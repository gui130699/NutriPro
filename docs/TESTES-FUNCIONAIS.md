# Testes funcionais — NutriPro

## Registro da rodada

| Campo | Resultado |
| --- | --- |
| Data | 30/07/2026 |
| Commit funcional | `397fb2126b9cbfb3e8b7a6978e41232e41498c7a` |
| Instalação limpa | `npm ci --force --no-audit --no-fund` concluído (777 pacotes) |
| Ambiente | Windows, Node.js local, Vite e Chromium do Playwright |
| Firebase | Nenhuma escrita de dados de produção durante os testes |
| Unitários | 55 aprovados em 15 arquivos |
| E2E | 15 aprovados no Chromium |
| Build PWA | normal e com `GITHUB_ACTIONS=true` aprovados |

## Comandos executados

```bash
npm ci --force --no-audit --no-fund
npm run lint
npm run test
npm run test:e2e
npm run build
GITHUB_ACTIONS=true npm run build
firebase deploy --only firestore:rules,firestore:indexes --dry-run
```

Resultados observados:

- `npm run lint`: aprovado, sem avisos.
- `npm run test`: 15 arquivos e 55 testes aprovados.
- `npm run test:e2e`: 15 cenários aprovados.
- `npm run build`: TypeScript e PWA aprovados.
- Build para Pages: 39 entradas no precache depois da limpeza de `dist`; builds antigos não permaneceram no service worker.
- Regras e índices Firestore: compilação aprovada no dry run para `nutripro-9115a`.

O aviso de chunk principal acima de 500 kB veio do Vite como recomendação de otimização; não é erro de compilação. Os bundles antigos passaram a ser removidos antes do build para impedir que esse precache cresça a cada publicação.

## Cobertura unitária

| Área | Verificações | Estado |
| --- | --- | --- |
| Catálogo estrito | cabeçalho, 7.083 linhas, duplicidade, numéricos, valores fixos, `S/N` e escrita atômica | Aprovado |
| Datas locais | serialização e comparação de `YYYY-MM-DD` sem deslocamento UTC | Aprovado |
| Evolução | validação de peso/medidas, médias, tendência, comparações e meta | Aprovado |
| Avaliação física | IMC, relações corporais e protocolos com dados obrigatórios | Aprovado |
| Rotas Pages | restauração de rota interna e rejeição de redirecionamento externo | Aprovado |
| `foodUsage` | chave por origem, agregação e transações de inclusão/exclusão | Aprovado |
| Recursos existentes | nutrição, catálogo, busca, overrides, refeições, ícones, tema e PWA | Aprovado |

## Cobertura E2E (Chromium)

| Área | Cenários aprovados |
| --- | --- |
| Acesso | validações locais de campos obrigatórios, e-mail inválido, senha curta e recuperação sem enviar dados remotos |
| Tema | preferência escura aplicada antes do React |
| Acessibilidade | nomes acessíveis e navegação por teclado na tela de acesso |
| Proteção de rotas | visitante redirecionado de `/listas`, `/diario` e `/perfil` |
| Responsividade | ausência de rolagem horizontal em 375 × 667, 390 × 844, 768 × 1024, 1366 × 768 e 1920 × 1080 |
| PWA | prompt nativo simulado em navegador compatível e instruções Safari/iOS em 390 × 844 |

## Verificação manual no navegador

| Escopo | Resultado | Estado |
| --- | --- | --- |
| Publicação atual | tela de acesso do GitHub Pages renderizou após o carregamento inicial | Aprovado |
| Artefato do GitHub Pages | abertura direta de `/NutriPro/evolucao` retornou ao app e, sem sessão, redirecionou para `/NutriPro/entrar` | Aprovado |
| Mobile | rota protegida no artefato Pages em 375 × 667: `scrollWidth` igual à largura de conteúdo, sem overflow horizontal | Aprovado |
| Console | artefato Pages validado sem erros ou warnings | Aprovado |
| PWA | build final gerou manifest, service worker, ícones e fallback de navegação | Aprovado |

O servidor de desenvolvimento do Vite exibiu um aviso de WebSocket no navegador integrado do Codex. Esse canal serve apenas ao HMR de desenvolvimento; a publicação estática e o build de produção foram testados separadamente, sem esse erro.

## Catálogo oficial: validação de falha segura

Foi executado:

```bash
npm run catalog:import -- lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0
```

O arquivo não existia no workspace. O importador retornou erro controlado (exit code 1) e os hashes de `public/data/foods.json` e `public/data/foods-version.json` permaneceram idênticos antes e depois. Portanto:

- não há catálogo fictício;
- a lista pública real de 7.083 itens não foi declarada como aprovada;
- a importação, pesquisa no fim da base e cache offline real devem ser repetidos quando o CSV original for fornecido.

## Cenários não executados

| Fluxo | Motivo | Estado |
| --- | --- | --- |
| Cadastro/login com conta válida | não havia conta de teste/homologação | Não executado |
| Onboarding persistido e guard autenticado | exigiria escrita Firestore segura | Não executado |
| CRUD real de peso, medidas e avaliações | exigiria ambiente Firebase isolado | Não executado |
| Dois usuários, regras e isolamento de dados | exigiria Emulator Suite ou homologação | Não executado |
| Importação real dos 7.083 alimentos | CSV oficial ausente | Não executado |
| Fotos de evolução | Firebase Storage privado/rules não configurados para este recurso | Não executado |
| Instalação no sistema | requer Android/iOS/desktop físico; E2E simulou os fluxos de interface | Não executado |

O Firestore Emulator não foi iniciado porque `java -version` não está disponível nesta máquina. A próxima rodada deve usar Firebase Emulator Suite completo ou projeto de homologação, uma conta de teste exclusiva e o CSV oficial, sem testar mutações contra a produção.

## Como repetir

```bash
npm ci
npx playwright install chromium
npm run lint
npm run test
npm run test:e2e
npm run build
GITHUB_ACTIONS=true npm run build
firebase deploy --only firestore:rules,firestore:indexes --dry-run
```

Para validar dados autenticados, configure as variáveis `VITE_FIREBASE_*` para homologação ou conecte o app aos emuladores antes de executar qualquer mutação.
