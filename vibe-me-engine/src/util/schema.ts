export type SchemaType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'union';

export interface SchemaField {
  type: SchemaType;
  description?: string;
  optional?: boolean;
  enumValues?: readonly string[]; // For enum
  items?: SchemaField; // For array
  properties?: Record<string, SchemaField>; // For object
  anyOf?: readonly SchemaField[]; // For union
}

export interface ToolMetadata {
  name: string;
  description: string;
  parameters: Record<string, SchemaField>;
}
