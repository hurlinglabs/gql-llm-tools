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
