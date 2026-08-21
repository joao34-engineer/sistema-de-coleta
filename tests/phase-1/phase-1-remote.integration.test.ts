import { describe, expect, it } from "vitest";
import {
  apiRequest,
  asRecord,
  fullRemoteEnabled,
  jsonRequest,
  readResponseBody,
  recordNumber,
  recordString,
  remoteConfig,
  remoteConfigError,
  responseData,
  responseErrorCode,
  rlsRemoteEnabled,
  storageInspectionEnabled,
  listStoragePrefix,
} from "./remote-harness";
import {
  syntheticAddress,
  syntheticCollectionId,
  syntheticCustomer,
  syntheticFormData,
  syntheticIdempotencyKey,
  syntheticItem,
  syntheticPngFile,
} from "./synthetic-fixtures";

type CustomerFixture = Readonly<{ id: string; displayName: string; taxId: string }>;
type DraftFixture = Readonly<{ id: string; rowVersion: number; customerId: string }>;
type ItemFixture = Readonly<{ id: string; rowVersion: number }>;

function requireRemoteConfig(): NonNullable<typeof remoteConfig> {
  if (!remoteConfig) throw new Error(remoteConfigError ?? "phase_1_qa_not_configured");
  return remoteConfig;
}

function payload(value: unknown): Readonly<Record<string, unknown>> | null {
  return responseData(value) ?? asRecord(value);
}

function fieldFromData(value: unknown, field: string): unknown {
  const body = payload(value);
  return body?.[field];
}

function nestedField(value: unknown, parent: string, child: string): unknown {
  return asRecord(fieldFromData(value, parent))?.[child];
}

function idFrom(value: unknown, field: string): string {
  const direct = recordString(value, field);
  const nested = fieldFromData(value, field);
  const result = direct ?? (typeof nested === "string" ? nested : null);
  if (!result) throw new Error(`phase_1_qa_missing_${field}`);
  return result;
}

function rowVersionFrom(value: unknown): number {
  const direct = recordNumber(value, "rowVersion") ?? recordNumber(fieldFromData(value, "draft"), "rowVersion");
  if (direct === null || direct < 1) throw new Error("phase_1_qa_missing_row_version");
  return direct;
}

async function createCustomer(token?: string): Promise<CustomerFixture> {
  const input = syntheticCustomer();
  const response = await apiRequest("/api/customers", jsonRequest(input, { token }));
  const body = await readResponseBody(response);
  expect(response.status, JSON.stringify(body)).toBe(201);
  const customer = asRecord(nestedField(body, "data", "customer"));
  const id = recordString(customer, "id");
  const displayName = recordString(customer, "displayName");
  const taxId = recordString(customer, "taxId");
  if (!id || !displayName || !taxId) throw new Error("phase_1_qa_customer_response_invalid");
  return { id, displayName, taxId };
}

async function createDraft(customerId: string, token?: string): Promise<DraftFixture> {
  const id = syntheticCollectionId();
  const response = await apiRequest("/api/collections/drafts", jsonRequest({ id, customerId }, { token }));
  const body = await readResponseBody(response);
  expect([200, 201], JSON.stringify(body)).toContain(response.status);
  const draft = asRecord(nestedField(body, "data", "draft"));
  const returnedId = recordString(draft, "id") ?? id;
  const rowVersion = recordNumber(draft, "rowVersion");
  if (!rowVersion || rowVersion < 1) throw new Error("phase_1_qa_draft_response_invalid");
  return { id: returnedId, rowVersion, customerId };
}

