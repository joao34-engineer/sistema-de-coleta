/**
 * Thread-pool stand-in for the native `sharp` addon.
 * Importing the real module inside `worker_threads` deadlocks on Windows.
 * Tests that must render PDFs belong in the Vitest `native` (forks) project.
 */
export default function sharp(): never {
  throw new Error("sharp is a native addon; load it only from the Vitest native project");
}
