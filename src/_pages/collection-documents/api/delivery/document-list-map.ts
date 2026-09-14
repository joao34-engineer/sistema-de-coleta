import { z } from "zod";
import {
  documentArtifactRowSchema,
  documentJobStatusSchema,
  documentListRowSchema,
  type DocumentListDTO,
} from "./contracts";

const nestedJobRowSchema = z.object({
  document_id: z.uuid(),
  status: documentJobStatusSchema,
  job_type: z.string().nullable().optional(),
});

const collectionEmbedSchema = z.object({
  official_code: z.string().nullable(),
});

const nestedDocumentRowSchema = z.object({
  id: documentListRowSchema.shape.id,
  collection_id: documentListRowSchema.shape.collection_id,
  version: documentListRowSchema.shape.version,
  status: documentListRowSchema.shape.status,
  issued_at: documentListRowSchema.shape.issued_at,
  document_artifacts: z.array(documentArtifactRowSchema).nullable().optional(),
  document_jobs: z.array(nestedJobRowSchema).nullable().optional(),
  collections: z.union([collectionEmbedSchema, z.array(collectionEmbedSchema)]).nullable().optional(),
});

function officialCodeFromEmbed(embed: z.output<typeof nestedDocumentRowSchema>["collections"]): string | null {
  const row = Array.isArray(embed) ? embed[0] : embed;
  const value = row?.official_code;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type CollectionDocumentListResult = Readonly<{
  documents: ReadonlyArray<DocumentListDTO>;
  officialCode: string | null;
}>;

export function mapNestedDocumentList(rows: unknown): CollectionDocumentListResult {
  const parsedRows = z.array(nestedDocumentRowSchema).parse(rows ?? []);
  let officialCode: string | null = null;
  const documents = parsedRows.map((row) => {
    if (officialCode === null) {
      officialCode = officialCodeFromEmbed(row.collections);
    }
    const pdfJob = (row.document_jobs ?? []).find((job) => job.job_type === "render_pdf");
    return {
      id: row.id,
      collectionId: row.collection_id,
      version: row.version,
      status: row.status,
      issuedAt: row.issued_at,
      ...(pdfJob ? { pdfJobStatus: pdfJob.status } : {}),
      artifacts: (row.document_artifacts ?? []).map((artifact) => ({
        id: artifact.id,
        type: artifact.artifact_type,
        contentType: artifact.content_type,
        byteSize: artifact.byte_size,
        createdAt: artifact.created_at,
      })),
    };
  });
  return { documents, officialCode };
}
