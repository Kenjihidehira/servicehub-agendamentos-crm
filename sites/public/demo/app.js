const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const statusLabels = { pending: "Pendente", confirmed: "Confirmado", completed: "Concluido", cancelled: "Cancelado" };
const stageLabels = { proposal: "Proposta", negotiation: "Negociacao", discovery: "Descoberta" };
const channelLabels = { Indication: "Indicacao", whatsapp: "WhatsApp", email: "E-mail" };
const templateLabels = { confirmacao_agendamento: "Confirmacao de agendamento", lembrete_24h: "Lembrete de 24 horas" };
let session = { canWrite: false };
let appointmentsState = [];
const appointmentFilters = { search: "", status: "all", sort: "date" };

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
  appointmentsState = appointments;
  const search = appointmentFilters.search.trim().toLocaleLowerCase("pt-BR");
  const visible = appointments
    .filter((appointment) => appointmentFilters.status === "all" || appointment.status === appointmentFilters.status)
    .filter((appointment) => !search || [appointment.customer, appointment.service, appointment.professional]
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search)))
    .sort((left, right) => {
      if (appointmentFilters.sort === "value") return right.price - left.price;
      if (appointmentFilters.sort === "customer") return left.customer.localeCompare(right.customer, "pt-BR");
      return new Date(left.scheduledAt) - new Date(right.scheduledAt);
    });

  document.querySelector("#appointmentCount").textContent = `${visible.length} de ${appointments.length} atendimentos`;
  const tableBody = document.querySelector("#appointments");
  tableBody.setAttribute("aria-busy", "false");
  tableBody.innerHTML = visible.length ? visible.map((appointment) => `
    <tr>
      <td><strong>${appointment.customer}</strong><small>${appointment.service}</small></td>
      <td><strong>${dateTime.format(new Date(appointment.scheduledAt))}</strong><small>${appointment.professional} | ${appointment.durationMinutes} min</small></td>
      <td><strong>${currency.format(appointment.price)}</strong><small>${channelLabels[appointment.channel] ?? appointment.channel}</small></td>
      <td><span class="pill ${appointment.status}">${statusLabels[appointment.status] ?? appointment.status}</span></td>
    </tr>`).join("") : '<tr><td class="empty-state" colspan="4"><strong>Nenhum atendimento encontrado</strong><span>Ajuste os filtros para recuperar a agenda.</span></td></tr>';
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
  setBusy(true);
  try {
    render(await api({ method: "POST", body: JSON.stringify({ action }) }));
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  document.querySelector("#appointments").setAttribute("aria-busy", String(isBusy));
  for (const button of document.querySelectorAll("#run-reminders, #new-demo-appointment")) button.disabled = isBusy;
}

function debounce(callback, delay = 220) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), delay);
  };
}

function refreshAppointmentView() {
  renderAppointments(appointmentsState);
}

document.querySelector("#new-demo-appointment").addEventListener("click", () => runAction("create_demo_appointment").catch(showError));
document.querySelector("#run-reminders").addEventListener("click", () => runAction("run_reminders").catch(showError));
document.querySelector("#appointmentSearch").addEventListener("input", debounce((event) => {
  appointmentFilters.search = event.target.value;
  refreshAppointmentView();
}));
document.querySelector("#appointmentStatus").addEventListener("change", (event) => {
  appointmentFilters.status = event.target.value;
  refreshAppointmentView();
});
document.querySelector("#appointmentSort").addEventListener("change", (event) => {
  appointmentFilters.sort = event.target.value;
  refreshAppointmentView();
});
document.querySelector("#clearAppointmentFilters").addEventListener("click", () => {
  Object.assign(appointmentFilters, { search: "", status: "all", sort: "date" });
  document.querySelector("#appointmentSearch").value = "";
  document.querySelector("#appointmentStatus").value = "all";
  document.querySelector("#appointmentSort").value = "date";
  refreshAppointmentView();
});

function showError(error) {
  setBusy(false);
  const output = document.querySelector("#automation-output");
  output.innerHTML = '<div class="error-message" role="alert"><strong>Falha na operacao</strong><p></p></div>';
  output.querySelector("p").textContent = error.message;
}

setBusy(true);
api().then(render).catch(showError).finally(() => setBusy(false));
