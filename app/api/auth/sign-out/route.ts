import { postSignOut } from "@/_app/api-routes";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return postSignOut(request);
}
