import assert from "node:assert/strict";
import test from "node:test";
import seed from "../data/seed.json" with { type: "json" };
import { applyAction, buildDashboard, cloneSeed, normalizeState } from "../lib/domain.js";

test("dashboard consolida agenda, funil e canais", () => {
  const dashboard = buildDashboard(cloneSeed(seed));
  assert.equal(dashboard.appointments.length, seed.appointments.length);
  assert.ok(dashboard.metrics.revenueForecast > 0);
  assert.equal(dashboard.metrics.channelRoi.length, seed.marketing.length);
});

test("agendamento demonstrativo e persistivel nao altera o seed", () => {
  const original = cloneSeed(seed);
  const next = applyAction(original, { action: "create_demo_appointment" });
  assert.equal(original.appointments.length, seed.appointments.length);
  assert.equal(next.appointments.length, seed.appointments.length + 1);
});

test("estado corrompido retorna ao seed", () => {
  assert.deepEqual(normalizeState({ appointments: null }, seed), seed);
});

test("acao desconhecida e rejeitada", () => {
  assert.throws(() => applyAction(cloneSeed(seed), { action: "erase_all" }), /nao suportada/);
});
