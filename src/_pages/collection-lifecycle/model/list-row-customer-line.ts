export function listRowCustomerLine(customerName: string | null, itemCount: number): string {
  const name = customerName ?? "Cliente não informado";
  const itemWord = itemCount === 1 ? "item" : "itens";
  return `${name} · ${itemCount} ${itemWord}`;
}
