import { z } from "zod";
import { projectRefFromUrl } from "./project-ref";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional().or(z.literal("")),
});

const bootstrapEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional().or(z.literal("")),
  BOOTSTRAP_CONFIRM_PROJECT_REF: z.string().min(1).optional(),
});

const serviceEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_CONFIRM_PROJECT_REF: z.string().min(1),
});

type PublicEnvironment = Readonly<{
  appUrl: string | undefined;
  supabaseUrl: string;
  supabasePublishableKey: string;
}>;

export type BootstrapEnvironment = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
  adminEmail: string;
  adminPassword: string | undefined;
  confirmProjectRef: string | undefined;
}>;

export type ServiceEnvironment = Readonly<{
  supabaseUrl: string;
  supabaseSecretKey: string;
  confirmProjectRef: string;
}>;

export class ServiceEnvironmentInvalidError extends Error {
  constructor() {
    super("Variáveis de serviço Supabase ausentes ou inválidas.");
    this.name = "ServiceEnvironmentInvalidError";
  }
}

export class ServiceEnvironmentMismatchError extends Error {
  constructor() {
    super("SUPABASE_CONFIRM_PROJECT_REF");
    this.name = "ServiceEnvironmentMismatchError";
  }
}

export function assertServiceProjectRef(environment: ServiceEnvironment): void {
  let urlRef: string;
  try {
    urlRef = projectRefFromUrl(environment.supabaseUrl);
  } catch {
    throw new ServiceEnvironmentInvalidError();
  }
  if (environment.confirmProjectRef !== urlRef) {
    throw new ServiceEnvironmentMismatchError();
  }
}

export function getPublicEnvironment(): PublicEnvironment {
  const parsed = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  });

  if (!parsed.success || !parsed.data.NEXT_PUBLIC_SUPABASE_URL || !parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Configuração pública do Supabase ausente ou inválida.");
  }

  return {
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL || undefined,
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function hasPublicEnvironment(): boolean {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  return typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0;
}

export function getBootstrapEnvironment(): BootstrapEnvironment {
  const parsed = bootstrapEnvironmentSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    BOOTSTRAP_ADMIN_EMAIL: process.env["BOOTSTRAP_ADMIN_EMAIL"],
    BOOTSTRAP_ADMIN_PASSWORD: process.env["BOOTSTRAP_ADMIN_PASSWORD"],
    BOOTSTRAP_CONFIRM_PROJECT_REF: process.env["BOOTSTRAP_CONFIRM_PROJECT_REF"],
  });

  if (!parsed.success || !parsed.data.NEXT_PUBLIC_SUPABASE_URL) {
    const fields = parsed.success ? ["NEXT_PUBLIC_SUPABASE_URL"] : parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Variáveis de bootstrap ausentes ou inválidas: ${fields.join(", ")}.`);
  }

  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    adminEmail: parsed.data.BOOTSTRAP_ADMIN_EMAIL,
    adminPassword: parsed.data.BOOTSTRAP_ADMIN_PASSWORD || undefined,
    confirmProjectRef: parsed.data.BOOTSTRAP_CONFIRM_PROJECT_REF,
  };
}

export function getServiceEnvironment(): ServiceEnvironment {
  const parsed = serviceEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    SUPABASE_CONFIRM_PROJECT_REF: process.env["SUPABASE_CONFIRM_PROJECT_REF"],
  });

  if (!parsed.success) throw new ServiceEnvironmentInvalidError();

  const environment = {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    confirmProjectRef: parsed.data.SUPABASE_CONFIRM_PROJECT_REF,
  };
  assertServiceProjectRef(environment);
  return environment;
}
