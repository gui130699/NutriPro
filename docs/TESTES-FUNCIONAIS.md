# Testes funcionais e homologação — NutriPro 0.9.0

Rodada de referência: **2026-08-05**, fuso `America/Sao_Paulo` (UTC-03:00).
Branch: `fix/homologacao-completa-nutripro`.
Commit funcional: `1cf1ee95c4dd8582f3649adc6719b345c4135926`.
Catálogo: `2.0.0-br`, atualizado em `2026-08-01`, com **626 alimentos** (`126` curados + `500` TACO).

Este documento substitui o status histórico de 2026-08-01. Na rodada atual, Java 21 foi disponibilizado e os testes autenticados/regras foram efetivamente executados com Firebase Emulator Suite. Nenhum dado ou projeto Firebase de produção foi usado.

## Ambiente validado

| Componente | Valor executado |
| --- | --- |
| Sistema | Windows / PowerShell |
| Node.js | `25.1.0` |
| npm | `11.6.2` |
| Java | Temurin JDK `21.0.12+8` portátil |
| Firebase CLI | `15.25.1` |
| Chromium | instalado pelo Playwright |
| Projeto Emulator | `nutripro-test` |
| Auth Emulator | `127.0.0.1:9099` |
| Firestore Emulator | `127.0.0.1:8080` |
| Emulator UI | `127.0.0.1:4000` |

Para desenvolvimento recorrente, use Node 22 ou 24 LTS. A execução em Node 25 passou, mas `superstatic` declara engines 20/22/24 e produz aviso de compatibilidade.

## Instalação e configuração

```bash
npm ci
npx playwright install chromium
```

Para desenvolvimento real, copie `.env.example` para `.env` e preencha apenas a configuração Web pública `VITE_FIREBASE_*`. Nunca armazene conta de serviço, chave privada, token ou senha no frontend. Para Emulator, o projeto contém `.env.test` com identificadores falsos e `VITE_USE_FIREBASE_EMULATORS=true`.

No PowerShell, quando Java não estiver no `PATH`:

```powershell
$env:JAVA_HOME='C:\caminho\para\jdk-21'
$env:PATH=(Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
```

## Comando agregado aprovado

```bash
npm run test:all
```

O comando executa, nesta ordem:

```text
catalog:validate
test:typecheck
lint
test:unit
test:firebase
test:e2e:firebase
build
test:e2e
```

Resultado final em 2026-08-05, após instalação e lockfile atualizados: **código de saída 0**.

## Matriz de resultados executados

