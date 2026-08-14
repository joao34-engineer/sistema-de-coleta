import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(254, "E-mail muito longo."),
  password: z.string().min(1, "Informe sua senha.").max(128, "Senha inválida."),
});

export type LoginInput = z.infer<typeof loginSchema>;
