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

// Sistema de múltiplos pixels
// Formato: JSON string com array de pixels
// Exemplo: [{"id":"123","token":"abc","name":"Pixel 1","has_fluxlabs":true},{"id":"456","token":"def","name":"Pixel 2","has_fluxlabs":false}]
// Ou usar variáveis individuais: PIXEL_ID_1, ACCESS_TOKEN_1, PIXEL_NAME_1, PIXEL_HAS_FLUXLABS_1, etc.
let PIXELS_CONFIG = [];

function loadPixelsConfig() {
  try {
    // Tentar carregar de PIXELS (JSON string)
    if (process.env.PIXELS) {
      const parsed = JSON.parse(process.env.PIXELS);
      if (Array.isArray(parsed)) {
        PIXELS_CONFIG = parsed.map(p => ({
          id: p.id || p.pixel_id,
          token: p.token || p.access_token,
          name: p.name || p.id || p.pixel_id || "Pixel",
          has_fluxlabs: p.has_fluxlabs === true || p.has_fluxlabs === "true" || p.hasFluxlabs === true
        })).filter(p => p.id && p.token);
        return;
      }
    }
    
    // Tentar carregar de variáveis individuais (PIXEL_ID_1, ACCESS_TOKEN_1, etc.)
    const pixels = [];
    let i = 1;
    while (true) {
      const pixelId = process.env[`PIXEL_ID_${i}`];
      const accessToken = process.env[`ACCESS_TOKEN_${i}`];
      if (!pixelId || !accessToken) break;
      
      const pixelName = process.env[`PIXEL_NAME_${i}`] || `Pixel ${i}`;
      const hasFluxlabs = process.env[`PIXEL_HAS_FLUXLABS_${i}`] === "true" || 
                         process.env[`PIXEL_HAS_FLUXLABS_${i}`] === true;
      
      pixels.push({
        id: pixelId,
        token: accessToken,
        name: pixelName,
        has_fluxlabs: hasFluxlabs
      });
      i++;
    }
    
    if (pixels.length > 0) {
      PIXELS_CONFIG = pixels;
      return;
    }
    
    // Fallback: usar PIXEL_ID e ACCESS_TOKEN únicos (compatibilidade)
    if (PIXEL_ID && ACCESS_TOKEN) {
      PIXELS_CONFIG = [{
        id: PIXEL_ID,
        token: ACCESS_TOKEN,
        name: process.env.PIXEL_NAME || "Pixel Principal",
        has_fluxlabs: process.env.PIXEL_HAS_FLUXLABS === "true" || false
      }];
    }
  } catch (err) {
    console.error("Erro ao carregar configuração de pixels:", err.message);
    // Fallback para configuração única
    if (PIXEL_ID && ACCESS_TOKEN) {
      PIXELS_CONFIG = [{
        id: PIXEL_ID,
        token: ACCESS_TOKEN,
        name: "Pixel Principal",
        has_fluxlabs: false
      }];
    }
  }
}

loadPixelsConfig();

if (PIXELS_CONFIG.length === 0) {
  console.error("⚠️  Nenhum pixel configurado! Configure PIXEL_ID/ACCESS_TOKEN ou PIXELS");
} else {
  console.log(`✅ ${PIXELS_CONFIG.length} pixel(s) configurado(s):`);
  PIXELS_CONFIG.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} (ID: ${p.id}) - FluxLabs: ${p.has_fluxlabs ? 'Sim' : 'Não'}`);
  });
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
  const names = [
    "x-signature",
    "x-hub-signature-256",
    "x-webhook-signature",
    "x-signature-sha256",
    "x-hmac-signature",
    "x-hmac-sha256",
  ];
  const found = names.map(n => req.headers[n]).find(Boolean);
  if (!found) return null;
  let raw = String(found).trim();
  const i = raw.indexOf("=");           // aceita "sha256=<hex>"
  if (i >= 0) raw = raw.slice(i + 1);
  return raw.trim().toLowerCase();
}

function verifyHmac(req, rawBody, secret) {
  if (!secret) return { ok: true };
  const provided = getNormalizedSignature(req);
  if (!provided) return { ok: false, reason: "missing_signature" };

  const h = crypto.createHmac("sha256", Buffer.from(secret, "utf8"));
  h.update(rawBody);
  const expected = h.digest("hex");     // hex minúsculo

  const ok = crypto.timingSafeEqual(
    Buffer.from(provided, "utf8"),
    Buffer.from(expected, "utf8")
  );
  return ok ? { ok: true } : { ok: false, reason: "invalid_signature" };
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
  // normaliza removendo caracteres não alfanuméricos para permitir
  // variações como "deposit_made", "deposit-made", "depositmade"
  const normalize = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = normalize(typeLower);
  const raw = (process.env.DEPOSIT_EVENT_TYPES || "");
  const list = raw
    .split(",")
    .map(s => normalize(s.trim()))
    .filter(Boolean);
  if (list.length > 0) return list.includes(t);
  // Se não houver env configurada, aceite aliases comuns de provedores
  const defaults = new Set([
    "depositmade",
    "deposit_made",
    "deposit-made",
    "deposit",
    "paymentconfirmed",
    "payment_confirmed",
    "pixpaid",
    "pix_confirmed",
    "onlinepixconfirm",
  ]);
  return defaults.has(t);
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

/**
 * Envia evento para um pixel específico do Meta CAPI
 * @param {Object} payload - Payload do evento
 * @param {string} pixelId - ID do pixel
 * @param {string} accessToken - Token de acesso
 * @returns {Promise<Object>} Resultado do envio
 */
async function sendToMetaCAPI(payload, pixelId = null, accessToken = null) {
  const pid = pixelId || PIXEL_ID;
  const token = accessToken || ACCESS_TOKEN;
  
  if (!pid || !token) {
    return { status: 500, data: { error: "missing_pixel_or_token" } };
  }
  
  const url = `https://graph.facebook.com/v18.0/${pid}/events?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, pixel_id: pid };
}

