# GQL LLM Tools

Tools to help LLMs and agents work with GraphQL schemas and GraphQL backends.

## Packages

### `@gql-schema-scout`

A tool that will return a subset of a GraphQL schema/introspection based of a query. This helps LLMs understand the structure of GraphQL APIs without bloating there context hugely with large GQL Schemas.

### Shared Configurations

- `@hurlinglabs/config-eslint` - ESLint configurations
- `@hurlinglabs/config-typescript` - TypeScript configurations
- `@hurlinglabs/jest-presets` - Jest presets

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm check-types
```

## Development

This is a Turborepo monorepo using pnpm as the package manager.

## Roadmap

### Phase 1: Schema Intelligence

**@hurling/gql-schema-scout** (In Progress)

- Library to context-efficiently explore GraphQL schemas for LLMs
- Reduces context bloat by returning relevant schema subsets based on queries

**On the Roadmap:**

- **MCP Version** - Model Context Protocol server for gql-schema-scout
- **@hurling/tanstack-ai** - TanStack AI integration for GraphQL schema-aware AI agents

### Phase 2: Query Generation

Future libraries that build on top of the schema intelligence:

- **Plain text to GraphQL query generator** - Library/MCP/Tools to convert natural language to GraphQL queries
- Additional tools for agentic GraphQL workflows
