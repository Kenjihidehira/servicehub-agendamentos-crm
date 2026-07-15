# ServiceHub Agendamentos CRM

[![CI](https://github.com/Kenjihidehira/servicehub-agendamentos-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/Kenjihidehira/servicehub-agendamentos-crm/actions/workflows/ci.yml)
[![Demo pública](https://img.shields.io/badge/demo-pública-0f766e)](https://servicehub-crm-ops.dadosepesquisa.chatgpt.site)

CRM operacional para negócios de serviços que precisam controlar agenda, clientes, funil comercial, cobranças e lembretes de atendimento em um único painel.

![Prévia do painel](docs/dashboard-preview.svg)

## Prova comercial publicada

- **Demo:** [servicehub-crm-ops.dadosepesquisa.chatgpt.site](https://servicehub-crm-ops.dadosepesquisa.chatgpt.site)
- **Autenticação:** consulta pública do cenário de demonstração e alterações protegidas por Sign in with ChatGPT.
- **Persistência:** agenda, cobranças e automações são persistidas em workspace D1 isolado por usuário.
- **Contrato hospedado:** `GET /api/state` consulta o workspace e `POST /api/state` valida e executa ações comerciais.
- **Entrega:** CI, build Vinext, migration reversível e deploy público versionado.
- **Arquitetura:** [`docs/architecture.md`](docs/architecture.md).

## Valor comercial

Este projeto simula uma solução vendável para clínicas, assistências técnicas, estúdios de estética, oficinas e prestadores locais que perdem receita por falta de acompanhamento, agenda desorganizada e cobranças atrasadas. A proposta é mostrar capacidade prática em criar um sistema web com API, painel, dados de exemplo e automações simuladas sem depender de serviços externos para executar a demonstração.

## Funcionalidades

- Painel com previsão de receita, ocupação semanal, agendamentos confirmados, pendências e cobranças em atraso.
- Agenda enriquecida com cliente, serviço, canal de origem, profissional, preço e status.
- Cadastro de novo agendamento via API e pelo botão de demonstração da interface.
- Funil comercial ponderado por probabilidade.
- ROI por canal de marketing com dados de leads, agenda e receita.
- Simulação de fila de lembretes por WhatsApp/e-mail sem envio real de mensagens.
- API documentada com endpoints REST em Node.js nativo.
- Dados comerciais de exemplo prontos em `data/seed.json`.
- Testes automatizados e teste rápido da API e da interface estática.

## Stack

- Node.js 24
- HTTP server nativo, sem dependencias externas
- HTML, CSS e JavaScript puro na interface
- `node:test` para validação automatizada
- Dockerfile para publicação em contêiner
- Vinext/React e Cloudflare D1 na versão comercial hospedada

## Como rodar localmente

```bash
npm start
```

Acesse:

```text
http://localhost:3000
```

Se estiver em um ambiente sem `npm`, rode diretamente:

```bash
node src/server.js
```

## Validação

```bash
npm test
npm run smoke
```

Sem `npm`:

```bash
node --test tests/*.test.js
node tests/smoke.js
```

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Status da aplicacao |
| `GET` | `/api/metrics` | Indicadores comerciais consolidados |
| `GET` | `/api/customers` | Lista de clientes |
| `GET` | `/api/appointments` | Lista de agendamentos enriquecida |
| `POST` | `/api/appointments` | Cria agendamento |
| `PATCH` | `/api/appointments/:id/status` | Atualiza status de agendamento |
| `GET` | `/api/pipeline` | Oportunidades do funil |
| `GET` | `/api/invoices` | Cobranças abertas e atrasadas |
| `POST` | `/api/automations/reminders` | Gera fila simulada de lembretes |

Exemplo de criação de agendamento:

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "content-type: application/json" \
  -d '{
    "customerId": "cus_1001",
    "service": "Avaliacao recorrente",
    "scheduledAt": "2026-07-11T10:00:00-03:00",
    "durationMinutes": 50,
    "professional": "Juliana",
    "price": 340,
    "channel": "Portal"
  }'
```

## Publicação

A versão comercial está ativa no [OpenAI Sites](https://servicehub-crm-ops.dadosepesquisa.chatgpt.site). O código implantado está em `sites/`, incluindo autenticação, persistência, migration e testes de domínio.

### Docker

```bash
docker build -t servicehub-agendamentos-crm .
docker run --rm -p 3000:3000 servicehub-agendamentos-crm
```

### Render, Railway ou Fly.io

- Comando de compilação: nenhum, o projeto não precisa compilar.
- Comando de inicialização: `node src/server.js`
- Variavel obrigatoria: `PORT`, normalmente definida pela propria plataforma.

## Diferenciais para portfólio

- Problema comercial claro: faltas em agenda, baixa conversão, cobranças atrasadas e falta de visão operacional.
- Demonstra servidor, interface, modelagem de dados, validação de payload e automação simulada.
- Pode evoluir para multiempresa, permissões por papel, integração WhatsApp Business Cloud, pagamentos e calendário externo.

## Melhorias possíveis

- Adaptador PostgreSQL para instalações fora do Sites.
- Permissões granulares para administrador, comercial e atendimento.
- Integração real com WhatsApp Business Cloud para envio de lembretes.
- Webhooks de pagamento para baixa automática de cobranças.
- Exportacao de relatorios em CSV/PDF.
- Observabilidade centralizada e alertas de falha das automações.
