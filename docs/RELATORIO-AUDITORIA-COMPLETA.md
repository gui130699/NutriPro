# Relatório de auditoria completa — NutriPro

## Identificação

| Item | Valor |
| --- | --- |
| Início da auditoria | 2026-08-05 09:24 (America/Sao_Paulo, UTC-03:00) |
| Conclusão técnica | 2026-08-05 11:03 (America/Sao_Paulo, UTC-03:00) |
| Repositório | `https://github.com/gui130699/NutriPro` |
| Branch de segurança | `backup/pre-correcao-completa-2026-08-05` |
| Backup remoto | `origin/backup/pre-correcao-completa-2026-08-05` |
| Branch funcional | `fix/homologacao-completa-nutripro` |
| Commit inicial preservado | `bfe144aa11745608c4efa8f6f1f6cdf442b044cd` |
| Commit funcional | `1cf1ee95c4dd8582f3649adc6719b345c4135926` |
| Commit documental | assunto `docs: record full NutriPro validation`; consultar `git log` (o hash é atribuído depois da geração deste arquivo) |
| Aplicativo | `0.9.0` |
| Catálogo | `2.0.0-br`, 626 alimentos, data `2026-08-01` |

## Resumo executivo

A auditoria saiu de uma linha de base com smoke público e unitários aprovados, porém sem Java/Emulators e com regras/payloads ainda permissivos. O resultado final contém ambiente Emulator reproduzível, onboarding com estados explícitos, regras Firestore estruturais, isolamento A/B, unidades/densidade offline, snapshots históricos, E2E autenticado, acessibilidade Axe, dez viewports, PWA e divisão de chunks.

Resultado final automatizado: **138 testes/cenários aprovados** — 81 unitários, 21 de regras, 13 E2E autenticados e 23 E2E públicos — além de catálogo, TypeScript, lint, build normal e build GitHub Pages.

Nenhum projeto, credencial ou dado Firebase de produção foi acessado. Nenhum deploy ou migração de produção foi executado.

## Linha de base real

| Comando | Resultado inicial |
| --- | --- |
| `npm ci` | aprovado após repetição; primeira tentativa excedeu 120 s |
| `npm run catalog:validate` | 626 alimentos aprovados |
| `npx tsc -b --pretty false` | aprovado |
| `npm run lint` | aprovado |
| `npm run test` | 19 arquivos / 72 testes aprovados |
| `npm run test:e2e` | 18/18 smoke isolados com `VITE_E2E=true` |
| `npm run build` | aprovado com chunk `useAuth` de 716,82 kB / 216,68 kB gzip |
| build Pages | aprovado com o mesmo aviso de chunk |
| Emulator | não executado inicialmente, pois Java não estava no `PATH` |

Diagnósticos iniciais confirmados:

- falha ao ler `profiles/{uid}` era tratada como onboarding incompleto;
- não havia suíte real de Auth/Firestore Emulator;
- coleções críticas aceitavam payloads pouco restritos;
- consultas de uso/padrão de unidade eram mais amplas que o necessário;
- o diário não guiava `unidade`/`porção` ausentes;
- densidade permitia faixa excessiva;
- versão do app era `0.0.0`;
- bundle inicial excedia 500 kB;
- três dependências e dois SVGs não tinham uso;
- `supabase/` não possuía integração ativa.

## Ambiente final

| Ferramenta | Versão/decisão |
| --- | --- |
| Node.js executado | `25.1.0` |
| npm | `11.6.2` |
| Firebase CLI | `15.25.1`, dependência de desenvolvimento |
| Java | Temurin JDK `21.0.12+8` portátil |
| Recomendação do projeto | Node 22 ou 24 LTS + JDK 21 |

O JDK foi obtido como runtime portátil em `C:\Users\guilh\AppData\Local\NutriProTools\jdk21\jdk-21.0.12+8`. Esse caminho é somente da máquina auditada e não é requisito fixo do repositório.

## Correções realizadas

### 1. Onboarding e autenticação

- Estado centralizado em `loading | complete | incomplete | error`.
- Erro de rede, deadline ou permissão não vira mais “perfil ausente”.
- UI recuperável com “Não foi possível verificar seu perfil”, tentar novamente e sair.
- Onboarding consulta os documentos canônicos antes de gravar, preserva `createdAt` e evita duplicar peso inicial.
- Removida inicialização automática de perfil no listener de autenticação.
- Helper E2E espera o gate de autenticação terminar antes de navegar, eliminando condição de corrida.
- Erros de credencial permanecem em português.

