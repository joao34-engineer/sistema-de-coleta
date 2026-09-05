import type { OrganizationSettingsRow } from "./database.types";

export type IssuerPublicationStatus = "published" | "incomplete" | "failed";

export type CompanySettingsDTO = Readonly<{
  organizationId: number;
  displayName: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: Readonly<{ street: string | null; streetNumber: string | null; complement: string | null; district: string | null; city: string | null; stateCode: string | null; postalCode: string | null }>;
  receiptLegalText: string | null;
  signerName: string | null;
  signerTitle: string | null;
  logoPath: string | null;
  setupStatus: "pending" | "complete";
  updatedAt: string;
}>;

export type CompanySettingsRow = OrganizationSettingsRow;
