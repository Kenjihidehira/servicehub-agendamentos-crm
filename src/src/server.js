const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_PATH = path.join(ROOT, "data", "seed.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function loadDatabase() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function createJsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON invalido."));
      }
    });
  });
}

function enrichAppointments(db) {
  const customers = new Map(db.customers.map(customer => [customer.id, customer]));
  return db.appointments
    .map(appointment => ({
      ...appointment,
      customer: customers.get(appointment.customerId)?.name ?? "Cliente nao encontrado"
    }))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function calculateMetrics(db) {
  const totalRevenue = db.appointments
    .filter(appointment => appointment.status !== "cancelled")
    .reduce((sum, appointment) => sum + appointment.price, 0);

  const confirmed = db.appointments.filter(appointment => appointment.status === "confirmed").length;
  const pending = db.appointments.filter(appointment => appointment.status === "pending").length;
  const overdueAmount = db.invoices
    .filter(invoice => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const weightedPipeline = db.pipeline.reduce(
    (sum, deal) => sum + deal.value * deal.probability,
    0
  );

  const occupancyMinutes = db.appointments.reduce(
    (sum, appointment) => sum + appointment.durationMinutes,
    0
  );
  const weeklyCapacityMinutes = 8 * 60 * 5;

  return {
    revenueForecast: Math.round(totalRevenue + weightedPipeline),
    confirmedAppointments: confirmed,
    pendingAppointments: pending,
    overdueAmount,
    occupancyRate: Number(Math.min(occupancyMinutes / weeklyCapacityMinutes, 1).toFixed(2)),
    customerRiskCount: db.customers.filter(customer => customer.status === "at_risk").length,
    channelRoi: db.marketing.map(channel => ({
      channel: channel.channel,
      spend: channel.spend,
      leads: channel.leads,
      appointments: channel.appointments,
      revenue: channel.revenue,
      roi: channel.spend === 0 ? null : Number((channel.revenue / channel.spend).toFixed(2))
    }))
  };
}

function buildAutomationQueue(db) {
  const now = new Date("2026-07-07T12:00:00-03:00");
  const dayMs = 24 * 60 * 60 * 1000;
  return enrichAppointments(db)
    .filter(appointment => {
      const scheduledAt = new Date(appointment.scheduledAt);
      return appointment.status !== "completed" && scheduledAt - now <= 2 * dayMs;
    })
    .map(appointment => ({
      id: `job_${crypto.createHash("sha1").update(appointment.id).digest("hex").slice(0, 8)}`,
      appointmentId: appointment.id,
      customer: appointment.customer,
      channel: appointment.channel === "WhatsApp" ? "whatsapp" : "email",
      template: appointment.status === "pending" ? "confirmacao_agendamento" : "lembrete_24h",
      scheduledFor: appointment.scheduledAt,
      preview: `Ola, ${appointment.customer}. Seu atendimento ${appointment.service} esta marcado para ${formatDateTime(appointment.scheduledAt)}.`
    }));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function validateAppointment(input) {
  const requiredFields = ["customerId", "service", "scheduledAt", "durationMinutes", "professional", "price"];
  const missing = requiredFields.filter(field => input[field] === undefined || input[field] === "");
  if (missing.length > 0) {
    return `Campos obrigatorios ausentes: ${missing.join(", ")}.`;
  }
  if (Number(input.durationMinutes) <= 0 || Number(input.price) < 0) {
    return "Duracao e preco precisam ser numeros validos.";
  }
  if (Number.isNaN(new Date(input.scheduledAt).getTime())) {
    return "scheduledAt precisa ser uma data ISO valida.";
  }
  return null;
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(content);
  });
}

function createServer(db = loadDatabase()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "OPTIONS") {
      createJsonResponse(res, 204, {});
      return;
    }

    try {
      if (url.pathname === "/api/health" && req.method === "GET") {
        createJsonResponse(res, 200, { ok: true, service: "servicehub-agendamentos-crm" });
        return;
      }

      if (url.pathname === "/api/metrics" && req.method === "GET") {
        createJsonResponse(res, 200, calculateMetrics(db));
        return;
      }

      if (url.pathname === "/api/customers" && req.method === "GET") {
        createJsonResponse(res, 200, db.customers);
        return;
      }

      if (url.pathname === "/api/appointments" && req.method === "GET") {
        createJsonResponse(res, 200, enrichAppointments(db));
        return;
      }

      if (url.pathname === "/api/appointments" && req.method === "POST") {
        const payload = await readBody(req);
        const error = validateAppointment(payload);
        if (error) {
          createJsonResponse(res, 422, { error });
          return;
        }
        if (!db.customers.some(customer => customer.id === payload.customerId)) {
          createJsonResponse(res, 404, { error: "Cliente nao encontrado." });
          return;
        }
        const appointment = {
          id: `apt_${crypto.randomUUID().slice(0, 8)}`,
          customerId: payload.customerId,
          service: payload.service,
          scheduledAt: payload.scheduledAt,
          durationMinutes: Number(payload.durationMinutes),
          professional: payload.professional,
          status: payload.status ?? "pending",
          price: Number(payload.price),
          channel: payload.channel ?? "Manual"
        };
        db.appointments.push(appointment);
        createJsonResponse(res, 201, appointment);
        return;
      }

      const statusMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/status$/);
      if (statusMatch && req.method === "PATCH") {
        const payload = await readBody(req);
        const appointment = db.appointments.find(item => item.id === statusMatch[1]);
        if (!appointment) {
          createJsonResponse(res, 404, { error: "Agendamento nao encontrado." });
          return;
        }
        if (!["pending", "confirmed", "completed", "cancelled"].includes(payload.status)) {
          createJsonResponse(res, 422, { error: "Status invalido." });
          return;
        }
        appointment.status = payload.status;
        createJsonResponse(res, 200, appointment);
        return;
      }

      if (url.pathname === "/api/pipeline" && req.method === "GET") {
        createJsonResponse(res, 200, db.pipeline);
        return;
      }

      if (url.pathname === "/api/invoices" && req.method === "GET") {
        createJsonResponse(res, 200, db.invoices);
        return;
      }

      if (url.pathname === "/api/automations/reminders" && req.method === "POST") {
        createJsonResponse(res, 202, {
          queued: buildAutomationQueue(db),
          note: "Simulacao: nenhuma mensagem real foi enviada."
        });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        createJsonResponse(res, 404, { error: "Endpoint nao encontrado." });
        return;
      }

      serveStatic(req, res);
    } catch (error) {
      createJsonResponse(res, 500, { error: error.message });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`ServiceHub CRM rodando em http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
  calculateMetrics,
  buildAutomationQueue,
  loadDatabase,
  validateAppointment
};
