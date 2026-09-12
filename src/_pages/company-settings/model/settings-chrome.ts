export type SettingsChrome = Readonly<{
  title: string;
  subtitle: string;
}>;

export const hubChrome: SettingsChrome = {
  title: "Empresa",
  subtitle: "Dados institucionais",
};

export const leafChrome: SettingsChrome = {
  title: "Perfil institucional",
  subtitle: "Razão social, CNPJ e rodapé da guia",
};
