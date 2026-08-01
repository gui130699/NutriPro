# Testes funcionais — NutriPro 2.0.0-br

Este roteiro cobre o catálogo brasileiro `2.0.0-br` e o sistema de unidades pessoais. Ele diferencia testes locais/isolados de cenários que só podem ser aprovados com Firebase Emulator Suite ou projeto de homologação. Uma suíte com `VITE_E2E=true` **não** é evidência de escrita autenticada real.

## Referência da versão

| Item | Referência esperada |
| --- | --- |
| Versão pública | `2.0.0-br` |
| Data de atualização | `2026-08-01` |
| Catálogo final | 626 alimentos |
| Catálogo curado preservado | 126 (`BR0001` a `BR0126`) |
| Adição TACO | 500 (`TACOxxxx`) |
| Fonte TACO preservada | `data/sources/taco-4a-edicao-cleaned.csv` |
| SHA-256 da fonte | `bc77766e56d7c669dd9cdba3fdbde7bcbf1bb4140e829720cb4a676d27670ea8` |
| Artefatos públicos | `public/data/foods.json` e `public/data/foods-version.json` |
| Artefatos gerados | `data/generated/` e `docs/RELATORIO-IMPORTACAO-ALIMENTOS.md` |

O catálogo público não pode criar, alterar ou excluir documentos pessoais. Favoritos, overrides, alimentos privados, perfis de medida, densidades e lançamentos do diário sempre dependem da pessoa autenticada e das regras por `userId`.

## Preparação

```bash
npm ci
npx playwright install chromium
```

Configure `.env` somente para um ambiente de teste. Não use conta, projeto ou dados de produção em testes destrutivos. Para testes autenticados, prefira Firebase Emulator Suite; se não estiver disponível, crie um projeto de homologação e contas exclusivas.

## Validação automatizada obrigatória

Execute na ordem abaixo antes de publicar:

```bash
npm run catalog:import -- \
  lista_alimentos_brasileiros_nutripro.csv \
  --taco data/sources/taco-4a-edicao-cleaned.csv \
  --additional-total 500 \
  --expected-total 626 \
  --version 2.0.0-br
npm run catalog:validate
npm run lint
npm run test
npm run test:e2e
npm run build
NUTRIPRO_GITHUB_PAGES=true npm run build
```

Para recriar exatamente a data da versão em outro dia, acrescente `--updated-at 2026-08-01` à importação. Se qualquer comando falhar, não publique. A importação deve manter os 126 registros curados, produzir exatamente 500 TACO e totalizar 626; a validação confere a fonte fixada, hashes, seleção, JSONs, CSVs e metadados sem modificar arquivos.

### Cobertura mínima do catálogo

| Área | Verificação |
| --- | --- |
| Fonte | A cópia local TACO existe, tem o SHA-256 publicado e não é substituída por download implícito. |
| Curados | IDs e valores dos 126 itens curados permanecem iguais; somente a proveniência estrutural pode ser adicionada. |
| TACO | Exatamente 500 IDs `TACOxxxx`, `sourceFoodNumber`, `catalogOrigin: taco` e nutrientes finitos/não negativos. |
| Normalização | Vírgula decimal é aceita; `Tr` vira `0,00001`; `NA`, `*` e vazio ficam ausentes; nenhum macro obrigatório é inventado. |
| Duplicidade | Identidades normalizadas não repetem alimentos curados nem novos itens; preparação material (cru/cozido/frito/assado etc.) continua distinta. |
| Artefatos | `foods.json` contém 626 itens e `foods-version.json` informa `2.0.0-br`, `2026-08-01` e `totalFoods: 626`. |
| Relatório | `docs/RELATORIO-IMPORTACAO-ALIMENTOS.md` contém origem, critérios, omitidos, distribuição e checksums. |
| Busca/cache | Nome, categoria e marca funcionam sem acento/pontuação/hífen; uma resposta com contagem divergente não substitui o IndexedDB. |

