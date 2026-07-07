const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`Erro ${response.status} em ${path}`);
  }
  return response.json();
}

function metric(label, value, helper) {
  return `<article class="metric"><span class="muted">${label}</span><strong>${value}</strong><small class="muted">${helper}</small></article>`;
}

async function renderMetrics() {
  const data = await api("/api/metrics");
  document.querySelector("#metrics").innerHTML = [
    metric("Previsao de receita", currency.format(data.revenueForecast), "agenda + funil ponderado"),
    metric("Confirmados", data.confirmedAppointments, "atendimentos ativos"),
    metric("Pendentes", data.pendingAppointments, "precisam follow-up"),
    metric("Em atraso", currency.format(data.overdueAmount), "cobranca prioritaria"),
    metric("Ocupacao", `${Math.round(data.occupancyRate * 100)}%`, "capacidade semanal")
  ].join("");

  document.querySelector("#channels").innerHTML = data.channelRoi
    .map(channel => {
      const ratio = channel.roi === null ? 100 : Math.min(channel.roi * 18, 100);
      const roi = channel.roi === null ? "Organico" : `${channel.roi}x`;
      return `
        <div class="channel">
          <strong>${channel.channel}</strong>
          <div class="muted">${channel.leads} leads | ${channel.appointments} agendas | ROI ${roi}</div>
          <div class="bar"><span style="width:${ratio}%"></span></div>
        </div>
      `;
    })
    .join("");
}

async function renderAppointments() {
  const appointments = await api("/api/appointments");
  document.querySelector("#appointments").innerHTML = appointments
    .map(appointment => `
      <div class="row">
        <div>
          <strong>${appointment.customer}</strong>
          <span class="muted">${appointment.service}</span>
        </div>
        <div>
          <strong>${dateTime.format(new Date(appointment.scheduledAt))}</strong>
          <span class="muted">${appointment.professional} | ${appointment.durationMinutes} min</span>
        </div>
        <div>
          <strong>${currency.format(appointment.price)}</strong>
          <span class="muted">${appointment.channel}</span>
        </div>
        <span class="pill ${appointment.status}">${appointment.status}</span>
      </div>
    `)
    .join("");
}

async function renderPipeline() {
  const deals = await api("/api/pipeline");
  document.querySelector("#pipeline").innerHTML = deals
    .map(deal => `
      <div class="deal">
        <strong>${deal.title}</strong>
        <div class="muted">${deal.stage} | ${currency.format(deal.value)} | ${Math.round(deal.probability * 100)}%</div>
        <div class="bar"><span style="width:${Math.round(deal.probability * 100)}%"></span></div>
      </div>
    `)
    .join("");
}

async function createDemoAppointment() {
  await api("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      customerId: "cus_1002",
      service: "Visita tecnica emergencial",
      scheduledAt: "2026-07-10T16:30:00-03:00",
      durationMinutes: 80,
      professional: "Caio",
      price: 520,
      channel: "Portal"
    })
  });
  await Promise.all([renderMetrics(), renderAppointments()]);
}

async function runReminders() {
  const result = await api("/api/automations/reminders", { method: "POST" });
  document.querySelector("#automation-output").innerHTML = result.queued
    .map(job => `
      <div class="automation-job">
        <strong>${job.customer}</strong>
        <div class="muted">${job.channel} | ${job.template} | ${dateTime.format(new Date(job.scheduledFor))}</div>
        <p>${job.preview}</p>
      </div>
    `)
    .join("");
}

document.querySelector("#new-demo-appointment").addEventListener("click", createDemoAppointment);
document.querySelector("#run-reminders").addEventListener("click", runReminders);

Promise.all([renderMetrics(), renderAppointments(), renderPipeline()]).catch(error => {
  document.body.insertAdjacentHTML("beforeend", `<pre class="error">${error.message}</pre>`);
});
