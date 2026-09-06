"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase-server";

export type SignOutActionState = Readonly<{ status: "idle" | "error"; message?: string }>;

export const initialSignOutState: SignOutActionState = { status: "idle" };

export async function signOutAction(
  _previous: SignOutActionState = initialSignOutState,
): Promise<SignOutActionState> {
  const supabase = await createServerSupabaseClient({ cookieMutation: "required" });
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { status: "error", message: "Não foi possível encerrar a sessão. Tente novamente." };
  }
  redirect("/login");
}
