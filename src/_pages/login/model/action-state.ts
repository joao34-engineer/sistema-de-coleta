export type LoginActionState = Readonly<{
  status: "idle" | "error";
  code: "validation_error" | "invalid_credentials" | "rate_limit_exceeded" | "temporarily_unavailable" | "unexpected_error";
  fieldErrors?: Readonly<{ email?: string; password?: string }>;
  message?: string;
}>;

export const initialLoginActionState: LoginActionState = { status: "idle", code: "validation_error" };
