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
const REDIS_URL = process.env.REDIS_URL;

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
    req.rawBodyBuffer = typeof buf === "string" ? Buffer.from(req.rawBody || "", "utf8") : Buffer.from(buf);
    if (req.headers["content-type"]?.includes("application/json")) {
      try { req.body = JSON.parse(req.rawBody || "{}"); } catch { req.body = {}; }
    }
    next();
  } catch (err) { next(err); }
});

// util para extrair header de assinatura normalizado
function getNormalizedSignature(req) {
  const candidates = [
    req.headers["x-signature"],
    req.headers["x-hub-signature-256"],
    req.headers["x-webhook-signature"],
  ].filter(Boolean);

  if (!candidates.length) return null;
  let raw = String(candidates[0]).trim();
  // aceita formatos: "<hex>" ou "sha256=<hex>"
  const idx = raw.indexOf("=");
  if (idx >= 0) raw = raw.slice(idx + 1);
  return raw.trim().toLowerCase();
}

function verifyHmac(req, rawBodyBuffer, secret) {
  if (!secret) return true; // sem secret, não exige assinatura

  const provided = getNormalizedSignature(req);
  if (!provided) {
    // sem assinatura
    return { ok: false, reason: "missing_signature" };
  }

  const h = crypto.createHmac("sha256", Buffer.from(secret, "utf8"));
  h.update(rawBodyBuffer); // IMPORTANT: os MESMOS BYTES do body
  const expected = h.digest("hex"); // hex minúsculo

  const ok = crypto.timingSafeEqual(
    Buffer.from(provided, "utf8"),
    Buffer.from(expected, "utf8")
  );

  if (!ok) return { ok: false, reason: "invalid_signature" };
  return { ok: true };
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

function onlyAllowed(eventName) {
  const allowed = (process.env.ALLOW_EVENTS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(eventName);
}

// --- FTD control (in-memory) ---
const firstDepositByUser = new Set();   // guarda user_ids que já tiveram FTD
const seenDeposits = new Set();         // idempotência por deposit_id (evita duplicadas)

function pick(obj, keys) {
  for (const k of keys) {
    const path = k.split(".");
    let v = obj;
    for (const p of path) {
      if (v && Object.prototype.hasOwnProperty.call(v, p)) v = v[p];
      else { v = undefined; break; }
    }
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
function toNumberSafe(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}
function getAllowedTypesFromEnv(name) {
  return (process.env[name] || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isDepositEventType(typeLower) {
  const list = (process.env.DEPOSIT_EVENT_TYPES || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 && list.includes(typeLower);
}

// Optional Redis support for FTD/idempotency with in-memory fallback
let redisClient = null;
let redisReady = false;
let redisTried = false;
async function getRedis() {
  if (!REDIS_URL) return null;
  if (redisReady && redisClient) return redisClient;
  if (redisTried) return null;
  redisTried = true;
  try {
    const mod = await import('redis');
    const client = mod.createClient({ url: REDIS_URL });
    client.on('error', () => {});
    await client.connect();
    redisClient = client;
    redisReady = true;
    return redisClient;
  } catch (_e) {
    return null;
  }
}

const MEMORY_TTL_MS = 48 * 60 * 60 * 1000;
const memFtdByUser = new Map(); // key -> expiresAt
const memSeenDeposit = new Map(); // depositId -> expiresAt
function nowMs() { return Date.now(); }
function notExpired(ts) { return typeof ts === 'number' && nowMs() < ts; }
function memMarkFtdIfFirst(userKey) {
  if (!userKey) return false;
  const exp = memFtdByUser.get(userKey);
  if (notExpired(exp)) return false;
  memFtdByUser.set(userKey, nowMs() + MEMORY_TTL_MS);
  return true;
}
function memSeenDepositAdd(depositId) {
  if (!depositId) return true;
  const exp = memSeenDeposit.get(depositId);
  if (notExpired(exp)) return false;
  memSeenDeposit.set(depositId, nowMs() + MEMORY_TTL_MS);
  return true;
}
function parseBoolLike(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (["1","true","yes","y","sim"].includes(s)) return true;
    if (["0","false","no","n","nao","não"].includes(s)) return false;
  }
  return null;
}
function coerceNumber(n) {
  if (typeof n === 'number') return Number.isFinite(n) ? n : undefined;
  if (typeof n === 'string') {
    const x = parseFloat(n);
    return Number.isFinite(x) ? x : undefined;
  }
  return undefined;
}

function parseEventTimeToSeconds(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    return Math.floor(v > 1e12 ? v / 1000 : v);
  }
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  return undefined;
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
  const secret = process.env.SHARED_SECRET || "";
  const ver = verifyHmac(req, req.rawBodyBuffer || Buffer.from(req.rawBody || "", "utf8"), secret);
  if (ver !== true && ver.ok === false) {
    console.log(JSON.stringify({ level: "warn", msg: "auth_fail", reason: ver.reason }));
    return res.status(401).json({ ok: false, error: ver.reason });
  }
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return res.status(500).json({ ok: false, error: "missing_pixel_or_token" });
  }

  // Normalização do corpo
  const p = req.body || {};

  // Mapear user.register -> Lead (se não vier event_name explicitamente)
  if (!p.event_name) {
    const t = (p.type || p.event || "").toString().toLowerCase();
    if (t === "user.register") {
      p.event_name = "Lead";
    }
    // Mapeamento de depósito pago -> Purchase
    if (!p.event_name && isDepositEventType(t)) {
      // Idempotência por depósito
      const depositIdRaw = p.deposit_id ?? p.pix_id ?? p.transaction_id;
      const depositId = depositIdRaw != null ? String(depositIdRaw) : undefined;
      if (depositId) {
        let duplicate = false;
        try {
          const rc = await getRedis();
          if (rc) {
            const added = await rc.sAdd('seen:deposit', depositId);
            if (typeof added === 'number' ? added === 0 : added === 0n) duplicate = true;
          } else {
            const addedMem = memSeenDepositAdd(depositId);
            if (!addedMem) duplicate = true;
          }
        } catch (_) {}
        if (duplicate) {
          console.log(JSON.stringify({ level: "info", msg: "duplicate_deposit", deposit_id: depositId }));
          return res.status(204).end();
        }
      }

      p.event_name = "Purchase";
      p.custom_data = p.custom_data || {};
      const value = coerceNumber(p.amount ?? p.pix_amount ?? p.deposit_amount);
      if (value !== undefined) p.custom_data.value = value;
      if (!p.custom_data.currency) p.custom_data.currency = p.currency || "BRL";

      // event_type: FTD ou REDEPOSIT
      let eventType = null;
      const flag = parseBoolLike(p.is_first_deposit ?? p.first_deposit ?? p.isFirstDeposit ?? p.firstDeposit);
      if (flag === true) eventType = "FTD";
      else if (flag === false) eventType = "REDEPOSIT";
      else {
        const userKeyRaw = p.user_id ?? p.account_id ?? p.customer_id;
        const userKey = userKeyRaw != null ? String(userKeyRaw) : undefined;
        if (userKey) {
          try {
            const rc = await getRedis();
            if (rc) {
              const wasSet = await rc.setNX(`ftd:user:${userKey}`, "1");
              eventType = wasSet ? "FTD" : "REDEPOSIT";
            } else {
              eventType = memMarkFtdIfFirst(`user:${userKey}`) ? "FTD" : "REDEPOSIT";
            }
          } catch (_) {
            eventType = memMarkFtdIfFirst(`user:${userKey}`) ? "FTD" : "REDEPOSIT";
          }
        }
      }
      if (eventType && !p.custom_data.event_type) p.custom_data.event_type = eventType;

      if (!p.custom_data.account_id) {
        const accId = p.user_id ?? p.account_id ?? p.customer_id;
        if (accId != null) p.custom_data.account_id = String(accId);
      }
      if (!p.custom_data.external_id) {
        const extTxId = p.deposit_id ?? p.pix_id ?? p.transaction_id;
        if (extTxId != null) p.custom_data.external_id = String(extTxId);
      }
      if (!p.custom_data.gateway) {
        const gw = p.gateway ?? p.pix_gateway;
        if (gw) p.custom_data.gateway = gw;
      }

      // event_time
      if (!p.event_time) {
        const tSec = parseEventTimeToSeconds(p.paid_at ?? p.confirmed_at);
        if (tSec) p.event_time = tSec;
      }
      // URL de origem
      if (!p.event_source_url) {
        p.event_source_url = p.payment_url || "https://betbelga.com/deposito/sucesso";
      }

      // user_data fallback
      p.user_data = p.user_data || {};
      if (!p.user_data.email && p.email) p.user_data.email = p.email;
      if (!p.user_data.phone && p.phone) p.user_data.phone = p.phone;
      if (!p.user_data.external_id) {
        const ext = p.user_id ?? p.account_id ?? p.customer_id;
        if (ext !== undefined && ext !== null) p.user_data.external_id = String(ext);
      }
    }
  }

  // Montar user_data para o caso de user.register (ou Lead sem user_data)
  if (p.event_name === "Lead") {
    p.user_data = p.user_data || {};
    if (!p.user_data.email && p.email) p.user_data.email = p.email;
    if (!p.user_data.phone && p.phone) p.user_data.phone = p.phone;
    if (!p.user_data.external_id) {
      const ext = p.user_id ?? p.id ?? p.username;
      if (ext !== undefined && ext !== null) p.user_data.external_id = String(ext);
    }
    if (!p.event_source_url) {
      p.event_source_url = "https://betbelga.com/form"; // fallback
    }
  }

  // Aplicar filtro por eventos permitidos
  if (!onlyAllowed(p.event_name)) {
    console.log(JSON.stringify({ level: "info", msg: "event_blocked", event_name: p.event_name }));
    return res.status(204).end(); // drop silencioso
  }

  // Substituir req.body por p para o restante do fluxo
  req.body = p;

  const mapped = mapEvent(req.body || {}, req);
  if (mapped.error) {
    if (mapped.error === "invalid_purchase_payload") {
      return res.status(400).json({ ok: false, error: mapped.error });
    }
    return res.status(400).json({ ok: false, error: mapped.error });
  }

  try {
    const result = await sendToMetaCAPI(mapped.payload);
    console.log(JSON.stringify({
      level: "info",
      msg: "capi_result",
      event_name: mapped.mapped_event_name,
      event_id: mapped.event_id,
      capi_status: result.status,
      events_received: result.data?.events_received ?? null,
      event_type: (mapped.payload?.data?.[0]?.custom_data?.event_type) || null
    }));
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
