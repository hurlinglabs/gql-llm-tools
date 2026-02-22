import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
  IntrospectionQuery,
} from "graphql";
import {
  buildSchema,
  parse,
  isScalarType,
  isObjectType,
  isInputObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isNonNullType,
  isListType,
  isNamedType,
} from "graphql";
import { buildASTSchema, buildClientSchema } from "graphql/utilities/index.js";

import type {
  TypeKind,
  ArgNode,
  FieldNode,
  TypeNode,
  TypeIndex,
  SymbolIndex,
  SchemaLookups,
  SerializedTypeIndex,
  SerializedSymbolIndex,
} from "./types";
export type { SchemaLookups } from "./types";

/**
 * Options for controlling how relevant types are retrieved.
 * All options are optional - defaults are applied if not specified.
 */
export type RetrieveOptions = {
  /**
   * Minimum score threshold for a type to be included.
   * Types with scores below this value are filtered out.
   * @default 0 (no threshold filtering)
   */
  minScore?: number;

  /**
   * Maximum number of types to return (by score).
   * If not specified, all types above minScore are returned.
   */
  maxResults?: number;

  /**
   * Whether to include Query and Mutation root types.
   * Only matching fields will be included from these types.
   * @default false
   */
  includeRootTypes?: boolean;

  /**
   * Whether to include types referenced by matched types.
   * Referenced types will be listed but not fully expanded.
   * @default true
   */
  includeReferences?: boolean;

  /**
   * Whether to split camelCase words into individual tokens.
   * e.g., "BetNotification" → ["bet", "notification"]
   * @default false
   */
  splitCamelCase?: boolean;
};

/**
 * Result of retrieving relevant schema types with categorization
 */
export type RelevantSchemaInfo = {
  /** Types that directly matched the user's query - full definition included */
  primaryTypes: Set<string>;
  /** Query/Mutation types - only matching fields included */
  rootTypes: Set<string>;
  /** Types referenced by primary types - listed but not expanded */
  referencedTypes: Set<string>;
  /** User tokens used for matching (for filtering root type fields) */
  matchedTokens: Set<string>;
};

const BUILTIN_SCALARS = new Set(["String", "Int", "Float", "Boolean", "ID"]);

export function isBuiltinScalar(name: string): boolean {
  return BUILTIN_SCALARS.has(name);
}

function stripWrapper(typeStr: string): string {
  return typeStr.replace(/[!\[\]]/g, "");
}

function getTypeString(type: GraphQLType): string {
  let result = "";
  if (isNonNullType(type)) {
    result += getTypeString(type.ofType) + "!";
  } else if (isListType(type)) {
    result += "[" + getTypeString(type.ofType) + "]";
  } else {
    result += type.name;
  }
  return result;
}

export function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 1 && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(name: string, splitCamelCase = false): string[] {
  const tokens: string[] = [];

  const words = name.toLowerCase().split(/[\s\-_.,;!?()[\]{}]+/);

  for (const word of words) {
    if (!word || word.length < 2) continue;

    if (splitCamelCase) {
      // Split camelCase: "BetNotification" → ["betnotification"]
      let current = "";
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (
          char === char.toUpperCase() &&
          char !== char.toLowerCase() &&
          current.length > 0
        ) {
          if (current) tokens.push(current);
          current = char.toLowerCase();
        } else {
          current += char;
        }
      }
      if (current) tokens.push(current);
    } else {
      // Keep as-is
      tokens.push(word);
    }
  }

  const result: string[] = [...tokens];
  for (const token of tokens) {
    if (token.length > 2) {
      const singular = singularize(token);
      if (singular !== token) result.push(singular);
    }
  }

  return Array.from(new Set(result));
}

