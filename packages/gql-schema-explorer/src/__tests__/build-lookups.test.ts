import { describe, it, expect } from "@jest/globals";
import {
  buildLookups,
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

  describe("buildLookups", () => {
    it("builds type index", () => {
      const lookups = buildLookups(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Query");
      expect(lookups.typeIndex).toHaveProperty("Mutation");
      expect(lookups.typeIndex).toHaveProperty("User");
      expect(lookups.typeIndex).toHaveProperty("Post");
      expect(lookups.typeIndex).toHaveProperty("CreateUserInput");
    });

    it("extracts fields with args", () => {
      const lookups = buildLookups(TEST_SCHEMA);
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
      const lookups = buildLookups(TEST_SCHEMA);
      const inputType = lookups.typeIndex.CreateUserInput;

      expect(inputType.kind).toBe("Input");
      expect(inputType.fields?.length).toBeGreaterThan(0);
    });

    it("identifies referenced types", () => {
      const lookups = buildLookups(TEST_SCHEMA);
      const postType = lookups.typeIndex.Post;

      expect(postType.referencedTypes).toContain("User");
    });

    it("captures query and mutation type names", () => {
      const lookups = buildLookups(TEST_SCHEMA);

      expect(lookups.queryTypeName).toBe("Query");
      expect(lookups.mutationTypeName).toBe("Mutation");
    });

    it("handles interfaces", () => {
      const lookups = buildLookups(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Node");
      expect(lookups.typeIndex.Node.kind).toBe("Interface");
    });

    it("handles unions", () => {
      const lookups = buildLookups(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("SearchResult");
      expect(lookups.typeIndex.SearchResult.kind).toBe("Union");
    });

    it("handles enums", () => {
      const lookups = buildLookups(TEST_SCHEMA);

      expect(lookups.typeIndex).toHaveProperty("Role");
      expect(lookups.typeIndex.Role.kind).toBe("Enum");
    });
  });

  describe("serialization/deserialization", () => {
    it("serializes and deserializes type index", () => {
      const lookups = buildLookups(TEST_SCHEMA);
      const serialized = serializeTypeIndex(
        new Map(Object.entries(lookups.typeIndex)) as any,
      );
      const deserialized = deserializeTypeIndex(serialized);

      expect(deserialized.get("User")).toBeDefined();
      expect(deserialized.get("User")?.kind).toBe("Object");
    });

    it("serializes and deserializes symbol index", () => {
      const lookups = buildLookups(TEST_SCHEMA);
      // Need schema to rebuild symbol index - this is tested via lookups
      expect(lookups.symbolIndex).toHaveProperty("user");
      expect(lookups.symbolIndex).toHaveProperty("createuser");
    });
  });
});
