import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api/database.types";
import { getBootstrapEnvironment } from "@/shared/config/environment";

function projectRefFromUrl(value: string): string {
  const hostname = new URL(value).hostname;
  const [ref] = hostname.split(".");
  if (!ref) throw new Error("Não foi possível identificar o project ref.");
  return ref;
}

async function main(): Promise<void> {
  const environment = getBootstrapEnvironment();
  const url = new URL(environment.supabaseUrl);
  const projectRef = projectRefFromUrl(environment.supabaseUrl);
  const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";

  if (!isLocal && environment.confirmProjectRef !== projectRef) {
    throw new Error("BOOTSTRAP_CONFIRM_PROJECT_REF não coincide com o projeto remoto.");
  }
  if (isLocal && !environment.adminPassword) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD é obrigatório no ambiente local.");
  }
  if (!isLocal && environment.adminPassword) {
    throw new Error("O bootstrap remoto não recebe nem altera senha; crie o usuário no painel e remova BOOTSTRAP_ADMIN_PASSWORD.");
  }

  const admin = createClient<Database>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;
  if (isLocal) {
    const { data, error } = await admin.auth.admin.createUser({
      email: environment.adminEmail.toLowerCase(),
      password: environment.adminPassword ?? "",
      email_confirm: true,
    });
    if (error && error.code !== "email_exists" && !error.message.toLowerCase().includes("already")) {
      throw new Error("Não foi possível criar o administrador local.");
    }
    if (data.user) {
      userId = data.user.id;
    } else {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listed.data.users.find((user) => user.email?.toLowerCase() === environment.adminEmail.toLowerCase());
      if (!match) throw new Error("Administrador local não encontrado após criação.");
      userId = match.id;
    }
  } else {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matches = listed.data.users.filter((user) => user.email?.toLowerCase() === environment.adminEmail.toLowerCase());
    if (matches.length !== 1) throw new Error("O e-mail remoto deve identificar exatamente um usuário criado manualmente.");
    const match = matches[0];
    if (!match) throw new Error("Usuário remoto não encontrado.");
    userId = match.id;
  }

  const { data: organization, error: organizationError } = await admin.from("organizations").select("id").eq("code", "mjt").single();
  if (organizationError || !organization) throw new Error("Organização MJT não encontrada; execute as migrations.");

  const { error: membershipError } = await admin
    .from("organization_memberships")
    .upsert({ organization_id: organization.id, user_id: userId, role_code: "administrator", status: "active" }, { onConflict: "organization_id,user_id" });
  if (membershipError) throw new Error("Não foi possível criar o vínculo administrativo.");

  const subjectId = `${organization.id}:${userId}`;
  const { data: existingAudit, error: auditLookupError } = await admin
    .from("audit_events")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("event_type", "organization.admin.bootstrapped")
    .eq("subject_type", "organization_membership")
    .eq("subject_id", subjectId)
    .limit(1)
    .maybeSingle();
  if (auditLookupError) throw new Error("Não foi possível verificar a auditoria do bootstrap.");

  if (!existingAudit) {
    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: organization.id,
      actor_user_id: userId,
      event_type: "organization.admin.bootstrapped",
      subject_type: "organization_membership",
      subject_id: subjectId,
      metadata: { source: isLocal ? "local_script" : "remote_script" },
    });
    if (auditError) throw new Error("Vínculo criado, mas a auditoria não pôde ser registrada.");
  }

  console.log(`Administrador provisionado para o projeto ${projectRef}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha inesperada no bootstrap.";
  console.error(message);
  process.exitCode = 1;
});
