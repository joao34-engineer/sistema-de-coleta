import { createHash } from "node:crypto";

type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | { readonly [key: string]: CanonicalValue };

function canonicalValue(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("O snapshot contém um número não finito.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    const entries = Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("O snapshot contém um valor não serializável.");
}

export function canonicalizeSnapshot(snapshot: CanonicalValue): string {
  return canonicalValue(snapshot);
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashCanonicalSnapshot(snapshot: CanonicalValue): string {
  return sha256Hex(canonicalizeSnapshot(snapshot));
}

