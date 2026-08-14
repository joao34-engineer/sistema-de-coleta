import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-medium border border-border bg-surface p-7 shadow-surface">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">MJT</p>
        <h1 className="text-2xl font-semibold">Sistema de Coleta</h1>
        <p className="mt-2 mb-7 text-sm text-muted">Entre com o acesso administrativo para continuar.</p>
        <LoginForm />
      </section>
    </main>
  );
}
