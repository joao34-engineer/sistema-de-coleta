import { z } from "zod";

const cursorPayloadSchema = z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() });

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export const collectionCursorSchema = z.string().regex(/^[A-Za-z0-9_-]+$/).superRefine((value, context) => {
  const decoded = decodeBase64Url(value);
  if (decoded === null) {
    context.addIssue({ code: "custom", message: "Cursor inválido." });
    return;
  }
  try {
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) context.addIssue({ code: "custom", message: "Cursor inválido." });
  } catch {
    context.addIssue({ code: "custom", message: "Cursor inválido." });
  }
});

export type CollectionCursor = z.infer<typeof cursorPayloadSchema>;

export function encodeCollectionCursor(cursor: CollectionCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
