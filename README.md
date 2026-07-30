# NutriPro

PWA em português para diário alimentar, metas nutricionais, água, peso e receitas. A aplicação usa Supabase Auth e PostgreSQL com isolamento por usuário via RLS; chaves administrativas nunca entram no frontend.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Instalação

1. Copie `.env.example` para `.env` e informe `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. No SQL Editor do Supabase, execute `supabase/migrations/202607300001_initial_schema.sql` e, depois, `supabase/seed.sql`.
3. Em **Authentication > URL Configuration**, adicione `http://localhost:5173` às Redirect URLs.
4. Execute `npm install` e `npm run dev`.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor local |
| `npm run test` | Testes unitários de cálculos |
| `npm run lint` | Análise estática |
| `npm run build` | Build de produção e service worker |
| `npm run preview` | Visualiza o build local |

## Banco e segurança

A migration inclui as tabelas de perfil, metas, alimentos, porções, favoritos, refeições, itens com snapshots, receitas, água, peso, medidas, notas, preferências e auditoria. Todas usam UUID e timestamps; os dados pessoais contam com RLS. Alimentos públicos são visíveis a todos, e somente administradores podem alterá-los.

O trigger de novos usuários cria automaticamente perfil, metas iniciais e preferências. Configure a confirmação de e-mail no painel Auth do Supabase conforme a política desejada.

## Offline e PWA

O manifest, o service worker e o cache de navegação são gerados no build. A fila `src/lib/offline.ts` usa IndexedDB e UUIDs no cliente para suportar sincronização sem duplicidade; conecte as mutações que exigirem persistência offline a `enqueueOffline` e `syncPending` conforme a estratégia de conflito do produto.

## Estrutura

```text
src/
  components/      layout, cards e status de conexão
  hooks/           autenticação
  lib/             Supabase, offline e cálculos puros
  pages/           fluxos de interface
  services/        consultas e mutações Supabase
supabase/          migrations e seed
```

Os valores nutricionais são gravados sem arredondamento; a formatação ocorre somente na apresentação. Os alimentos seed são identificados como demonstração.
