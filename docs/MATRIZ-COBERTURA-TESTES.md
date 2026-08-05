# Matriz de cobertura — auditoria 2026-08-05

| Área | Unitário | Regras | E2E autenticado | E2E público/manual | Resultado |
| --- | :---: | :---: | :---: | :---: | --- |
| Login/cadastro/recuperação | — | — | ✓ | ✓ | Aprovado |
| Onboarding completo/ausente/erro | ✓ | ✓ | ✓ | — | Aprovado |
| Idempotência do onboarding | ✓ | ✓ | ✓ | — | Aprovado |
| Perfil/metas/peso | ✓ | ✓ | ✓ | — | Aprovado |
| Isolamento conta A/B | — | ✓ | ✓ | — | Aprovado |
| Alimento particular | ✓ | ✓ | ✓ | — | Aprovado |
| Favoritos/overrides | ✓ | ✓ | — | — | Aprovado por serviço/regras |
| Catálogo 626/TACO | ✓ | — | ✓ | ✓ | Aprovado |
| Busca/cache IndexedDB | ✓ | — | ✓ | — | Aprovado |
| Unidade/porção direta | ✓ | ✓ | ✓ | — | Aprovado |
| Snapshot histórico | ✓ | ✓ | ✓ | — | Aprovado |
| Padrão/transação/consulta limitada | ✓ | ✓ | — | — | Aprovado por serviço/regras |
| Densidade e limite 20 g/ml | ✓ | ✓ | — | — | Aprovado por serviço/regras |
| Fila offline/reconexão | ✓ | ✓ | ✓ | — | Aprovado |
| Hidratação | ✓ | ✓ | ✓ | — | Aprovado |
| Evolução/peso | ✓ | ✓ | ✓ | — | Aprovado |
| Medidas corporais | ✓ | ✓ | ✓ | — | Aprovado |
| Avaliação física | ✓ | ✓ | ✓ | — | Aprovado |
| Acessibilidade WCAG A/AA | — | — | ✓ | ✓ | Aprovado (Axe/teclado) |
| Responsividade | — | — | — | ✓, 10 viewports | Aprovado |
| PWA prompt/guia | — | — | — | ✓ | Aprovado automatizado |
| PWA física | — | — | — | não executado | Pendente operacional |
| Build normal/Pages | — | — | — | ✓ | Aprovado |
| Produção/deploy/migração | — | — | — | não executado | Fora do escopo seguro |

## Arquivos de evidência

- unitários: `src/**/*.test.ts`;
- regras: `tests/firestore/firestore-rules.test.ts`;
- autenticados: `tests/e2e/firebase/*.spec.ts`;
- públicos: `tests/e2e/*.spec.ts`;
- configurações: `playwright.config.ts`, `playwright.firebase.config.ts`, `firebase.json`;
- relatório detalhado: `docs/RELATORIO-AUDITORIA-COMPLETA.md`.

“Aprovado por serviço/regras” indica que a operação e a autorização foram testadas diretamente, embora não exista um clique E2E dedicado para cada variante de UI. Nenhum item marcado “não executado” deve ser apresentado como homologado.
