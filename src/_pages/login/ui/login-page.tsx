import Image from "next/image";
import { LoginForm } from "./login-form";

export function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-between bg-[var(--color-surface-bg)] px-6 py-10">
      <div>
        {/* Logo real da MJT Tornearia (PNG 395x288, fundo transparente) */}
        <div className="mb-8 flex items-center justify-start">
          <Image
            src="/logo/Logo_-_MJT-removebg-preview.png"
            alt="MJT Tornearia"
            width={88}
            height={64}
            priority
            className="h-16 w-auto"
          />
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
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
          MJT Tornearia · Usinagem de peças · Solda Elétrica e Mecânica
        </p>
        <p className="mt-1 text-[12px] font-normal text-[var(--color-text-muted)]">
          (21) 98663-8936 · mjt.mjtornearia@gmail.com
        </p>
      </footer>
    </main>
  );
}
