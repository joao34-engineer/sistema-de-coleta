import { describe, expect, it } from "vitest";
import {
  messageForQueueError,
  titleForOperatorError,
} from "@/_pages/collection-drafts/model/offline-copy";
import { classifyCommandError } from "@/shared/lib/command-error";

const PERMISSION_COPY = "Você não tem permissão para esta ação.";

describe("S09 permission copy", () => {
  it("maps access-denied codes to ação, not operação", () => {
    expect(classifyCommandError({ code: "administrator_access_denied" }).actionMessage).toBe(
      PERMISSION_COPY,
    );
    expect(messageForQueueError("forbidden")).toBe(PERMISSION_COPY);
    expect(messageForQueueError("administrator_access_denied")).toBe(PERMISSION_COPY);
  });

  it("titles the operator panel Sem permissão for that body", () => {
    expect(titleForOperatorError(PERMISSION_COPY, "Erro")).toBe("Sem permissão");
  });
});
