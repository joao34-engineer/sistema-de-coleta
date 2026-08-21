import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between bg-[var(--color-background)] px-4 py-8">
      <div>
        {/* Topbar / Header MJT do Figma */}
        <header className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 rounded-[16px] border shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-sm font-bold text-white">
              MJT
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-[var(--color-text)]">
                Acessar
              </h1>
              <p className="text-[12px] text-[var(--color-muted)]">
                Sistema de Coleta MJT
              </p>
            </div>
          </div>
        </header>

        {/* Hero Title do Figma */}
        <section className="mb-6 px-1">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text)]">
            Entre para continuar.
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Credenciais do coletor ou administrador da oficina.
          </p>
        </section>

        <LoginForm />
      </div>

      <footer className="mt-8 text-center">
        <p className="text-[12px] text-[var(--color-muted)]">
          Sem cadastro ou recuperação de senha neste MVP.
        </p>
      </footer>
    </main>
  );
}
