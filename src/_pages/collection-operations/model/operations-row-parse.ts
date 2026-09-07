import type { z } from "zod";

export class OperationsRowParseError extends Error {
  readonly code = "operations_row_invalid" as const;

  constructor() {
    super("operations_row_invalid");
    this.name = "OperationsRowParseError";
  }
}

function isNullCollectionItemId(row: unknown): boolean {
  if (typeof row !== "object" || row === null) {
    return false;
  }
  return (row as Readonly<Record<string, unknown>>)["collectionItemId"] == null;
}

/**
 * Parse each operations row independently.
 * Null `collectionItemId` lines are orphan OS rows — skip them.
 * Any other Zod failure throws so callers cannot silently collapse to [].
 */
export function parseOperationsRows<T>(schema: z.ZodType<T>, payload: unknown): T[] {
  if (payload == null) {
    return [];
  }
  if (!Array.isArray(payload)) {
    throw new OperationsRowParseError();
  }

  const parsed: T[] = [];
  for (const row of payload) {
    if (isNullCollectionItemId(row)) {
      continue;
    }
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new OperationsRowParseError();
    }
    parsed.push(result.data);
  }
  return parsed;
}
