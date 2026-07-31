# Testes funcionais — NutriPro

Este documento é o roteiro de validação da integração do catálogo brasileiro `1.0.0-br`. Ele separa verificações automatizadas de cenários que exigem uma conta de homologação, para não confundir teste de interface isolado com escrita real em Firebase.

## Escopo da versão

| Item | Referência esperada |
| --- | --- |
| Fonte editável | `lista_alimentos_brasileiros_nutripro.csv` |
| Catálogo público | `public/data/foods.json` |
| Metadados | `public/data/foods-version.json` |
| Versão | `1.0.0-br` |
| Data de atualização | `2026-07-31` |
| Total de alimentos | 126 |
| Idioma da fonte | `pt-BR` |
| Base nutricional | 100 `g` ou 100 `ml`, conforme o item |

O catálogo público não deve criar, alterar ou excluir documentos pessoais no Firestore. Favoritos, overrides, alimentos privados e lançamentos do diário continuam a depender de uma sessão autenticada e de regras por `userId`.

## Preparação

```bash
npm ci
npx playwright install chromium
```

Configure `.env` somente se for necessário testar uma instância Firebase de homologação. Não use uma conta de produção para cenários destrutivos.

## Validação automatizada

Execute na ordem abaixo:

```bash
npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv --version 1.0.0-br --expected-total 126
npm run catalog:validate
npm run lint
npm run test
npm run test:e2e
npm run build
NUTRIPRO_GITHUB_PAGES=true npm run build
```

O importador deve finalizar com 126 itens e `0` códigos duplicados, registros ignorados e registros inválidos. `catalog:validate` deve confirmar, sem modificar os arquivos, que o CSV e os artefatos públicos correspondem à versão e à quantidade esperadas.

Se qualquer etapa falhar, não publique. Uma fonte com total incorreto, código duplicado, nutriente negativo, base inválida, unidade diferente de `g`/`ml`, idioma inválido ou cabeçalho incompatível deve ser rejeitada sem substituir o último catálogo válido.

### Cobertura exigida do catálogo

| Área | Verificação |
| --- | --- |
| Contrato CSV | Cabeçalho brasileiro, 126 registros, códigos únicos, `pt-BR`, `S/N`, nutrientes finitos e não negativos. |
| Artefatos | `foods.json` contém 126 itens e `foods-version.json` informa `1.0.0-br`, `2026-07-31` e `totalFoods: 126`. |
| Busca | Nome, categoria e marca; acentos, pontuação e hífens não devem impedir a localização. |
| Filtros e paginação | Categoria, favoritos/ocultos, debounce e carregamento progressivo continuam funcionando. |
| Medidas | Itens de massa oferecem `g`/`kg`; itens líquidos oferecem `ml`/`l`; `unidade` e `porção` só aparecem quando o peso respectivo existe. |
| Integridade de cache | Uma resposta cuja contagem diverge de `totalFoods` não substitui o IndexedDB; a troca de versão é atômica. |
| Offline | Depois de um carregamento válido, desligar a rede mantém a última versão íntegra disponível. |
| Dados variáveis | Item com fonte que indique valor médio ou conferência de rótulo exibe o aviso no detalhe. |

## Smoke tests em Chromium

`npm run test:e2e` usa `VITE_E2E=true`. Nesse modo, Auth e Firestore não são inicializados: os testes são seguros para CI, mas não provam fluxos autenticados reais. Valide pelo menos:

- abertura da tela de acesso, validação local e redirecionamento de rota privada para visitantes;
- ausência de rolagem horizontal em 375 × 667, 390 × 844, 768 × 1024, 1366 × 768 e 1920 × 1080;
- instalação PWA simulada em navegador compatível e instruções Safari/iOS;
- build normal e build com `NUTRIPRO_GITHUB_PAGES=true`.

O teste em Chromium da lista pública, do diário, de favorito, de override e de persistência do onboarding **não deve ser marcado como aprovado neste documento sem uma execução autenticada registrada**.

## Roteiro manual autenticado (homologação)

Use duas contas exclusivas de teste ou Firebase Emulator Suite. Registre no pull request/data da rodada o ambiente, a conta mascarada e o resultado de cada item.

1. Crie uma conta, entre e conclua o onboarding; recarregue a página e confirme que as rotas privadas continuam acessíveis.
2. Abra **Listas > Pública**, pesquise por nome sem acento e por categoria; percorra mais de uma página de resultados.
3. Abra um alimento, confira categoria, macros, fonte, unidade-base e porção sugerida; confirme o aviso se a fonte indicar valor médio/conferir rótulo.
4. Favorite um alimento, crie uma personalização, oculte-o e restaure os valores originais. Entre com a segunda conta e confirme que essas ações não vazaram.
5. No diário, escolha um item em `g` e outro em `ml`; confirme que a lista de unidades não oferece conversões incompatíveis. Teste `unidade`/`porção` apenas quando houver peso configurado.
6. Adicione um item à refeição, recarregue e confira quantidade, unidade, gramas/ml convertidos e snapshot nutricional.
7. Com o catálogo carregado, desligue a rede, abra a lista e pesquise novamente. Em seguida, publique uma versão de teste com total coerente e confirme a atualização atômica do cache.

## Limitações conhecidas e critérios de comunicação

- Valores nutricionais são referências por 100 `g`/`ml`; não são prescrição nem substituem rótulo, nutricionista ou avaliação médica.
- Itens cuja fonte informa valor médio ou necessidade de conferir o rótulo precisam de revisão para o produto específico.
- A instalação real em Android, iOS ou desktop só pode ser declarada como concluída depois de teste no sistema operacional correspondente; o prompt simulado não equivale à instalação física.
- Não declare cadastro, onboarding, favorito, override, diário, cache autenticado ou regras Firestore como aprovados apenas porque a suíte `VITE_E2E=true` passou.

## Publicação

Após a validação, publique o build e as regras necessárias:

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

O GitHub Pages é publicado pelo push para `main`. Após o deploy, abra a URL publicada, faça uma recarga em uma rota interna e verifique a tela de acesso/roteamento antes de registrar o resultado da rodada.
