const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const statusLabels = { pending: "Pendente", confirmed: "Confirmado", completed: "Concluido", cancelled: "Cancelado" };
const stageLabels = { proposal: "Proposta", negotiation: "Negociacao", discovery: "Descoberta" };
const channelLabels = { Indication: "Indicacao", whatsapp: "WhatsApp", email: "E-mail" };
const templateLabels = { confirmacao_agendamento: "Confirmacao de agendamento", lembrete_24h: "Lembrete de 24 horas" };
let session = { canWrite: false };

async function api(options = {}) {
  const response = await fetch("/api/state", {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    if (payload.signInUrl) window.location.href = payload.signInUrl;
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }
  return payload;
}

function metric(label, value, helper) {
  return `<article class="metric"><span class="muted">${label}</span><strong>${value}</strong><small class="muted">${helper}</small></article>`;
}

function renderMetrics(data) {
  document.querySelector("#metrics").innerHTML = [
    metric("Previsao de receita", currency.format(data.revenueForecast), "agenda + funil ponderado"),
    metric("Confirmados", data.confirmedAppointments, "atendimentos ativos"),
    metric("Pendentes", data.pendingAppointments, "precisam de acompanhamento"),
    metric("Em atraso", currency.format(data.overdueAmount), "cobranca prioritaria"),
    metric("Ocupacao", `${Math.round(data.occupancyRate * 100)}%`, "capacidade semanal"),
  ].join("");
  document.querySelector("#channels").innerHTML = data.channelRoi.map((channel) => {
    const ratio = channel.roi === null ? 100 : Math.min(channel.roi * 18, 100);
    const roi = channel.roi === null ? "Organico" : `${channel.roi}x`;
    return `<div class="channel"><strong>${channelLabels[channel.channel] ?? channel.channel}</strong><div class="muted">${channel.leads} leads | ${channel.appointments} agendas | ROI ${roi}</div><div class="bar"><span style="width:${ratio}%"></span></div></div>`;
  }).join("");
}

function renderAppointments(appointments) {
  document.querySelector("#appointments").innerHTML = appointments.map((appointment) => `
    <div class="row"><div><strong>${appointment.customer}</strong><span class="muted">${appointment.service}</span></div>
    <div><strong>${dateTime.format(new Date(appointment.scheduledAt))}</strong><span class="muted">${appointment.professional} | ${appointment.durationMinutes} min</span></div>
    <div><strong>${currency.format(appointment.price)}</strong><span class="muted">${channelLabels[appointment.channel] ?? appointment.channel}</span></div>
    <span class="pill ${appointment.status}">${statusLabels[appointment.status] ?? appointment.status}</span></div>`).join("");
}

function renderPipeline(deals) {
  document.querySelector("#pipeline").innerHTML = deals.map((deal) => `
    <div class="deal"><strong>${deal.title}</strong><div class="muted">${stageLabels[deal.stage] ?? deal.stage} | ${currency.format(deal.value)} | ${Math.round(deal.probability * 100)}%</div><div class="bar"><span style="width:${Math.round(deal.probability * 100)}%"></span></div></div>`).join("");
}

function renderReminders(items) {
  document.querySelector("#automation-output").innerHTML = items.length ? items.map((job) => `
    <div class="automation-job"><strong>${job.customer}</strong><div class="muted">${channelLabels[job.channel] ?? job.channel} | ${templateLabels[job.template] ?? job.template} | ${dateTime.format(new Date(job.scheduledFor))}</div><p>${job.preview}</p></div>`).join("") : "";
}

function renderSession(next) {
  session = next;
  let element = document.querySelector("#auth-session");
  if (!element) {
    element = document.createElement("a");
    element.id = "auth-session";
    element.className = "auth-session";
    (document.querySelector(".topbar .actions, .topbar-actions, header") || document.body).append(element);
  }
  element.textContent = session.authenticated ? `Sessao: ${session.displayName} | Sair` : "Modo demo | Entrar para salvar";
  element.href = session.authenticated ? session.signOutUrl : session.signInUrl;
}

function render(payload) {
  renderMetrics(payload.metrics);
  renderAppointments(payload.appointments);
  renderPipeline(payload.pipeline);
  renderReminders(payload.reminders);
  renderSession(payload.session);
}

async function runAction(action) {
  if (!session.canWrite) {
    window.location.href = session.signInUrl;
    return;
  }
  render(await api({ method: "POST", body: JSON.stringify({ action }) }));
}

document.querySelector("#new-demo-appointment").addEventListener("click", () => runAction("create_demo_appointment").catch(showError));
document.querySelector("#run-reminders").addEventListener("click", () => runAction("run_reminders").catch(showError));

function showError(error) {
  document.querySelector("#automation-output").textContent = error.message;
}

api().then(render).catch(showError);