export function buildTypeIndex(schema: GraphQLSchema): TypeIndex {
  const typeMap = schema.getTypeMap();
  const typeIndex = new Map<string, TypeNode>();

  for (const [typeName, type] of Object.entries(typeMap)) {
    if (typeName.startsWith("__")) continue;
    if (isScalarType(type) && isBuiltinScalar(typeName)) continue;

    let kind: TypeKind;
    let fields: FieldNode[] | undefined;
    let interfaces: string[] | undefined;
    const referencedTypes = new Set<string>();

    if (isObjectType(type) || isInputObjectType(type)) {
      kind = isInputObjectType(type) ? "Input" : "Object";
      fields = [];

      const fieldMap = isObjectType(type)
        ? (type as GraphQLObjectType).getFields()
        : (type as GraphQLInputObjectType).getFields();

      for (const [fieldName, field] of Object.entries(fieldMap)) {
        const graphQLField = field as
          | GraphQLField<any, any>
          | GraphQLInputField;
        const returnType = getTypeString(graphQLField.type);
        const namedReturn = stripWrapper(returnType);

        if (!isBuiltinScalar(namedReturn)) {
          referencedTypes.add(namedReturn);
        }

        const args: ArgNode[] = [];
        if ("args" in graphQLField && Array.isArray(graphQLField.args)) {
          for (const arg of graphQLField.args as GraphQLArgument[]) {
            const argTypeStr = getTypeString(arg.type);
            args.push({
              name: arg.name,
              type: argTypeStr,
              required: isNonNullType(arg.type),
              description: arg.description ?? undefined,
            });
          }
        }

        fields.push({
          name: fieldName,
          returnType,
          args,
          description: graphQLField.description ?? undefined,
        });
      }

      if (isObjectType(type)) {
        const implementedInterfaces = (
          type as GraphQLObjectType
        ).getInterfaces();
        interfaces = implementedInterfaces.map((i) => i.name);
        for (const iface of implementedInterfaces) {
          if (!isBuiltinScalar(iface.name)) {
            referencedTypes.add(iface.name);
          }
        }
      }
    } else if (isEnumType(type)) {
      kind = "Enum";
    } else if (isInterfaceType(type)) {
      kind = "Interface";
      fields = [];
      const fieldMap = (type as GraphQLInterfaceType).getFields();
      for (const [fieldName, field] of Object.entries(fieldMap)) {
        const graphQLField = field as GraphQLField<any, any>;
        const returnType = getTypeString(graphQLField.type);
        const namedReturn = stripWrapper(returnType);
        if (!isBuiltinScalar(namedReturn)) {
          referencedTypes.add(namedReturn);
        }
        const args: ArgNode[] = [];
        if ("args" in graphQLField && Array.isArray(graphQLField.args)) {
          for (const arg of graphQLField.args as GraphQLArgument[]) {
            const argTypeStr = getTypeString(arg.type);
            args.push({
              name: arg.name,
              type: argTypeStr,
              required: isNonNullType(arg.type),
              description: arg.description ?? undefined,
            });
          }
        }
        fields.push({
          name: fieldName,
          returnType,
          args,
          description: graphQLField.description ?? undefined,
        });
      }
    } else if (isUnionType(type)) {
      kind = "Union";
      const types = (type as GraphQLUnionType).getTypes();
      for (const t of types) {
        if (!isBuiltinScalar(t.name)) {
          referencedTypes.add(t.name);
        }
      }
    } else {
      continue;
    }

    typeIndex.set(typeName, {
      name: typeName,
      kind,
      fields,
      interfaces,
      referencedTypes: Array.from(referencedTypes),
      description: type.description ?? undefined,
    });
  }

  return typeIndex;
}

export function buildSymbolIndex(
  typeIndex: TypeIndex,
  schema: GraphQLSchema,
): SymbolIndex {
  const symbolIndex: SymbolIndex = new Map();

  const addSymbol = (token: string, target: string) => {
    if (!symbolIndex.has(token)) {
      symbolIndex.set(token, new Set());
    }
    symbolIndex.get(token)!.add(target);
  };

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();

  if (queryType) {
    addSymbol("query", "Query");
    addSymbol("query", queryType.name);
  }
  if (mutationType) {
    addSymbol("mutation", "Mutation");
    addSymbol("mutation", mutationType.name);
  }
  addSymbol("subscription", "Subscription");

  for (const [typeName, typeNode] of Array.from(typeIndex)) {
    const tokens = tokenize(typeName);
    for (const token of tokens) {
      addSymbol(token, typeName);
    }

    if (typeNode.fields) {
      for (const field of typeNode.fields) {
        const fieldTokens = tokenize(field.name);
        for (const token of fieldTokens) {
          addSymbol(token, `${typeName}.${field.name}`);
          addSymbol(token, typeName);
        }
      }
    }
  }

  return symbolIndex;
}

export function serializeTypeIndex(typeIndex: TypeIndex): SerializedTypeIndex {
  const result: SerializedTypeIndex = {};
  for (const [key, value] of Array.from(typeIndex)) {
    result[key] = value;
  }
  return result;
}

export function deserializeTypeIndex(
  serialized: SerializedTypeIndex,
): TypeIndex {
  return new Map(Object.entries(serialized));
}

export function serializeSymbolIndex(
  symbolIndex: SymbolIndex,
): SerializedSymbolIndex {
  const result: SerializedSymbolIndex = {};
  for (const [key, value] of Array.from(symbolIndex)) {
    result[key] = Array.from(value);
  }
  return result;
}

export function deserializeSymbolIndex(
  serialized: SerializedSymbolIndex,
): SymbolIndex {
  const result: SymbolIndex = new Map();
  for (const [key, value] of Object.entries(serialized)) {
    result.set(key, new Set(value));
  }
  return result;
}

export function buildLookupsFromSDL(schemaSDL: string): SchemaLookups {
  const ast = parse(schemaSDL);
  const schema = buildASTSchema(ast);
  return buildLookupsFromSchema(schema);
}

export function buildLookupsFromIntrospection(
  introspection: IntrospectionQuery,
): SchemaLookups {
  const schema = buildClientSchema(introspection);
  return buildLookupsFromSchema(schema);
}

