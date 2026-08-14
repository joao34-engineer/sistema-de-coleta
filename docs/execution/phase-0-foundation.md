# Fase 0 — Fundacao do projeto

## Objetivo

Criar uma base independente, repetivel e segura, publicada em um ambiente remoto de producao controlada do MVP, antes de qualquer funcionalidade de coleta.

## Estado de implementacao

O scaffold Next.js, a autenticacao, o dashboard, as configuracoes institucionais, o Storage privado, as migrations iniciais e os testes basicos ja foram criados. A fase permanece aberta enquanto a protecao contra senhas vazadas nao for ativada no painel Supabase e enquanto o smoke test autenticado remoto nao for concluido.

## Passos

1. Confirmar que esta pasta e um repositorio Git proprio, com remoto proprio quando definido.
2. Criar o projeto Next.js com TypeScript, lint, testes e convencoes de codigo.
3. Criar e configurar um unico projeto Supabase remoto proprio para desenvolvimento integrado, validacao controlada e producao tecnica do MVP; nunca reutilizar o projeto da Shopee. O Supabase local fica adiado.
4. Configurar variaveis de ambiente documentadas em `.env.example`, sem segredos reais versionados.
5. Configurar Auth, tabela de perfis, organizacao MJT e o unico perfil de administrador do MVP.
6. Criar a estrutura de dominios, migrations versionadas e politicas RLS vazias/negativas por padrao.
7. Configurar Storage privado para documentos, assinaturas e evidencias.
8. Configurar CI para lint, tipos, testes e build; nao criar staging remoto nesta etapa.
9. Criar configuracoes editaveis da empresa: nome exibido, dados institucionais, logo e texto da guia.

## Nao fazer nesta fase

- Usar dados reais de clientes em desenvolvimento.
- Criar tabela sem RLS ou bucket publico para "facilitar".
- Implementar NF-e, WhatsApp API ou tela de oficina.
- Tratar configuracao institucional como constante no codigo.
- Implementar convite por e-mail, cadastro de outros usuarios, gestao de equipe, recuperacao de senha por e-mail ou SMTP transacional. O MVP tera somente um administrador; a expansao de usuarios sera planejada quando houver necessidade operacional e infraestrutura de e-mail apropriada.
- Usar o ambiente remoto para coletas reais, documentos ou evidencias insubstituiveis antes de a Fase 4 comprovar backup, restauracao e procedimento operacional.

## Criterios de aceite

- O projeto e clonado e iniciado apenas com instrucoes documentadas e variaveis de exemplo.
- Usuario nao autenticado nao le dados da aplicacao.
- Usuarios autenticados sem permissao nao recebem dados por tabela, API ou Storage.
- O pipeline falha para erros de tipo, lint ou testes.
- O unico projeto Supabase remoto e separado de qualquer projeto Shopee; nao ha Supabase local ou staging remoto nesta fase.
- O deploy remoto da Vercel usa somente as credenciais do projeto Supabase remoto; previews nao recebem segredos nem acesso ao banco remoto.
- A protecao contra senhas vazadas do Supabase Auth esta habilitada e o advisor de seguranca nao apresenta alerta de autenticacao pendente.
- O ambiente remoto esta publicado como producao tecnica do MVP, mas permanece em validacao controlada com dados sinteticos ate a liberacao operacional da Fase 4.
- Toda mudanca de schema chega ao ambiente remoto por migration aditiva versionada, revisada e conferida com `supabase db push --dry-run`; nenhum reset ou comando destrutivo e permitido.

## Saidas documentais

- README de desenvolvimento atualizado.
- Mapa de variaveis de ambiente.
- Registro da decisao de hospedagem, dominio e proprietario operacional.
- ADR do modelo de ambientes e do limite de uso do MVP.
