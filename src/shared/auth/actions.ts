"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/shared/config/routes";
import { createServerSupabaseClient } from "./supabase-server";

export type SignOutActionState = Readonly<{ status: "idle" | "error"; message?: string }>;

export const initialSignOutState: SignOutActionState = { status: "idle" };

const signOutFailure: SignOutActionState = {
  status: "error",
  message: "Não foi possível encerrar a sessão. Tente novamente.",
};

export async function signOutAction(
  _previous: SignOutActionState = initialSignOutState,
): Promise<SignOutActionState> {
  void _previous;
  try {
    const supabase = await createServerSupabaseClient({ cookieMutation: "required" });
    const { error } = await supabase.auth.signOut();
    if (error) return signOutFailure;
  } catch {
    return signOutFailure;
  }
  revalidatePath("/", "layout");
  redirect(routes.login);
}