/**
 * Envia evento para múltiplos pixels
 * @param {Object} payload - Payload do evento
 * @param {Array<string>} pixelIds - IDs dos pixels (opcional, se não especificado envia para todos)
 * @param {boolean} onlyFluxlabs - Se true, envia apenas para pixels com FluxLabs habilitado
 * @returns {Promise<Array<Object>>} Resultados do envio
 */
async function sendToMultiplePixels(payload, pixelIds = null, onlyFluxlabs = false) {
  let pixelsToSend = PIXELS_CONFIG;
  
  // Filtrar apenas pixels com FluxLabs se solicitado
  if (onlyFluxlabs) {
    pixelsToSend = pixelsToSend.filter(p => p.has_fluxlabs === true);
  }
  
  // Filtrar por IDs específicos se fornecidos
  if (pixelIds && Array.isArray(pixelIds) && pixelIds.length > 0) {
    pixelsToSend = pixelsToSend.filter(p => pixelIds.includes(p.id));
  }
  
  if (pixelsToSend.length === 0) {
    return [];
  }
  
  // Enviar para todos os pixels em paralelo
  const promises = pixelsToSend.map(pixel => 
    sendToMetaCAPI(payload, pixel.id, pixel.token)
      .then(result => ({ ...result, pixel_name: pixel.name }))
      .catch(err => ({ 
        status: 500, 
        data: { error: err.message }, 
        pixel_id: pixel.id,
        pixel_name: pixel.name 
      }))
  );
  
  return Promise.all(promises);
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
app.get("/health", (_req, res) => res.status(200).json({ 
  ok: true, 
  ts: Date.now(),
  pixels_configured: PIXELS_CONFIG.length,
  pixels: PIXELS_CONFIG.map(p => ({ id: p.id, name: p.name, has_fluxlabs: p.has_fluxlabs }))
}));

// GET /webhook/fluxlabs - Verificação de endpoint
app.get("/webhook/fluxlabs", (_req, res) => {
  const fluxlabsPixels = PIXELS_CONFIG.filter(p => p.has_fluxlabs === true);
  return res.status(200).json({
    ok: true,
    endpoint: "/webhook/fluxlabs",
    method: "POST",
    pixels_with_fluxlabs: fluxlabsPixels.length,
    pixels: fluxlabsPixels.map(p => ({ id: p.id, name: p.name })),
    message: "Este endpoint aceita apenas requisições POST. Use POST para enviar eventos do FluxLabs."
  });
});

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
  const raw = req.rawBodyBuffer || Buffer.from(req.rawBody || "", "utf8");
  const ver = verifyHmac(req, raw, secret);
  if (ver !== true && ver.ok === false) {
    console.log(JSON.stringify({ level: "warn", msg: "auth_fail", reason: ver.reason }));
    return res.status(401).json({ ok: false, error: ver.reason });
  }

  // detectar "modo teste" do painel
  const isTest =
    req.query.test === "true" ||
    req.headers["x-webhook-test"] === "true" ||
    (req.body && (req.body.test === true || req.body.type === "webhook.test"));

  if (isTest) {
    console.log(JSON.stringify({ level: "info", msg: "webhook_test_received" }));
    return res.status(200).json({ ok: true, test: true });
  }
  if (PIXELS_CONFIG.length === 0) {
    return res.status(500).json({ ok: false, error: "missing_pixel_or_token" });
  }

  // Normalização do corpo
  const p = req.body || {};

  // ===== PROCESSAMENTO ESPECÍFICO DOS EVENTOS DE MARKETING =====
  // Detectar e processar eventos baseados no campo "type", "action" ou "event"
  // Prioridade: type > action > event
  const eventTypeRaw = p.type || p.action || p.event || "";
  const eventType = eventTypeRaw.toString().toLowerCase().replace(/[^a-z0-9_]/g, "");
  
  // Mapear user_created (action) para register_new_user (type interno)
  if (eventType === "user_created" || eventType === "register_new_user") {
    // Evento: Novo usuário registrado
    p.event_name = "Lead";
    
    // Extrair dados de objetos aninhados se vierem no formato {action, user, ...}
    if (p.user && typeof p.user === "object") {
      if (!p.email && p.user.email) p.email = p.user.email;
      if (!p.name && p.user.name) p.name = p.user.name;
      if (!p.phone && p.user.phone_number) p.phone = p.user.phone_number;
      if (!p.date_birth && p.user.date_of_birth) p.date_birth = p.user.date_of_birth;
      if (!p.user_id && p.user.id) p.user_id = p.user.id;
      if (!p.usernameIndication && p.user.affiliation_code) {
        // affiliation_code pode ser usado como usernameIndication
        p.usernameIndication = p.user.affiliation_code;
      }
    }
    
    p.user_data = p.user_data || {};
    
    // Mapear dados do usuário
    if (p.email && !p.user_data.email) p.user_data.email = p.email;
    if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
    if (p.name) {
      // Extrair first_name e last_name do nome completo
      const nameParts = p.name.trim().split(" ");
      if (!p.user_data.fn) p.user_data.fn = nameParts[0];
      if (!p.user_data.ln && nameParts.length > 1) {
        p.user_data.ln = nameParts.slice(1).join(" ");
      }
    }
    if (p.date_birth && !p.user_data.db) {
      // Formatar data de nascimento (remover hífens: YYYY-MM-DD -> YYYYMMDD)
      p.user_data.db = p.date_birth.replace(/-/g, "");
    }
    
    // Capturar IP e User Agent
    if (p.ip_address && !p.user_data.client_ip_address) {
      p.user_data.client_ip_address = p.ip_address;
    }
    if (p.user_agent && !p.user_data.client_user_agent) {
      p.user_data.client_user_agent = p.user_agent;
    }
    
    // Parâmetros do Meta Pixel
    if (p.fbp) p.fbp = p.fbp;
    if (p.fbc) p.fbc = p.fbc;
    
    // Custom data com informações de origem
    p.custom_data = p.custom_data || {};
    if (p.usernameIndication) p.custom_data.referrer_username = p.usernameIndication;
    if (p.origem_cid) p.custom_data.origem_cid = p.origem_cid;
    if (p.utm_source) p.custom_data.utm_source = p.utm_source;
    if (p.utm_campaign) p.custom_data.utm_campaign = p.utm_campaign;
    if (p.utm_medium) p.custom_data.utm_medium = p.utm_medium;
    
    // URL de origem
    if (!p.event_source_url) {
      p.event_source_url = "https://betbelga.com/cadastro";
    }
    
    console.log(JSON.stringify({
      level: "info",
      msg: "register_new_user_processed",
      email: p.email ? "***" : null,
      phone: p.phone ? "***" : null
    }));
  }
  else if (eventType === "deposit_generated") {
    // Evento: Depósito gerado
    // Para agenciamidas, este é o evento de Purchase (finalização de compra)
    // Para outros cambistas, é InitiateCheckout (PIX criado, aguardando pagamento)
    
    const isAgenciaMidas = p.usernameIndication === "agenciamidas";
    
    if (isAgenciaMidas) {
      // Para agenciamidas: deposit_generated = Purchase
      p.event_name = "Purchase";
    } else {
      // Para outros: deposit_generated = InitiateCheckout
      p.event_name = "InitiateCheckout";
    }
    
    p.user_data = p.user_data || {};
    
    // Mapear dados do usuário
    if (p.email && !p.user_data.email) p.user_data.email = p.email;
    if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
    if (p.name) {
      const nameParts = p.name.trim().split(" ");
      if (!p.user_data.fn) p.user_data.fn = nameParts[0];
      if (!p.user_data.ln && nameParts.length > 1) {
        p.user_data.ln = nameParts.slice(1).join(" ");
      }
    }
    if (p.date_birth && !p.user_data.db) {
      p.user_data.db = p.date_birth.replace(/-/g, "");
    }
    if (p.ip_address && !p.user_data.client_ip_address) {
      p.user_data.client_ip_address = p.ip_address;
    }
    if (p.user_agent && !p.user_data.client_user_agent) {
      p.user_data.client_user_agent = p.user_agent;
    }
    
    // Parâmetros do Meta Pixel
    if (p.fbp) p.fbp = p.fbp;
    if (p.fbc) p.fbc = p.fbc;
    
    // Custom data com valor e informações do PIX
    p.custom_data = p.custom_data || {};
    if (p.value !== undefined) {
      p.custom_data.value = coerceNumber(p.value);
      p.custom_data.currency = "BRL";
    }
    if (p.qrCode) p.custom_data.pix_qr_code = p.qrCode.substring(0, 50) + "..."; // Truncar para não poluir logs
    if (p.copiaECola) p.custom_data.pix_copy_paste = p.copiaECola.substring(0, 50) + "...";
    if (p.usernameIndication) p.custom_data.referrer_username = p.usernameIndication;
    
    // Para agenciamidas, marcar como FTD
    if (isAgenciaMidas) {
      p.custom_data.event_type = "FTD";
    }
    
    // URL de origem
    if (!p.event_source_url) {
      if (isAgenciaMidas) {
        p.event_source_url = "https://betbelga.com/deposito/sucesso";
      } else {
        p.event_source_url = "https://betbelga.com/deposito";
      }
    }
    
    console.log(JSON.stringify({
      level: "info",
      msg: "deposit_generated_processed",
      value: p.value,
      cambista: p.usernameIndication || null,
      event_type: isAgenciaMidas ? "Purchase" : "InitiateCheckout"
    }));
  }
  else if (eventType === "confirmed_deposit" || eventType === "invoice_paid") {
    // Evento: Depósito confirmado (pagamento recebido)
    // invoice_paid também é mapeado para confirmed_deposit
    p.event_name = "Purchase";
    
    // Extrair dados de objetos aninhados se vierem no formato {action, user, invoice, client, payer}
    if (p.user && typeof p.user === "object") {
      if (!p.email && p.user.email) p.email = p.user.email;
      if (!p.name && p.user.name) p.name = p.user.name;
      if (!p.phone && p.user.phone_number) p.phone = p.user.phone_number;
      if (!p.date_birth && p.user.date_of_birth) p.date_birth = p.user.date_of_birth;
      if (!p.user_id && p.user.id) p.user_id = p.user.id;
    }
    if (p.invoice && typeof p.invoice === "object") {
      if (p.invoice.value !== undefined && p.value === undefined) p.value = p.invoice.value;
      if (p.invoice.id && !p.deposit_id) p.deposit_id = p.invoice.id;
      if (p.invoice.status && p.invoice.status === "paid" && p.first_deposit === undefined) {
        // Se não tiver first_deposit explícito, tentar inferir
        // Por padrão, assumimos que é FTD se não houver informação contrária
      }
    }
    if (p.client && typeof p.client === "object") {
      if (!p.email && p.client.email) p.email = p.client.email;
      if (!p.name && p.client.name) p.name = p.client.name;
      if (!p.phone && p.client.phone) p.phone = p.client.phone;
    }
    if (p.payer && typeof p.payer === "object") {
      if (!p.name && p.payer.name) p.name = p.payer.name;
      if (!p.phone && p.payer.phone) p.phone = p.payer.phone;
    }
    p.user_data = p.user_data || {};
    
    // Mapear dados do usuário
    if (p.email && !p.user_data.email) p.user_data.email = p.email;
    if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
    if (p.name) {
      const nameParts = p.name.trim().split(" ");
      if (!p.user_data.fn) p.user_data.fn = nameParts[0];
      if (!p.user_data.ln && nameParts.length > 1) {
        p.user_data.ln = nameParts.slice(1).join(" ");
      }
    }
    if (p.date_birth && !p.user_data.db) {
      p.user_data.db = p.date_birth.replace(/-/g, "");
    }
    if (p.ip_address && !p.user_data.client_ip_address) {
      p.user_data.client_ip_address = p.ip_address;
    }
    if (p.user_agent && !p.user_data.client_user_agent) {
      p.user_data.client_user_agent = p.user_agent;
    }
    
    // Parâmetros do Meta Pixel
    if (p.fbp) p.fbp = p.fbp;
    if (p.fbc) p.fbc = p.fbc;
    
    // Custom data com valor e tipo de depósito
    p.custom_data = p.custom_data || {};
    if (p.value !== undefined) {
      p.custom_data.value = coerceNumber(p.value);
      p.custom_data.currency = "BRL";
    }
    
    // Determinar se é FTD ou REDEPOSIT baseado no campo first_deposit
    const isFirstDeposit = parseBoolLike(p.first_deposit);
    if (isFirstDeposit === true) {
      p.custom_data.event_type = "FTD";
    } else {
      p.custom_data.event_type = "REDEPOSIT";
      // Por padrão, ignoramos REDEPOSITs conforme lógica existente
      console.log(JSON.stringify({
        level: "info",
        msg: "redeposit_from_confirmed_deposit",
        approved_deposits: p.approved_deposits
      }));
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "redeposit_ignored",
        approved_deposits: p.approved_deposits
      });
    }
    
    if (p.approved_deposits !== undefined) {
      p.custom_data.approved_deposits = p.approved_deposits;
    }
    if (p.usernameIndication) {
      p.custom_data.referrer_username = p.usernameIndication;
    }
    
    // URL de origem
    if (!p.event_source_url) {
      p.event_source_url = "https://betbelga.com/deposito/sucesso";
    }
    
    console.log(JSON.stringify({
      level: "info",
      msg: "confirmed_deposit_processed",
      value: p.value,
      event_type: p.custom_data.event_type,
      approved_deposits: p.approved_deposits
    }));
  }
  // ===== FIM DO PROCESSAMENTO ESPECÍFICO =====

  // Mapear eventos de cadastro -> Lead (se não vier event_name explicitamente)
  if (!p.event_name) {
    // Prioridade: type > action > event
    const raw = (p.type || p.action || p.event || "").toString().toLowerCase();
    // normaliza removendo caracteres não alfanuméricos (hífens, underscores, pontos)
    const t = raw.replace(/[^a-z0-9]/g, "");
    // aceitar várias nomenclaturas comuns de cadastro
    const registerAliases = new Set([
      "userregister",
      "userregistered",
      "usercreated",
      "signup",
      "registered",
      "registrationcompleted",
      "onlineregisteraccount",
    ]);
    if (registerAliases.has(t)) {
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
          return res.status(200).json({ ok: true, ignored: true, reason: "duplicate_deposit", deposit_id: String(depositId || "") });
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
      if (eventType === "REDEPOSIT") {
        // enquanto estiver ignorando redepósitos
        console.log(JSON.stringify({ level: "info", msg: "redeposit_ignored", user_id: String((p.user_id ?? p.account_id ?? p.customer_id) || "") }));
        return res.status(200).json({ ok: true, ignored: true, reason: "redeposit_ignored", user_id: String((p.user_id ?? p.account_id ?? p.customer_id) || "") });
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
    return res.status(200).json({ ok: true, ignored: true, reason: "event_blocked", event_name: p.event_name || null });
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
    // Permitir especificar pixels no payload (opcional)
    const targetPixels = req.body?.pixel_ids || req.body?.pixels || null;
    
    // Enviar para múltiplos pixels
    const results = await sendToMultiplePixels(mapped.payload, targetPixels, false);
    
    if (results.length === 0) {
      return res.status(500).json({ ok: false, error: "no_pixels_configured" });
    }
    
    // Log de resultados
    results.forEach(result => {
      console.log(JSON.stringify({
        level: "info",
        msg: "capi_result",
        pixel_id: result.pixel_id,
        pixel_name: result.pixel_name,
        event_name: mapped.mapped_event_name,
        event_id: mapped.event_id,
        capi_status: result.status,
        events_received: result.data?.events_received ?? null,
        event_type: (mapped.payload?.data?.[0]?.custom_data?.event_type) || null
      }));
    });
    
    // Retornar resultado do primeiro pixel (compatibilidade) + todos os resultados
    const firstResult = results[0];
    return res.status(200).json({ 
      ok: true, 
      event_id: mapped.event_id, 
      capi_status: firstResult.status, 
      events_received: mapped.payload?.data?.length || 0, 
      capi_response: firstResult.data,
      pixels_sent: results.length,
      all_results: results.map(r => ({
        pixel_id: r.pixel_id,
        pixel_name: r.pixel_name,
        status: r.status,
        events_received: r.data?.events_received ?? null
      }))
    });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: "capi_request_failed" });
  }
});

