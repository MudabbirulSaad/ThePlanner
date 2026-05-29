import { readFile } from "node:fs/promises";
import { dirname, parse, resolve } from "node:path";

import type { JsonSchemaValidator, SchemaValidationReport } from "../../application/index.js";

type JsonSchema = {
  readonly $ref?: string;
  readonly $defs?: Readonly<Record<string, JsonSchema>>;
  readonly type?: string;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly minLength?: number;
  readonly minItems?: number;
  readonly pattern?: string;
};

export class FilePlanningGraphSchemaValidator implements JsonSchemaValidator {
  public constructor(private readonly schemaPath = "planning/graph.schema.json") {}

  public async validate(value: unknown): Promise<SchemaValidationReport> {
    const schema = JSON.parse(await readFile(await resolveSchemaPath(this.schemaPath), "utf8")) as JsonSchema;
    const errors = validateSchemaValue(value, schema, schema, "$").map((message) => ({
      code: "schema_validation_error",
      message
    }));

    return {
      status: errors.length > 0 ? "error" : "pass",
      errors
    };
  }
}

function validateSchemaValue(value: unknown, schema: JsonSchema, root: JsonSchema, path: string): readonly string[] {
  const resolvedSchema = resolveRef(schema, root);
  const errors: string[] = [];

  if (resolvedSchema.type && !matchesType(value, resolvedSchema.type)) {
    return [`${path}: expected ${resolvedSchema.type}`];
  }

  if (resolvedSchema.enum && !resolvedSchema.enum.some((candidate) => candidate === value)) {
    errors.push(`${path}: expected one of ${resolvedSchema.enum.map(String).join(", ")}`);
  }

  if (typeof value === "number" && resolvedSchema.minimum !== undefined && value < resolvedSchema.minimum) {
    errors.push(`${path}: must be >= ${resolvedSchema.minimum}`);
  }

  if (typeof value === "string") {
    if (resolvedSchema.minLength !== undefined && value.length < resolvedSchema.minLength) {
      errors.push(`${path}: must have length >= ${resolvedSchema.minLength}`);
    }

    if (resolvedSchema.pattern && !new RegExp(resolvedSchema.pattern, "u").test(value)) {
      errors.push(`${path}: must match pattern ${resolvedSchema.pattern}`);
    }
  }

  if (Array.isArray(value)) {
    if (resolvedSchema.minItems !== undefined && value.length < resolvedSchema.minItems) {
      errors.push(`${path}: must contain at least ${resolvedSchema.minItems} item(s)`);
    }

    if (resolvedSchema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchemaValue(item, resolvedSchema.items as JsonSchema, root, `${path}[${index}]`));
      });
    }
  }

  if (isRecord(value)) {
    for (const property of resolvedSchema.required ?? []) {
      if (!(property in value)) {
        errors.push(`${path}: missing required property ${property}`);
      }
    }

    for (const [key, propertyValue] of Object.entries(value)) {
      const propertySchema = resolvedSchema.properties?.[key];
      if (propertySchema) {
        errors.push(...validateSchemaValue(propertyValue, propertySchema, root, `${path}.${key}`));
      } else if (resolvedSchema.additionalProperties === false) {
        errors.push(`${path}.${key}: additional property is not allowed`);
      }
    }
  }

  return errors;
}

function resolveRef(schema: JsonSchema, root: JsonSchema): JsonSchema {
  if (!schema.$ref) {
    return schema;
  }

  const prefix = "#/$defs/";
  if (!schema.$ref.startsWith(prefix)) {
    throw new Error(`Unsupported JSON Schema ref: ${schema.$ref}`);
  }

  const resolved = root.$defs?.[schema.$ref.slice(prefix.length)];
  if (!resolved) {
    throw new Error(`Missing JSON Schema ref: ${schema.$ref}`);
  }

  return resolved;
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "object") {
    return isRecord(value);
  }

  if (type === "array") {
    return Array.isArray(value);
  }

  if (type === "integer") {
    return Number.isInteger(value);
  }

  return typeof value === type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function resolveSchemaPath(schemaPath: string): Promise<string> {
  const absolutePath = resolve(schemaPath);
  try {
    await readFile(absolutePath, "utf8");
    return absolutePath;
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  let current = process.cwd();
  const root = parse(current).root;
  while (current !== root) {
    const candidate = resolve(current, schemaPath);
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
    current = dirname(current);
  }

  throw new Error(`JSON Schema file not found: ${schemaPath}`);
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
