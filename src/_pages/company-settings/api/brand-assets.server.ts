import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api/database.types";
import { getServiceEnvironment } from "@/shared/config/environment";

type BrandAsset = Readonly<{ id: string; storage_path: string }>;

type CreateOrReuseLogoAssetInput = Readonly<{
  storageClient: SupabaseClient<Database>;
  organizationId: number;
  actorUserId: string;
  file: File;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
  sha256: string;
}>;

export type CreateOrReuseLogoAssetResult =
  | Readonly<{ ok: true; assetId: string; storagePath: string; reused: boolean }>
  | Readonly<{ ok: false; code: "asset_lookup_failed" | "asset_upload_failed" | "asset_persist_failed" | "asset_link_failed" }>;

function createCompanySettingsServiceClient(): SupabaseClient<Database> {
  const environment = getServiceEnvironment();
  return createClient<Database>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findExistingLogoAsset(client: SupabaseClient<Database>, organizationId: number, sha256: string): Promise<BrandAsset | null | "error"> {
  const { data, error } = await client
    .from("organization_brand_assets")
    .select("id,storage_path")
    .eq("organization_id", organizationId)
    .eq("asset_type", "logo")
    .eq("sha256", sha256)
    .maybeSingle();

  if (error) return "error";
  return data;
}

async function linkLogoAsset(client: SupabaseClient<Database>, organizationId: number, actorUserId: string, asset: BrandAsset): Promise<boolean> {
  const { error } = await client
    .from("organization_settings")
    .update({ logo_asset_id: asset.id, logo_path: asset.storage_path, updated_by: actorUserId })
    .eq("organization_id", organizationId);

  return !error;
}

/**
 * User-provided logo bytes are uploaded with the authenticated administrator
 * session. This narrow service-role adapter is used only for immutable asset
 * metadata lookup/insert, linking the asset to organization_settings, and
 * compensating deletion of an unconfirmed UUID path when a hash race occurs.
 * It never exposes the client or its secret outside this server-only module.
 */
export async function createOrReuseLogoAsset(input: CreateOrReuseLogoAssetInput): Promise<CreateOrReuseLogoAssetResult> {
  const metadataClient = createCompanySettingsServiceClient();
  const existing = await findExistingLogoAsset(metadataClient, input.organizationId, input.sha256);
  if (existing === "error") return { ok: false, code: "asset_lookup_failed" };

  if (existing) {
    const linked = await linkLogoAsset(metadataClient, input.organizationId, input.actorUserId, existing);
    return linked
      ? { ok: true, assetId: existing.id, storagePath: existing.storage_path, reused: true }
      : { ok: false, code: "asset_link_failed" };
  }

  const storagePath = `${input.organizationId}/company-logo/${crypto.randomUUID()}.${input.extension}`;
  const { error: uploadError } = await input.storageClient.storage.from("organization-assets").upload(storagePath, input.file, {
    contentType: input.contentType,
    upsert: false,
  });
  if (uploadError) return { ok: false, code: "asset_upload_failed" };

  const { data: inserted, error: insertError } = await metadataClient
    .from("organization_brand_assets")
    .insert({
      organization_id: input.organizationId,
      asset_type: "logo",
      storage_path: storagePath,
      content_type: input.contentType,
      byte_size: input.file.size,
      sha256: input.sha256,
      created_by: input.actorUserId,
    })
    .select("id,storage_path")
    .maybeSingle();

  if (insertError || !inserted) {
    // The only expected insert race is the immutable hash uniqueness rule.
    // Remove solely our unconfirmed UUID path with the narrow administrative
    // adapter because authenticated delete is not granted on this bucket.
    await metadataClient.storage.from("organization-assets").remove([storagePath]);
    const winner = await findExistingLogoAsset(metadataClient, input.organizationId, input.sha256);
    if (winner === "error" || !winner) return { ok: false, code: "asset_persist_failed" };
    const linked = await linkLogoAsset(metadataClient, input.organizationId, input.actorUserId, winner);
    return linked
      ? { ok: true, assetId: winner.id, storagePath: winner.storage_path, reused: true }
      : { ok: false, code: "asset_link_failed" };
  }

  const linked = await linkLogoAsset(metadataClient, input.organizationId, input.actorUserId, inserted);
  if (!linked) {
    // The metadata row is immutable once inserted. Keep it for a safe retry
    // instead of deleting evidence that may have been observed concurrently.
    return { ok: false, code: "asset_link_failed" };
  }

  return { ok: true, assetId: inserted.id, storagePath: inserted.storage_path, reused: false };
}