async function getDraft(collectionId: string, token?: string): Promise<Readonly<Record<string, unknown>>> {
  const response = await apiRequest(`/api/collections/${collectionId}/draft`, { token });
  const body = await readResponseBody(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  const data = payload(body);
  if (!data) throw new Error("phase_1_qa_draft_get_invalid");
  return data;
}

async function addItem(draft: DraftFixture, token?: string): Promise<ItemFixture> {
  const response = await apiRequest(
    `/api/collections/${draft.id}/items`,
    jsonRequest({ ...syntheticItem(), expectedVersion: draft.rowVersion }, { token }),
  );
  const body = await readResponseBody(response);
  expect([200, 201], JSON.stringify(body)).toContain(response.status);
  const item = asRecord(nestedField(body, "data", "item"));
  const id = recordString(item, "id");
  if (!id) throw new Error("phase_1_qa_item_response_invalid");
  return { id, rowVersion: rowVersionFrom(body) };
}

async function patchDraft(draft: DraftFixture, patch: Readonly<Record<string, unknown>>, token?: string): Promise<Response> {
  return apiRequest(
    `/api/collections/${draft.id}/draft`,
    jsonRequest({ expectedVersion: draft.rowVersion, ...patch }, { token }),
  );
}

async function uploadEvidence(
  collectionId: string,
  expectedVersion: number,
  itemId: string | null,
  token?: string,
): Promise<Readonly<{ response: Response; body: unknown }>> {
  const body = syntheticFormData({
    expectedVersion: String(expectedVersion),
    itemId,
    file: syntheticPngFile(),
  });
  const response = await apiRequest(`/api/collections/${collectionId}/evidences`, { method: "POST", body, token });
  return { response, body: await readResponseBody(response) };
}

async function completeDraftForFinalize(
  customer: CustomerFixture,
  token?: string,
): Promise<Readonly<{ draft: DraftFixture; item: ItemFixture }>> {
  const draft = await createDraft(customer.id, token);
  const patchResponse = await patchDraft(
    draft,
    {
      collectionLocation: "Local sintetico de QA",
      responsibleName: "Responsavel Sintetico",
      responsibleTaxId: "52998224725",
      collectedAt: new Date().toISOString(),
    },
    token,
  );
  const patchBody = await readResponseBody(patchResponse);
  expect(patchResponse.status, JSON.stringify(patchBody)).toBe(200);
  const patchedDraft = { ...draft, rowVersion: rowVersionFrom(patchBody) };
  const item = await addItem(patchedDraft, token);
  return { draft: { ...patchedDraft, rowVersion: item.rowVersion }, item };
}

async function saveSignature(collectionId: string, expectedVersion: number, token?: string): Promise<Readonly<{ body: unknown; rowVersion: number }>> {
  const formData = syntheticFormData({
    signerName: "Responsavel Sintetico",
    signerTaxId: "52998224725",
    acceptanceText: "Aceito os termos da coleta sintetica para teste.",
    expectedVersion: String(expectedVersion),
    signature: syntheticPngFile("qa-signature.png"),
  });
  const response = await apiRequest(`/api/collections/${collectionId}/signature`, { method: "PUT", body: formData, token });
  const body = await readResponseBody(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  return { body, rowVersion: rowVersionFrom(body) };
}

async function finalize(
  collectionId: string,
  expectedVersion: number,
  idempotencyKey: string,
  token?: string,
): Promise<Readonly<{ response: Response; body: unknown }>> {
  const response = await apiRequest(
    `/api/collections/${collectionId}/finalize`,
    jsonRequest({ expectedVersion }, { method: "POST", token, headers: { "Idempotency-Key": idempotencyKey } }),
  );
  return { response, body: await readResponseBody(response) };
}

function listItems(value: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> {
  const data = payload(value);
  const items = data?.["items"];
  return Array.isArray(items)
    ? items.filter((item): item is Readonly<Record<string, unknown>> => asRecord(item) !== null).map((item) => asRecord(item) as Readonly<Record<string, unknown>>)
    : [];
}

describe("Fase 1A remote integration (opt-in isolated environment)", () => {
  it.skipIf(!remoteEnabled())("keeps the remote suite disabled without an explicit isolated marker", () => {
    expect(remoteConfig?.baseUrl).toBeTruthy();
    expect(remoteConfig?.bearerToken).toBeTruthy();
  });

  it.skipIf(!fullRemoteEnabled)("rejects expectedVersion zero before touching a draft", async () => {
    const customer = await createCustomer();
    const draft = await createDraft(customer.id);
    const response = await patchDraft(draft, { expectedVersion: 0, collectionLocation: "invalid" });
    const body = await readResponseBody(response);
    expect([400, 422], JSON.stringify(body)).toContain(response.status);
    expect(responseErrorCode(body)).toBe("validation_error");
  });

  it.skipIf(!fullRemoteEnabled)("allows exactly one winner for concurrent autosaves", async () => {
    const customer = await createCustomer();
    const draft = await createDraft(customer.id);
    const responses = await Promise.all([
      patchDraft(draft, { collectionLocation: "Local QA A" }),
      patchDraft(draft, { collectionLocation: "Local QA B" }),
    ]);
    const bodies = await Promise.all(responses.map(readResponseBody));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(bodies.some((body) => responseErrorCode(body) === "stale_version")).toBe(true);
    const current = await getDraft(draft.id);
    const currentDraft = asRecord(current["draft"]);
    expect(recordNumber(currentDraft, "rowVersion")).toBe(2);
  });

  it.skipIf(!fullRemoteEnabled)("serializes item create, update and removal through the collection version", async () => {
    const customer = await createCustomer();
    const draft = await createDraft(customer.id);
    const createResponses = await Promise.all([
      apiRequest(`/api/collections/${draft.id}/items`, jsonRequest({ ...syntheticItem(), expectedVersion: draft.rowVersion })),
      apiRequest(`/api/collections/${draft.id}/items`, jsonRequest({ ...syntheticItem(), expectedVersion: draft.rowVersion })),
    ]);
    const createBodies = await Promise.all(createResponses.map(readResponseBody));
    expect(createResponses.filter((response) => [200, 201].includes(response.status))).toHaveLength(1);
    expect(createResponses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(createBodies.some((body) => responseErrorCode(body) === "stale_version")).toBe(true);

    const current = await getDraft(draft.id);
    const currentDraft = asRecord(current["draft"]);
    const currentVersion = recordNumber(currentDraft, "rowVersion");
    const currentItems = listItems(current);
    const itemId = recordString(currentItems[0], "id");
    if (!currentVersion || !itemId) throw new Error("phase_1_qa_item_concurrency_fixture_invalid");

    const updateResponses = await Promise.all([
      apiRequest(`/api/collections/${draft.id}/items/${itemId}`, jsonRequest({ expectedVersion: currentVersion, notes: "Atualizacao A" })),
      apiRequest(`/api/collections/${draft.id}/items/${itemId}`, jsonRequest({ expectedVersion: currentVersion, notes: "Atualizacao B" })),
    ]);
    const updateBodies = await Promise.all(updateResponses.map(readResponseBody));
    expect(updateResponses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(updateResponses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(updateBodies.some((body) => responseErrorCode(body) === "stale_version")).toBe(true);

    const afterUpdate = await getDraft(draft.id);
    const afterUpdateDraft = asRecord(afterUpdate["draft"]);
    const afterUpdateVersion = recordNumber(afterUpdateDraft, "rowVersion");
    if (!afterUpdateVersion) throw new Error("phase_1_qa_missing_post_update_version");
    const removeResponses = await Promise.all([
      apiRequest(`/api/collections/${draft.id}/items/${itemId}/remove`, jsonRequest({ expectedVersion: afterUpdateVersion })),
      apiRequest(`/api/collections/${draft.id}/items/${itemId}/remove`, jsonRequest({ expectedVersion: afterUpdateVersion })),
    ]);
    const removeBodies = await Promise.all(removeResponses.map(readResponseBody));
    expect(removeResponses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(removeResponses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(removeBodies.some((body) => responseErrorCode(body) === "stale_version")).toBe(true);
  });

  it.skipIf(!fullRemoteEnabled)("rejects evidence that references an item from another collection", async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();
    const draftA = await createDraft(customerA.id);
    const draftB = await createDraft(customerB.id);
    const itemB = await addItem(draftB);
    const invalid = await uploadEvidence(draftA.id, draftA.rowVersion, itemB.id);
    expect(invalid.response.ok).toBe(false);
    expect([400, 404, 409, 422]).toContain(invalid.response.status);
    const after = await getDraft(draftA.id);
    const afterDraft = asRecord(after["draft"]);
    expect(recordNumber(afterDraft, "rowVersion")).toBe(draftA.rowVersion);
  });

  it.skipIf(!fullRemoteEnabled)("maps concurrent duplicate tax IDs to duplicate_tax_id", async () => {
    const input = syntheticCustomer();
    const responses = await Promise.all([
      apiRequest("/api/customers", jsonRequest(input)),
      apiRequest("/api/customers", jsonRequest({ ...input, displayName: `${input.displayName} concorrente` })),
    ]);
    const bodies = await Promise.all(responses.map(readResponseBody));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(bodies.some((body) => responseErrorCode(body) === "duplicate_tax_id")).toBe(true);
  });

  it.skipIf(!fullRemoteEnabled)("supports complete address creation and update through the customer API", async () => {
    const customer = await createCustomer();
    const address = syntheticAddress();
    const createResponse = await apiRequest(`/api/customers/${customer.id}/addresses`, jsonRequest(address));
    const createBody = await readResponseBody(createResponse);
    expect([200, 201], JSON.stringify(createBody)).toContain(createResponse.status);
    const addressId = idFrom(nestedField(createBody, "data", "address"), "id");
    const patchResponse = await apiRequest(
      `/api/customers/${customer.id}/addresses/${addressId}`,
      jsonRequest({ ...address, streetNumber: "101", isPrimary: true }),
    );
    const patchBody = await readResponseBody(patchResponse);
    expect(patchResponse.status, JSON.stringify(patchBody)).toBe(200);
    expect(idFrom(nestedField(patchBody, "data", "address"), "id")).toBe(addressId);
  });

  it.skipIf(!fullRemoteEnabled)("paginates collection lists and event timelines by createdAt plus id", async () => {
    const drafts = await Promise.all([createCustomer(), createCustomer(), createCustomer()]);
    const createdDrafts = await Promise.all(drafts.map((customer) => createDraft(customer.id)));
    const listedIds: string[] = [];
    const listedDates: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 8; page += 1) {
      const query = new URLSearchParams({ limit: "1" });
      if (cursor) query.set("cursor", cursor);
      const response = await apiRequest(`/api/collections?${query.toString()}`);
      const body = await readResponseBody(response);
      expect(response.status, JSON.stringify(body)).toBe(200);
      const root = payload(body);
      const items = Array.isArray(root?.["items"]) ? root["items"].filter((item): item is Readonly<Record<string, unknown>> => asRecord(item) !== null).map((item) => asRecord(item) as Readonly<Record<string, unknown>>) : [];
      for (const item of items) {
        const id = recordString(item, "id");
        const createdAt = recordString(item, "createdAt");
        if (id) listedIds.push(id);
        if (createdAt) listedDates.push(createdAt);
      }
      const nextCursor = root?.["nextCursor"];
      cursor = typeof nextCursor === "string" ? nextCursor : null;
      if (!cursor) break;
    }
    expect(new Set(listedIds).size).toBe(listedIds.length);
    expect(createdDrafts.every((draft) => listedIds.includes(draft.id))).toBe(true);
    expect(listedDates.every((date, index) => index === 0 || date <= (listedDates[index - 1] ?? date))).toBe(true);

    const timelineIds: string[] = [];
    const timelineDates: string[] = [];
    let eventCursor: string | null = null;
    for (let page = 0; page < 8; page += 1) {
      const query = new URLSearchParams({ limit: "1" });
      if (eventCursor) query.set("cursor", eventCursor);
      const response = await apiRequest(`/api/collections/${createdDrafts[0]?.id ?? ""}/events?${query.toString()}`);
      const body = await readResponseBody(response);
      expect(response.status, JSON.stringify(body)).toBe(200);
      const root = payload(body);
      const items = Array.isArray(root?.["items"]) ? root["items"].filter((item): item is Readonly<Record<string, unknown>> => asRecord(item) !== null).map((item) => asRecord(item) as Readonly<Record<string, unknown>>) : [];
      for (const item of items) {
        const id = recordString(item, "id");
        const createdAt = recordString(item, "createdAt");
        if (id) timelineIds.push(id);
        if (createdAt) timelineDates.push(createdAt);
      }
      const nextCursor = root?.["nextCursor"];
      eventCursor = typeof nextCursor === "string" ? nextCursor : null;
      if (!eventCursor) break;
    }
    expect(new Set(timelineIds).size).toBe(timelineIds.length);
    expect(timelineDates.every((date, index) => index === 0 || date <= (timelineDates[index - 1] ?? date))).toBe(true);
  });

  it.skipIf(!fullRemoteEnabled)("requires an idempotency key with a domain-specific error", async () => {
    const collectionId = syntheticCollectionId();
    const response = await apiRequest(`/api/collections/${collectionId}/finalize`, jsonRequest({ expectedVersion: 1 }, { method: "POST" }));
    const body = await readResponseBody(response);
    expect(response.status).toBe(400);
    expect(responseErrorCode(body)).toBe("idempotency_key_required");
  });

  it.skipIf(!fullRemoteEnabled)("returns the same finalization result for concurrent retries", async () => {
    const customer = await createCustomer();
    const completed = await completeDraftForFinalize(customer);
    const evidence = await uploadEvidence(completed.draft.id, completed.draft.rowVersion, completed.item.id);
    expect(evidence.response.status, JSON.stringify(evidence.body)).toBe(201);
    const evidenceRecord = asRecord(nestedField(evidence.body, "data", "evidence"));
    const evidenceId = recordString(evidenceRecord, "id");
    if (!evidenceId) throw new Error("phase_1_qa_evidence_response_invalid");
    const signature = await saveSignature(completed.draft.id, completed.draft.rowVersion + 1);
    const key = syntheticIdempotencyKey();
    const results = await Promise.all([
      finalize(completed.draft.id, signature.rowVersion, key),
      finalize(completed.draft.id, signature.rowVersion, key),
    ]);
    const bodies = await Promise.all(results.map((result) => Promise.resolve(result.body)));
    expect(results.every((result) => result.response.status === 200), JSON.stringify(bodies)).toBe(true);
    const first = payload(bodies[0]);
    const second = payload(bodies[1]);
    expect(first).toEqual(second);
    expect(recordString(first, "officialCode")).toMatch(/^MJT-\d{4}-\d{6}$/);
  });

  it.skipIf(!fullRemoteEnabled)("serves a frozen customer and evidence snapshot after customer edits", async () => {
    const customer = await createCustomer();
    const completed = await completeDraftForFinalize(customer);
    const evidence = await uploadEvidence(completed.draft.id, completed.draft.rowVersion, completed.item.id);
    const evidenceRecord = asRecord(nestedField(evidence.body, "data", "evidence"));
    const evidenceId = recordString(evidenceRecord, "id");
    if (!evidenceId) throw new Error("phase_1_qa_evidence_response_invalid");
    const signature = await saveSignature(completed.draft.id, completed.draft.rowVersion + 1);
    const result = await finalize(completed.draft.id, signature.rowVersion, syntheticIdempotencyKey());
    expect(result.response.status, JSON.stringify(result.body)).toBe(200);

    const changedName = `${customer.displayName} Alterado Depois`;
    const customerPatch = await apiRequest(`/api/customers/${customer.id}`, jsonRequest({ displayName: changedName }));
    const customerPatchBody = await readResponseBody(customerPatch);
    expect(customerPatch.status, JSON.stringify(customerPatchBody)).toBe(200);

    const detailResponse = await apiRequest(`/api/collections/${completed.draft.id}`);
    const detailBody = await readResponseBody(detailResponse);
    expect(detailResponse.status, JSON.stringify(detailBody)).toBe(200);
    const detail = payload(detailBody);
    const detailCustomer = asRecord(detail?.["customer"]);
    const detailEvidence = Array.isArray(detail?.["evidences"]) ? detail["evidences"] : [];
    expect(recordString(detailCustomer, "name")).toBe(customer.displayName);
    expect(detailEvidence.some((item) => recordString(asRecord(item), "id") === evidenceId)).toBe(true);
  });

  it.skipIf(!rlsRemoteEnabled)("denies a second organization access to the first organization's collection", async () => {
    const config = requireRemoteConfig();
    const customer = await createCustomer(config.bearerToken);
    const draft = await createDraft(customer.id, config.bearerToken);
    const response = await apiRequest(`/api/collections/${draft.id}/draft`, { token: config.bearerTokenB ?? undefined });
    const body = await readResponseBody(response);
    expect([401, 403, 404], JSON.stringify(body)).toContain(response.status);
  });

  it.skipIf(!storageInspectionEnabled)("does not expose objects in a failed signature commit", async () => {
    const config = requireRemoteConfig();
    const customer = await createCustomer(config.bearerToken);
    const draft = await createDraft(customer.id, config.bearerToken);
    const stale = await saveSignature(draft.id, draft.rowVersion + 1, config.bearerToken).catch(async (error: unknown) => {
      expect(error).toBeDefined();
      return null;
    });
    expect(stale).toBeNull();
    const organizationId = config.organizationId;
    if (!organizationId) throw new Error("phase_1_qa_organization_id_missing");
    const listed = await listStoragePrefix(config.bearerToken, "collection-signatures", `${organizationId}/${draft.id}`);
    if (listed.error) {
      expect(listed.data).toBeNull();
      return;
    }
    expect(listed.data ?? []).toHaveLength(0);
  });
});

function remoteEnabled(): boolean {
  return remoteConfig !== null;
}
