-- Fase 1A: endurecimento de ACLs depois da aplicação da migration de núcleo.
-- Esta migration não altera dados nem schema; remove EXECUTE implícito de
-- PUBLIC/anon/service_role e deixa cada RPC disponível somente ao papel que
-- realmente o utiliza.

revoke execute on function
  public.create_customer_with_address_for_organization(bigint, text, text, text, jsonb),
  public.create_customer_with_address(text, text, text, jsonb),
  public.update_collection_draft(uuid, integer, jsonb),
  public.create_collection_item(uuid, integer, text, numeric, text, text, integer),
  public.update_collection_item(uuid, uuid, integer, jsonb),
  public.update_collection_item(uuid, uuid, integer, text, numeric, text, text, integer),
  public.remove_collection_item(uuid, uuid, integer),
  public.prepare_collection_upload(uuid, integer, text, uuid, text, integer, text, text, text, text, text),
  public.commit_collection_upload(uuid, integer),
  public.cancel_collection_upload(uuid),
  public.save_collection_signature(uuid, integer, text, text, text, text, text, integer),
  public.finalize_collection(uuid, integer, uuid, text),
  public.cancel_collection(uuid, integer, text, uuid, text),
  public.reopen_collection(uuid, integer, text, uuid, text),
  public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer),
  public.get_collection_detail(uuid),
  public.list_collection_events(uuid, text, integer),
  public.verify_collection_document(text),
  public.expire_collection_upload_intents(integer),
  public.ack_collection_upload_cleanup(uuid)
from public, anon, authenticated, service_role;

-- O helper público explícito de organização não é usado pela API atual. Ele
-- permanece sem grant; somente a fachada de quatro argumentos fica exposta a
-- authenticated.
grant execute on function
  public.create_customer_with_address(text, text, text, jsonb)
to authenticated;

grant execute on function
  public.update_collection_draft(uuid, integer, jsonb),
  public.create_collection_item(uuid, integer, text, numeric, text, text, integer),
  public.update_collection_item(uuid, uuid, integer, jsonb),
  public.update_collection_item(uuid, uuid, integer, text, numeric, text, text, integer),
  public.remove_collection_item(uuid, uuid, integer),
  public.prepare_collection_upload(uuid, integer, text, uuid, text, integer, text, text, text, text, text),
  public.commit_collection_upload(uuid, integer),
  public.cancel_collection_upload(uuid),
  public.save_collection_signature(uuid, integer, text, text, text, text, text, integer),
  public.finalize_collection(uuid, integer, uuid, text),
  public.cancel_collection(uuid, integer, text, uuid, text),
  public.reopen_collection(uuid, integer, text, uuid, text),
  public.list_collections(text, text, text, text, text, timestamptz, timestamptz, text, integer),
  public.get_collection_detail(uuid),
  public.list_collection_events(uuid, text, integer)
to authenticated;

grant execute on function public.verify_collection_document(text)
to anon, authenticated;

grant execute on function
  public.expire_collection_upload_intents(integer),
  public.ack_collection_upload_cleanup(uuid)
to service_role;
