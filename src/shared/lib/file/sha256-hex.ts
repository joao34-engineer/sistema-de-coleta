/** Web Crypto SHA-256 as lowercase hex. Shared by file digests and idempotency hashes. */

async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestSha256(file: File): Promise<string> {
  return sha256Hex(await file.arrayBuffer());
}

export type LifecycleRequestHashExtra = Readonly<{
  deliveredItemIds: ReadonlyArray<string>;
}>;

export async function digestLifecycleRequest(
  operation: string,
  collectionId: string,
  expectedVersion: number,
  reason?: string | undefined,
  extra?: LifecycleRequestHashExtra,
): Promise<string> {
  const payload = JSON.stringify({
    operation,
    collectionId,
    expectedVersion,
    reason: reason ?? null,
    ...(extra === undefined ? {} : { deliveredItemIds: [...extra.deliveredItemIds].sort() }),
  });
  return sha256Hex(new TextEncoder().encode(payload));
}
