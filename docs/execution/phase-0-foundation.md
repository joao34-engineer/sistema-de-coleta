# Fase 0 — Fundacao do projeto

## Objetivo

Criar uma base independente, repetivel e segura antes de qualquer funcionalidade de coleta.

## Passos

1. Confirmar que esta pasta e um repositorio Git proprio, com remoto proprio quando definido.
2. Criar o projeto Next.js com TypeScript, lint, testes e convencoes de codigo.
3. Criar projetos Supabase distintos para desenvolvimento, staging e producao; nunca reutilizar o projeto da Shopee.
4. Configurar variaveis de ambiente documentadas em `.env.example`, sem segredos reais versionados.
5. Configurar Auth, tabela de perfis, organizacao MJT e papeis iniciais.
6. Criar a estrutura de dominios, migrations versionadas e politicas RLS vazias/negativas por padrao.
7. Configurar Storage privado para documentos, assinaturas e evidencias.
8. Configurar CI para lint, tipos, testes e build; criar ambiente de staging.
9. Criar configuracoes editaveis da empresa: nome exibido, dados institucionais, logo e texto da guia.

## Nao fazer nesta fase

- Usar dados reais de clientes em desenvolvimento.
- Criar tabela sem RLS ou bucket publico para "facilitar".
- Implementar NF-e, WhatsApp API ou tela de oficina.
- Tratar configuracao institucional como constante no codigo.

## Criterios de aceite

- O projeto e clonado e iniciado apenas com instrucoes documentadas e variaveis de exemplo.
- Usuario nao autenticado nao le dados da aplicacao.
- Usuarios autenticados sem permissao nao recebem dados por tabela, API ou Storage.
- O pipeline falha para erros de tipo, lint ou testes.
- Staging usa banco e credenciais diferentes de producao.

## Saidas documentais

- README de desenvolvimento atualizado.
- Mapa de variaveis de ambiente.
- Registro da decisao de hospedagem, dominio e proprietario operacional.