Os testes de `scripts/taco-catalog.ts`, `src/lib/taco-catalog.test.ts` e `src/lib/brazilian-catalog.test.ts` devem cobrir importação reproduzível, totais, proveniência e prevenção de duplicidades. Não aprove uma modificação do CSV/JSON pela inspeção visual isolada.

## Cobertura mínima das unidades pessoais

| Área | Verificação |
| --- | --- |
| Entrada | Aceita `80,5` e `80.5`; bloqueia letras, `NaN`, infinito, zero, negativos e valores fora de `0,1–10.000`. |
| Medida ausente | Ao escolher **+ unidade personalizada…**, abre modal com base `g` ou `ml` correspondente ao alimento, sem preencher peso automaticamente. |
| Persistente | Salvar cria perfil individual em `foodUnitProfiles`, permite múltiplos perfis, um padrão, editar, duplicar, desativar e restaurar. |
| Idempotência | O ID `${userId}_${foodSource}_${foodId}_${normalizedUnitName}` é estável para variações de acento/caixa/espaçamento e não cria duplicata no reenvio. |
| Temporária | **Usar só desta vez** grava somente o snapshot do lançamento e não cria `foodUnitProfiles`. |
| Sugestões | Pesos herdados do catálogo são opções virtuais; aceitá-los não duplica documentos na conta. |
| Exclusão | Perfil usado em `mealItems.unitProfileId` é desativado, não removido fisicamente; perfil sem uso pode ser excluído. |
| Snapshot | Lançamento novo possui `unitProfileId`, `unitLabelSnapshot`, `amountPerUnitSnapshot`, `baseMeasureSnapshot` e `consumedBaseAmount`; a alteração posterior do perfil não muda o histórico. |
| Densidade | Conversão entre g e ml só acontece com `foodDensityProfiles.gramsPerMl` explícito. Sem densidade, a ação deve falhar sem assumir `1 ml = 1 g`. |
| Offline | Perfil/densidade pendente fica no IndexedDB, exibe **Aguardando sincronização** e é reenviado ao entrar ou voltar online; a operação determinística não deve duplicar perfis. |
| Segurança | Regras só permitem dono autenticado, `userId` imutável, origem e medida válidas e faixas numéricas permitidas. |

Os testes unitários de `src/lib/food-units.test.ts` e `src/services/nutrition-service.transactions.test.ts` são a primeira evidência para matemática, validação, snapshots e transações. Eles não substituem o roteiro autenticado abaixo.

## Rotas e smoke tests em Chromium

`npm run test:e2e` usa `VITE_E2E=true`: Auth e Firestore não são inicializados. A suíte pode verificar rotas públicas, redirecionamentos e comportamento visual com segurança, mas não deve ser interpretada como teste do banco real.

| Rota | Cenário de smoke esperado |
| --- | --- |
| `/entrar` | Tela de acesso, validação local e acessibilidade básica. |
| `/` | Visitante é redirecionado para `/entrar`. |
| `/diario` | Visitante é redirecionado para `/entrar`; sem erro de console. |
| `/listas` | Visitante é redirecionado para `/entrar`; sem erro de console. |
| `/perfil` | Visitante é redirecionado para `/entrar`; sem erro de console. |
| `/evolucao`, `/evolucao/medidas`, `/evolucao/avaliacao-fisica` | Rotas privadas preservam o bloqueio para visitante. |
| Base GitHub Pages (`/NutriPro/`) | Rota interna aberta diretamente é recuperada pelo fallback SPA e chega à tela de acesso. |

Também valide em 375 × 667, 390 × 844, 768 × 1024, 1366 × 768 e 1920 × 1080: não pode haver rolagem horizontal, sobreposição crítica, quebra de modal ou erro de console. Verifique o botão de instalação em navegador compatível e o guia Safari/iOS; o prompt simulado não comprova instalação física.

## Roteiro manual autenticado (Emulator ou homologação)

Registre ambiente, data, conta mascarada e resultado de cada item. Use duas contas de teste para validar isolamento.

