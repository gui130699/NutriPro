# NutriPro

PWA em português para diário alimentar, metas nutricionais, água, peso e receitas. A aplicação usa Firebase Authentication e Cloud Firestore com regras de isolamento por usuário; chaves administrativas nunca entram no frontend.

## Requisitos

- Node.js 20+
- Um projeto Firebase com Authentication (E-mail/senha), Cloud Firestore e Hosting habilitados

## Instalação

1. Copie `.env.example` para `.env` e informe a chave pública (`VITE_FIREBASE_API_KEY`) e o App ID (`VITE_FIREBASE_APP_ID`) do projeto Firebase.
2. Em **Authentication > Sign-in method**, ative **E-mail/senha**.
3. Execute `firebase login`, `firebase deploy --only firestore:rules,firestore:indexes` e `npm run dev`.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor local |
| `npm run test` | Testes unitários de cálculos |
| `npm run lint` | Análise estática |
| `npm run build` | Build de produção e service worker |
| `npm run preview` | Visualiza o build local |
| `firebase deploy` | Publica regras, índices e Hosting |

## Firebase e segurança

As coleções principais são `profiles`, `goals`, `foods`, `mealItems`, `waterLogs`, `weightLogs`, `recipes` e `dailyNotes`. `firestore.rules` protege qualquer registro que possua `userId`: o usuário só cria, lê, atualiza e exclui seus próprios documentos. Alimentos públicos devem ser criados pelo Console Firebase ou por uma futura função administrativa autenticada.

Configure a confirmação de e-mail no painel Authentication do Firebase conforme sua política. O perfil e as metas podem ser criados no onboarding do app.

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
