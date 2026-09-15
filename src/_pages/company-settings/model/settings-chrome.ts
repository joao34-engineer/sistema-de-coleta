export type SettingsChrome = Readonly<{
  title: string;
  subtitle: string;
}>;

export const settingsLogoSrc = "/logo/Logo_-_MJT-removebg-preview.png";

export const hubChrome: SettingsChrome = {
  title: "Conta",
  subtitle: "Configurações da conta",
};

export const leafChrome: SettingsChrome = {
  title: "Empresa",
  subtitle: "Dados institucionais",
};

export const hubLegalFact = {
  label: "Dados jurídicos",
  value: "Razão social, CNPJ e rodapé dos recibos",
} as const;

export const hubProfileFact = {
  label: "Perfil institucional",
  value: "Editar no fluxo /configuracoes/empresa",
} as const;

export const hubSignOutFact = {
  label: "Sair",
  value: "Encerra a sessão deste aparelho",
} as const;
