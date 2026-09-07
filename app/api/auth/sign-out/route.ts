import { postSignOut } from "@/_app/api-routes/sign-out";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return postSignOut(request);
}