/**
 * Mapeia eventos do FluxLabs para o formato do webhook
 * O FluxLabs pode enviar eventos em diferentes formatos, então tentamos detectar
 * e mapear para os tipos suportados: register_new_user, deposit_generated, confirmed_deposit
 */
function mapFluxLabsEvent(fluxLabsPayload) {
  const mapped = { ...fluxLabsPayload };
  
  // Detectar tipo de evento do FluxLabs
  // Prioridade: type > action > event_type > event
  const eventType = (fluxLabsPayload.type || fluxLabsPayload.action || fluxLabsPayload.event_type || fluxLabsPayload.event || "").toString().toLowerCase();
  const normalizedType = eventType.replace(/[^a-z0-9_]/g, "");
  
  // Mapear eventos comuns do FluxLabs
  // Cadastro/Registro
  if (normalizedType.includes("register") || normalizedType.includes("signup") || 
      normalizedType.includes("usercreated") || normalizedType.includes("cadastro")) {
    mapped.type = "register_new_user";
  }
  // Depósito gerado/criado
  else if (normalizedType.includes("depositgenerated") || normalizedType.includes("deposit_created") ||
           normalizedType.includes("depositcreated") || normalizedType.includes("depositogenerated") ||
           normalizedType.includes("pixgenerated") || normalizedType.includes("pix_created")) {
    mapped.type = "deposit_generated";
  }
  // Depósito confirmado/pago
  else if (normalizedType.includes("depositconfirmed") || normalizedType.includes("deposit_paid") ||
           normalizedType.includes("depositpaid") || normalizedType.includes("depositoconfirmed") ||
           normalizedType.includes("pixconfirmed") || normalizedType.includes("pix_paid") ||
           normalizedType.includes("paymentconfirmed") || normalizedType.includes("payment_confirmed") ||
           normalizedType.includes("invoicepaid") || normalizedType.includes("invoice_paid")) {
    mapped.type = "confirmed_deposit";
  }
  
  // Mapear campos comuns do FluxLabs para o formato esperado
  // Nome
  if (fluxLabsPayload.name && !mapped.name) {
    mapped.name = fluxLabsPayload.name;
  } else if (fluxLabsPayload.full_name && !mapped.name) {
    mapped.name = fluxLabsPayload.full_name;
  } else if (fluxLabsPayload.user_name && !mapped.name) {
    mapped.name = fluxLabsPayload.user_name;
  }
  
  // Email
  if (fluxLabsPayload.email && !mapped.email) {
    mapped.email = fluxLabsPayload.email;
  } else if (fluxLabsPayload.user_email && !mapped.email) {
    mapped.email = fluxLabsPayload.user_email;
  }
  
  // Telefone
  if (fluxLabsPayload.phone && !mapped.phone) {
    mapped.phone = fluxLabsPayload.phone;
  } else if (fluxLabsPayload.telephone && !mapped.phone) {
    mapped.phone = fluxLabsPayload.telephone;
  } else if (fluxLabsPayload.mobile && !mapped.phone) {
    mapped.phone = fluxLabsPayload.mobile;
  }
  
  // Data de nascimento
  if (fluxLabsPayload.date_birth && !mapped.date_birth) {
    mapped.date_birth = fluxLabsPayload.date_birth;
  } else if (fluxLabsPayload.birth_date && !mapped.date_birth) {
    mapped.date_birth = fluxLabsPayload.birth_date;
  } else if (fluxLabsPayload.date_of_birth && !mapped.date_birth) {
    mapped.date_birth = fluxLabsPayload.date_of_birth;
  }
  
  // Valor (para depósitos)
  if (fluxLabsPayload.value !== undefined && mapped.value === undefined) {
    mapped.value = fluxLabsPayload.value;
  } else if (fluxLabsPayload.amount !== undefined && mapped.value === undefined) {
    mapped.value = fluxLabsPayload.amount;
  } else if (fluxLabsPayload.deposit_amount !== undefined && mapped.value === undefined) {
    mapped.value = fluxLabsPayload.deposit_amount;
  }
  
  // IP Address
  if (fluxLabsPayload.ip_address && !mapped.ip_address) {
    mapped.ip_address = fluxLabsPayload.ip_address;
  } else if (fluxLabsPayload.ip && !mapped.ip_address) {
    mapped.ip_address = fluxLabsPayload.ip;
  } else if (fluxLabsPayload.client_ip && !mapped.ip_address) {
    mapped.ip_address = fluxLabsPayload.client_ip;
  }
  
  // User Agent
  if (fluxLabsPayload.user_agent && !mapped.user_agent) {
    mapped.user_agent = fluxLabsPayload.user_agent;
  } else if (fluxLabsPayload.userAgent && !mapped.user_agent) {
    mapped.user_agent = fluxLabsPayload.userAgent;
  }
  
  // First Deposit
  if (fluxLabsPayload.first_deposit !== undefined && mapped.first_deposit === undefined) {
    mapped.first_deposit = fluxLabsPayload.first_deposit;
  } else if (fluxLabsPayload.is_first_deposit !== undefined && mapped.first_deposit === undefined) {
    mapped.first_deposit = fluxLabsPayload.is_first_deposit;
  } else if (fluxLabsPayload.isFirstDeposit !== undefined && mapped.first_deposit === undefined) {
    mapped.first_deposit = fluxLabsPayload.isFirstDeposit;
  }
  
  // Username Indication / Referrer
  if (fluxLabsPayload.usernameIndication && !mapped.usernameIndication) {
    mapped.usernameIndication = fluxLabsPayload.usernameIndication;
  } else if (fluxLabsPayload.referrer && !mapped.usernameIndication) {
    mapped.usernameIndication = fluxLabsPayload.referrer;
  } else if (fluxLabsPayload.affiliate && !mapped.usernameIndication) {
    mapped.usernameIndication = fluxLabsPayload.affiliate;
  } else if (fluxLabsPayload.indication && !mapped.usernameIndication) {
    mapped.usernameIndication = fluxLabsPayload.indication;
  }
  
  // UTM Parameters
  if (fluxLabsPayload.utm_source && !mapped.utm_source) {
    mapped.utm_source = fluxLabsPayload.utm_source;
  }
  if (fluxLabsPayload.utm_campaign && !mapped.utm_campaign) {
    mapped.utm_campaign = fluxLabsPayload.utm_campaign;
  }
  if (fluxLabsPayload.utm_medium && !mapped.utm_medium) {
    mapped.utm_medium = fluxLabsPayload.utm_medium;
  }
  
  // PIX QR Code / Copy Paste
  if (fluxLabsPayload.qrCode && !mapped.qrCode) {
    mapped.qrCode = fluxLabsPayload.qrCode;
  } else if (fluxLabsPayload.qr_code && !mapped.qrCode) {
    mapped.qrCode = fluxLabsPayload.qr_code;
  }
  
  if (fluxLabsPayload.copiaECola && !mapped.copiaECola) {
    mapped.copiaECola = fluxLabsPayload.copiaECola;
  } else if (fluxLabsPayload.copy_paste && !mapped.copiaECola) {
    mapped.copiaECola = fluxLabsPayload.copy_paste;
  } else if (fluxLabsPayload.pix_copy_paste && !mapped.copiaECola) {
    mapped.copiaECola = fluxLabsPayload.pix_copy_paste;
  }
  
  // User ID / External ID
  if (fluxLabsPayload.user_id && !mapped.user_id) {
    mapped.user_id = fluxLabsPayload.user_id;
  } else if (fluxLabsPayload.userId && !mapped.user_id) {
    mapped.user_id = fluxLabsPayload.userId;
  } else if (fluxLabsPayload.customer_id && !mapped.user_id) {
    mapped.user_id = fluxLabsPayload.customer_id;
  }
  
  // Approved Deposits
  if (fluxLabsPayload.approved_deposits !== undefined && mapped.approved_deposits === undefined) {
    mapped.approved_deposits = fluxLabsPayload.approved_deposits;
  } else if (fluxLabsPayload.total_deposits !== undefined && mapped.approved_deposits === undefined) {
    mapped.approved_deposits = fluxLabsPayload.total_deposits;
  }
  
  return mapped;
}