function buildLookupsFromSchema(schema: GraphQLSchema): SchemaLookups {
  const typeIndex = buildTypeIndex(schema);
  const symbolIndex = buildSymbolIndex(typeIndex, schema);

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();

  return {
    typeIndex: serializeTypeIndex(typeIndex),
    symbolIndex: serializeSymbolIndex(symbolIndex),
    queryTypeName: queryType?.name ?? null,
    mutationTypeName: mutationType?.name ?? null,
  };
}

// Score constants for weighted matching
const SCORE_EXACT_MATCH = 100;
const SCORE_PREFIX_MATCH = 50;
const SCORE_CONTAINS_MATCH = 25;
const SCORE_FIELD_MATCH = 10;

function calculateMatchScore(token: string, match: string): number {
  const matchLower = match.toLowerCase();
  const tokenLower = token.toLowerCase();

  // Exact match (e.g., "user" matches "User")
  if (matchLower === tokenLower) {
    return SCORE_EXACT_MATCH;
  }

  // Prefix match (e.g., "user" matches "UserProfile")
  if (matchLower.startsWith(tokenLower)) {
    return SCORE_PREFIX_MATCH;
  }

  // Contains match (e.g., "user" matches "CurrentUser")
  if (matchLower.includes(tokenLower)) {
    return SCORE_CONTAINS_MATCH;
  }

  return 0;
}

export function retrieveRelevantTypes(
  userInput: string,
  typeIndex: TypeIndex,
  symbolIndex: SymbolIndex,
  queryTypeName: string | null,
  mutationTypeName: string | null,
  options?: RetrieveOptions,
): RelevantSchemaInfo {
  const {
    minScore = 0,
    maxResults,
    includeRootTypes = false,
    includeReferences = true,
    splitCamelCase = false,
  } = options ?? {};

  // Score each type by relevance
  const typeScores = new Map<string, number>();
  const userTokens = tokenize(userInput, splitCamelCase);
  const matchedTokens = new Set(userTokens.map((t) => t.toLowerCase()));

  for (const token of userTokens) {
    const tokenLower = token.toLowerCase();
    const matches = symbolIndex.get(tokenLower);

    if (matches) {
      for (const match of Array.from(matches)) {
        const [typeName, fieldName] = match.includes(".")
          ? match.split(".")
          : [match, null];

        const score = fieldName
          ? SCORE_FIELD_MATCH
          : calculateMatchScore(token, typeName);

        // Accumulate scores for types that match multiple tokens
        const currentScore = typeScores.get(typeName) ?? 0;
        typeScores.set(typeName, currentScore + score);
      }
    }
  }

  // Filter by minimum score
  let filteredTypes = Array.from(typeScores.entries())
    .filter(([, score]) => score >= minScore)
    .sort((a, b) => b[1] - a[1]); // Sort by score descending

  // Apply max results limit
  if (maxResults !== undefined) {
    filteredTypes = filteredTypes.slice(0, maxResults);
  }

  const primaryTypes = new Set(filteredTypes.map(([name]) => name));

  // Expand to referenced types
  const referencedTypes = new Set<string>();

  if (includeReferences) {
    for (const typeName of Array.from(primaryTypes)) {
      const typeNode = typeIndex.get(typeName);
      if (typeNode) {
        for (const refType of typeNode.referencedTypes) {
          if (typeIndex.has(refType) && !primaryTypes.has(refType)) {
            referencedTypes.add(refType);
          }
        }
      }
    }
  }

  // Root types (Query/Mutation)
  const rootTypes = new Set<string>();
  if (includeRootTypes) {
    if (queryTypeName && typeIndex.has(queryTypeName)) {
      rootTypes.add(queryTypeName);
    }
    if (mutationTypeName && typeIndex.has(mutationTypeName)) {
      rootTypes.add(mutationTypeName);
    }
  }

  return {
    primaryTypes,
    rootTypes,
    referencedTypes,
    matchedTokens,
  };
}

export function formatTypesForLLM(
  typeNames: Set<string>,
  typeIndex: TypeIndex,
): string {
  const sortedNames = Array.from(typeNames).sort();
  const lines: string[] = [];

  for (const typeName of sortedNames) {
    const typeNode = typeIndex.get(typeName);
    if (!typeNode) continue;

    lines.push(`## Type: ${typeNode.name} (${typeNode.kind})`);
    lines.push("");

    if (typeNode.fields && typeNode.fields.length > 0) {
      lines.push("Fields:");
      for (const field of typeNode.fields) {
        const argsStr =
          field.args.length > 0
            ? `(${field.args.map((a) => `${a.name}: ${a.type}`).join(", ")})`
            : "";
        lines.push(`- ${field.name}${argsStr}: ${field.returnType}`);
      }
      lines.push("");
    }

    if (typeNode.interfaces && typeNode.interfaces.length > 0) {
      lines.push(`Implements: ${typeNode.interfaces.join(", ")}`);
      lines.push("");
    }

    if (typeNode.referencedTypes.length > 0) {
      const relevantRefs = typeNode.referencedTypes.filter((ref) =>
        typeNames.has(ref),
      );
      if (relevantRefs.length > 0) {
        lines.push(`References: ${relevantRefs.join(", ")}`);
        lines.push("");
      }
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}
