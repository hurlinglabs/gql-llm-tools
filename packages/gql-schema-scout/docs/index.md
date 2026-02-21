# GraphQL Schema Scout - Documentation

`@hurling/gql-schema-scout` helps you build LLM-powered GraphQL applications by enabling intelligent, context-aware schema retrieval. Given a natural language query, it returns the relevant GraphQL types - perfect for AI agents that need to understand your schema.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Examples](#examples)
  - [Basic Usage](#basic-usage)
  - [Pre-built Lookups](#pre-built-lookups)
  - [From Introspection](#from-introspection)
  - [LLM Integration](#llm-integration)
- [API Reference](#api-reference)
- [Performance Tips](#performance-tips)

---

## Installation

```bash
npm install @hurling/gql-schema-scout
```

Requirements:

- Node.js 18+
- TypeScript 5.0+ (if using TypeScript)

---

## Quick Start

```typescript
import { GQLSchemaScout } from "@hurling/gql-schema-scout";

const sdl = `
type Query {
user(id: ID!): User
users(limit: Int): [User!]!
posts(authorId: ID): [Post!]!
}

type Mutation {
createUser(input: CreateUserInput!): User!
createPost(input: CreatePostInput!): Post!
}

type User {
id: ID!
name: String!
email: String!
posts: [Post!]!
}

type Post {
id: ID!
title: String!
content: String!
author: User!
}

input CreateUserInput {
name: String!
email: String!
}

input CreatePostInput {
title: String!
content: String!
authorId: ID!
}
`;

const scout = GQLSchemaScout.fromSDL(sdl);

// Query the schema with natural language
const context = scout.retrieveContext("create a new user");
console.log(context);
// Output:
// ## Type: Mutation (Object)
// Fields:
// - createUser(input: CreateUserInput!): User!
// - createPost(input: CreatePostInput!): Post!
// References: User, Post
//
// ## Type: Post (Object)
// Fields:
// - id: ID!
// - title: String!
// - content: String!
// - author: User!
// References: User
//
// ## Type: Query (Object)
// Fields:
// - user(id: ID!): User
// - users(limit: Int): [User!]!
// - posts(authorId: ID): [Post!]!
// References: User, Post
//
// ## Type: User (Object)
// Fields:
// - id: ID!
// - name: String!
// - email: String!
// - posts: [Post!]!
// References: Post

````

**Output:**

```markdown
## Type: Mutation (Object)

Fields:

- createUser(input: CreateUserInput!): User!
- createPost(input: CreatePostInput!): Post!

## Type: CreateUserInput (Input)

Fields:

- name: String!
- email: String!

## Type: Query (Object)

Fields:

- user(id: ID!): User
- users(limit: Int): [User!]!
- posts(authorId: ID): [Post!]!
````

---

## How It Works

### 1. Tokenization

The library breaks down your query into searchable tokens:

```typescript
import { tokenize, singularize } from "@hurling/gql-schema-scout";

tokenize("createNewUser");
// Returns: ["create", "new", "user", "createnewuser"]

tokenize("blog_posts");
// Returns: ["blog", "posts", "post"]
```

### 2. Symbol Matching

Each token is matched against a symbol index that maps words to type names:

- Type names are tokenized and indexed
- Field names are indexed under their parent types
- Singular/plural forms are both indexed

### 3. Type Expansion

Once matching types are found, the library automatically expands to include:

- Referenced types (types used in fields)
- Query and Mutation root types (always included)

---

## Examples

### Basic Usage

```typescript
import { GQLSchemaScout } from "@hurling/gql-schema-scout";

const schema = `
  type Query {
    products(category: String): [Product!]!
    product(id: ID!): Product
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
    category: Category!
  }

  type Category {
    id: ID!
    name: String!
    products: [Product!]!
  }
`;

const scout = GQLSchemaScout.fromSDL(schema);

// Get context for "products"
console.log(scout.retrieveContext("products"));
// Output:
// ## Type: Category (Object)
// Fields:
// - id: ID!
// - name: String!
// - products: [Product!]!
// References: Product
//
// ## Type: Product (Object)
// Fields:
// - id: ID!
// - name: String!
// - price: Float!
// - category: Category!
// References: Category
//
// ## Type: Query (Object)
// Fields:
// - products(category: String): [Product!]!
// - product(id: ID!): Product
// References: Product

// Get context for "price"
console.log(scout.retrieveContext("price"));
// Output:
// ## Type: Category (Object)
// Fields:
// - id: ID!
// - name: String!
// - products: [Product!]!
// References: Product
//
// ## Type: Product (Object)
// Fields:
// - id: ID!
// - name: String!
// - price: Float!
// - category: Category!
// References: Category
//
// ## Type: Query (Object)
// Fields:
// - products(category: String): [Product!]!
// - product(id: ID!): Product
// References: Product
```

### Pre-built Lookups

For production use, pre-compute lookups to avoid parsing the schema on every request:

**Step 1: Build and save (run once, e.g., at build time)**

```typescript
import { buildLookupsFromSDL, saveLookups } from "@hurling/gql-schema-scout";
import { readFileSync } from "node:fs";

const sdl = readFileSync("./schema.graphql", "utf-8");
const lookups = buildLookupsFromSDL(sdl);

saveLookups({
  lookups,
  filePath: "./data/schema-lookups.json",
});

console.log("Lookups saved!");
```

**Step 2: Load at runtime**

```typescript
import { loadLookups, GQLSchemaScout } from "@hurling/gql-schema-scout";

const lookups = loadLookups({
  filePath: "./data/schema-lookups.json",
});

const scout = GQLSchemaScout.fromLookups(lookups);

// Fast initialization - no parsing needed
const context = scout.retrieveContext("find products");
```

### From Introspection

If you only have access to the introspection result (not SDL):

```typescript
import { GQLSchemaScout } from "@hurling/gql-schema-scout";

// Fetch introspection from your GraphQL endpoint
async function getSchema() {
  const response = await fetch("https://api.example.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            types {
              kind
              name
              fields {
                name
                args {
                  name
                  type { kind name ofType { name kind } }
                }
                type { kind name ofType { name kind } }
              }
              inputFields {
                name
                type { kind name ofType { name kind } }
              }
              enumValues { name }
              possibleTypes { name }
            }
          }
        }
      `,
    }),
  });

  const result = await response.json();
  return result.data;
}

const introspection = await getSchema();
const scout = GQLSchemaScout.fromIntrospection(introspection);
```

### LLM Integration

This library shines in AI applications. Here's how to integrate:

```typescript
import { GQLSchemaScout } from "@hurling/gql-schema-scout";

const scout = GQLSchemaScout.fromSDL(yourSchema);

// In your AI handler:
async function handleUserMessage(userMessage: string) {
  // 1. Get relevant schema context
  const schemaContext = scout.retrieveContext(userMessage);

  // 2. Build prompt with context
  const systemPrompt = `
You are a GraphQL API assistant. Use the following schema context to help users.

Schema:
${schemaContext}

Rules:
- Only use fields and types shown above
- Return valid GraphQL queries
- Explain what each field does
  `.trim();

  // 3. Send to LLM
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}

// Example: User asks "how do I fetch all products?"
// The library returns Product, Query, and Category types
// LLM can now generate: query { products { id name price } }
```

### Generating Function Definitions

Use with function calling APIs:

```typescript
const functions = [
  {
    name: "query_schema",
    description: "Query the GraphQL schema for types and fields",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What you're looking for (e.g., 'user', 'create post')",
        },
      },
      required: ["query"],
    },
  },
];

