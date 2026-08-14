import type { Database as GeneratedDatabase, Json as GeneratedJson } from "./database.generated";

export type Json = GeneratedJson;
export type Database = GeneratedDatabase;
export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["organization_memberships"]["Row"];
export type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];
export type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
