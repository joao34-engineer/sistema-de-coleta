import { handleCreateCustomer, handleListCustomers } from "@/_pages/customers/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> { return handleListCustomers(request); }
export async function POST(request: Request): Promise<Response> { return handleCreateCustomer(request); }
