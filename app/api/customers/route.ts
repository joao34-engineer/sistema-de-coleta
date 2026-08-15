import { createCustomer, listCustomers } from "@/_pages/customers/api/customers.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> { return listCustomers(request); }
export async function POST(request: Request): Promise<Response> { return createCustomer(request); }
