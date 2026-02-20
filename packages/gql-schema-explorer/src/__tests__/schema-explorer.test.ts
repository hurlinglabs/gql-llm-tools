import { describe, it, expect } from "@jest/globals";
import {
  GraphQLSchemaExplorer,
  GraphQLSchemaExplorerFromLookups,
  buildLookups,
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
`;

describe("GraphQLSchemaExplorer", () => {
  describe("constructor", () => {
    it("parses SDL and builds indices", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });

      const typeIndex = explorer.getTypeIndex();
      expect(typeIndex.size).toBeGreaterThan(0);
    });
  });

  describe("retrieveContext", () => {
    it("retrieves User type when querying user", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const context = explorer.retrieveContext("user");

      expect(context).toContain("## Type: User");
    });

    it("retrieves Post type when querying posts", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const context = explorer.retrieveContext("posts");

      expect(context).toContain("## Type: Post");
    });

    it("includes Query and Mutation types", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const context = explorer.retrieveContext("anything");

      expect(context).toContain("Query");
      expect(context).toContain("Mutation");
    });

    it("expands to referenced types", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const context = explorer.retrieveContext("posts");

      expect(context).toContain("User");
    });

    it("retrieves input types when querying mutations", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const context = explorer.retrieveContext("create user");

      expect(context).toContain("CreateUserInput");
    });
  });

  describe("getSDL", () => {
    it("returns the original SDL", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      expect(explorer.getSDL()).toBe(TEST_SCHEMA);
    });
  });

  describe("getLookups", () => {
    it("returns serializable lookups", () => {
      const explorer = new GraphQLSchemaExplorer({ sdl: TEST_SCHEMA });
      const lookups = explorer.getLookups();

      expect(lookups.typeIndex).toBeDefined();
      expect(lookups.symbolIndex).toBeDefined();
      expect(lookups.queryTypeName).toBe("Query");
      expect(lookups.mutationTypeName).toBe("Mutation");
    });
  });
});

describe("GraphQLSchemaExplorerFromLookups", () => {
  it("loads from pre-built lookups", () => {
    const lookups = buildLookups(TEST_SCHEMA);
    const explorer = new GraphQLSchemaExplorerFromLookups(lookups);

    const typeIndex = explorer.getTypeIndex();
    expect(typeIndex.size).toBeGreaterThan(0);
  });

  it("retrieveContext works with pre-built lookups", () => {
    const lookups = buildLookups(TEST_SCHEMA);
    const explorer = new GraphQLSchemaExplorerFromLookups(lookups);
    const context = explorer.retrieveContext("user");

    expect(context).toContain("## Type: User");
  });

  it("getLookups returns original lookups", () => {
    const lookups = buildLookups(TEST_SCHEMA);
    const explorer = new GraphQLSchemaExplorerFromLookups(lookups);
    const retrievedLookups = explorer.getLookups();

    expect(retrievedLookups.queryTypeName).toBe("Query");
  });
});
