import express from "express";
import getRawBody from "raw-body";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

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

  const nowSec = Math.floor(Date.now() / 1000);
  const {
    event_name = "PageView",
    event_time = nowSec,
    event_source_url,
    custom_data = {},
    user_data = {}
  } = req.body || {};

  const event_id = genEventId(req.body);
  const { fbp, fbc } = extractFBPFBC(req);

  const client_ip_address = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || undefined;
  const client_user_agent = req.headers["user-agent"] || undefined;

  const payload = {
    data: [
      {
        event_name,
        event_time,
        event_id,
        action_source: "website",
        event_source_url,
        user_data: {
          // Envie só o que tiver — Meta recomenda SHA256 para PII (em, ph etc.) já vindo hasheado
          client_ip_address,
          client_user_agent,
          fbp,
          fbc,
          ...user_data
        },
        custom_data
      }
    ],
    // Opcional: código de teste para modo "Test Events" do Events Manager
    // "test_event_code": "TEST123"
    partner_agent: "midas-capi/1.0"
  };

  try {
    const result = await sendToMetaCAPI(payload);
    // Log mínimo e seguro
    console.log("CAPI result:", { status: result.status, data: result.data, event_id });
    return res.status(200).json({ ok: true, event_id, capi_status: result.status, capi_response: result.data });
  } catch (e) {
    console.error("CAPI error:", e);
    return res.status(500).json({ ok: false, error: "capi_request_failed" });
  }
});

// Erros
app.use((err, _req, res, _next) => {
  console.error("Erro:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => console.log(`Webhook/CAPI na porta ${PORT}`));
