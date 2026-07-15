# Arquitetura da prova comercial

## Visao geral

```mermaid
flowchart LR
  B[Dashboard publico] --> API[/api/state]
  API --> AUTH[Sign in with ChatGPT]
  API --> DOMAIN[Agenda, funil e lembretes]
  API --> DB[(D1 por usuario)]
  CI[GitHub Actions] --> BUILD[Testes e build Vinext]
```

A API Node original permanece como implementacao de referencia. O deploy em `sites/` reutiliza a mesma base demonstrativa e acrescenta autenticacao, persistencia e execucao no edge.

## Limites e seguranca

- Visitantes leem um seed imutavel; escrita exige identidade fornecida pela plataforma.
- O e-mail do usuario nunca e aceito pelo payload e identifica a chave do workspace.
- O servidor aceita somente `create_demo_appointment` e `run_reminders`.
- Dados invalidos ou corrompidos voltam ao seed conhecido.
- Nenhum segredo, token ou credencial e exposto no repositorio.

## Persistencia

O D1 armazena um documento de estado por usuario em `workspaces`. A migration em `sites/db/migrations` e reversivel; o bootstrap idempotente garante disponibilidade no primeiro acesso. Em producao multiempresa, clientes, agendamentos, negocios e eventos devem ser normalizados e vinculados a uma organizacao.

## Qualidade

A CI valida a aplicacao Node, smoke test, regras hospedadas e build de producao. Regras de agenda ficam em `sites/lib/domain.js`; HTTP, identidade e banco ficam isolados em `sites/app/api/state` e `sites/db`.
