# Checklist Supabase MJT

- Migration e aditiva; nao apaga dados, eventos ou objetos.
- RLS esta ativa em tabela/view exposta e policies foram revisadas por operacao.
- Policy possui escopo de organizacao, papel e `WITH CHECK` em escrita.
- Chave secret/service role esta em modulo `server-only` e fora de logs/respostas.
- Consulta seleciona colunas explicitas e converte para DTO.
- Bucket e privado; caminho e interno; upload valida MIME/tamanho; download e temporario.
- RPC nao usa `SECURITY DEFINER` sem ADR, grants minimos e `search_path`.
- Testes cobrem acesso permitido e negado para dados e Storage.
- Tipos gerados e documentacao foram atualizados.
