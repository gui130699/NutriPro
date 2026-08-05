# NutriPro

PWA responsiva em português do Brasil para diário alimentar, hidratação, metas e acompanhamento de evolução corporal. O app usa Firebase Authentication, Cloud Firestore, IndexedDB e um catálogo público local para oferecer busca rápida e uso offline após o primeiro carregamento válido.

- Repositório: <https://github.com/gui130699/NutriPro>
- GitHub Pages: <https://gui130699.github.io/NutriPro/>
- Firebase Hosting: <https://nutripro-9115a.web.app/>

## Catálogo brasileiro 2.0.0-br

A versão pública atual é `2.0.0-br`, datada de `2026-08-01`, com **626 alimentos**:

- **126 alimentos curados** já existentes, com IDs `BR0001` a `BR0126`, valores nutricionais e identificadores preservados;
- **500 alimentos TACO** adicionais, com IDs determinísticos `TACOxxxx` derivados do número da fonte.

Os artefatos de distribuição e auditoria são:

- `lista_alimentos_brasileiros_nutripro.csv`: fonte curada dos 126 itens;
- `data/sources/taco-4a-edicao-cleaned.csv`: cópia auditada da fonte TACO usada na importação;
- `data/generated/lista_500_alimentos_taco_nutripro.csv`: os 500 itens adicionados;
- `data/generated/foods-500-taco-nutripro.json`: os mesmos 500 itens em JSON;
- `data/generated/catalogo-brasileiro-626-nutripro.csv`: catálogo final completo;
- `public/data/foods.json` e `public/data/foods-version.json`: artefatos consumidos pela PWA;
- `docs/RELATORIO-IMPORTACAO-ALIMENTOS.md`: origem, critérios, exclusões, distribuição e checksums da rodada.

