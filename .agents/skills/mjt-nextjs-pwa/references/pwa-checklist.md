# Checklist Next.js PWA MJT

- Rota em `app/` e fina; FSD esta em `src/`.
- Server Component e padrao; fronteira client e minima; props sao serializaveis.
- Entrada e autorizacao sao verificadas no servidor.
- Modulos de dados/segredo importam `server-only`.
- Cache de dados privados e erros e `no-store`/nao publico.
- Manifest, icones e service worker foram revisados.
- Rascunho offline mostra estado, persiste com seguranca e sincroniza idempotentemente.
- Atualizacao do service worker nao perde trabalho pendente.
- Testes cobrem offline, reconexao e tela em dispositivo alvo.