// When calling the function:
const result = scout.retrieveContext(query);

// Format for the LLM:
const functionResponse = {
  content: JSON.stringify({
    types: result,
    tip: "Use these types to construct your GraphQL query",
  }),
};
```

---

## API Reference

### Class

#### `GQLSchemaScout`

Main scout class with fluent static factory methods.

```typescript
// From SDL string
const scout = GQLSchemaScout.fromSDL(sdl);

// From introspection result
const scout = GQLSchemaScout.fromIntrospection(introspection);

// From pre-built lookups
const scout = GQLSchemaScout.fromLookups(lookups);
```

**Instance Methods:**

| Method                           | Returns         | Description                                           |
| -------------------------------- | --------------- | ----------------------------------------------------- |
| `retrieveContext(input: string)` | `string`        | Get relevant schema types as formatted string         |
| `getTypeIndex()`                 | `TypeIndex`     | Raw Map of type names to TypeNodes                    |
| `getSymbolIndex()`               | `SymbolIndex`   | Raw Map of tokens to type names                       |
| `getSDL()`                       | `string`        | Original SDL (only available if created with fromSDL) |
| `getLookups()`                   | `SchemaLookups` | Serializable lookups object                           |

### Functions

#### Build Functions

```typescript
// From SDL string
buildLookupsFromSDL(sdl: string): SchemaLookups

// From introspection result
buildLookupsFromIntrospection(introspection: IntrospectionQuery): SchemaLookups
```

#### Serialization Functions

```typescript
// Convert to JSON string
serializeLookups(lookups: SchemaLookups): string

// Parse from JSON string
deserializeLookups(data: string): SchemaLookups

// Save to file
saveLookups({ lookups, filePath }): void

// Load from file
loadLookups({ filePath }): SchemaLookups
```

#### Utility Functions

```typescript
// Tokenize a string for searching
tokenize(name: string): string[]

// Convert plural to singular
singularize(word: string): string
```

### Types

```typescript
type TypeKind = "Object" | "Input" | "Enum" | "Interface" | "Union";

type ArgNode = {
  name: string;
  type: string;
  required: boolean;
};

type FieldNode = {
  name: string;
  returnType: string;
  args: ArgNode[];
};

type TypeNode = {
  name: string;
  kind: TypeKind;
  fields?: FieldNode[];
  interfaces?: string[];
  referencedTypes: string[];
};

type SchemaLookups = {
  typeIndex: SerializedTypeIndex;
  symbolIndex: SerializedSymbolIndex;
  queryTypeName: string | null;
  mutationTypeName: string | null;
};
```

---

## Performance Tips

1. **Pre-build lookups**: For production, build lookups once and save to disk
2. **Use `fromLookups()`**: Avoids re-parsing the schema
3. **Cache the scout instance**: Don't create new instances per request
4. **Lazy load**: Load lookups only when needed

```typescript
// Good: Single instance, reused
const scout = GQLSchemaScout.fromSDL(sdl);
app.get("/api/chat", (req, res) => {
  const context = scout.retrieveContext(req.body.message);
  // ...
});

// Bad: New instance each request
app.get("/api/chat", (req, res) => {
  const scout = GQLSchemaScout.fromSDL(req.body.schema);
  // ...
});
```
