import { describe, it, expect } from "@jest/globals";
import { GQLSchemaScout, buildLookupsFromSDL } from "..";

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

describe("GQLSchemaScout", () => {
  describe("fromSDL", () => {
    it("parses SDL and builds indices", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);

      const typeIndex = scout.getTypeIndex();
      expect(typeIndex.size).toBeGreaterThan(0);
    });
  });

  describe("retrieveContext", () => {
    it("retrieves User type when querying user", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const context = scout.retrieveContext("user");

      expect(context).toContain("## Type: User");
    });

    it("retrieves Post type when querying posts", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const context = scout.retrieveContext("posts");

      expect(context).toContain("## Type: Post");
    });

    it("includes Query and Mutation types", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const context = scout.retrieveContext("anything");

      expect(context).toContain("Query");
      expect(context).toContain("Mutation");
    });

    it("expands to referenced types", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const context = scout.retrieveContext("posts");

      expect(context).toContain("User");
    });

    it("retrieves input types when querying mutations", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const context = scout.retrieveContext("create user");

      expect(context).toContain("CreateUserInput");
    });
  });

  describe("getSDL", () => {
    it("returns the original SDL", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      expect(scout.getSDL()).toBe(TEST_SCHEMA);
    });
  });

  describe("getLookups", () => {
    it("returns serializable lookups", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const lookups = scout.getLookups();

      expect(lookups.typeIndex).toBeDefined();
      expect(lookups.symbolIndex).toBeDefined();
      expect(lookups.queryTypeName).toBe("Query");
      expect(lookups.mutationTypeName).toBe("Mutation");
    });
  });

  describe("fromLookups", () => {
    it("loads from pre-built lookups", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const scout = GQLSchemaScout.fromLookups(lookups);

      const typeIndex = scout.getTypeIndex();
      expect(typeIndex.size).toBeGreaterThan(0);
    });

    it("retrieveContext works with pre-built lookups", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const scout = GQLSchemaScout.fromLookups(lookups);
      const context = scout.retrieveContext("user");

      expect(context).toContain("## Type: User");
    });

    it("getLookups returns original lookups", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const scout = GQLSchemaScout.fromLookups(lookups);
      const retrievedLookups = scout.getLookups();

      expect(retrievedLookups.queryTypeName).toBe("Query");
    });
  });
});
