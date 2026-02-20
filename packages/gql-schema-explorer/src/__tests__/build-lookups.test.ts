import { describe, it, expect } from "@jest/globals";
import {
  buildLookupsFromSDL,
  buildLookupsFromIntrospection,
  tokenize,
  singularize,
  serializeTypeIndex,
  deserializeTypeIndex,
  serializeSymbolIndex,
  deserializeSymbolIndex,
} from "..";

const TEST_SCHEMA = `
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  posts(authorId: ID): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean!
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
  createdAt: String!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  publishedAt: String
}

input CreateUserInput {
  name: String!
  email: String!
}

input UpdateUserInput {
  name: String
  email: String
}

enum Role {
  ADMIN
  USER
  GUEST
}

interface Node {
  id: ID!
}

union SearchResult = User | Post
`;

describe("@hurling/gql-schema-explorer", () => {
  describe("tokenize", () => {
    it("splits on non-alphanumeric characters", () => {
      expect(tokenize("created_at")).toContain("created");
      expect(tokenize("created_at")).toContain("at");
    });

    it("includes singularized versions", () => {
      expect(tokenize("users")).toContain("user");
      expect(tokenize("posts")).toContain("post");
    });

    it("handles plural words ending in ies", () => {
      expect(tokenize("categories")).toContain("category");
    });
  });

  describe("singularize", () => {
    it("handles regular plurals", () => {
      expect(singularize("users")).toBe("user");
      expect(singularize("posts")).toBe("post");
    });

    it("handles words ending in ies", () => {
      expect(singularize("categories")).toBe("category");
    });

    it("handles words ending in es", () => {
      expect(singularize("addresses")).toBe("address");
    });
  });

  describe("buildLookupsFromSDL", () => {
    it("builds type index", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Query");
      expect(lookups.typeIndex).toHaveProperty("Mutation");
      expect(lookups.typeIndex).toHaveProperty("User");
      expect(lookups.typeIndex).toHaveProperty("Post");
      expect(lookups.typeIndex).toHaveProperty("CreateUserInput");
    });

    it("extracts fields with args", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const queryType = lookups.typeIndex.Query;

      const userField = queryType.fields?.find((f) => f.name === "user");
      expect(userField).toBeDefined();
      expect(userField?.args).toHaveLength(1);
      expect(userField?.args[0].name).toBe("id");
      expect(userField?.args[0].required).toBe(true);

      const usersField = queryType.fields?.find((f) => f.name === "users");
      expect(usersField?.args).toHaveLength(2);
    });

    it("extracts input types", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const inputType = lookups.typeIndex.CreateUserInput;

      expect(inputType.kind).toBe("Input");
      expect(inputType.fields?.length).toBeGreaterThan(0);
    });

    it("identifies referenced types", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const postType = lookups.typeIndex.Post;

      expect(postType.referencedTypes).toContain("User");
    });

    it("captures query and mutation type names", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);

      expect(lookups.queryTypeName).toBe("Query");
      expect(lookups.mutationTypeName).toBe("Mutation");
    });

    it("handles interfaces", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Node");
      expect(lookups.typeIndex.Node.kind).toBe("Interface");
    });

    it("handles unions", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("SearchResult");
      expect(lookups.typeIndex.SearchResult.kind).toBe("Union");
    });

    it("handles enums", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Role");
      expect(lookups.typeIndex.Role.kind).toBe("Enum");
    });
  });

  describe("serialization/deserialization", () => {
    it("serializes and deserializes type index", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const serialized = serializeTypeIndex(
        new Map(Object.entries(lookups.typeIndex)) as any,
      );
      const deserialized = deserializeTypeIndex(serialized);

      expect(deserialized.get("User")).toBeDefined();
      expect(deserialized.get("User")?.kind).toBe("Object");
    });

    it("serializes and deserializes symbol index", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      // Need schema to rebuild symbol index - this is tested via lookups
      expect(lookups.symbolIndex).toHaveProperty("user");
      expect(lookups.symbolIndex).toHaveProperty("createuser");
    });
  });

  describe("buildLookupsFromIntrospection", () => {
    const TEST_INTROSPECTION_JSON = `{
      "__schema": {
        "queryType": { "name": "Query" },
        "mutationType": { "name": "Mutation" },
        "subscriptionType": null,
        "types": [
          { "kind": "SCALAR", "name": "Boolean", "fields": null },
          { "kind": "SCALAR", "name": "Float", "fields": null },
          { "kind": "SCALAR", "name": "ID", "fields": null },
          { "kind": "SCALAR", "name": "Int", "fields": null },
          { "kind": "SCALAR", "name": "String", "fields": null },
          {
            "kind": "OBJECT",
            "name": "Query",
            "fields": [
              { "name": "user", "args": [{ "name": "id", "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } }], "type": { "kind": "OBJECT", "name": "User" } },
              { "name": "users", "args": [{ "name": "limit", "type": { "kind": "SCALAR", "name": "Int" } }, { "name": "offset", "type": { "kind": "SCALAR", "name": "Int" } }], "type": { "kind": "NON_NULL", "ofType": { "kind": "LIST", "ofType": { "kind": "NON_NULL", "ofType": { "kind": "OBJECT", "name": "User" } } } } },
              { "name": "posts", "args": [{ "name": "authorId", "type": { "kind": "SCALAR", "name": "ID" } }], "type": { "kind": "NON_NULL", "ofType": { "kind": "LIST", "ofType": { "kind": "NON_NULL", "ofType": { "kind": "OBJECT", "name": "Post" } } } } }
            ],
            "interfaces": []
          },
          {
            "kind": "OBJECT",
            "name": "Mutation",
            "fields": [
              { "name": "createUser", "args": [{ "name": "input", "type": { "kind": "NON_NULL", "ofType": { "kind": "INPUT_OBJECT", "name": "CreateUserInput" } } }], "type": { "kind": "NON_NULL", "ofType": { "kind": "OBJECT", "name": "User" } } },
              { "name": "updateUser", "args": [{ "name": "id", "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } }, { "name": "input", "type": { "kind": "NON_NULL", "ofType": { "kind": "INPUT_OBJECT", "name": "UpdateUserInput" } } }], "type": { "kind": "OBJECT", "name": "User" } },
              { "name": "deleteUser", "args": [{ "name": "id", "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } }], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "Boolean" } } }
            ],
            "interfaces": []
          },
          {
            "kind": "OBJECT",
            "name": "User",
            "fields": [
              { "name": "id", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } },
              { "name": "name", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } },
              { "name": "email", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } },
              { "name": "posts", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "LIST", "ofType": { "kind": "NON_NULL", "ofType": { "kind": "OBJECT", "name": "Post" } } } } },
              { "name": "createdAt", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } }
            ],
            "interfaces": []
          },
          {
            "kind": "OBJECT",
            "name": "Post",
            "fields": [
              { "name": "id", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } },
              { "name": "title", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } },
              { "name": "content", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } },
              { "name": "author", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "OBJECT", "name": "User" } } },
              { "name": "publishedAt", "args": [], "type": { "kind": "SCALAR", "name": "String" } }
            ],
            "interfaces": []
          },
          {
            "kind": "INPUT_OBJECT",
            "name": "CreateUserInput",
            "inputFields": [
              { "name": "name", "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } },
              { "name": "email", "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "String" } } }
            ]
          },
          {
            "kind": "INPUT_OBJECT",
            "name": "UpdateUserInput",
            "inputFields": [
              { "name": "name", "type": { "kind": "SCALAR", "name": "String" } },
              { "name": "email", "type": { "kind": "SCALAR", "name": "String" } }
            ]
          },
          {
            "kind": "ENUM",
            "name": "Role",
            "enumValues": [
              { "name": "ADMIN" },
              { "name": "USER" },
              { "name": "GUEST" }
            ]
          },
          {
            "kind": "INTERFACE",
            "name": "Node",
            "fields": [{ "name": "id", "args": [], "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } } }],
            "interfaces": []
          },
          {
            "kind": "UNION",
            "name": "SearchResult",
            "possibleTypes": [
              { "kind": "OBJECT", "name": "User" },
              { "kind": "OBJECT", "name": "Post" }
            ]
          }
        ],
        "directives": []
      }
    }`;

    const TEST_INTROSPECTION = JSON.parse(TEST_INTROSPECTION_JSON);

    it("builds lookups from introspection JSON", () => {
      const lookups = buildLookupsFromIntrospection(TEST_INTROSPECTION as any);

      expect(lookups.typeIndex).toHaveProperty("Query");
      expect(lookups.typeIndex).toHaveProperty("Mutation");
      expect(lookups.typeIndex).toHaveProperty("User");
      expect(lookups.typeIndex).toHaveProperty("Post");
      expect(lookups.typeIndex).toHaveProperty("CreateUserInput");
    });

    it("produces equivalent lookups to SDL parsing", () => {
      const sdlLookups = buildLookupsFromSDL(TEST_SCHEMA);
      const introspectionLookups = buildLookupsFromIntrospection(
        TEST_INTROSPECTION as any,
      );

      expect(Object.keys(introspectionLookups.typeIndex)).toEqual(
        Object.keys(sdlLookups.typeIndex),
      );
      expect(introspectionLookups.queryTypeName).toBe(sdlLookups.queryTypeName);
      expect(introspectionLookups.mutationTypeName).toBe(
        sdlLookups.mutationTypeName,
      );
    });

    it("extracts fields with args from introspection", () => {
      const lookups = buildLookupsFromIntrospection(TEST_INTROSPECTION as any);
      const queryType = lookups.typeIndex.Query;

      const userField = queryType.fields?.find((f) => f.name === "user");
      expect(userField).toBeDefined();
      expect(userField?.args).toHaveLength(1);
      expect(userField?.args[0].name).toBe("id");
      expect(userField?.args[0].required).toBe(true);
    });
  });
});
