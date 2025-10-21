import express from "express";
import getRawBody from "raw-body";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
import { hashUserData } from "./src/utils/hash.js";

const app = express();
const PORT = process.env.PORT || 3000;
const SHARED_SECRET = process.env.SHARED_SECRET || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!PIXEL_ID || !ACCESS_TOKEN) {
  console.error("Faltam variáveis PIXEL_ID e/ou ACCESS_TOKEN");
}

app.use(async (req, _res, next) => {
  try {
    const buf = await getRawBody(req, {
      encoding: req.headers["content-type"]?.includes("application/json")
        ? "utf8"
        : true,
      length: req.headers["content-length"],
    });
    req.rawBody = typeof buf === "string" ? buf : buf.toString("utf8");
    if (req.headers["content-type"]?.includes("application/json")) {
      try { req.body = JSON.parse(req.rawBody || "{}"); } catch { req.body = {}; }
    }
    next();
  } catch (err) { next(err); }
});

function verifySignature(req) {
  if (!SHARED_SECRET) return true; // desligado por padrão
  const expected = crypto.createHmac("sha256", SHARED_SECRET)
    .update(req.rawBody || "")
    .digest("hex");

  const gotRaw = (req.headers["x-signature"]
    || req.headers["x-signature-hmac"]
    || req.headers["x-hub-signature-256"]
    || "").toString().trim();

  const got = gotRaw.includes("=") ? gotRaw.split("=")[1] : gotRaw;
  if (!got) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(got, "utf8"));
  } catch { return false; }
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(";").map(s => s.trim());
  for (const p of pairs) {
    const [k, ...rest] = p.split("=");
    out[k] = rest.join("=");
  }
  return out;
}

// Tenta achar fbp/fbc em body, header ou cookie
function extractFBPFBC(req) {
  let fbp = req.body?.fbp || req.headers["x-fbp"];
  let fbc = req.body?.fbc || req.headers["x-fbc"];

  const cookies = parseCookies(req.headers.cookie || "");
  if (!fbp && cookies._fbp) fbp = cookies._fbp;
  if (!fbc && cookies._fbc) fbc = cookies._fbc;

  // Também dá pra montar _fbc a partir de "fbclid" na query da landing (se tiver sido preservado)
  if (!fbc && req.body?.fbclid) fbc = `fb.1.${Math.floor(Date.now()/1000)}.${req.body.fbclid}`;
  return { fbp, fbc };
}

function genEventId(body) {
  // Deduplicação simples: se vier event_id usa o do cliente; senão gera um
  return body?.event_id || crypto.randomUUID();
}

async function sendToMetaCAPI(payload) {
  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function mapEvent(body, req) {
  const nowSec = Math.floor(Date.now() / 1000);
  const inputName = (body?.event_name || "PageView").trim();
  const originalName = inputName;

  let event_name = originalName;
  const cd = typeof body?.custom_data === "object" && body.custom_data ? { ...body.custom_data } : {};

  // Regras para FTD → Purchase com event_type=FTD
  if (originalName === "FTD") {
    event_name = "Purchase";
    if (cd && cd.event_type == null) {
      cd.event_type = "FTD";
    }
  }

  // Validação de Purchase (inclui FTD mapeado)
  const isPurchase = event_name === "Purchase";
  if (isPurchase) {
    if (cd == null || typeof cd.value !== "number" || Number.isNaN(cd.value) || !cd.currency) {
      return { error: "invalid_purchase_payload" };
    }
  }

  const event_time = Number.isInteger(body?.event_time) ? body.event_time : nowSec;
  const event_id = body?.event_id || crypto.randomUUID();
  const event_source_url = body?.event_source_url;

  const { fbp, fbc } = extractFBPFBC(req);
  const client_ip_address = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || undefined;
  const client_user_agent = req.headers["user-agent"] || undefined;

  // Hash de PII (aceita campos no user_data e no nível raiz do body)
  const rawUserData = typeof body?.user_data === "object" && body.user_data ? { ...body.user_data } : {};
  if (body?.email && rawUserData.email == null && rawUserData.em == null) rawUserData.email = body.email;
  if (body?.phone && rawUserData.phone == null && rawUserData.ph == null) rawUserData.phone = body.phone;
  if (body?.em && rawUserData.em == null) rawUserData.em = body.em;
  if (body?.ph && rawUserData.ph == null) rawUserData.ph = body.ph;
  if (body?.external_id && rawUserData.external_id == null) rawUserData.external_id = body.external_id;
  const hashed = hashUserData(rawUserData);

  const user_data = {
    client_ip_address,
    client_user_agent,
    fbp,
    fbc,
    ...hashed,
  };

  const custom_data = { ...cd };

  const payload = {
    data: [
      {
        event_name,
        event_time,
        event_id,
        action_source: "website",
        ...(event_source_url ? { event_source_url } : {}),
        user_data,
        custom_data,
      }
    ],
    partner_agent: "midas-capi/1.0",
  };

  return { payload, mapped_event_name: event_name, event_id };
}

// Health
app.get("/health", (_req, res) => res.status(200).json({ ok: true, ts: Date.now() }));

// Challenge estilo Meta Webhooks (opcional)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("forbidden");
});

/**
 * POST /webhook
 * Espera um JSON como:
 * {
 *   "event_name": "PageView" | "Lead" | "Purchase" | ...,
 *   "event_time": 1710000000 (epoch seconds) (opcional, usa agora),
 *   "event_source_url": "https://seusite.com/pagina",
 *   "event_id": "opcional-para-dedupe",
 *   "custom_data": { "value": 123.45, "currency": "BRL", ... },
 *   "user_data": { "em": "...hash", "ph": "...hash" } // opcional (sha256)
 *   // opcional: fbp/fbc no body; caso não venham, tentamos achar via cookies/headers
 * }
 */
app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ ok: false, error: "invalid signature" });
  }
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return res.status(500).json({ ok: false, error: "missing_pixel_or_token" });
  }

  const mapped = mapEvent(req.body || {}, req);
  if (mapped.error) {
    if (mapped.error === "invalid_purchase_payload") {
      return res.status(400).json({ ok: false, error: mapped.error });
    }
    return res.status(400).json({ ok: false, error: mapped.error });
  }

  try {
    const result = await sendToMetaCAPI(mapped.payload);
    console.log("CAPI:", { status: result.status, events_received: mapped.payload?.data?.length || 0, event_name: mapped.mapped_event_name, event_id: mapped.event_id });
    return res.status(200).json({ ok: true, event_id: mapped.event_id, capi_status: result.status, events_received: mapped.payload?.data?.length || 0, capi_response: result.data });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: "capi_request_failed" });
  }
});

// Erros
app.use((err, _req, res, _next) => {
  console.error("Erro:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => console.log(`Webhook/CAPI na porta ${PORT}`));
