# Testes funcionais — NutriPro

## Registro da rodada

| Campo | Valor |
| --- | --- |
| Data | 30/07/2026 |
| Commit funcional testado | `51b6ff31a90149a52f06eb7bbfd2f8e845627474` |
| Ambiente | Vite local em `http://127.0.0.1:4173` |
| Navegadores | Chromium do Playwright 1.62 e navegador integrado do Codex |
| Firebase | Nenhuma escrita em produção; sem conta de homologação disponível |
| Unitários | 25 aprovados em 8 arquivos |
| E2E | 13 aprovados em Chromium |

## Comandos executados

```bash
npm run test       # 25 aprovados
npm run build      # aprovado
npm run lint       # aprovado
npm run test:e2e   # 13 aprovados
```

O Playwright iniciou o Vite local automaticamente. Os cenários não autenticados foram executados sem credenciais Firebase e não criaram, alteraram ou removeram dados remotos.

## Cenários automatizados executados

| ID | Módulo | Tela/ação | Cenário | Resultado esperado | Resultado obtido | Estado | Evidência/observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | Acesso | `/entrar` | Abrir tela de acesso | Título e formulário visíveis | Visíveis | Aprovado | `auth-and-theme.smoke.spec.ts` |
| E2E-02 | Acesso | Login vazio | Enviar sem campos | Erros locais de e-mail e senha | Exibidos | Aprovado | Não enviou autenticação remota |
| E2E-03 | Acesso | Login inválido | E-mail inválido e senha curta | Validação em PT-BR | Exibida | Aprovado | Não enviou autenticação remota |
| E2E-04 | Acesso | Recuperação | Abrir recuperação e enviar vazio | Campo de senha some; e-mail continua validado | Confirmado | Aprovado | Fluxo de envio real requer Firebase de teste |
| E2E-05 | Tema | Bootstrap | Preferência `dark` no carregamento | `html.dark` e `data-theme=dark` antes do React | Confirmado | Aprovado | Teste E2E com `addInitScript` |
| E2E-06 | Acessibilidade | Acesso | Labels, botão e Tab | Controles acessíveis e foco navegável | Confirmado | Aprovado | `accessibility.spec.ts` |
| E2E-07 | Rotas | `/listas` | Visitante abre rota privada | Redirecionamento para `/entrar` | Confirmado | Aprovado | Sem sessão |
| E2E-08 | Rotas | `/diario` | Visitante abre rota privada | Redirecionamento para `/entrar` | Confirmado | Aprovado | Sem sessão |
| E2E-09 | Rotas | `/perfil` | Visitante abre rota privada | Redirecionamento para `/entrar` | Confirmado | Aprovado | Sem sessão |
| E2E-10 | Responsividade | 375 × 667 | Abrir acesso | Sem rolagem horizontal; envio visível | Confirmado | Aprovado | `responsive.spec.ts` |
| E2E-11 | Responsividade | 390 × 844 | Abrir acesso | Sem rolagem horizontal; envio visível | Confirmado | Aprovado | `responsive.spec.ts` |
| E2E-12 | Responsividade | 768 × 1024 | Abrir acesso | Sem rolagem horizontal; envio visível | Confirmado | Aprovado | `responsive.spec.ts` |
| E2E-13 | Responsividade | 1366 × 768 | Abrir acesso | Sem rolagem horizontal; envio visível | Confirmado | Aprovado | `responsive.spec.ts` |
| E2E-14 | Responsividade | 1920 × 1080 | Abrir acesso | Sem rolagem horizontal; envio visível | Confirmado | Aprovado | `responsive.spec.ts` |

## Testes unitários executados

| Módulo | Cobertura verificada | Estado |
| --- | --- | --- |
| Nutrição | conversão de unidades, cálculos, soma e porção | Aprovado |
| Catálogo | normalização, palavras-chave e deduplicação por `externalId` | Aprovado |
| Pesquisa | acentos, termo parcial, categoria, favorito, ocultação e paginação | Aprovado |
| Overrides | personalização individual, restauração e ocultar/restaurar | Aprovado |
| Refeições | defaults, aliases, snapshots e compatibilidade com `mealName` | Aprovado |
| Ícones | 33 chaves persistíveis e busca sem acentos | Aprovado |
| Tema | claro, escuro, sistema, cache e classe raiz | Aprovado |

## Verificação manual no navegador

Foi aberto o servidor local no navegador integrado e verificado diretamente:

| Área | Cenário | Resultado | Estado |
| --- | --- | --- | --- |
| Acesso | Tela carregada após o bundle final | Título “Seu bem-estar começa aqui.” visível | Aprovado |
| Tema escuro | Preferência já ativa no contexto do navegador | Fundo `rgb(14, 24, 19)` e título claro com contraste | Aprovado |
| Layout | Janela 1280 px | `scrollWidth` 1265 px; sem rolagem horizontal | Aprovado |
| Rota privada | Abrir `/listas` sem sessão | Retorno para `/entrar` | Aprovado |
| Console | Login e rota privada | Nenhum erro ou warning relevante | Aprovado |

## Problemas encontrados e correções

| Problema | Causa | Correção | Resultado |
| --- | --- | --- | --- |
| Teste de acessibilidade encontrava dois controles com “Senha” | O seletor genérico incluía o botão de exibir senha | Teste passou a selecionar o textbox e o botão separadamente | Suíte E2E aprovada |
| Teste responsivo procurava `button[type=submit]` | O botão usa submissão implícita, válida em HTML | Teste passou a buscar o botão por nome acessível | Cinco dimensões aprovadas |
| Não há CSV de 7.083 alimentos no workspace | Arquivo de origem não foi anexado | Mantido stub seguro, importador e cache prontos | Limitação declarada; nenhum dado inventado |

## Cenários que não foram executados

Os cenários abaixo exigem Firebase Emulator Suite completo ou uma conta/projeto de homologação. Não foram executados para não criar, editar ou excluir dados de produção.

| Módulo | Tela/ação | Motivo | Estado |
| --- | --- | --- | --- |
| Cadastro/login válido | Authentication | Sem conta de teste/homologação | Não executado |
| Onboarding persistido | Firestore | Sem ambiente de escrita seguro | Não executado |
| Lista pública com 7.083 itens | `/listas` | CSV oficial ausente | Não executado |
| Overrides, favoritos e alimento particular reais | `/listas` | Sem Firestore de homologação | Não executado |
| Refeições reais e snapshots no diário | `/listas` e `/diario` | Sem Firestore de homologação | Não executado |
| Hidratação e exclusão reais | `/diario` | Sem Firestore de homologação | Não executado |
| Persistência autenticada de tema | `/perfil` | Sem Firestore de homologação | Não executado |
| PWA offline após primeiro catálogo | Produção/preview | Catálogo oficial ausente | Não executado |

O Firebase Emulator Suite não foi iniciado nesta máquina porque o emulador Firestore requer Java e o runtime Java não está instalado. A próxima rodada deve anexar o CSV e usar Emulator Suite ou um projeto Firebase de homologação, então repetir os cenários autenticados campo a campo.

## Como repetir

```bash
npm install
npx playwright install chromium
npm run test
npm run build
npm run lint
npm run test:e2e
```

Para homologação segura, configure `VITE_FIREBASE_*` para o projeto de teste ou conecte a aplicação aos emuladores antes de executar mutações. Os resultados de falha do Playwright ficam em `test-results/` e `playwright-report/`, ambos fora do Git.
