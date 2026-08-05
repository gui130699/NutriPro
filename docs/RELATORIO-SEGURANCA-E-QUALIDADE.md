# Segurança e qualidade — NutriPro 0.9.0

Data de referência: 2026-08-05. Este documento descreve as garantias implementadas e os limites da auditoria; não substitui pentest independente.

## Fronteiras de confiança

- O frontend é público e não contém segredo administrativo.
- `VITE_FIREBASE_*` identifica o aplicativo Web; autorização é feita por Firebase Auth + `firestore.rules`.
- Produção, Emulator e smoke isolado são ambientes separados.
- `VITE_E2E=true` impede inicialização Firebase nos testes públicos.
- `.env`, contas de serviço, chaves privadas e tokens são ignorados pelo Git e excluídos do TXT completo.

## Isolamento por usuário

Todas as coleções pessoais exigem `request.auth.uid == userId`. Em updates, o proprietário não pode mudar. Queries continuam sujeitas às regras e os testes usam contas A/B para comprovar ausência de leitura cruzada.

IDs determinísticos (`foodOverrides`, `foodFavorites`, `foodUsage`, unidades, densidades e pesos vinculados) têm uma exceção mínima para `get` inexistente: o documento deve não existir e seu ID deve começar com o UID autenticado. `list` continua aceitando apenas recursos já pertencentes ao usuário.

## Integridade de payloads

- listas exatas de chaves impedem campos inesperados em documentos críticos;
- números devem ser finitos e estar em intervalos de domínio;
- enums limitam origem, base, método e estado;
- `createdAt` usa timestamp de servidor e é imutável;
- `updatedAt` acompanha a escrita atual;
- snapshots de diário preservam interpretação histórica;
- campos opcionais nulos de avaliação física não são gravados, reduzindo superfície e custo de regras;
- `undefined` é removido de alimentos privados antes de chegar ao SDK.

## Idempotência e concorrência

- onboarding consulta documentos existentes e grava em lote;
- peso inicial e pesos vinculados usam IDs determinísticos;
- favorito usa transação e preserva `createdAt`;
- perfil de unidade usa ID normalizado determinístico;
- definição de padrão consulta apenas pares do mesmo usuário/alimento/origem e desmarca concorrentes em transação;
- fila offline substitui operação anterior da mesma entidade, evitando duplicata na reconexão.

## Offline

O cache não amplia autorização: operações sincronizadas voltam a passar pelas mesmas regras. Dados locais pertencem ao perfil do navegador/dispositivo e devem ser tratados como dados pessoais. Logout não apaga automaticamente todo o IndexedDB; em dispositivo compartilhado, recomenda-se perfil de sistema/navegador separado.

## Dependências

`fast-uri` está forçado para `3.1.5`, corrigindo `GHSA-7p8r-x3mc-p8w7`. O audit restante é `GHSA-qwww-vcr4-c8h2` em React Router, exclusivo das APIs RSC instáveis. O NutriPro não usa RSC/SSR/server actions. A versão patched indicada (`8.3.0`) não existia no npm durante a auditoria. Reavaliar regularmente e remover esta exceção assim que houver release compatível.

Não executar `npm audit fix --force` sem revisão: a sugestão disponível rebaixou para 7.11.0 e abriu mais advisories.

## Acessibilidade e qualidade visual

- Axe WCAG 2 A/AA em acesso e dashboard autenticado;
- labels, roles e estados de modal;
- teclado e Escape;
- contraste corrigido;
- dez viewports sem overflow horizontal;
- PWA com prompt compatível e instrução Safari/iOS.

## Evidências

```text
Vitest unitário        81/81
Firestore Rules        21/21
Playwright autenticado 13/13
Playwright público     23/23
Build normal           aprovado
Build GitHub Pages     aprovado
```

## Operação segura

Antes de publicar:

1. revisar a branch e o diff de regras;
2. rodar `npm run test:all` com JDK 21;
3. exportar backup do Firestore antes de migração;
4. usar projeto de homologação para dry-run;
5. publicar sem `--force` e sem credenciais no repositório;
6. repetir smoke na URL publicada e monitorar erros.

## Limites

Não foram executados pentest externo, leitor de tela físico, PWA em aparelho físico, deploy ou migração de produção. Esses itens permanecem controles operacionais pendentes, não falhas ocultas.
