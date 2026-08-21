import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] font-bold text-xl border border-[var(--color-primary)]">
            MJT
          </div>
          <span className="inline-block rounded-full bg-[var(--color-surface-green)] px-3 py-1 text-xs font-medium text-[var(--color-primary-strong)]">
            Sistema de Coleta PWA
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Acesso do Operador</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Entre com suas credenciais de coletor ou gestor da oficina
          </p>
        </div>

        <LoginForm />

        <div className="mt-6 border-t border-[var(--color-border)] pt-4 text-center text-xs text-[var(--color-muted)]">
          <p>MJT Soluções Industriais • M12 Mobile</p>
        </div>
      </section>
    </main>
  );
}
