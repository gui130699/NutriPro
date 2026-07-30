# NutriPro

PWA responsiva em português do Brasil para diário alimentar, hidratação, metas, peso e organização de alimentos. O NutriPro usa Firebase Authentication, Cloud Firestore, IndexedDB e um catálogo público local para manter a pesquisa rápida e disponível offline após o primeiro carregamento.

- Repositório: <https://github.com/gui130699/NutriPro>
- GitHub Pages: <https://gui130699.github.io/NutriPro/>
- Firebase Hosting: <https://nutripro-9115a.web.app/>

## Recursos

- Autenticação por e-mail e senha, recuperação de acesso e onboarding persistente.
- Dashboard com calorias, macronutrientes, hidratação e atalhos.
- Diário com pesquisa incremental de alimentos, medidas em g, kg, ml, l, unidade e porção, snapshots nutricionais e exclusão de lançamentos.
- Hidratação por atalhos ou valor personalizado, inclusive em datas passadas, com remoção/undo manual do registro.
- Rota `/listas` com **Lista pública**, **Minha lista** e **Refeições**.
- Catálogo público pesquisável por nome, categoria ou marca, sem renderizar milhares de opções em um `<select>`.
- Alimentos particulares, favoritos, personalização individual de itens públicos, ocultação e restauração sem alterar a base global.
- Tipos de refeição editáveis, ordenáveis, ativáveis e com catálogo acessível de ícones Lucide.
- Tema Claro, Escuro e Sistema com cache local, sincronização em `userPreferences` e aplicação sem flash de cor.
- PWA com manifest, service worker, cache de catálogo no IndexedDB e instalação guiada em Android, iOS e desktop.

## Tecnologias

React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Firebase Authentication, Cloud Firestore, Dexie/IndexedDB, Lucide, Recharts, vite-plugin-pwa, Vitest e Playwright.

## Configuração

1. Instale o Node.js 20 ou superior e o Firebase CLI.
2. Copie `.env.example` para `.env`.
3. Preencha todas as variáveis `VITE_FIREBASE_*` com a configuração pública do seu app Web Firebase.
4. No Firebase Authentication, ative o provedor **E-mail/senha**.
5. Instale as dependências e aplique regras/índices:

```bash
npm install
firebase login
firebase deploy --only firestore:rules,firestore:indexes
npm run dev
```

Não inclua conta de serviço, chave administrativa ou `.env` no Git. A configuração Web do Firebase é pública por natureza; a proteção dos dados depende das regras do Firestore em `firestore.rules`.

## Catálogo de alimentos

O catálogo público é independente do Firestore. Coloque o arquivo oficial `lista_7083_alimentos_nutrientes_100g.csv` na raiz do projeto e execute:

```bash
npm run catalog:import -- lista_7083_alimentos_nutrientes_100g.csv --version 1.0.0
```

O conversor cria ou atualiza:

```text
public/data/foods.json
public/data/foods-version.json
```

Ele detecta CSV com vírgula, ponto e vírgula ou tabulação, converte decimais brasileiros, normaliza nomes e deduplica pelo `externalId`. Reexecutá-lo não duplica alimentos. O cliente baixa `foods-version.json`, guarda o catálogo completo no IndexedDB e só faz novo download quando a versão muda. Se ainda não houver CSV, o projeto mantém um stub seguro vazio — nunca inventa os 7.083 registros.

## Dados e segurança

Coleções protegidas por usuário:

| Coleção | Finalidade |
| --- | --- |
| `profiles` | perfil e conclusão do onboarding |
| `goals` | metas nutricionais e de hidratação |
| `foods` | alimentos particulares; exclusão lógica com `isActive` |
| `foodOverrides` | personalizações e ocultação de alimentos públicos |
| `foodFavorites` | favoritos sem duplicidade por usuário/origem/alimento |
| `mealTypes` | refeições, ícone, cor, horário, ordem e estado |
| `mealItems` | diário com snapshots de alimento e refeição |
| `waterLogs` | registros de hidratação |
| `weightLogs`, `recipes`, `dailyNotes` | recursos pessoais existentes |
| `userPreferences` | preferência visual |

As regras não usam uma concessão genérica. Cada coleção verifica autenticação, propriedade por `userId` e bloqueia alteração do proprietário. O catálogo em JSON não depende do Firestore e alimentos públicos não podem ser alterados globalmente por usuários comuns.

Registros antigos do diário que possuem somente `mealName` continuam sendo exibidos com um ícone de fallback. Para migrá-los permanentemente, use uma conta de serviço apenas em ambiente controlado:

```bash
# primeiro execute em modo de simulação
npm run migrate:meals

# depois de conferir o resultado
npm run migrate:meals -- --apply
```

Defina `GOOGLE_APPLICATION_CREDENTIALS` ou `FIREBASE_SERVICE_ACCOUNT_JSON` somente para esse script administrativo. Ele não é usado pelo frontend.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | inicia o Vite em desenvolvimento |
| `npm run build` | valida TypeScript e gera a PWA de produção |
| `npm run preview` | abre o build local |
| `npm run lint` | executa o Oxlint |
| `npm run test` | executa testes unitários com Vitest |
| `npm run test:e2e` | executa Playwright/Chromium |
| `npm run test:e2e:headed` | executa Playwright com navegador visível |
| `npm run test:e2e:ui` | abre a interface do Playwright |
| `npm run test:e2e:report` | abre o relatório HTML mais recente |
| `npm run catalog:import -- arquivo.csv --version x.y.z` | converte a base oficial |
| `npm run migrate:meals` | simula migração de snapshots legados |
| `npm run pwa:icons` | regenera os ícones PNG do manifest e do iOS |

Instale o navegador do Playwright uma vez quando necessário:

```bash
npx playwright install chromium
```

## Instalar como aplicativo

- **Android, Windows, macOS e Linux:** no Chrome ou Edge, use o botão **Instalar app** quando ele aparecer. O navegador exibirá a confirmação nativa.
- **iPhone e iPad:** use o botão **Instalar app** para ver o passo a passo. No Safari, toque em **Compartilhar → Adicionar à Tela de Início**. A Apple exige essa ação manual.
- O botão não é mostrado quando o NutriPro já está aberto como aplicativo. A instalação requer uma URL HTTPS publicada, como o Firebase Hosting ou GitHub Pages.
- Quando uma atualização do NutriPro estiver disponível, confirme a recarga: o novo service worker é ativado antes de abrir a versão atualizada.

## Publicação

Para o Firebase Hosting:

```bash
npm run build
firebase deploy
```

O GitHub Pages é publicado pela ação `.github/workflows/deploy-pages.yml`. Configure as variáveis `VITE_FIREBASE_*` em **Settings → Secrets and variables → Actions → Variables** do repositório para que o build do Pages tenha acesso à configuração Web pública correta.

## Testes e limites conhecidos

O roteiro e os resultados executados ficam em [docs/TESTES-FUNCIONAIS.md](docs/TESTES-FUNCIONAIS.md). Os smoke tests E2E não usam nem modificam dados de produção. Fluxos autenticados com gravação devem ser repetidos contra Firebase Emulator Suite ou uma conta/projeto de homologação antes de uma operação destrutiva; nunca em dados reais.

Nesta versão, `public/data/foods.json` está vazio porque o CSV oficial não foi fornecido no workspace. O código de importação, cache, paginação e pesquisa já está pronto; assim que o arquivo for adicionado, gere a versão e valide a contagem esperada de 7.083 alimentos antes do deploy.
