# Relatório de importação de alimentos — NutriPro

Data: 2026-08-01  
Fonte: TACO 4ª ed. NEPA/UNICAMP  
SHA-256 da fonte baixada: `bc77766e56d7c669dd9cdba3fdbde7bcbf1bb4140e829720cb4a676d27670ea8`

## Resultado

- Catálogo curado preservado: 126 alimentos (IDs `BR0001` a `BR0126`).
- Registros TACO de origem: 597.
- Registros com campos obrigatórios completos: 581.
- Registros TACO elegíveis após duplicidades e prioridade: 500.
- Novos registros TACO selecionados: 500.
- Total final validado: 626.
- Duplicidades revisadas contra os 126 curados: 80.
- Duplicidades óbvias internas TACO: 0.
- Omissões por prioridade de catálogo: 1.
- Registros ignorados/inválidos: 97.

## Política de seleção

A lista final usa somente a fonte primária TACO preservada em `data/sources/taco-4a-edicao-cleaned.csv`. O espelho de contingência foi consultado apenas para auditoria: o código 540 aparece como `L` na fonte primária e como “Feijoada” no espelho; ele foi ignorado porque já existe no catálogo curado.

A identidade de alimentos remove acentos, pontuação, conectores e diferenças de ordem, mas mantém termos materiais — inclusive preparo (cru/cozido/frito/assado/grelhado), sabor, corte, sal, pele e conservação. Uma lista revisada de 80 códigos TACO impede colisões com os 126 alimentos curados; o código 474 (cerveja) foi omitido da seleção sugerida. Não houve duplicidades internas após essa verificação.

Checksum SHA-256 dos códigos TACO selecionados (ordem crescente): `7c3348abb6d1edcfa37e452096b47237a2906bcb32f329f6bba6072b77562189`.  
Checksum SHA-256 dos IDs TACO selecionados: `94e93758a776bf589e5726be335f6a403ad7f477804b9e67aa4aa0a20c4cd80b`.

## Distribuição dos 500 novos alimentos

| Categoria TACO | Total |
| --- | ---: |
| Alimentos Preparados | 31 |
| Bebidas (alcoólicas e não alcoólicas) | 9 |
| Carnes e Derivados | 112 |
| Cereais e derivados | 55 |
| Frutas e derivados | 81 |
| Gorduras e Oleos | 5 |
| Leguminosas e Derivados | 25 |
| Leite e Derivados | 16 |
| Miscelâneas | 7 |
| Nozes e Sementes | 9 |
| Outros Alimentos Industrializados | 4 |
| Ovos e Derivados | 3 |
| Pescados e Frutos do Mar | 49 |
| Produtos Açucarados | 17 |
| Verduras, hortaliças e derivados | 77 |

## Amostra de registros ignorados

| Linha | Código | Descrição | Motivo |
| ---: | --- | --- | --- |
| 260 | 259 | Azeite, de dendê | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 261 | 260 | Azeite, de oliva, extra virgem | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 268 | 267 | Óleo, de babaçu | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 269 | 268 | Óleo, de canola | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 270 | 269 | Óleo, de girassol | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 271 | 270 | Óleo, de milho | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 272 | 271 | Óleo, de pequi | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 273 | 272 | Óleo, de soja | campo obrigatório ausente/inválido: proteínas, carboidratos |
| 451 | 450 | Iogurte, sabor abacaxi | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 458 | 457 | Leite, de vaca, desnatado, UHT | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 459 | 458 | Leite, de vaca, integral | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 473 | 472 | Cana, aguardente 1 | campo obrigatório ausente/inválido: proteínas, gorduras, carboidratos |
| 517 | 516 | Sal, dietético | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 518 | 517 | Sal, grosso | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 541 | 540 | L | campo obrigatório ausente/inválido: nome |
| 592 | 591 | Coco, verde, cru | campo obrigatório ausente/inválido: calorias, proteínas, gorduras, carboidratos |
| 2 | 1 | Arroz, integral, cozido | duplicidade revisada com alimento curado existente |
| 4 | 3 | Arroz, tipo 1, cozido | duplicidade revisada com alimento curado existente |
| 8 | 7 | Aveia, flocos, crua | duplicidade revisada com alimento curado existente |
| 9 | 8 | Biscoito, doce, maisena | duplicidade revisada com alimento curado existente |
| 14 | 13 | Biscoito, salgado, cream cracker | duplicidade revisada com alimento curado existente |
| 17 | 16 | Bolo, pronto, chocolate | duplicidade revisada com alimento curado existente |
| 53 | 52 | Pão, trigo, forma, integral | duplicidade revisada com alimento curado existente |
| 54 | 53 | Pão, trigo, francês | duplicidade revisada com alimento curado existente |
| 65 | 64 | Abóbora, cabotian, cozida | duplicidade revisada com alimento curado existente |
| 71 | 70 | Abobrinha, italiana, cozida | duplicidade revisada com alimento curado existente |
| 80 | 79 | Alface, lisa, crua | duplicidade revisada com alimento curado existente |
| 83 | 82 | Alho, cru | duplicidade revisada com alimento curado existente |
| 89 | 88 | Batata, doce, cozida | duplicidade revisada com alimento curado existente |
| 92 | 91 | Batata, inglesa, cozida | duplicidade revisada com alimento curado existente |

A importação converteu `Tr` em `0,00001`; `NA`, `*` e campos vazios foram tratados como ausentes. Registros sem calorias, proteínas, gorduras, carboidratos, nome, categoria ou código foram recusados. A fibra não é campo eliminatório da TACO e é representada como `0` quando a fonte não a publica; nenhum valor ausente de calorias, proteínas, gorduras ou carboidratos foi inventado.

## Política de medida publicada na homologação de 2026-08-05

Cada alimento passou a publicar `measurementPolicy`, sem mudar os nutrientes nem os identificadores preservados:

| Origem/base | Política |
| --- | --- |
| Alimento com base `ml` | `volume-source` |
| Qualquer alimento TACO | `mass-source`, referência explícita por 100 g |
| Bebida não TACO cuja fonte é massa | `requires-density` para conversão em ml |
| Demais alimentos em base `g` | `mass-source` |

As nove bebidas TACO selecionadas permanecem em 100 g. Não foi criada versão em mililitros, pois a fonte auditada não fornece densidade confiável por item. Na interface, tentar uma medida volumétrica para bebida TACO requer densidade pessoal documentada ou uma medida explícita; o sistema não presume `1 ml = 1 g`.

Comando exato reproduzido:

```bash
npm run catalog:import -- lista_alimentos_brasileiros_nutripro.csv \
  --taco data/sources/taco-4a-edicao-cleaned.csv \
  --additional-total 500 \
  --expected-total 626 \
  --version 2.0.0-br \
  --updated-at 2026-08-01
npm run catalog:validate
```

Resultado final: **626 alimentos validados**, sem ID duplicado, com os mesmos checksums de fonte/seleção acima. Os testes unitários verificam a política TACO e o E2E autenticado abre “Bebida isotônica, sabores variados” e confirma a referência `100 g`.
