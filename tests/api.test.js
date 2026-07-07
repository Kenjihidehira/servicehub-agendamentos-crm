const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer, calculateMetrics, buildAutomationQueue, validateAppointment } = require("../src/server");
const seed = require("../data/seed.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function withServer(assertions) {
  const server = createServer(clone(seed));
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await assertions(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("calcula indicadores comerciais principais", () => {
  const metrics = calculateMetrics(clone(seed));
  assert.equal(metrics.confirmedAppointments, 2);
  assert.equal(metrics.pendingAppointments, 2);
  assert.equal(metrics.overdueAmount, 2450);
  assert.ok(metrics.revenueForecast > 10000);
  assert.equal(metrics.channelRoi.find(item => item.channel === "WhatsApp").roi, 34);
});

test("gera fila de automacao sem enviar mensagens reais", () => {
  const queue = buildAutomationQueue(clone(seed));
  assert.ok(queue.length >= 3);
  assert.equal(queue.every(job => job.preview.includes("Seu atendimento")), true);
  assert.equal(queue.some(job => job.template === "confirmacao_agendamento"), true);
});

test("valida payload de novo agendamento", () => {
  assert.equal(validateAppointment({}), "Campos obrigatorios ausentes: customerId, service, scheduledAt, durationMinutes, professional, price.");
  assert.equal(validateAppointment({
    customerId: "cus_1001",
    service: "Teste",
    scheduledAt: "2026-07-11T10:00:00-03:00",
    durationMinutes: 30,
    professional: "Teste",
    price: 100
  }), null);
});

test("API cria agendamento e retorna lista enriquecida", async () => {
  await withServer(async baseUrl => {
    const created = await fetch(`${baseUrl}/api/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: "cus_1001",
        service: "Avaliacao recorrente",
        scheduledAt: "2026-07-11T10:00:00-03:00",
        durationMinutes: 50,
        professional: "Juliana",
        price: 340,
        channel: "Portal"
      })
    });
    assert.equal(created.status, 201);
    const appointment = await created.json();
    assert.match(appointment.id, /^apt_/);

    const list = await fetch(`${baseUrl}/api/appointments`).then(res => res.json());
    assert.equal(list.some(item => item.id === appointment.id && item.customer === "Studio Bella Forma"), true);
  });
});
