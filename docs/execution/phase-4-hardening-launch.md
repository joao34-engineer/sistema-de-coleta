# Fase 4 — Confiabilidade e lancamento

## Objetivo

Autorizar o uso real em campo, incluindo operacao com internet instavel, recuperacao e seguranca. Ate esta fase, a producao remota do MVP permanece em validacao controlada.

## Estado real (22/08/2026)

- Manifest PWA existe (`app/manifest.ts`) nas cores MJT (theme `#4c916f`, bg `#f7f8f7`) — corrigido na Onda 1 do RECOVERY-PLAN.
- **Nao existe** service worker, fila de sincronizacao offline, armazenamento local de rascunhos, backup testado, observabilidade nem testes de campo. Nenhum passo desta fase foi implementado alem do manifest.
- Os 4 gates remotos da Fase 1A (RLS cruzada, concorrencia, storage privado, cleanup real) permanecem ADIADOS — ver `phase-1-collection-core.md`.

## Passos

1. Implementar manifest, instalacao PWA e cache controlado do aplicativo.
2. Implementar armazenamento local temporario de rascunhos, itens e assinatura, com fila de sincronizacao.
3. Garantir idempotencia e mensagens claras para sincronizacao repetida ou falha parcial.
4. Criar painel/aviso de itens pendentes de sincronizacao e estrategia de recuperacao.
5. Revisar RLS, Storage, links, rate limits, logs e autorizacao de cada comando.
6. Configurar observabilidade, alerta de erros e verificacao de disponibilidade.
7. Configurar backup de banco e de arquivos; executar restauracao em ambiente isolado.
8. Realizar testes de campo em Android, iPhone e computador, com conexao lenta/interrompida.
9. Treinar usuarios e publicar procedimento curto de coleta, incidente e suporte.
10. Autorizar a operacao real gradualmente, acompanhando primeiras guias e indicadores.

## Casos de teste de campo

- Perder internet antes e depois de assinar.
- Fechar e reabrir o navegador antes de sincronizar.
- Tentar finalizar duas vezes apos reconectar.
- Compartilhar PDF por WhatsApp e abrir QR em outro celular.
- Tentar acessar documento com usuario sem permissao.
- Restaurar banco e arquivo de evidencia em ambiente isolado.

## Criterios de lancamento

- Nenhum dado de teste existe na producao.
- Backup e restauracao foram comprovados, inclusive para PDFs/assinaturas.
- Equipe sabe identificar coleta pendente de sincronizacao.
- Responsavel da MJT aprovou visual da guia, textos e dados institucionais ativos.
- Ha responsavel definido para suporte, acessos e incidentes.
