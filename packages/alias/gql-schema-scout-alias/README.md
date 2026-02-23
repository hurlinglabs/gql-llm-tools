# gql-schema-scout

A CLI wrapper for `@hurling/gql-schema-scout` - Search GraphQL schemas with natural language

## CLI

```bash
npx gql-schema-scout [options] [query]
```

### Options

- `-m, --minScore <number>` - Minimum relevance score (default: 0)
- `-r, --maxResults <number>` - Maximum number of types to return
- `-s, --schema <path>` - Path to GraphQL schema file or URL (default: GitHub schema)
- `--splitCamelCase` - Split camelCase words into tokens
- `--noExpandRefs` - Don't expand type references
- `--noRootTypes` - Don't include root types (Query, Mutation, Subscription)
- `--noComments` - Don't search within field/type descriptions
- `--output <type>` - Output format: sdl|minified (default: sdl)

### Example

```bash
npx gql-schema-scout --schema https://docs.github.com/public/fpt/schema.docs.graphql "issue"
```
