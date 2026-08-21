import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-between bg-[var(--color-surface-bg)] px-6 py-10">
      <div>
        {/* Logo Mark MJT do Figma (64x64px, radius 18px, bg #4c916f) */}
        <div className="mb-8 flex items-center justify-start">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-[18px] bg-[var(--color-primary)] text-[18px] font-semibold text-white shadow-xs">
            MJT
          </div>
        </div>

        {/* Hero Title do Figma Node 27:3 */}
        <section className="mb-8">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Entre para continuar.
          </h1>
          <p className="mt-1.5 text-[14px] font-normal text-[var(--color-text-muted)]">
            Acesse o sistema de coleta e operação.
          </p>
        </section>

        <LoginForm />
      </div>

      <footer className="mt-10 text-center">
        <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
          MJT © 2026 · Sistema de Coleta e Operação
        </p>
      </footer>
    </main>
  );
}

