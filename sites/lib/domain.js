export function cloneSeed(seed) {
  return structuredClone(seed);
}

export function normalizeState(value, fallback) {
  const valid = value && ["customers", "appointments", "pipeline", "invoices", "marketing"]
    .every((key) => Array.isArray(value[key]));
  return structuredClone(valid ? value : fallback);
}

function enrichAppointments(state) {
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  return state.appointments
    .map((appointment) => ({
      ...appointment,
      customer: customers.get(appointment.customerId)?.name ?? "Cliente nao encontrado",
    }))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function calculateMetrics(state) {
  const totalRevenue = state.appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .reduce((sum, appointment) => sum + appointment.price, 0);
  const weightedPipeline = state.pipeline.reduce((sum, deal) => sum + deal.value * deal.probability, 0);
  const occupancyMinutes = state.appointments.reduce((sum, appointment) => sum + appointment.durationMinutes, 0);
  return {
    revenueForecast: Math.round(totalRevenue + weightedPipeline),
    confirmedAppointments: state.appointments.filter((item) => item.status === "confirmed").length,
    pendingAppointments: state.appointments.filter((item) => item.status === "pending").length,
    overdueAmount: state.invoices.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0),
    occupancyRate: Number(Math.min(occupancyMinutes / 2400, 1).toFixed(2)),
    channelRoi: state.marketing.map((channel) => ({
      ...channel,
      roi: channel.spend === 0 ? null : Number((channel.revenue / channel.spend).toFixed(2)),
    })),
  };
}

function buildReminders(state) {
  const now = new Date("2026-07-07T12:00:00-03:00");
  return enrichAppointments(state)
    .filter((appointment) => appointment.status !== "completed" && new Date(appointment.scheduledAt) - now <= 172_800_000)
    .map((appointment) => ({
      id: `job_${appointment.id}`,
      customer: appointment.customer,
      channel: appointment.channel === "WhatsApp" ? "whatsapp" : "email",
      template: appointment.status === "pending" ? "confirmacao_agendamento" : "lembrete_24h",
      scheduledFor: appointment.scheduledAt,
      preview: `O atendimento ${appointment.service} esta pronto para confirmacao.`,
    }));
}

export function buildDashboard(state) {
  return {
    metrics: calculateMetrics(state),
    appointments: enrichAppointments(state),
    pipeline: state.pipeline,
    reminders: state.lastReminderRun?.jobs ?? [],
    lastReminderRunAt: state.lastReminderRun?.at ?? null,
  };
}

export function applyAction(state, input) {
  if (input.action === "create_demo_appointment") {
    const sequence = state.appointments.length + 1;
    return {
      ...state,
      appointments: [...state.appointments, {
        id: `apt_demo_${sequence}`,
        customerId: "cus_1002",
        service: "Visita tecnica emergencial",
        scheduledAt: `2026-07-1${Math.min(sequence, 9)}T16:30:00-03:00`,
        durationMinutes: 80,
        professional: "Caio",
        status: "pending",
        price: 520,
        channel: "Portal",
      }],
    };
  }
  if (input.action === "run_reminders") {
    return { ...state, lastReminderRun: { at: new Date().toISOString(), jobs: buildReminders(state) } };
  }
  throw new Error("Acao nao suportada.");
}
