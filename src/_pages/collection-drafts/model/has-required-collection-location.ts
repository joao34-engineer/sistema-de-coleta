/**
 * Local da coleta é obrigatório na guia; endereço cadastral do cliente é opcional.
 * @see docs/architecture/data-and-rules.md
 */
export function hasRequiredCollectionLocation(location: string | null | undefined): boolean {
  return (location?.trim().length ?? 0) >= 1;
}
