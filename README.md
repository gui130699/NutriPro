# NutriPro

PWA responsiva em português do Brasil para diário alimentar, hidratação, metas e acompanhamento de evolução corporal. A aplicação usa Firebase Authentication, Cloud Firestore, IndexedDB e um catálogo público local para preservar uma experiência rápida, inclusive após o primeiro carregamento.

- Repositório: <https://github.com/gui130699/NutriPro>
- GitHub Pages: <https://gui130699.github.io/NutriPro/>
- Firebase Hosting: <https://nutripro-9115a.web.app/>

## Destaques da versão

- Evolução com registros reais de peso, médias de 7/30 dias, tendência, meta, edição e exclusão.
- Medidas corporais completas, comparação entre registros, gráfico e vínculo opcional do peso ao histórico.
- Avaliação física com relatório imprimível, IMC, relações cintura/quadril e cintura/altura, composição corporal e protocolos de percentual de gordura que só calculam quando todos os dados exigidos foram informados.
- Perfil validado com React Hook Form e Zod; peso atual e meta de peso separados, sem substituir o histórico.
- Onboarding protegido: contas sem `onboardingCompleted: true` são levadas à conclusão antes das rotas privadas.
- Um único `ThemeProvider` para os modos Claro, Escuro e Sistema.
- Contagem de uso de alimentos em `foodUsage`, atualizada em transação e sem varrer todo o diário.
- PWA instalável em Android, desktop e iOS, com recuperação de rotas profundas do GitHub Pages e build que elimina bundles antigos antes de gerar o service worker.

## Recursos preservados

- Autenticação por e-mail/senha, recuperação de acesso e onboarding persistente.
- Dashboard, diário por data, hidratação, listas públicas e particulares, favoritos, overrides e refeições personalizadas.
- Tema, cache offline, manifest, service worker e botão **Instalar app**.
- Tipos de refeição existentes e snapshots nutricionais do diário continuam compatíveis com registros anteriores.

## Requisitos e configuração

1. Instale Node.js 20 ou superior e Firebase CLI.
2. Copie `.env.example` para `.env`.
3. Preencha as variáveis `VITE_FIREBASE_*` com a configuração Web do projeto Firebase.
4. No Firebase Authentication, habilite **E-mail/senha**.
5. Instale as dependências e rode o projeto:

```bash
npm ci
npm run dev
```

A configuração Web do Firebase é pública por natureza. Não inclua conta de serviço, credencial administrativa ou `.env` no Git; a proteção dos dados é feita pelas regras em `firestore.rules`.

## Catálogo oficial de alimentos

O importador é deliberadamente estrito. Coloque o arquivo original `lista_7083_alimentos_nutrientes_100g.csv` na raiz e execute:

```bash
npm run catalog:import -- lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0
```

Ele exige exatamente 7.083 linhas e este cabeçalho, nesta ordem:

```text
codigo_usda,nome_alimento_en,categoria_en,proteinas_g_100g,carboidratos_g_100g,fibras_g_100g,gorduras_g_100g,calorias_estimadas_kcal_100g,quantidade_base,unidade_base,idioma_nome,ativo,fonte_url
```

Cada linha precisa ter código e nome, nutrientes numéricos não negativos, `quantidade_base = 100`, `unidade_base = g`, `idioma_nome = en-US` e `ativo` igual a `S` ou `N`. Códigos duplicados, linhas inválidas, colunas inesperadas ou uma contagem diferente de 7.083 interrompem a operação antes de qualquer gravação. `S` é convertido para `isActive: true` e `N` para `false`.

Nesta entrega o CSV original não estava no workspace. Por isso, `public/data/foods.json` e `public/data/foods-version.json` foram preservados como stubs vazios: nenhum alimento, nutriente ou total foi inventado. Assim que o arquivo for disponibilizado, rode o comando acima, confira `totalFoods: 7083` e repita a busca, paginação e cache offline antes de publicar.

## Evolução e avaliação física

As rotas privadas são:

| Rota | Finalidade |
| --- | --- |
| `/evolucao` | peso, tendência, médias e meta |
| `/evolucao/medidas` | medidas corporais, histórico, comparação e gráfico |
| `/evolucao/avaliacao-fisica` | avaliações, protocolos, relatório e impressão |
| `/perfil` | dados pessoais, metas nutricionais, peso atual e peso-meta |

As datas civis usam `localIsoDate()` para não deslocar lançamentos no fuso local. Registros criados pelo perfil, pelas medidas e pelas avaliações podem alimentar o mesmo histórico de peso sem criar duplicidade para a mesma data e valor.

Os resultados da avaliação física são estimativas informativas. Eles não substituem avaliação médica, nutricional ou presencial. A tela não simula upload de fotos: o recurso aparece como indisponível até que Firebase Storage privado e suas regras sejam configurados e verificados.

## Dados, regras e agregação

Coleções pessoais protegidas incluem `profiles`, `goals`, `foods`, `foodOverrides`, `foodFavorites`, `mealTypes`, `mealItems`, `waterLogs`, `weightLogs`, `bodyMeasurements`, `physicalAssessments`, `foodUsage` e `userPreferences`.

As regras verificam autenticação, propriedade por `userId`, tipos, faixas e imutabilidade do proprietário em atualizações. Os índices incluem consultas por data descendente para peso, medidas e avaliações, além de `foodUsage` por quantidade de uso.

Para registros antigos, a migração é administrativa, idempotente e começa em simulação:

```bash
npm run migrate:food-usage
npm run migrate:food-usage -- --apply
```

Ela exige `GOOGLE_APPLICATION_CREDENTIALS` ou `FIREBASE_SERVICE_ACCOUNT_JSON` e nunca é executada pelo frontend.

## Instalar como aplicativo

- **Android, Windows, macOS e Linux:** em Chrome ou Edge, use **Instalar app** quando o botão aparecer e confirme o diálogo nativo.
- **iPhone e iPad:** use o mesmo botão para ver o guia. No Safari, escolha **Compartilhar → Adicionar à Tela de Início**; a Apple exige essa ação manual.
- O botão desaparece em modo standalone. A instalação real requer HTTPS, como GitHub Pages ou Firebase Hosting.

## Qualidade e CI

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

`npm run build` limpa somente o diretório gerado `dist` após validar que ele pertence ao workspace. Isso impede que hashes de bundles antigos entrem no precache do Workbox. O GitHub Pages executa `npm ci`, lint, testes unitários e build antes de publicar; o workflow Playwright é separado e roda em pushes e pull requests. Nesse workflow, `VITE_E2E=true` desativa a conexão Firebase apenas para a suíte de interface: os cenários usam a tela de acesso local e não leem nem gravam dados do projeto publicado.

## Publicação

Para Firebase Hosting e regras do Firestore:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

O GitHub Pages é publicado no push para `main`. O arquivo `public/404.html` devolve links diretos para o app shell, e `src/main.tsx` restaura apenas rotas internas válidas; assim, recarregar ou abrir `/NutriPro/evolucao` não cai mais em uma página estática 404.

## Testes e limitações conhecidas

O registro detalhado fica em [docs/TESTES-FUNCIONAIS.md](docs/TESTES-FUNCIONAIS.md). A rodada atual aprovou 55 testes unitários em 15 arquivos e 15 cenários Playwright/Chromium, além do build normal e do build com base do GitHub Pages.

Não foram feitas escritas autenticadas em produção: não havia conta/projeto de homologação e o Firestore Emulator requer Java, que não está instalado nesta máquina. Os fluxos autenticados, o catálogo com 7.083 itens e a instalação em aparelho físico continuam pendentes desses recursos, e são documentados sem resultados fictícios.
