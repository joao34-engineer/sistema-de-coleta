export type CaptureActor = Readonly<{
  userId: string;
  organizationId: number;
}>;

export const captureSteps = ["cliente", "itens", "revisao", "assinatura"] as const;
export type CaptureStep = (typeof captureSteps)[number];

export const syncUxStates = ["online", "saved_locally", "syncing", "synced", "failed"] as const;
export type SyncUxState = (typeof syncUxStates)[number];
