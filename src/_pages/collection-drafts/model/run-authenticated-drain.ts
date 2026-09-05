import type { CaptureActor } from "./capture-actor";
import { ensureOfflineDraftStore } from "./offline-port";
import { productionOfflineCommands } from "./production-offline-commands";
import { browserDrainLock, drainAllPending, type DrainPendingResult } from "./offline-runner";

export async function runAuthenticatedDrain(actor: CaptureActor): Promise<DrainPendingResult> {
  const store = await ensureOfflineDraftStore();
  return drainAllPending({
    store,
    commands: productionOfflineCommands,
    actor,
    lock: browserDrainLock(),
  });
}
