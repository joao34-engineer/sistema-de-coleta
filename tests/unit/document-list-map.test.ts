/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { mapNestedDocumentList } from "@/_pages/collection-documents/api/delivery/document-list-map";

const documentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const collectionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const artifactId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const issuedAt = "2026-09-13T12:00:00.000Z";
const createdAt = "2026-09-13T12:01:00.000Z";
const storagePath = `1/${collectionId}/${documentId}.pdf`;

describe("mapNestedDocumentList", () => {
  it("maps nested artifacts, pdf jobs and official code from one row", () => {
    const result = mapNestedDocumentList([
      {
        id: documentId,
        collection_id: collectionId,
        version: 1,
        status: "rendered",
        issued_at: issuedAt,
        document_artifacts: [
          {
            id: artifactId,
            document_id: documentId,
            artifact_type: "pdf",
            storage_path: storagePath,
            content_type: "application/pdf",
            byte_size: 2048,
            created_at: createdAt,
          },
        ],
        document_jobs: [
          { document_id: documentId, status: "succeeded", job_type: "render_pdf" },
          { document_id: documentId, status: "queued", job_type: "other" },
        ],
        collections: { official_code: "MJT-2026-000123" },
      },
    ]);

    expect(result.officialCode).toBe("MJT-2026-000123");
    expect(result.documents).toEqual([
      {
        id: documentId,
        collectionId,
        version: 1,
        status: "rendered",
        issuedAt,
        pdfJobStatus: "succeeded",
        artifacts: [
          {
            id: artifactId,
            type: "pdf",
            contentType: "application/pdf",
            byteSize: 2048,
            createdAt,
          },
        ],
      },
    ]);
  });

  it("returns an empty list without official code when there are no documents", () => {
    expect(mapNestedDocumentList([])).toEqual({ documents: [], officialCode: null });
  });
});
