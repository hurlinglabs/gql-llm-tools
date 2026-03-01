import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { exec } from "child_process";
import { promisify } from "node:util";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execAsync = promisify(exec);

const CLI_PATH = join(__dirname, "../../dist/es/cli.js");
const TEST_SCHEMA_URL =
  "https://docs.github.com/public/fpt/schema.docs.graphql";

describe("CLI", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "gql-scout-cli-"));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const runCli = async (
    args: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    try {
      const { stdout, stderr } = await execAsync(`node ${CLI_PATH} ${args}`, {
        timeout: 60000,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        exitCode: error.code || 1,
      };
    }
  };

  describe("basic functionality", () => {
    it("shows help with --help", async () => {
      const result = await runCli("--help");
      expect(result.stdout).toContain("gql-schema-scout");
      expect(result.stdout).toContain("--schema");
      expect(result.stdout).toContain("--expandRefs");
      expect(result.stdout).toContain("--skipRootTypes");
    });

    it("shows version with --version", async () => {
      const result = await runCli("--version");
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("errors when query is missing", async () => {
      const result = await runCli(`--schema ${TEST_SCHEMA_URL}`);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Query is required");
    });

    it("errors when schema is missing", async () => {
      const result = await runCli('"issue"');
      expect(result.exitCode).toBe(1);
    });
  });

  describe("options", () => {
    it("accepts --minScore", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --minScore 0.5`,
      );
      expect(result.stdout).toContain("minScore=0.5");
    });

    it("accepts --maxResults", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --maxResults 3`,
      );
      expect(result.stdout).toContain("maxResults=3");
    });

    it("accepts --splitCamelCase", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "createIssue" --splitCamelCase`,
      );
      expect(result.stdout).toContain("splitCamelCase=true");
    });

    it("accepts --expandRefs", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --expandRefs`,
      );
      expect(result.stdout).toContain("expandRefs=true");
    });

    it("accepts --skipRootTypes", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --skipRootTypes`,
      );
      expect(result.stdout).toContain("skipRootTypes=true");
    });

    it("accepts --noComments", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --noComments`,
      );
      expect(result.stdout).toContain("searchComments=false");
    });

    it("accepts --output minified", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --output minified`,
      );
      // Minified output should have semicolons and no newlines in SDL portion
      // (has "};" pattern instead of "}\n")
      expect(result.stdout).toContain("};");
    });

    it("accepts --output sdl (default)", async () => {
      const result = await runCli(
        `--schema ${TEST_SCHEMA_URL} "issue" --output sdl`,
      );
      expect(result.stdout).toContain("type ");
    });
  });

  describe("with local schema file", () => {
    let schemaPath: string;

    beforeAll(() => {
      const schemaContent = `
        type Query {
          user(id: ID!): User
          users(limit: Int): [User!]!
        }

        type User {
          id: ID!
          name: String!
          email: String!
        }
      `;
      schemaPath = join(tempDir, "test-schema.graphql");
      writeFileSync(schemaPath, schemaContent);
    });

    it("loads schema from local file", async () => {
      const result = await runCli(`--schema ${schemaPath} "user"`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("type Query");
      expect(result.stdout).toContain("type User");
    });

    it("applies --skipRootTypes to local schema", async () => {
      const result = await runCli(
        `--schema ${schemaPath} "email" --skipRootTypes`,
      );
      expect(result.stdout).not.toContain("type Query");
      expect(result.stdout).toContain("type User");
    });

    it("applies --expandRefs to local schema", async () => {
      const result = await runCli(`--schema ${schemaPath} "user" --expandRefs`);
      expect(result.stdout).toContain("type User");
    });
  });

  describe("output validation", () => {
    let schemaPath: string;

    beforeAll(() => {
      const schemaContent = `
        type Query {
          user: User
        }

        type User {
          id: ID!
          name: String!
        }
      `;
      schemaPath = join(tempDir, "output-test-schema.graphql");
      writeFileSync(schemaPath, schemaContent);
    });

    it("outputs valid SDL by default", async () => {
      const result = await runCli(`--schema ${schemaPath} "user"`);
      expect(result.stdout).toContain("type Query");
      expect(result.stdout).toContain("type User");
      expect(result.stdout).toContain("@hurling/gql-schema-scout");
    });

    it("includes summary with size info", async () => {
      const result = await runCli(`--schema ${schemaPath} "user"`);
      expect(result.stdout).toContain("SUMMARY:");
      expect(result.stdout).toContain("% of original");
    });
  });
});