A fonte primária foi a [Tabela TACO 4ª edição limpa](https://huggingface.co/datasets/julianamarques/tabela-taco/raw/main/taco-4a-edicao-cleaned.csv), preservada no repositório. O [espelho de contingência](https://raw.githubusercontent.com/machine-learning-mocha/taco/refs/heads/main/formatados/alimentos.csv) foi consultado somente para auditoria. O SHA-256 da cópia usada é `bc77766e56d7c669dd9cdba3fdbde7bcbf1bb4140e829720cb4a676d27670ea8`; os hashes da seleção e dos IDs estão no relatório.

Na rodada publicada, a fonte tinha 597 registros e 581 completos nos campos obrigatórios. Entre os 97 descartes estão 80 duplicidades revisadas contra o catálogo curado, 1 omissão por prioridade e 16 registros com dados ausentes ou inválidos. O resultado selecionado foi exatamente 500 itens novos.

O importador lê vírgulas decimais, converte `Tr` em `0,00001` e trata `NA`, `*` e campos vazios como ausentes. Nome, categoria, código, calorias, proteínas, gorduras e carboidratos são obrigatórios; fibra ausente da fonte pode ser `0`. Ele recusa dados nutricionais inventados ou inválidos.

A seleção evita identidades óbvias já presentes no catálogo curado e entre os novos registros, mas preserva variações materiais de preparo, corte e conservação — por exemplo, cru, cozido, frito ou assado. Cada registro informa `catalogOrigin` (`curated-br` ou `taco`) e, no caso da TACO, `sourceFoodNumber`.

### Reproduzir e validar a importação

```bash
npm run catalog:import -- \
  lista_alimentos_brasileiros_nutripro.csv \
  --taco data/sources/taco-4a-edicao-cleaned.csv \
  --additional-total 500 \
  --expected-total 626 \
  --version 2.0.0-br
npm run catalog:validate
```

Para reproduzir exatamente a publicação de `2026-08-01` em outro dia, acrescente `--updated-at 2026-08-01` ao primeiro comando. A escrita usa arquivos temporários: uma fonte inválida não substitui o último catálogo válido. `catalog:validate` é somente leitura e confere os 126 curados, a seleção determinística dos 500 TACO, os CSVs/JSONs gerados, os metadados e os checksums publicados.

## Busca, cache e dados pessoais

- Em **Listas > Pública**, a busca ignora acentos, pontuação e hífens; nome, categoria e marca podem ser encontrados. Filtros, favoritos/ocultos, debounce, paginação e carregamento progressivo continuam disponíveis.
- O aplicativo armazena o catálogo completo e seus metadados no IndexedDB. A troca de versão é atômica e somente acontece quando a quantidade recebida coincide com `totalFoods`; sem rede, a última versão íntegra permanece disponível.
- O catálogo público não é editável por usuários. Alimentos particulares, favoritos e overrides ficam separados no Firestore por `userId`, portanto a atualização dos 626 itens não apaga nem altera dados pessoais.

Os valores nutricionais são referências por 100 `g` ou `ml`, não substituem rótulos, acompanhamento profissional ou orientação médica. Confirme o produto específico quando a fonte indicar valor médio ou variação por marca/preparo.

## Unidades e porções por pessoa

O diário mantém `g`/`kg` para alimentos de massa e `ml`/`l` para líquidos. As opções diretas **unidade** e **porção** usam a medida pessoal ou a sugestão do catálogo; se ela não existir, o formulário abre automaticamente. **+ nova medida** sempre permite criar uma medida explícita. O formulário pede nome, quantidade-base, unidade-base, rótulos singular/plural e preferência de padrão. O sistema não estima peso, não aceita zero, negativos, texto, valores não finitos ou fora de `0,1` a `10.000`.

- **Salvar para as próximas vezes** cria um perfil pessoal em `foodUnitProfiles`; há várias medidas por alimento, uma padrão, edição, duplicação, desativação, restauração e exclusão física apenas quando não há lançamento histórico que a referencie.
- **Usar só desta vez** produz somente o snapshot do lançamento; não cria documento de perfil.
- Pesos antigos do catálogo (`unitWeightG` e `portionWeightG`) aparecem como sugestões virtuais. Aceitá-los não grava cópias repetidas no Firestore; a pessoa pode criar uma medida pessoal diferente.
- As medidas são individualizadas também para alimentos públicos, por `userId`, `foodId` e `foodSource`. A chave de perfil é determinística: `${userId}_${foodSource}_${foodId}_${normalizedUnitName}`.
- Cada lançamento novo salva `unitProfileId`, rótulo, quantidade por unidade, medida-base e quantidade consumida como snapshot. Alterar ou desativar um perfil depois não recalcula o passado; registros antigos continuam legíveis pelos campos legados.

Em **Listas > detalhes do alimento > Unidades e porções**, também há uma densidade pessoal opcional em `g/ml`, identificada como proveniente de rótulo, da pessoa usuária ou de profissional. Conversões entre gramas e mililitros só ocorrem quando essa densidade explícita existe — o app nunca assume que `1 ml = 1 g`.

Perfis, densidades e operações pendentes são mantidos no IndexedDB. Em indisponibilidade de rede, a alteração é colocada em uma fila determinística e a interface mostra **Aguardando sincronização**; a sincronização é tentada ao entrar e quando o navegador volta a ficar online.

## Segurança do Firestore

As coleções `foodUnitProfiles` e `foodDensityProfiles` têm regras próprias de proprietário. Elas exigem sessão autenticada, `userId` imutável, origem `public`/`private`, medidas compatíveis (`mass`/`g` ou `volume`/`ml`), valor entre `0,1` e `10.000`, e campos de origem permitidos. Os índices compostos necessários estão em `firestore.indexes.json`.

O restante do isolamento já existente é preservado: perfis, metas, alimentos privados, overrides, favoritos, tipos de refeição, diário, hidratação, evolução e preferências continuam acessíveis apenas pela pessoa proprietária.

As regras também validam chaves permitidas, tipos, limites numéricos, timestamps de servidor, proprietário imutável e snapshots históricos de `mealItems`, `waterLogs`, `weightLogs`, `bodyMeasurements` e `physicalAssessments`. Favoritos e demais documentos determinísticos podem consultar um ID ainda ausente somente quando o prefixo pertence à sessão autenticada; isso permite transações idempotentes sem abrir leitura cruzada entre contas.

### Auditoria de dependências

`fast-uri` é fixado em `3.1.5` por `overrides`, versão corrigida para o advisory `GHSA-7p8r-x3mc-p8w7`. Em 2026-08-05, `npm audit --omit=dev` ainda sinaliza `react-router@7.18.2` por `GHSA-qwww-vcr4-c8h2`; o próprio advisory restringe o impacto às APIs RSC instáveis, que não são usadas por esta SPA. A versão corrigida indicada (`8.3.0`) ainda não estava publicada no npm. Não foi aplicado downgrade para `7.11.0`, pois essa versão apresentava um conjunto maior de advisories. Reavaliar assim que uma versão corrigida compatível for publicada.

## Recursos preservados

- Autenticação por e-mail/senha, recuperação de acesso e onboarding persistente.
- Dashboard, diário por data, hidratação, listas públicas e particulares, favoritos, overrides e refeições personalizadas.
- Evolução de peso, medidas corporais, avaliação física e metas nutricionais.
- Tema Claro, Escuro e Sistema; manifest, service worker e botão **Instalar app**.
- Tipos de refeição e snapshots nutricionais compatíveis com lançamentos anteriores.

## Requisitos e execução local

1. Instale Node.js **22 ou 24 LTS**. Para os Emulators, instale também **JDK 21**. A Firebase CLI já é dependência de desenvolvimento do projeto.
2. Copie `.env.example` para `.env`.
3. Preencha as variáveis `VITE_FIREBASE_*` com a configuração Web do projeto Firebase.
4. No Firebase Authentication, habilite **E-mail/senha**.
5. Instale as dependências e inicie o ambiente local:

```bash
npm ci
npm run dev
```

Os testes desta auditoria também rodaram em Node `25.1.0`, mas `superstatic` (dependência da Firebase CLI) declara suporte a Node 20/22/24; por isso Node 22 ou 24 é a configuração recomendada e sem aviso de engine.

A configuração Web do Firebase é pública por natureza. Não envie conta de serviço, credencial administrativa ou `.env` ao Git; o controle de acesso dos dados pessoais é feito em `firestore.rules`.

## Instalar como aplicativo

- **Android, Windows, macOS e Linux:** em Chrome ou Edge, use **Instalar app** e confirme o diálogo nativo.
- **iPhone e iPad:** abra o guia pelo mesmo botão e, no Safari, escolha **Compartilhar → Adicionar à Tela de Início**. A Apple exige essa etapa manual.
- A instalação efetiva requer HTTPS, disponível no GitHub Pages e no Firebase Hosting. O botão não é exibido em modo standalone.

## Qualidade e testes

Antes de publicar, execute:

```bash
npm ci
npm run catalog:validate
npm run test:typecheck
npm run lint
npm run test:unit
npm run test:firebase
npm run test:e2e:firebase
npx playwright install chromium
npm run test:e2e
npm run build
NUTRIPRO_GITHUB_PAGES=true npm run build
```

`npm run test:all` agrega catálogo, tipagem, lint, unitários, regras, fluxos autenticados, build/PWA e smoke público. A matriz final de 2026-08-05 aprovou **81 testes unitários**, **21 testes de regras**, **13 fluxos autenticados** e **23 cenários públicos**, além dos dois builds. `VITE_E2E=true` isola apenas a suíte pública; a suíte autenticada usa Auth e Firestore Emulator com projeto falso `nutripro-test`. Nenhum teste acessa ou modifica produção. O roteiro, os comandos e as evidências estão em [docs/TESTES-FUNCIONAIS.md](docs/TESTES-FUNCIONAIS.md) e [docs/RELATORIO-AUDITORIA-COMPLETA.md](docs/RELATORIO-AUDITORIA-COMPLETA.md).

Documentação adicional:

- [Matriz de cobertura](docs/MATRIZ-COBERTURA-TESTES.md)
- [Segurança e qualidade](docs/RELATORIO-SEGURANCA-E-QUALIDADE.md)
- [Importação TACO e política de medidas](docs/RELATORIO-IMPORTACAO-ALIMENTOS.md)
- `NutriPro-documentacao-e-codigo.txt`: índice consolidado
- `NutriPro-projeto-completo.txt`: conteúdo textual integral, comandos e código-fonte

## Publicação

Para Firebase Hosting e regras do Firestore:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

O GitHub Pages é publicado no push para `main`. O arquivo `public/404.html` preserva rotas internas do app para que uma abertura direta, como `/NutriPro/evolucao`, retorne ao shell da PWA em vez de uma página estática 404.
