#!/usr/bin/env node

import { GQLSchemaScout } from "../dist/es/index.js";
import { readFileSync } from "node:fs";
import readline from "node:readline";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

async function main() {
  const DEFAULT_SCHEMA =
    "https://docs.github.com/public/fpt/schema.docs.graphql";

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
  let QUERY = null;

  if (args[0]) {
    // Check if args[0] looks like a file path (contains / or ends with .graphql)
    if (
      args[0].includes("/") ||
      args[0].endsWith(".graphql") ||
      args[0].endsWith(".gql")
    ) {
      SCHEMA_PATH = args[0];
      QUERY = args.slice(1).join(" ") || null;
    } else {
      // Treat as query
      QUERY = args.join(" ");
    }
  }

  // Prompt for query if not provided
  if (!QUERY) {
    console.log(
      "\nEnter your search query (e.g., 'issues', 'pull requests', 'repository', 'workflow'):",
    );
    QUERY = await ask("> ");
    if (!QUERY.trim()) {
      console.log("No query provided, exiting.");
      process.exit(0);
    }
  }

  console.log(
    `Options: minScore=${options.minScore}, maxResults=${options.maxResults}, splitCamelCase=${options.splitCamelCase}\n`,
  );

  console.log(`Loading schema from: ${SCHEMA_PATH}\n`);

  let sdl;
  if (SCHEMA_PATH.startsWith("http://") || SCHEMA_PATH.startsWith("https://")) {
    console.log(`Fetching schema from URL: ${SCHEMA_PATH}\n`);
    const response = await fetch(SCHEMA_PATH);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch schema: ${response.status} ${response.statusText}`,
      );
    }
    sdl = await response.text();
  } else {
    sdl = readFileSync(SCHEMA_PATH, "utf-8");
  }

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
}

main().catch(console.error);