### 2. Perfil

- Formulário só inicializa depois de perfil, metas e último peso concluírem o carregamento.
- Eliminada corrida que podia resetar os campos após digitação.
- Rodapé mostra versões reais do app e catálogo.

### 3. Regras Firestore

As regras foram reforçadas para:

- `profiles`, `userPreferences`, `goals`, `foods`;
- `foodOverrides`, `foodFavorites`, `foodUsage`;
- `foodUnitProfiles`, `foodDensityProfiles`;
- `mealTypes`, `mealItems`, `waterLogs`;
- `weightLogs`, `bodyMeasurements`, `physicalAssessments`;
- `recipes` e `dailyNotes`.

Validações incluem autenticação, proprietário, chaves permitidas, tipos, intervalos, enums, timestamps, `createdAt` imutável, snapshots e campos canônicos. Leituras de IDs determinísticos ausentes só são aceitas para o prefixo do próprio usuário e são separadas de `list`.

O payload de avaliação física foi compactado: campos opcionais nulos não são gravados; ao editar e limpar um campo, `deleteField()` o remove. Isso mantém o schema estrito sem exceder o limite de 1.000 expressões das regras.

### 4. Favoritos idempotentes

`setFavorite` usa transação. Criar duas vezes não altera `createdAt`; remover um favorito já ausente é inócuo. As regras permitem consultar apenas o ID determinístico ausente cujo prefixo corresponde à sessão.

### 5. Unidades, porções e densidade

- Políticas explícitas de medida no catálogo.
- Seleções diretas `unidade`, `porção` e `+ nova medida`.
- Modal com nome, valor, base, singular, plural, padrão, persistente/temporária, Escape e atributos acessíveis.
- Valor de unidade entre `0,1` e `10.000`; densidade entre `0,1` e `20 g/ml`.
- ID determinístico por usuário + origem + alimento + nome normalizado.
- Consulta de uso canônica e fallback legado, ambas com `limit(1)`.
- Consulta de padrão limitada a usuário + alimento + origem.
- Transação desmarca pares concorrentes antes de definir o padrão.
- Snapshots de item incluem `unitProfileId`, rótulo, quantidade por unidade, base, consumo e `nutrientBaseAmount`.
- Edição futura do perfil não reinterpreta histórico.
- Exclusão de perfil usado vira desativação reversível.

### 6. Offline

- Firestore usa cache persistente multiaba.
- Catálogo e metadados permanecem no IndexedDB.
- Perfis de unidade/densidade e fila pendente usam Dexie.
- O navegador offline falha rápido, sem aguardar repetidas transações de rede.
- O perfil salvo offline entra imediatamente no cache da query e aparece como “Aguardando sincronização”.
- Evento `online` reenvia operações determinísticas.
- E2E comprovou 626 itens em cache, fila `1 → 0` e um único documento remoto após reconexão.

### 7. Catálogo TACO

- Catálogo regenerado com 126 curados + 500 TACO.
- Cada item recebe `measurementPolicy`.
- TACO permanece em base de 100 g, inclusive bebidas; nenhuma equivalência 1 ml = 1 g foi inventada.
- Bebidas TACO exigem densidade ou medida explícita para uso volumétrico.
- `catalog:validate` confirma totais, versões, IDs, hashes e artefatos.

### 8. Serviços e payloads

- Água rejeita zero/negativo e valores acima de 20.000 ml.
- Alimento particular remove `undefined` antes de `addDoc`; atualização usa `deleteField()` quando necessário.
- Override tocado remove aliases legados proibidos.
- Migração de snapshots reconhece aliases snake_case e deriva `nutrientBaseAmount` em modo dry-run por padrão.
- Índices de Firestore foram atualizados para snapshots/campos canônicos.

### 9. Acessibilidade e responsividade

- Axe foi incorporado às suítes pública e autenticada.
- Contrastes da tela de acesso e dashboard foram corrigidos.
- Modal possui nomes acessíveis e fechamento por Escape.
- Dez viewports, de 320×568 a 1920×1080, passaram sem overflow horizontal.
- Inspeção pelo navegador integrado confirmou login, cadastro, recuperação, mostrar/ocultar senha, mensagens, título e zero logs de warning/error no fluxo normal.

### 10. Performance e chunks

Antes:

