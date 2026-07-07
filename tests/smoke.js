const assert = require("node:assert/strict");
const { createServer } = require("../src/server");

async function main() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`).then(res => res.json());
    assert.equal(health.ok, true);

    const home = await fetch(`${baseUrl}/`).then(res => res.text());
    assert.match(home, /ServiceHub Agendamentos CRM/);

    const reminders = await fetch(`${baseUrl}/api/automations/reminders`, {
      method: "POST"
    }).then(res => res.json());
    assert.ok(Array.isArray(reminders.queued));
    assert.ok(reminders.queued.length > 0);

    console.log("Smoke test ok");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
