import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SchemaLookups } from "./types";

const SCHEMA_VERSION = 1;

export interface SerializedSchemaLookups {
  version: number;
  data: SchemaLookups;
}

export function serializeLookups(lookups: SchemaLookups): string {
  const serialized: SerializedSchemaLookups = {
    version: SCHEMA_VERSION,
    data: lookups,
  };
  return JSON.stringify(serialized, null, 2);
}

export function deserializeLookups(data: string): SchemaLookups {
  const parsed = JSON.parse(data) as SerializedSchemaLookups;

  if (!parsed.version) {
    throw new Error(
      "Invalid lookups file: missing version. Please regenerate from GraphQL schema.",
    );
  }

  if (parsed.version !== SCHEMA_VERSION) {
    throw new Error(
      `Incompatible lookups version: ${parsed.version}. Expected ${SCHEMA_VERSION}. Please regenerate from GraphQL schema.`,
    );
  }

  return parsed.data;
}

export interface SaveLookupsOptions {
  lookups: SchemaLookups;
  filePath: string;
}

export function saveLookups(options: SaveLookupsOptions): void {
  const data = serializeLookups(options.lookups);

  const dir = dirname(options.filePath);
  if (dir) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(options.filePath, data, "utf-8");
}

export interface LoadLookupsOptions {
  filePath: string;
}

export function loadLookups(options: LoadLookupsOptions): SchemaLookups {
  const exists = existsSync(options.filePath);

  if (!exists) {
    throw new Error(`Lookups file not found: ${options.filePath}`);
  }

  const text = readFileSync(options.filePath, "utf-8");
  return deserializeLookups(text);
}
