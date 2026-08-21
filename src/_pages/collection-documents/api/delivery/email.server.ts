import "server-only";

import { createResendAdapter } from "./resend-adapter";
import {
  authorizeShareForEmail,
  completeDocumentShareEmailDelivery,
  reserveDocumentShareEmailDelivery,
} from "./shares.server";
import type { EmailShareInput } from "./contracts";
import { getPublicEnvironment } from "@/shared/config/environment";
import { buildDocumentShareUrl } from "./share-token";
import { documentRateLimitRules, enforceDocumentRateLimit } from "./rate-limit.server";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function queueDocumentShareEmail(shareId: string, input: EmailShareInput, idempotencyKey: string, expectedDocumentId?: string) {
  const authorization = await authorizeShareForEmail(shareId, expectedDocumentId, input.shareToken);
  await Promise.all([
    enforceDocumentRateLimit(documentRateLimitRules.emailAdministrator, `administrator:${authorization.createdBy}`),
    enforceDocumentRateLimit(documentRateLimitRules.emailOrganization, `organization:${authorization.organizationId}`),
  ]);
  const reservation = await reserveDocumentShareEmailDelivery(shareId, idempotencyKey);
  if (!reservation.canSend || reservation.reservationToken === null) {
    return { idempotent: true, pending: reservation.delivery === null, delivery: reservation.delivery };
  }
  const environment = getPublicEnvironment();
  if (!environment.appUrl) throw new Error("document_share_base_url_missing");
  const secureUrl = buildDocumentShareUrl(environment.appUrl, input.shareToken);
  const recipientMasked = maskEmail(input.email);

  try {
    const result = await createResendAdapter().send({
      to: input.email,
      subject: "Guia de coleta MJT",
      text: `Acesse o link seguro da sua guia de coleta: ${secureUrl}`,
      idempotencyKey,
    });
    const completed = await completeDocumentShareEmailDelivery({
      reservationId: reservation.reservationId,
      reservationToken: reservation.reservationToken,
      result: result.result,
      recipientMasked,
      providerReference: result.providerReference,
      errorCode: null,
    });
    return { idempotent: false, pending: false, delivery: completed };
  } catch (error: unknown) {
    try {
      await completeDocumentShareEmailDelivery({
        reservationId: reservation.reservationId,
        reservationToken: reservation.reservationToken,
        result: "failed",
        recipientMasked,
        providerReference: null,
        errorCode: "document_email_provider_failed",
      });
    } catch {
      // The original provider failure remains the safe error boundary. The
      // reservation lease expires and can be retried with the same key.
    }
    throw error;
  }
}