```text
useAuth: 716,82 kB (216,68 kB gzip)
Evolution: 368,10 kB
```

Depois, build final:

| Chunk | Tamanho | Gzip |
| --- | ---: | ---: |
| `firebase-firestore` | 377,27 kB | 109,01 kB |
| `useAuth` | 314,58 kB | 100,14 kB |
| `index` | 264,91 kB | 84,29 kB |
| `charts` | 245,46 kB | 62,12 kB |
| `Evolution` | 135,55 kB | 46,87 kB |

Não há chunk acima de 500 kB. A divisão usa grupos de Firestore, Auth, core Firebase e gráficos, além de lazy loading das páginas.

### 11. Limpeza segura

- Removidos após `rg` confirmar ausência de uso: `@tanstack/react-query-devtools`, `date-fns`, `eslint-config-prettier`, `src/assets/react.svg`, `src/assets/vite.svg`.
- `supabase/` não tinha referência ativa; foi preservado em `archive/supabase-legacy/` em vez de apagado.
- Alterações locais anteriores foram preservadas no commit/branch de backup.

## Matriz final de testes

| Comando | Saída final | Estado |
| --- | --- | --- |
| `npm run catalog:validate` | 626 (`126 + 500`) | Aprovado |
| `npm run test:typecheck` | 0 diagnósticos | Aprovado |
| `npm run lint` | código 0 | Aprovado |
| `npm run test:unit` | 20 arquivos / 81 testes | Aprovado |
| `npm run test:firebase` | 1 arquivo / 21 regras | Aprovado |
| `npm run test:e2e:firebase` | 13/13 | Aprovado |
| `npm run test:e2e` | 23/23 | Aprovado |
| `npm run build` | PWA e SW, 47 precache | Aprovado |
| build Pages | PWA e SW, base `/NutriPro/` | Aprovado |

A rodada agregada final `npm run test:all` terminou com código 0 em aproximadamente 246 s. O build Pages foi repetido separadamente depois dela e também passou.

## Auditoria de dependências

Comando:

```bash
npm audit --omit=dev --audit-level=high
```

Achados e tratamento:

1. `fast-uri@3.1.4`, high `GHSA-7p8r-x3mc-p8w7`: **corrigido** por override para `3.1.5`, versão patched oficial.
2. `react-router@7.18.2`, high `GHSA-qwww-vcr4-c8h2`: **exceção temporária documentada**. O advisory declara impacto apenas nas APIs RSC instáveis; o NutriPro usa `BrowserRouter` como SPA e não usa RSC, actions de servidor ou SSR. A versão patched indicada, `8.3.0`, ainda não estava publicada no npm em 2026-08-05.

Foi testado o downgrade sugerido pelo audit para `7.11.0`, mas ele abriu um conjunto maior de advisories de XSS, redirect, SSR e DoS; a alteração foi revertida. Não foi aplicado `npm audit fix --force`. Reavaliar quando React Router publicar uma versão corrigida compatível.

## Warnings conhecidos da execução

- Node 25 gera `EBADENGINE` porque `superstatic@10` suporta oficialmente Node 20/22/24. Recomendação: Node 22 ou 24 LTS.
- Warnings WebChannel nos E2E são esperados nos cenários que simulam perda de rede/403. O fluxo normal inspecionado no navegador terminou com console limpo.
- `MetadataLookupWarning` vem do ambiente Firebase CLI ao encerrar processos locais; não afetou códigos de saída nem asserções.

## Migrações

`scripts/migrate-meal-snapshots.ts` é dry-run por padrão e foi atualizado, mas **não foi executado contra produção**. Procedimento recomendado:

1. exportar backup do Firestore;
2. executar dry-run em homologação;
3. revisar contagens e exemplos;
4. executar com flag explícita de escrita no projeto correto;
5. repetir `test:firebase` e smoke autenticado.

## Itens não executados

- deploy Firebase/Pages;
- merge em `main`;
- migração real;
- instalação PWA física;
- leitor de tela físico;
- teste contra contas ou dados de produção.

Esses itens estão deliberadamente marcados como não executados, e não como aprovados.

## Resultado

O código local e o pacote de documentação estão homologados para revisão na branch funcional. Não há falha de teste conhecida. O único risco aberto é o advisory RSC do React Router, sem caminho usado no NutriPro e sem versão corrigida publicada na data da auditoria. A publicação ainda depende de revisão humana e das validações operacionais pós-deploy.