/**
 * POST /webhook/fluxlabs
 * Rota específica para receber eventos do FluxLabs
 * O FluxLabs pode enviar eventos em seu próprio formato, que serão mapeados automaticamente
 */
app.post("/webhook/fluxlabs", async (req, res) => {
  try {
    // Verificar autenticação se necessário (pode ser diferente do webhook principal)
    const fluxLabsSecret = process.env.FLUXLABS_SECRET || "";
    if (fluxLabsSecret) {
      const raw = req.rawBodyBuffer || Buffer.from(req.rawBody || "", "utf8");
      const ver = verifyHmac(req, raw, fluxLabsSecret);
      if (ver !== true && ver.ok === false) {
        console.log(JSON.stringify({ 
          level: "warn", 
          msg: "fluxlabs_auth_fail", 
          reason: ver.reason 
        }));
        return res.status(401).json({ ok: false, error: ver.reason });
      }
    }
    
    // Detectar modo teste
    const isTest =
      req.query.test === "true" ||
      req.headers["x-webhook-test"] === "true" ||
      (req.body && (req.body.test === true || req.body.type === "webhook.test"));
    
    if (isTest) {
      console.log(JSON.stringify({ 
        level: "info", 
        msg: "fluxlabs_webhook_test_received",
        payload: req.body 
      }));
      return res.status(200).json({ ok: true, test: true, source: "fluxlabs" });
    }
    
    // Verificar se há pixels com FluxLabs habilitado
    const fluxlabsPixels = PIXELS_CONFIG.filter(p => p.has_fluxlabs === true);
    if (fluxlabsPixels.length === 0 && PIXELS_CONFIG.length === 0) {
      return res.status(500).json({ ok: false, error: "missing_pixel_or_token", source: "fluxlabs" });
    }
    if (fluxlabsPixels.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: "no_fluxlabs_pixels", 
        message: "Nenhum pixel configurado com FluxLabs habilitado",
        source: "fluxlabs" 
      });
    }
    
    // Mapear evento do FluxLabs para o formato do webhook
    const fluxLabsPayload = req.body || {};
    const mappedPayload = mapFluxLabsEvent(fluxLabsPayload);
    
    console.log(JSON.stringify({
      level: "info",
      msg: "fluxlabs_event_received",
      original_type: fluxLabsPayload.type || fluxLabsPayload.action || fluxLabsPayload.event_type || fluxLabsPayload.event,
      mapped_type: mappedPayload.type,
      has_user_data: !!(mappedPayload.email || mappedPayload.phone || mappedPayload.name)
    }));
    
    // Substituir req.body pelo payload mapeado e processar como webhook normal
    req.body = mappedPayload;
    
    // Reutilizar a lógica do webhook principal
    const p = req.body || {};
    
    // Processar eventos específicos (mesma lógica do webhook principal)
    // Prioridade: type > action > event
    const eventTypeRaw = p.type || p.action || p.event || "";
    const eventType = eventTypeRaw.toString().toLowerCase().replace(/[^a-z0-9_]/g, "");
    
    // Mapear user_created (action) para register_new_user (type interno)
    if (eventType === "user_created" || eventType === "register_new_user") {
      p.event_name = "Lead";
      
      // Extrair dados de objetos aninhados se vierem no formato {action, user, ...}
      if (p.user && typeof p.user === "object") {
        if (!p.email && p.user.email) p.email = p.user.email;
        if (!p.name && p.user.name) p.name = p.user.name;
        if (!p.phone && p.user.phone_number) p.phone = p.user.phone_number;
        if (!p.date_birth && p.user.date_of_birth) p.date_birth = p.user.date_of_birth;
        if (!p.user_id && p.user.id) p.user_id = p.user.id;
        if (!p.usernameIndication && p.user.affiliation_code) {
          p.usernameIndication = p.user.affiliation_code;
        }
      }
      
      p.user_data = p.user_data || {};
      
      if (p.email && !p.user_data.email) p.user_data.email = p.email;
      if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
      if (p.name) {
        const nameParts = p.name.trim().split(" ");
        if (!p.user_data.fn) p.user_data.fn = nameParts[0];
        if (!p.user_data.ln && nameParts.length > 1) {
          p.user_data.ln = nameParts.slice(1).join(" ");
        }
      }
      if (p.date_birth && !p.user_data.db) {
        p.user_data.db = p.date_birth.replace(/-/g, "");
      }
      if (p.ip_address && !p.user_data.client_ip_address) {
        p.user_data.client_ip_address = p.ip_address;
      }
      if (p.user_agent && !p.user_data.client_user_agent) {
        p.user_data.client_user_agent = p.user_agent;
      }
      
      p.custom_data = p.custom_data || {};
      if (p.usernameIndication) p.custom_data.referrer_username = p.usernameIndication;
      if (p.origem_cid) p.custom_data.origem_cid = p.origem_cid;
      if (p.utm_source) p.custom_data.utm_source = p.utm_source;
      if (p.utm_campaign) p.custom_data.utm_campaign = p.utm_campaign;
      if (p.utm_medium) p.custom_data.utm_medium = p.utm_medium;
      
      if (!p.event_source_url) {
        p.event_source_url = "https://betbelga.com/cadastro";
      }
      
      console.log(JSON.stringify({
        level: "info",
        msg: "fluxlabs_register_new_user_processed",
        email: p.email ? "***" : null,
        phone: p.phone ? "***" : null
      }));
    }
    else if (eventType === "deposit_generated") {
      const isAgenciaMidas = p.usernameIndication === "agenciamidas";
      
      if (isAgenciaMidas) {
        p.event_name = "Purchase";
      } else {
        p.event_name = "InitiateCheckout";
      }
      
      p.user_data = p.user_data || {};
      
      if (p.email && !p.user_data.email) p.user_data.email = p.email;
      if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
      if (p.name) {
        const nameParts = p.name.trim().split(" ");
        if (!p.user_data.fn) p.user_data.fn = nameParts[0];
        if (!p.user_data.ln && nameParts.length > 1) {
          p.user_data.ln = nameParts.slice(1).join(" ");
        }
      }
      if (p.date_birth && !p.user_data.db) {
        p.user_data.db = p.date_birth.replace(/-/g, "");
      }
      if (p.ip_address && !p.user_data.client_ip_address) {
        p.user_data.client_ip_address = p.ip_address;
      }
      if (p.user_agent && !p.user_data.client_user_agent) {
        p.user_data.client_user_agent = p.user_agent;
      }
      
      p.custom_data = p.custom_data || {};
      if (p.value !== undefined) {
        p.custom_data.value = coerceNumber(p.value);
        p.custom_data.currency = "BRL";
      }
      if (p.qrCode) p.custom_data.pix_qr_code = p.qrCode.substring(0, 50) + "...";
      if (p.copiaECola) p.custom_data.pix_copy_paste = p.copiaECola.substring(0, 50) + "...";
      if (p.usernameIndication) p.custom_data.referrer_username = p.usernameIndication;
      
      if (isAgenciaMidas) {
        p.custom_data.event_type = "FTD";
      }
      
      if (!p.event_source_url) {
        if (isAgenciaMidas) {
          p.event_source_url = "https://betbelga.com/deposito/sucesso";
        } else {
          p.event_source_url = "https://betbelga.com/deposito";
        }
      }
      
      console.log(JSON.stringify({
        level: "info",
        msg: "fluxlabs_deposit_generated_processed",
        value: p.value,
        cambista: p.usernameIndication || null,
        event_type: isAgenciaMidas ? "Purchase" : "InitiateCheckout"
      }));
    }
    else if (eventType === "confirmed_deposit" || eventType === "invoice_paid") {
      // Evento: Depósito confirmado (pagamento recebido)
      // invoice_paid também é mapeado para confirmed_deposit
      p.event_name = "Purchase";
      
      // Extrair dados de objetos aninhados se vierem no formato {action, user, invoice, client, payer}
      if (p.user && typeof p.user === "object") {
        if (!p.email && p.user.email) p.email = p.user.email;
        if (!p.name && p.user.name) p.name = p.user.name;
        if (!p.phone && p.user.phone_number) p.phone = p.user.phone_number;
        if (!p.date_birth && p.user.date_of_birth) p.date_birth = p.user.date_of_birth;
        if (!p.user_id && p.user.id) p.user_id = p.user.id;
      }
      if (p.invoice && typeof p.invoice === "object") {
        if (p.invoice.value !== undefined && p.value === undefined) p.value = p.invoice.value;
        if (p.invoice.id && !p.deposit_id) p.deposit_id = p.invoice.id;
      }
      if (p.client && typeof p.client === "object") {
        if (!p.email && p.client.email) p.email = p.client.email;
        if (!p.name && p.client.name) p.name = p.client.name;
        if (!p.phone && p.client.phone) p.phone = p.client.phone;
      }
      if (p.payer && typeof p.payer === "object") {
        if (!p.name && p.payer.name) p.name = p.payer.name;
        if (!p.phone && p.payer.phone) p.phone = p.payer.phone;
      }
      
      p.user_data = p.user_data || {};
      
      if (p.email && !p.user_data.email) p.user_data.email = p.email;
      if (p.phone && !p.user_data.phone) p.user_data.phone = p.phone;
      if (p.name) {
        const nameParts = p.name.trim().split(" ");
        if (!p.user_data.fn) p.user_data.fn = nameParts[0];
        if (!p.user_data.ln && nameParts.length > 1) {
          p.user_data.ln = nameParts.slice(1).join(" ");
        }
      }
      if (p.date_birth && !p.user_data.db) {
        p.user_data.db = p.date_birth.replace(/-/g, "");
      }
      if (p.ip_address && !p.user_data.client_ip_address) {
        p.user_data.client_ip_address = p.ip_address;
      }
      if (p.user_agent && !p.user_data.client_user_agent) {
        p.user_data.client_user_agent = p.user_agent;
      }
      
      p.custom_data = p.custom_data || {};
      if (p.value !== undefined) {
        p.custom_data.value = coerceNumber(p.value);
        p.custom_data.currency = "BRL";
      }
      
      const isFirstDeposit = parseBoolLike(p.first_deposit);
      if (isFirstDeposit === true) {
        p.custom_data.event_type = "FTD";
      } else {
        p.custom_data.event_type = "REDEPOSIT";
        console.log(JSON.stringify({
          level: "info",
          msg: "fluxlabs_redeposit_from_confirmed_deposit",
          approved_deposits: p.approved_deposits
        }));
        return res.status(200).json({
          ok: true,
          ignored: true,
          reason: "redeposit_ignored",
          approved_deposits: p.approved_deposits,
          source: "fluxlabs"
        });
      }
      
      if (p.approved_deposits !== undefined) {
        p.custom_data.approved_deposits = p.approved_deposits;
      }
      if (p.usernameIndication) {
        p.custom_data.referrer_username = p.usernameIndication;
      }
      
      if (!p.event_source_url) {
        p.event_source_url = "https://betbelga.com/deposito/sucesso";
      }
      
      console.log(JSON.stringify({
        level: "info",
        msg: "fluxlabs_confirmed_deposit_processed",
        value: p.value,
        event_type: p.custom_data.event_type,
        approved_deposits: p.approved_deposits
      }));
    }
    
    // Se não mapeou para nenhum tipo específico, tentar mapeamento genérico
    if (!p.event_name) {
      // Prioridade: type > action > event
      const raw = (p.type || p.action || p.event || "").toString().toLowerCase();
      const t = raw.replace(/[^a-z0-9]/g, "");
      const registerAliases = new Set([
        "userregister",
        "userregistered",
        "usercreated",
        "signup",
        "registered",
        "registrationcompleted",
        "onlineregisteraccount",
      ]);
      if (registerAliases.has(t)) {
        p.event_name = "Lead";
      }
    }
    
    // Aplicar filtro por eventos permitidos
    if (p.event_name && !onlyAllowed(p.event_name)) {
      console.log(JSON.stringify({ 
        level: "info", 
        msg: "fluxlabs_event_blocked", 
        event_name: p.event_name 
      }));
      return res.status(200).json({ 
        ok: true, 
        ignored: true, 
        reason: "event_blocked", 
        event_name: p.event_name || null,
        source: "fluxlabs"
      });
    }
    
    // Montar user_data se necessário
    if (p.event_name === "Lead") {
      p.user_data = p.user_data || {};
      if (!p.user_data.email && p.email) p.user_data.email = p.email;
      if (!p.user_data.phone && p.phone) p.user_data.phone = p.phone;
      if (!p.user_data.external_id) {
        const ext = p.user_id || p.id || p.username;
        if (ext !== undefined && ext !== null) p.user_data.external_id = String(ext);
      }
      if (!p.event_source_url) {
        p.event_source_url = "https://betbelga.com/form";
      }
    }
    
    // Mapear e enviar para Meta CAPI
    const mapped = mapEvent(p, req);
    if (mapped.error) {
      if (mapped.error === "invalid_purchase_payload") {
        return res.status(400).json({ ok: false, error: mapped.error, source: "fluxlabs" });
      }
      return res.status(400).json({ ok: false, error: mapped.error, source: "fluxlabs" });
    }
    
    try {
      // Permitir especificar pixels no payload (opcional)
      const targetPixels = req.body?.pixel_ids || req.body?.pixels || null;
      
      // Enviar apenas para pixels com FluxLabs habilitado
      const results = await sendToMultiplePixels(mapped.payload, targetPixels, true);
      
      if (results.length === 0) {
        return res.status(500).json({ 
          ok: false, 
          error: "no_fluxlabs_pixels_available", 
          source: "fluxlabs" 
        });
      }
      
      // Log de resultados
      results.forEach(result => {
        console.log(JSON.stringify({
          level: "info",
          msg: "fluxlabs_capi_result",
          pixel_id: result.pixel_id,
          pixel_name: result.pixel_name,
          event_name: mapped.mapped_event_name,
          event_id: mapped.event_id,
          capi_status: result.status,
          events_received: result.data?.events_received ?? null,
          event_type: (mapped.payload?.data?.[0]?.custom_data?.event_type) || null
        }));
      });
      
      // Retornar resultado do primeiro pixel (compatibilidade) + todos os resultados
      const firstResult = results[0];
      return res.status(200).json({ 
        ok: true, 
        event_id: mapped.event_id, 
        capi_status: firstResult.status, 
        events_received: mapped.payload?.data?.length || 0, 
        capi_response: firstResult.data,
        source: "fluxlabs",
        pixels_sent: results.length,
        all_results: results.map(r => ({
          pixel_id: r.pixel_id,
          pixel_name: r.pixel_name,
          status: r.status,
          events_received: r.data?.events_received ?? null
        }))
      });
    } catch (_e) {
      return res.status(500).json({ ok: false, error: "capi_request_failed", source: "fluxlabs" });
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "fluxlabs_webhook_error",
      error: error.message,
      stack: error.stack
    }));
    return res.status(500).json({ ok: false, error: "internal_error", source: "fluxlabs" });
  }
});

// Erros
app.use((err, _req, res, _next) => {
  console.error("Erro:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

app.listen(PORT, () => console.log(`Webhook/CAPI na porta ${PORT}`));
