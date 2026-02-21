#!/usr/bin/env node

import { GQLSchemaScout } from "../packages/gql-schema-scout/dist/cjs/index.cjs";
import { readFileSync } from "node:fs";

const DEFAULT_SCHEMA =
  "/Users/bet000005/.local/share/opencode/worktree/628e186c07e1792fd77ec53983a91587cc5c95a4/playful-knight/packages/gql/bos/generated/schema.graphql";
const DEFAULT_QUERY = "Bets";

// Parse options from command line FIRST
// Options: --minScore=N --maxResults=N --splitCamelCase --noExpandRefs --noRootTypes

const options = {
  minScore: 0,
  maxResults: undefined,
  splitCamelCase: false,
  includeRootTypes: true,
  expandReferences: true,
};

// Filter out options from args
const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--minScore=")) {
    options.minScore = parseInt(arg.split("=")[1], 10);
  }
  if (arg.startsWith("--maxResults=")) {
    options.maxResults = parseInt(arg.split("=")[1], 10);
  }
  if (arg.includes("--splitCamelCase")) {
    options.splitCamelCase = true;
  }
  if (arg.includes("--noExpandRefs")) {
    options.expandReferences = false;
  }
  if (arg.includes("--noRootTypes")) {
    options.includeRootTypes = false;
  }
}

// Handle remaining arguments for schema path and query
let SCHEMA_PATH = DEFAULT_SCHEMA;
let QUERY = DEFAULT_QUERY;

if (args[0]) {
  // Check if args[0] looks like a file path (contains / or ends with .graphql)
  if (
    args[0].includes("/") ||
    args[0].endsWith(".graphql") ||
    args[0].endsWith(".gql")
  ) {
    SCHEMA_PATH = args[0];
    QUERY = args.slice(1).join(" ") || DEFAULT_QUERY;
  } else {
    // Treat as query
    QUERY = args.join(" ");
  }
}

console.log(
  `Options: minScore=${options.minScore}, maxResults=${options.maxResults}, splitCamelCase=${options.splitCamelCase}\n`,
);

console.log(`Loading schema from: ${SCHEMA_PATH}\n`);

const sdl = readFileSync(SCHEMA_PATH, "utf-8");

console.log(
  `Original SDL: ${sdl.split("\n").length} lines, ${sdl.length} chars\n`,
);

const scout = GQLSchemaScout.fromSDL(sdl);

console.log(`Query: "${QUERY}"\n`);
console.log("=".repeat(50) + "\n");

const result = scout.retrieveRelevantSchema(QUERY, options);

console.log("--- asSDLString() ---\n");
const sdlOutput = result.asSDLString();
console.log(sdlOutput);

console.log("\n--- asMinified() ---\n");
const minifiedOutput = result.asMinified();
// console.log(minifiedOutput);

console.log("\n" + "=".repeat(50));
console.log("\nSUMMARY:");
const sdlPercent = ((sdlOutput.length / sdl.length) * 100).toFixed(1);
const minPercent = ((minifiedOutput.length / sdl.length) * 100).toFixed(1);
console.log(`  Original SDL:    ${sdl.length.toLocaleString()} chars`);
console.log(
  `  asSDLString():   ${sdlOutput.length.toLocaleString()} chars (${sdlPercent}% of original)`,
);
console.log(
  `  asMinified():    ${minifiedOutput.length.toLocaleString()} chars (${minPercent}% of original)`,
);
