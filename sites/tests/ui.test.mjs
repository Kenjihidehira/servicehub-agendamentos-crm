import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/demo/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/demo/app.js", import.meta.url), "utf8");

test("a agenda usa tabela operacional com busca, filtro e ordenacao", () => {
  assert.match(html, /<table>/);
  for (const id of ["appointmentSearch", "appointmentStatus", "appointmentSort", "clearAppointmentFilters"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /Nenhum atendimento encontrado/);
});

test("a demo nao usa persistencia local no navegador", () => {
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
});