| Grupo | Comando | Resultado real | Estado |
| --- | --- | --- | --- |
| Instalação reprodutível | `npm ci --no-audit --no-fund` | 1.230 pacotes instalados; somente avisos de engine/depreciação | Aprovado |
| Consistência do lock final | `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | código 0 | Aprovado |
| Catálogo | `npm run catalog:validate` | 626 alimentos; 126 curados + 500 TACO | Aprovado |
| TypeScript | `npm run test:typecheck` | nenhum diagnóstico | Aprovado |
| Lint | `npm run lint` | Oxlint, código 0 | Aprovado |
| Unitários | `npm run test:unit` | 20 arquivos, **81/81** testes | Aprovado |
| Regras Firestore | `npm run test:firebase` | 1 arquivo, **21/21** testes no Emulator | Aprovado |
| E2E autenticado | `npm run test:e2e:firebase` | **13/13** no Auth + Firestore Emulator | Aprovado |
| E2E público | `npm run test:e2e` | **23/23** em Chromium | Aprovado |
| Build normal/PWA | `npm run build` | 2.487 módulos; SW + manifest; 47 itens no precache | Aprovado |
| Build Pages/PWA | `NUTRIPRO_GITHUB_PAGES=true npm run build` | base Pages, SW + manifest; 47 itens no precache | Aprovado |
| Navegador integrado | sessão local em `127.0.0.1:4175` | login/cadastro/recuperação, campos, botões, mensagens, ativos e overflow; 0 warnings/0 errors | Aprovado |
| Auditoria npm | `npm audit --omit=dev --audit-level=high` | `fast-uri` corrigido; 2 ocorrências altas do mesmo advisory RSC do React Router | Aprovado com exceção documentada |

Total automatizado: **138 verificações aprovadas** (`81 + 21 + 13 + 23`), sem contar catálogo, tipagem, lint e builds.

## E2E público — 23 cenários

A configuração pública exclui `tests/e2e/firebase/**` e força `VITE_E2E=true`; portanto não inicializa Firebase nem pode tocar produção.

- 5 cenários de login, cadastro, recuperação e tema.
- 1 cenário Axe com WCAG 2 A/AA e navegação por teclado.
- 5 redirecionamentos de rotas privadas.
- 2 cenários de instalação PWA (prompt compatível e guia Safari/iOS).
- 10 viewports sem rolagem horizontal:
  - `320×568`, `360×800`, `375×667`, `390×844`, `414×896`;
  - `768×1024`, `820×1180`, `1024×768`;
  - `1366×768`, `1920×1080`.

O Axe inicialmente encontrou três contrastes insuficientes na tela de acesso. As cores foram corrigidas e a repetição encerrou com `violations = []`. O dashboard autenticado também foi analisado com Axe e terminou sem violações A/AA detectáveis.

## E2E autenticado — 13 cenários

A suíte autenticada executa `npm run build` e serve o resultado com
`npm run preview` antes de abrir o Chromium. Assim, os 13 cenários validam os
chunks otimizados de produção contra Auth e Firestore Emulator, sem acessar o
projeto real. Essa cobertura impede a regressão em que uma divisão manual dos
módulos Firebase passava no servidor de desenvolvimento, mas quebrava a
inicialização do Firestore no GitHub Pages.

Todos os cenários usam usuários descartáveis, limpam Auth/Firestore Emulator entre testes e recusam execução se as variáveis não apontarem para `127.0.0.1:8080` e `127.0.0.1:9099`.

1. Perfil completo abre o dashboard; perfil ausente abre onboarding.
2. Falha de permissão/rede na leitura de perfil mostra estado recuperável e não redireciona incorretamente.
3. Onboarding cria perfil, metas e peso inicial de forma idempotente, inclusive com clique duplo.
4. Um usuário não vê alimento particular de outra conta.
5. Unidade direta abre modal, preserva quantidade e grava snapshot histórico de 160 g.
6. Catálogo com 626 itens permanece no IndexedDB; unidade criada offline entra na fila, aparece pendente e sincroniza uma única vez ao reconectar.
7. Credencial inválida mantém mensagem em português.
8. Dashboard autenticado passa no Axe WCAG A/AA.
9. Perfil atualiza nome, metas e peso histórico e mostra versões reais `0.9.0`/`2.0.0-br`.
10. Hidratação bloqueia negativo, cria 350 ml e exclui o lançamento correto.
11. Evolução e medidas corporais preservam históricos separados.
12. Avaliação física manual calcula IMC e persiste somente campos informados.
13. Lista particular cria alimento sem gravar `undefined`; bebida TACO permanece explicitamente em base de 100 g.

Os warnings de WebChannel vistos na saída são esperados somente nos testes que deliberadamente retiram a rede ou interceptam o endpoint do Emulator. A inspeção interativa normal, sem simulação de falha, registrou zero warnings e zero errors.

## Regras Firestore — 21 testes

Cobertura efetiva:

- acesso anônimo negado;
- leitura/escrita restrita ao `userId` autenticado;
- duas contas A/B sem vazamento;
- validação de `mealItems`, `waterLogs`, `foodOverrides` e `foodFavorites`;
- IDs determinísticos ainda ausentes legíveis somente pelo prefixo do dono;
- documento determinístico forjado de outra conta negado;
- unidades e densidades com origem, base, faixas, estado e proprietário válidos;
- transações de unidade e peso vinculado idempotentes;
- avaliação física mínima válida, escrita administrativa de seed e peso negativo negado.

As regras compilam no Emulator. Consultas `get` e `list` são separadas quando a leitura de um ID ausente é necessária para uma transação segura.

## Unidades, porções, densidade e histórico

| Requisito | Evidência |
| --- | --- |
| Valor de medida | Unitários cobrem vírgula/ponto e limites; regras exigem `0,1–10.000` |
| Densidade | validação limita `0,1–20 g/ml`; conversão cruzada exige perfil explícito |
| Modal | nome, quantidade, base, singular, plural, padrão, salvar/temporária, Escape e acessibilidade |
| Seleção direta | `unidade` e `porção` usam perfil/sugestão ou abrem o modal automaticamente |
| Snapshot | `unitProfileId`, rótulo, quantidade por unidade, base e quantidade nutricional permanecem históricos |
| Consultas | uso de unidade usa consulta canônica e fallback legado, ambos com `limit(1)` |
| Padrão | consulta limitada ao mesmo usuário + alimento + origem; transação remove padrões concorrentes |
| Offline | IndexedDB, fila determinística, status pendente e sincronização ao evento `online` comprovados em E2E |

## Catálogo e TACO

O comando exato de regeneração da rodada foi:

```bash
npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv \
  --taco data/sources/taco-4a-edicao-cleaned.csv \
  --additional-total 500 \
  --expected-total 626 \
  --version 2.0.0-br \
  --updated-at 2026-08-01
```

Política de medida publicada:

- base `ml`: origem volumétrica;
- TACO: massa explícita por 100 g, inclusive bebidas;
- bebida não TACO em base de massa: volume exige densidade;
- demais itens: massa.

Nenhuma versão em ml foi inventada para alimentos TACO. A interface alerta que bebidas TACO em gramas precisam de densidade ou medida personalizada para uso em ml.

## PWA, offline e builds

- `generateSW` produziu `dist/sw.js` e `dist/workbox-2fbc6a65.js`.
- 47 entradas, aproximadamente 1,799 MiB, foram incluídas no precache.
- O service worker usa `autoUpdate`, `skipWaiting`, `clientsClaim` e limpeza de
  caches antigos. Uma versão nova assume o controle sem depender do bundle
  anterior, inclusive quando esse bundle falha durante a inicialização.
- O catálogo público mantém troca atômica no IndexedDB e não substitui cache íntegro por download parcial.
- Firestore usa cache persistente multiaba.
- A instalação real em Android/iOS/desktop físico **não foi executada**; somente os fluxos de prompt/guia foram automatizados.

## O que não foi executado

- Nenhum deploy para Firebase Hosting ou Firestore.
- Nenhum `firebase deploy` ou migração contra produção. O GitHub Pages foi
  publicado pelos workflows versionados do repositório.
- Nenhuma instalação PWA física em Android, iOS, Windows ou macOS.
- Nenhum leitor de tela físico; a evidência de acessibilidade é Axe + teclado automatizado.
- Nenhuma escrita em credenciais, contas ou dados reais.

Esses itens não são necessários para aprovar o código local, mas devem ser validados em ambiente de homologação antes de uma publicação operacional.

## Comandos individuais úteis

```bash
npm run catalog:validate
npm run test:typecheck
npm run lint
npm run test:unit
npm run test:firebase
npm run test:e2e:firebase
npm run test:e2e:firebase:offline
npm run build
npm run test:e2e
npm run docs:complete
```

PowerShell para GitHub Pages:

```powershell
$env:NUTRIPRO_GITHUB_PAGES='true'
npm run build
Remove-Item Env:NUTRIPRO_GITHUB_PAGES
```

## Critério de publicação

Publicar somente a partir de uma branch revisada, com `npm run test:all` e o build Pages aprovados. Depois do deploy, repetir smoke da URL publicada e abertura direta de uma rota interna. Não fazer force-push nem merge automático em `main`.
