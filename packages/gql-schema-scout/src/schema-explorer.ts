import { parse, buildASTSchema } from "graphql";

import {
  buildTypeIndex,
  buildSymbolIndex,
  retrieveRelevantTypes,
  formatTypesForLLM,
} from "./build-lookups";
import type { SchemaLookups, TypeIndex, SymbolIndex } from "./types";

export interface GraphQLSchemaExplorerOptions {
  sdl: string;
}

export class GraphQLSchemaExplorer {
  private typeIndex: TypeIndex;
  private symbolIndex: SymbolIndex;
  private queryTypeName: string | null;
  private mutationTypeName: string | null;
  private sdl: string;

  constructor(options: GraphQLSchemaExplorerOptions) {
    const ast = parse(options.sdl);
    const schema = buildASTSchema(ast);
    this.sdl = options.sdl;
    this.typeIndex = buildTypeIndex(schema);
    this.symbolIndex = buildSymbolIndex(this.typeIndex, schema);

    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    this.queryTypeName = queryType?.name ?? null;
    this.mutationTypeName = mutationType?.name ?? null;
  }

  retrieveContext(userInput: string): string {
    const relevantTypes = retrieveRelevantTypes(
      userInput,
      this.typeIndex,
      this.symbolIndex,
      this.queryTypeName,
      this.mutationTypeName,
    );
    return formatTypesForLLM(relevantTypes, this.typeIndex);
  }

  getTypeIndex(): TypeIndex {
    return this.typeIndex;
  }

  getSymbolIndex(): SymbolIndex {
    return this.symbolIndex;
  }

  getSDL(): string {
    return this.sdl;
  }

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
