# TypeScript e contratos

## Baseline

TypeScript e o contrato de desenvolvimento, nao uma sugestao. Usar `strict: true` e proibir `any`, supressoes de erro e non-null assertion como forma de contornar incerteza.

Configurar e manter, salvo incompatibilidade documentada:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Adotar isso no scaffold inicial, antes de haver codigo que precisaria ser corrigido. `exactOptionalPropertyTypes` diferencia uma propriedade ausente de uma propriedade presente com valor `undefined`; `noUncheckedIndexedAccess` obriga verificar acessos possivelmente inexistentes.

## Regras de codigo

- Preferir `type` para unioes, contratos derivados e discriminated unions; `interface` e aceitavel para extensao aberta de objetos.
- Modelar estado e erros de dominio com unioes discriminadas e codigos estaveis; nunca decidir por texto de `error.message`.
- Tratar dados de `FormData`, JSON, `searchParams`, QR, upload, local storage e Supabase como entrada externa. Entram como `unknown` e passam por schema/type guard antes do uso.
- Usar `readonly` em DTOs e colecoes que nao pertencem ao consumidor.
- Usar `as const satisfies` para estados, permissoes e configuracoes canonicas.
- Manter casts raros, junto da borda de biblioteca e justificados por validacao anterior; nao encadear `as`.
- Definir props de componente e retorno de funcao publica explicitamente quando isso torna o contrato mais claro; nao exportar tipos de banco diretamente para o cliente.

## Tipos de banco e DTOs

Os tipos gerados pelo Supabase sao a fonte de verdade para o schema e ficam em `src/shared/api/database.types.ts` quando o banco existir. Eles nao sao o contrato de tela automaticamente.

Cada consulta server-side seleciona colunas explicitamente, converte para um DTO de caso de uso e entrega ao cliente somente o necessario. Nao usar `select('*')`, nem enviar assinatura, token, auditoria integral ou campos administrativos por conveniencia.

## Erros

Em `catch`, estreitar `unknown` antes de ler propriedades. O usuario recebe mensagem segura e acionavel; logs internos preservam contexto sem CPF, telefone, assinatura, segredo ou URL privada.

Fontes: [TSConfig](https://www.typescriptlang.org/tsconfig/) e [configuracao TypeScript do Next.js](https://nextjs.org/docs/app/api-reference/config/typescript).
