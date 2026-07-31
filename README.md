# NutriPro

PWA responsiva em português do Brasil para diário alimentar, hidratação, metas e acompanhamento de evolução corporal. O app usa Firebase Authentication, Cloud Firestore, IndexedDB e um catálogo público local para oferecer busca rápida e uso offline após o primeiro carregamento válido.

- Repositório: <https://github.com/gui130699/NutriPro>
- GitHub Pages: <https://gui130699.github.io/NutriPro/>
- Firebase Hosting: <https://nutripro-9115a.web.app/>

## Catálogo brasileiro atual

O catálogo público distribuído nesta versão é o brasileiro `1.0.0-br`, atualizado em `2026-07-31`, com **126 alimentos**. Os arquivos publicados são:

- `lista_alimentos_brasileiros_nutripro.csv`: fonte CSV editável, mantida no repositório;
- `public/data/foods.json`: artefato público gerado para o aplicativo;
- `public/data/foods-version.json`: metadados da versão, data e quantidade esperada.

O CSV usa o contrato abaixo, separado por ponto e vírgula. Ele é a fonte de verdade; não edite o JSON gerado manualmente.

```text
codigo_alimento;nome_alimento_pt_br;categoria_pt_br;marca;calorias_kcal_100;proteinas_g_100;carboidratos_g_100;gorduras_g_100;fibras_g_100;quantidade_base;unidade_base;peso_medio_unidade_g;peso_porcao_g;idioma_nome;ativo;fonte
```

Cada item possui código externo único, nome e categoria em `pt-BR`, nutrientes por 100 `g` ou `ml`, unidade-base, peso médio por unidade/porção quando aplicável, situação ativa e fonte. O importador rejeita códigos duplicados, cabeçalho incompatível, totais diferentes do esperado, números negativos ou inválidos, base diferente de 100, unidade diferente de `g`/`ml`, idioma inválido e situação diferente de `S`/`N`.

Para recriar os artefatos após uma alteração consciente no CSV, execute:

```bash
npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv --version 1.0.0-br --expected-total 126
npm run catalog:validate
```

A importação só substitui `foods.json` e `foods-version.json` depois de validar toda a fonte; `catalog:validate` compara a fonte e os artefatos gerados. Ao publicar outra lista, escolha uma nova versão, atualize a data e informe o total esperado de forma explícita. O importador também mantém um contrato internacional separado (`en-US`) para uma futura fonte USDA, sem misturar suas colunas com a lista brasileira.

## Como o catálogo aparece no app

- Em **Listas > Pública**, a busca ignora acentos, pontuação e hífens; nome, categoria e marca podem ser encontrados. A tela mantém filtro por categoria, favoritos/ocultos, debounce, paginação e carregamento progressivo.
- Cada alimento público mostra categoria, macros por 100 `g`/`ml`, fonte e medidas disponíveis. A pessoa usuária pode abrir detalhes, favoritar, ocultar para si e criar uma personalização sem alterar o catálogo comum.
- No diário, a unidade-base respeita o alimento: itens em gramas oferecem `g`/`kg`; itens em mililitros oferecem `ml`/`l`; `unidade` e `porção` só são disponibilizadas quando houver o peso correspondente.
- O aplicativo guarda o catálogo completo no IndexedDB juntamente com sua versão. Antes de trocar o cache, valida a quantidade recebida contra `totalFoods`; a troca é atômica. Sem rede, a última versão íntegra continua disponível como cache offline.

O catálogo público não é um conjunto de documentos editáveis por usuários. Alimentos particulares, favoritos e overrides continuam protegidos no Firestore por `userId`. Essa separação permite, no futuro, adicionar novas fontes públicas (por exemplo, USDA) e alimentos privados sem perder a origem, o idioma ou a personalização individual.

### Observação sobre dados nutricionais

Os valores são referências por 100 `g` ou `ml`, não substituem rótulos, acompanhamento profissional ou orientação médica. Alguns itens carregam na própria fonte a indicação de que o valor é médio ou deve ser conferido no rótulo; nesses casos, confirme o produto específico antes de usar o dado para uma decisão clínica ou alimentar precisa.

## Recursos preservados

- Autenticação por e-mail/senha, recuperação de acesso e onboarding persistente.
- Dashboard, diário por data, hidratação, listas públicas e particulares, favoritos, overrides e refeições personalizadas.
- Evolução de peso, medidas corporais, avaliação física e metas nutricionais.
- Tema Claro, Escuro e Sistema; manifest, service worker e botão **Instalar app**.
- Tipos de refeição existentes e snapshots nutricionais do diário compatíveis com registros anteriores.

## Requisitos e execução local

1. Instale Node.js 20 ou superior e Firebase CLI.
2. Copie `.env.example` para `.env`.
3. Preencha as variáveis `VITE_FIREBASE_*` com a configuração Web do projeto Firebase.
4. No Firebase Authentication, habilite **E-mail/senha**.
5. Instale as dependências e inicie o ambiente local:

```bash
npm ci
npm run dev
```

A configuração Web do Firebase é pública por natureza. Não envie conta de serviço, credencial administrativa ou `.env` ao Git; o controle de acesso dos dados pessoais é feito em `firestore.rules`.

## Instalar como aplicativo

- **Android, Windows, macOS e Linux:** em Chrome ou Edge, use **Instalar app** e confirme o diálogo nativo.
- **iPhone e iPad:** abra o guia pelo mesmo botão e, no Safari, escolha **Compartilhar → Adicionar à Tela de Início**. A Apple exige essa etapa manual.
- A instalação efetiva requer HTTPS, disponível no GitHub Pages e no Firebase Hosting. O botão não é exibido em modo standalone.

## Qualidade e testes

Antes de publicar, execute a sequência abaixo. `VITE_E2E=true`, usado pela suíte Playwright, isola a interface de Firebase para que os smoke tests não leiam nem gravem dados de produção.

```bash
npm run catalog:validate
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
NUTRIPRO_GITHUB_PAGES=true npm run build
```

O roteiro detalhado de validação, incluindo o que ainda exige uma conta de homologação, está em [docs/TESTES-FUNCIONAIS.md](docs/TESTES-FUNCIONAIS.md). Fluxos autenticados devem ser validados em Firebase Emulator Suite ou projeto de teste; esta documentação não os declara como executados contra produção.

## Publicação

Para Firebase Hosting e regras do Firestore:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

O GitHub Pages é publicado no push para `main`. O arquivo `public/404.html` preserva rotas internas do app para que uma abertura direta, como `/NutriPro/evolucao`, retorne ao shell da PWA em vez de uma página estática 404.
