import {
  deserializeTypeIndex,
  deserializeSymbolIndex,
  retrieveRelevantTypes,
  formatTypesForLLM,
} from "./build-lookups";
import type { SchemaLookups, TypeIndex, SymbolIndex } from "./types";

export class GraphQLSchemaExplorerFromLookups {
  private typeIndex: TypeIndex;
  private symbolIndex: SymbolIndex;
  private queryTypeName: string | null;
  private mutationTypeName: string | null;

  constructor(lookups: SchemaLookups) {
    this.typeIndex = deserializeTypeIndex(lookups.typeIndex);
    this.symbolIndex = deserializeSymbolIndex(lookups.symbolIndex);
    this.queryTypeName = lookups.queryTypeName;
    this.mutationTypeName = lookups.mutationTypeName;
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