1. Crie uma conta, entre, conclua onboarding e recarregue. Confirme as rotas privadas e o redirecionamento de uma conta sem onboarding.
2. Em **Listas > Pública**, pesquise um item TACO por nome sem acento, categoria e marca; percorra páginas. Abra um item TACO e um curado e confira fonte exibida e macros por 100 `g`/`ml`. Confira `catalogOrigin` e `sourceFoodNumber` nos artefatos gerados, quando necessário.
3. No detalhe de um alimento público, abra **Unidades e porções**. Crie `unidade média` com `80,5 g`, marque-a como padrão, edite, duplique, desative, restaure e verifique que outra conta não enxerga nenhuma dessas alterações.
4. Salve uma densidade opcional com origem **Rótulo**, confirme que ela é individual e teste uma conversão g↔ml. Remova a densidade e confirme que uma conversão cruzada é bloqueada, sem usar equivalência implícita.
5. Em **Diário**, selecione alimento sem peso de unidade, escolha **+ unidade personalizada…** e confirme que o modal pede o valor em `g`/`ml`, sem sugestão numérica. Teste campos inválidos e valores limite válidos (`0,1` e `10.000`).
6. Registre uma medida com **Usar só desta vez**, recarregue e confira o rótulo/quantidade do lançamento; confirme que não surgiu perfil salvo. Em seguida registre com perfil persistente e inspecione os snapshots do lançamento.
7. Altere ou desative o perfil usado e recarregue. O lançamento anterior deve manter os nutrientes e a medida do snapshot. Tente excluir o perfil usado e confirme a desativação segura; exclua fisicamente somente uma medida de teste sem uso.
8. Desligue a rede após carregar catálogo e perfis. Crie/edite uma medida, confirme **Aguardando sincronização**, volte online e confirme sincronização única, sem duplicatas. Pesquise o catálogo no cache offline.
9. Favorite, oculte e personalize um alimento; crie alimento particular e lançamento no diário. Entre na segunda conta para confirmar que não houve vazamento de dados pessoais ou perfis de medida.
10. Faça uma recarga em rota interna publicada, execute em pelo menos um navegador desktop e um dispositivo móvel disponível, e registre separadamente o resultado da instalação PWA real.

## Status e limites de aprovação

- A aprovação automática deve ser registrada com a saída da rodada atual de `catalog:validate`, lint, Vitest, Playwright e ambos os builds.
- **Não declarado como executado neste documento:** cadastro, onboarding, perfis de unidade, densidade, fila offline, diário, isolamento entre contas, regras Firestore e cache por sessão autenticada. Eles exigem a rodada manual acima em Emulator ou homologação.
- Valores nutricionais são referências, não prescrição. Itens variáveis por marca/preparo exigem conferência do rótulo.
- A instalação real em Android, iOS ou desktop só pode ser marcada como aprovada após teste no sistema correspondente.

## Rodada executada — 2026-08-01

- `npm run catalog:validate`: aprovado com **626 alimentos** (`126` curados + `500` TACO).
- `npx tsc -b --pretty false`, `npm run lint` e `npm run test`: aprovados; Vitest registrou **19 arquivos / 72 testes**.
- `npm run test:e2e`: aprovado com **18 cenários Chromium**. A configuração do Playwright força `VITE_E2E=true` ao criar seu servidor local, impedindo inicialização do Firebase de produção durante os smoke tests.
- `npm run build` e `NUTRIPRO_GITHUB_PAGES=true npm run build`: aprovados; PWA e service worker foram gerados. O aviso de tamanho de chunk não bloqueou o build.
- Navegador local: tela de acesso, troca para cadastro e console foram inspecionados; não houve erro de console nem rolagem horizontal em `375×667`, `390×844`, `768×1024`, `1366×768` e `1920×1080`.
- Não houve escrita destrutiva em Firebase real. A rodada autenticada permanece pendente de Emulator/homologação: o Firestore Emulator requer JDK, indisponível nesta máquina no momento da validação.

## Publicação

Depois da validação técnica e, quando aplicável, do roteiro autenticado de homologação:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

O GitHub Pages é publicado pelo push para `main`. Após o deploy, abra a URL publicada, recarregue uma rota interna e valide novamente a tela de acesso/roteamento antes de registrar a rodada.
