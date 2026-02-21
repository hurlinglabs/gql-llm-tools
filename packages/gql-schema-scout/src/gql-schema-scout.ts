import { parse, buildASTSchema } from "graphql";

import {
  buildLookupsFromSDL,
  buildLookupsFromIntrospection,
  buildTypeIndex,
  buildSymbolIndex,
  deserializeTypeIndex,
  deserializeSymbolIndex,
  retrieveRelevantTypes,
  type RetrieveOptions,
} from "./build-lookups";
import { SchemaResult } from "./schema-result";
import type { SchemaLookups, TypeIndex, SymbolIndex } from "./types";

/**
 * GQLSchemaScout - A fluent API for exploring GraphQL schemas
 *
 * @example
 * // From SDL
 * const scout = GQLSchemaScout.fromSDL(schemaSDL);
 *
 * @example
 * // From introspection result
 * const scout = GQLSchemaScout.fromIntrospection(introspectionResult);
 *
 * @example
 * // From pre-built lookups (fastest)
 * const scout = GQLSchemaScout.fromLookups(lookups);
 */
export class GQLSchemaScout {
  private typeIndex: TypeIndex;
  private symbolIndex: SymbolIndex;
  private queryTypeName: string | null;
  private mutationTypeName: string | null;
  private sdl: string | null;

  private constructor(
    typeIndex: TypeIndex,
    symbolIndex: SymbolIndex,
    queryTypeName: string | null,
    mutationTypeName: string | null,
    sdl: string | null,
  ) {
    this.typeIndex = typeIndex;
    this.symbolIndex = symbolIndex;
    this.queryTypeName = queryTypeName;
    this.mutationTypeName = mutationTypeName;
    this.sdl = sdl;
  }

  /**
   * Create a GQLSchemaScout from a GraphQL SDL string
   */
  static fromSDL(sdl: string): GQLSchemaScout {
    const ast = parse(sdl);
    const schema = buildASTSchema(ast);
    const typeIndex = buildTypeIndex(schema);
    const symbolIndex = buildSymbolIndex(typeIndex, schema);

    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();

    return new GQLSchemaScout(
      typeIndex,
      symbolIndex,
      queryType?.name ?? null,
      mutationType?.name ?? null,
      sdl,
    );
  }

  /**
   * Create a GQLSchemaScout from an introspection query result
   */
  static fromIntrospection(introspection: any): GQLSchemaScout {
    const lookups = buildLookupsFromIntrospection(introspection);
    return GQLSchemaScout.fromLookups(lookups);
  }

  /**
   * Create a GQLSchemaScout from pre-built lookups (fastest initialization)
   */
  static fromLookups(lookups: SchemaLookups): GQLSchemaScout {
    const typeIndex = deserializeTypeIndex(lookups.typeIndex);
    const symbolIndex = deserializeSymbolIndex(lookups.symbolIndex);

    return new GQLSchemaScout(
      typeIndex,
      symbolIndex,
      lookups.queryTypeName,
      lookups.mutationTypeName,
      null,
    );
  }

  /**
   * Retrieve relevant schema types for a natural language query
   * Returns a SchemaResult that can be formatted as SDL or minified
   */
  retrieveRelevantSchema(
    userInput: string,
    options?: RetrieveOptions,
  ): SchemaResult {
    const relevantTypes = retrieveRelevantTypes(
      userInput,
      this.typeIndex,
      this.symbolIndex,
      this.queryTypeName,
      this.mutationTypeName,
      options,
    );
    return new SchemaResult(relevantTypes, this.typeIndex);
  }

  /**
   * Retrieve relevant schema types as a formatted string (legacy method)
   * @deprecated Use retrieveRelevantSchema() instead
   */
  retrieveContext(userInput: string): string {
    const schemaResult = this.retrieveRelevantSchema(userInput);
    return schemaResult.asSDLString();
  }

  /**
   * Get the raw type index
   */
  getTypeIndex(): TypeIndex {
    return this.typeIndex;
  }

  /**
   * Get the raw symbol index
   */
  getSymbolIndex(): SymbolIndex {
    return this.symbolIndex;
  }

  /**
   * Get the original SDL (only available if created with fromSDL)
   */
  getSDL(): string | null {
    return this.sdl;
  }

  /**
   * Get serializable lookups for caching
   */
  getLookups(): SchemaLookups {
    return {
      typeIndex: this.serializeTypeIndex(),
      symbolIndex: this.serializeSymbolIndex(),
      queryTypeName: this.queryTypeName,
      mutationTypeName: this.mutationTypeName,
    };
  }

  private serializeTypeIndex() {
    const result: Record<string, any> = {};
    for (const [key, value] of Array.from(this.typeIndex)) {
      result[key] = value;
    }
    return result;
  }

  private serializeSymbolIndex() {
    const result: Record<string, string[]> = {};
    for (const [key, value] of Array.from(this.symbolIndex)) {
      result[key] = Array.from(value);
    }
    return result;
  }
}
