import Image from "next/image";
import { LoginForm } from "./login-form";

const LOGIN_LOGO_SRC = "/logo/Logo_-_MJT-removebg-preview.png";

export function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-between bg-[var(--color-surface-bg)] px-6 pb-10 pt-6">
      <div>
        <header className="mb-8 flex items-center gap-3">
          <Image
            src={LOGIN_LOGO_SRC}
            alt="MJT Tornearia"
            width={44}
            height={32}
            priority
            className="h-8 w-auto shrink-0"
          />
          <div className="flex min-w-0 flex-col">
            <p className="text-[18px] font-semibold leading-8 text-[var(--color-text-primary)]">Acessar</p>
            <p className="text-[12px] font-normal leading-4 text-[var(--color-text-muted)]">
              Sistema de Coleta MJT
            </p>
          </div>
        </header>

        <section className="mb-8">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Entre para continuar.
          </h1>
          <p className="mt-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px] leading-5 text-[var(--color-text)]">
            No iPhone o app não aparece na App Store. Abra este site no Safari, toque em Compartilhar e
            depois em Adicionar à Tela de Início.
          </p>
        </section>

        <LoginForm />

        <p className="mt-6 text-[12px] leading-4 text-[var(--color-text-muted)]">
          Sem cadastro ou recuperação de senha neste MVP.
        </p>
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
