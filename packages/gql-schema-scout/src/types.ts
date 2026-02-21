import {
  parse,
  buildASTSchema,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLField,
  GraphQLInputField,
  GraphQLArgument,
  isNonNullType,
  isListType,
  getNamedType,
  isObjectType,
  isInputObjectType,
  isEnumType,
  isInterfaceType,
  isUnionType,
  isScalarType,
  GraphQLType,
} from "graphql";

export type TypeKind = "Object" | "Input" | "Enum" | "Interface" | "Union";

export type ArgNode = {
  name: string;
  type: string;
  required: boolean;
};

export type FieldNode = {
  name: string;
  returnType: string;
  args: ArgNode[];
};

export type TypeNode = {
  name: string;
  kind: TypeKind;
  fields?: FieldNode[];
  interfaces?: string[];
  referencedTypes: string[];
};

export type TypeIndex = Map<string, TypeNode>;
export type SymbolIndex = Map<string, Set<string>>;

export type SerializedTypeIndex = Record<string, TypeNode>;
export type SerializedSymbolIndex = Record<string, string[]>;

export type SchemaLookups = {
  typeIndex: SerializedTypeIndex;
  symbolIndex: SerializedSymbolIndex;
  queryTypeName: string | null;
  mutationTypeName: string | null;
};
