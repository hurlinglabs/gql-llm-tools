import type { TypeIndex, TypeNode, FieldNode, ArgNode } from "./types";

/**
 * Result of retrieving relevant schema types
 * Provides methods to format the schema as SDL or minified SDL
 */
export class SchemaResult {
  private typeNames: Set<string>;
  private typeIndex: TypeIndex;

  constructor(typeNames: Set<string>, typeIndex: TypeIndex) {
    this.typeNames = typeNames;
    this.typeIndex = typeIndex;
  }

  /**
   * Format the relevant schema types as valid SDL string
   * Includes descriptions/comments for types and fields
   */
  asSDLString(): string {
    const sortedNames = Array.from(this.typeNames).sort();
    const lines: string[] = [];

    for (const typeName of sortedNames) {
      const typeNode = this.typeIndex.get(typeName);
      if (!typeNode) continue;

      // Add type description as comment
      if (typeNode.description) {
        lines.push(`"""\n${typeNode.description}\n"""`);
      }

      // Type declaration
      const typeDecl = this.formatTypeDeclaration(typeNode);
      lines.push(typeDecl);

      if (typeNode.fields && typeNode.fields.length > 0) {
        lines.push("  {");

        for (const field of typeNode.fields) {
          const fieldLine = this.formatField(field);
          lines.push(fieldLine);
        }

        lines.push("  }");
      }

      lines.push("");
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.join("\n");
  }

  /**
   * Format the relevant schema types as a minified, single-line SDL string
   * Preserves descriptions but removes most whitespace
   */
  asMinified(): string {
    const sortedNames = Array.from(this.typeNames).sort();
    const parts: string[] = [];

    for (const typeName of sortedNames) {
      const typeNode = this.typeIndex.get(typeName);
      if (!typeNode) continue;

      // Add type description as inline comment
      if (typeNode.description) {
        parts.push(`# ${typeNode.description}`);
      }

      // Type declaration (compact)
      const typeDecl = this.formatTypeDeclaration(typeNode);
      parts.push(typeDecl);

      if (typeNode.fields && typeNode.fields.length > 0) {
        const fieldLines: string[] = [];

        for (const field of typeNode.fields) {
          const fieldLine = this.formatField(field);
          fieldLines.push(fieldLine);
        }

        parts.push(`{${fieldLines.join(";")}}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Get the set of type names included in this result
   */
  getTypeNames(): Set<string> {
    return new Set(this.typeNames);
  }

  private formatTypeDeclaration(typeNode: TypeNode): string {
    const implementsPart = typeNode.interfaces?.length
      ? ` implements ${typeNode.interfaces.join(" & ")}`
      : "";

    return `type ${typeNode.name}${implementsPart}`;
  }

  private formatField(field: FieldNode): string {
    // Add field description as comment if present
    const description = field.description ? `# ${field.description}\n  ` : "";

    const argsStr =
      field.args.length > 0
        ? `(${field.args.map((a) => this.formatArg(a)).join(", ")})`
        : "";

    return `${description}${field.name}${argsStr}: ${field.returnType}`;
  }

  private formatArg(arg: ArgNode): string {
    const description = arg.description ? `# ${arg.description} ` : "";
    return `${description}${arg.name}: ${arg.type}`;
  }
}
