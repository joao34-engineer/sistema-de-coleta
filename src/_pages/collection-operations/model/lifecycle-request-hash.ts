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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
