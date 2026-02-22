#!/usr/bin/env node

import { Command } from "commander";
import { GQLSchemaScout } from "./index.js";
import { readFileSync } from "node:fs";

const program = new Command();

program
  .name("gql-scout")
  .description("Search GraphQL schemas with natural language")
  .version("0.0.0");

program
  .argument("[query]", "Natural language query to search the schema")
  .argument(
    "[schema]",
    "Path to GraphQL schema file or URL (default: GitHub schema)",
  )
  .option("-m, --minScore <number>", "Minimum relevance score", "0")
  .option("-r, --maxResults <number>", "Maximum number of types to return")
  .option("--splitCamelCase", "Split camelCase words into tokens")
  .option("--noExpandRefs", "Don't expand type references")
  .option(
    "--noRootTypes",
    "Don't include root types (Query, Mutation, Subscription)",
  )
  .option("--noComments", "Don't search within field/type descriptions")
  .option("--output <type>", "Output format: sdl|minified", "sdl")
  .action(async (query, schema, options) => {
    const SCHEMA_PATH =
      schema || "https://docs.github.com/public/fpt/schema.docs.graphql";

    if (!query) {
      console.error("Error: Query is required");
      console.error("Usage: gql-scout <query> [schema]");
      process.exit(1);
    }

    console.log(`Loading schema from: ${SCHEMA_PATH}\n`);

    let sdl;
    try {
      if (
        SCHEMA_PATH.startsWith("http://") ||
        SCHEMA_PATH.startsWith("https://")
      ) {
        const response = await fetch(SCHEMA_PATH);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`,
          );
        }
        sdl = await response.text();
      } else {
        sdl = readFileSync(SCHEMA_PATH, "utf-8");
      }
    } catch (err) {
      const error = err as Error;
      console.error(`Error loading schema: ${error.message}`);
      process.exit(1);
    }

    console.log(
      `Original SDL: ${sdl.split("\n").length} lines, ${sdl.length} chars\n`,
    );

    const scout = GQLSchemaScout.fromSDL(sdl);

    console.log(`Query: "${query}"`);
    console.log(
      `Options: minScore=${options.minScore}, maxResults=${options.maxResults || "unlimited"}, splitCamelCase=${options.splitCamelCase}, includeReferences=${options.expandRefs}, includeRootTypes=${options.rootTypes}, searchComments=${!options.noComments}`,
    );
    console.log("=".repeat(50) + "\n");

    const result = scout.retrieveRelevantSchema(query, {
      minScore: parseInt(options.minScore, 10),
      maxResults: options.maxResults
        ? parseInt(options.maxResults, 10)
        : undefined,
      splitCamelCase: options.splitCamelCase,
      includeRootTypes: options.rootTypes,
      includeReferences: options.expandRefs,
      searchWithinComments: !options.noComments,
    });

    const output =
      options.output === "minified"
        ? result.asMinified()
        : result.asSDLString();
    console.log(output);

    const pct = ((output.length / sdl.length) * 100).toFixed(1);
    const reduction = (100 - parseFloat(pct)).toFixed(1);

    console.log("\n" + "=".repeat(50));
    console.log(`\nSUMMARY: ${pct}% of original (${reduction}% reduction)`);
    console.log(`  Original: ${sdl.length.toLocaleString()} chars`);
    console.log(`  Output:   ${output.length.toLocaleString()} chars`);
  });

program.parse();
