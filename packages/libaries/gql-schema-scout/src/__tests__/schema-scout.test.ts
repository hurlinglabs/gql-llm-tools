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

  describe("retrieveRelevantSchema", () => {
    it("retrieves User type when querying user", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user");

      expect(result.asSDLString()).toContain("type User");
    });

    it("retrieves Post type when querying posts", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("posts");

      expect(result.asSDLString()).toContain("type Post");
    });

    it("includes Query and Mutation types when requested", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("anything", {
        skipRootTypes: false,
      });

      const sdl = result.asSDLString();
      expect(sdl).toContain("type Query");
      expect(sdl).toContain("type Mutation");
    });

    it("expands to referenced types", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("posts");

      expect(result.asSDLString()).toContain("User");
    });

    it("retrieves input types when querying mutations", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("create user", {
        skipRootTypes: false,
      });

      expect(result.asSDLString()).toContain("CreateUserInput");
    });

    it("filters by minScore - only exact matches", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user", {
        minScore: 100,
      });

      const sdl = result.asSDLString();
      // Should include User (exact match)
      expect(sdl).toContain("type User");
    });

    it("limits results with maxResults", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user post", {
        maxResults: 1,
        skipRootTypes: true,
      });

      // Should only have 1 primary type
      const typeNames = result.getTypeNames();
      expect(typeNames.size).toBe(1);
    });

    it("includes credit header in output", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user");

      const sdl = result.asSDLString();
      expect(sdl).toContain("@hurling/gql-schema-scout");
      expect(sdl).toContain("% of original");
    });

    it("returns minified output", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user");

      const minified = result.asMinified();
      // Should be a single line
      expect(minified.includes("\n")).toBe(false);
      expect(minified).toContain("@hurling/gql-schema-scout");
    });

    it("excludes referenced types when expandRefs is false", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("posts", {
        expandRefs: false,
        skipRootTypes: false,
      });

      const sdl = result.asSDLString();
      // Should NOT contain header about referenced types
      expect(sdl).not.toContain("referenced");
    });

    it("includes referenced types in output by default", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("posts", {
        skipRootTypes: false,
        expandRefs: true,
      });

      const sdl = result.asSDLString();
      // Should include User (referenced by Post)
      expect(sdl).toContain("type User");
    });

    it("filters root type fields when skipRootTypes is false", () => {
      const scout = GQLSchemaScout.fromSDL(TEST_SCHEMA);
      const result = scout.retrieveRelevantSchema("user", {
        skipRootTypes: false,
      });

      const sdl = result.asSDLString();
      // Should include Query
      expect(sdl).toContain("type Query");
      // Should only have user-related fields in Query
      expect(sdl).toContain("user(");
      // Should NOT have posts field since query was "user"
      expect(sdl).not.toContain("posts(");
    });

    it("can use splitCamelCase option", () => {
      // Create schema with camelCase type names
      const camelSchema = `
        type UserProfile {
          id: ID!
          profileData: String!
        }
        
        type Query {
          userProfile: UserProfile
        }
      `;
      const scout = GQLSchemaScout.fromSDL(camelSchema);

      // With splitCamelCase - should match profileData
      const result = scout.retrieveRelevantSchema("profileData", {
        splitCamelCase: true,
      });
      expect(result.asSDLString()).toContain("UserProfile");
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

    it("retrieveRelevantSchema works with pre-built lookups", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const scout = GQLSchemaScout.fromLookups(lookups);
      const result = scout.retrieveRelevantSchema("user");

      expect(result.asSDLString()).toContain("type User");
    });

    it("getLookups returns original lookups", () => {
      const lookups = buildLookupsFromSDL(TEST_SCHEMA);
      const scout = GQLSchemaScout.fromLookups(lookups);
      const retrievedLookups = scout.getLookups();

      expect(retrievedLookups.queryTypeName).toBe("Query");
    });
  });
});
