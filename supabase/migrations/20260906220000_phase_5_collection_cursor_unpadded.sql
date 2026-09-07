-- Cursor de paginação em RFC 4648 base64url compacto.
-- encode(..., 'base64') no PostgreSQL é RFC 2045 (quebra a cada 76 colunas).
-- list_collections / list_collection_events devolvem nextCursor; o contrato da app
-- é [A-Za-z0-9_-]+. Mesma assinatura; sem DROP; sem alteração de dados.

create or replace function private.encode_collection_cursor(
  p_created_at timestamp with time zone,
  p_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    rtrim(
      replace(
        encode(
          convert_to(
            jsonb_build_object(
              'createdAt', p_created_at,
              'id', p_id
            )::text,
            'UTF8'
          ),
          'base64'
        ),
        E'\n',
        ''
      ),
      '='
    ),
    '+/',
    '-_'
  );
$$;
