import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { projectRefFromUrl } from "./project-guard";

export function loadEnvLocal(cwd: string = process.cwd()): void {
  const envPath = path.join(cwd, ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const exportEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_CONFIRM_PROJECT_REF: z.string().min(1),
  BACKUP_OUTPUT_DIR: z.string().min(1),
});

const restoreEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_CONFIRM_PROJECT_REF: z.string().min(1),
  RESTORE_SUPABASE_URL: z.string().url(),
  RESTORE_SUPABASE_SECRET_KEY: z.string().min(1),
  RESTORE_CONFIRM_PROJECT_REF: z.string().min(1),
  RESTORE_DATABASE_URL: z.string().min(1),
  BACKUP_INPUT_DIR: z.string().min(1),
});

export type ExportEnvironment = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
  confirmProjectRef: string;
  outputDir: string;
  sourceProjectRef: string;
}>;

export type RestoreEnvironment = Readonly<{
  sourceProjectRef: string;
  restoreUrl: string;
  restoreSecretKey: string;
  restoreConfirmProjectRef: string;
  restoreDatabaseUrl: string;
  inputDir: string;
}>;

export function getExportEnvironment(): ExportEnvironment {
  const parsed = exportEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    SUPABASE_CONFIRM_PROJECT_REF: process.env["SUPABASE_CONFIRM_PROJECT_REF"],
    BACKUP_OUTPUT_DIR: process.env["BACKUP_OUTPUT_DIR"],
  });
  if (!parsed.success) {
    throw new Error("Variáveis de export ausentes ou inválidas (URL, SECRET, CONFIRM, BACKUP_OUTPUT_DIR).");
  }
  const sourceProjectRef = projectRefFromUrl(parsed.data.NEXT_PUBLIC_SUPABASE_URL);
  if (sourceProjectRef !== parsed.data.SUPABASE_CONFIRM_PROJECT_REF) {
    throw new Error("SUPABASE_CONFIRM_PROJECT_REF não coincide com NEXT_PUBLIC_SUPABASE_URL.");
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    confirmProjectRef: parsed.data.SUPABASE_CONFIRM_PROJECT_REF,
    outputDir: path.resolve(parsed.data.BACKUP_OUTPUT_DIR),
    sourceProjectRef,
  };
}

export function getRestoreEnvironment(): RestoreEnvironment {
  const parsed = restoreEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    SUPABASE_CONFIRM_PROJECT_REF: process.env["SUPABASE_CONFIRM_PROJECT_REF"],
    RESTORE_SUPABASE_URL: process.env["RESTORE_SUPABASE_URL"],
    RESTORE_SUPABASE_SECRET_KEY: process.env["RESTORE_SUPABASE_SECRET_KEY"],
    RESTORE_CONFIRM_PROJECT_REF: process.env["RESTORE_CONFIRM_PROJECT_REF"],
    RESTORE_DATABASE_URL: process.env["RESTORE_DATABASE_URL"],
    BACKUP_INPUT_DIR: process.env["BACKUP_INPUT_DIR"],
  });
  if (!parsed.success) {
    throw new Error(
      "Variáveis de restore ausentes ou inválidas (MVP CONFIRM/URL, RESTORE_*, BACKUP_INPUT_DIR).",
    );
  }
  const sourceProjectRef = projectRefFromUrl(parsed.data.NEXT_PUBLIC_SUPABASE_URL);
  if (sourceProjectRef !== parsed.data.SUPABASE_CONFIRM_PROJECT_REF) {
    throw new Error("SUPABASE_CONFIRM_PROJECT_REF não coincide com NEXT_PUBLIC_SUPABASE_URL.");
  }
  return {
    sourceProjectRef,
    restoreUrl: parsed.data.RESTORE_SUPABASE_URL,
    restoreSecretKey: parsed.data.RESTORE_SUPABASE_SECRET_KEY,
    restoreConfirmProjectRef: parsed.data.RESTORE_CONFIRM_PROJECT_REF,
    restoreDatabaseUrl: parsed.data.RESTORE_DATABASE_URL,
    inputDir: path.resolve(parsed.data.BACKUP_INPUT_DIR),
  };
}
