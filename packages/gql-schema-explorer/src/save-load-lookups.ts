import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SchemaLookups } from "./types";

export interface SaveLookupsOptions {
  lookups: SchemaLookups;
  filePath: string;
}

export function saveLookups(options: SaveLookupsOptions): void {
  const data = JSON.stringify(options.lookups, null, 2);

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
  const data = JSON.parse(text);

  return data as SchemaLookups;
}
