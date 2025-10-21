import crypto from "crypto";

export function sha256Hex(str) {
  const normalized = typeof str === "string" ? str : String(str ?? "");
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function normalizePhoneE164ish(phone) {
  if (!phone || typeof phone !== "string") return "";
  // Mantém apenas dígitos. Não adiciona "+"; preserva DDI se já estiver presente como dígitos
  const digits = phone.replace(/\D+/g, "");
  return digits;
}

function isHex64(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value);
}

export function hashUserData(userDataIn) {
  const out = {};
  const src = userDataIn || {};

  // EMAIL
  if (isHex64(src.em)) {
    out.em = src.em;
  } else if (src.em) {
    out.em = sha256Hex(normalizeEmail(src.em));
  } else if (src.email) {
    out.em = sha256Hex(normalizeEmail(src.email));
  }

  // PHONE
  if (isHex64(src.ph)) {
    out.ph = src.ph;
  } else if (src.ph) {
    out.ph = sha256Hex(normalizePhoneE164ish(src.ph));
  } else if (src.phone) {
    out.ph = sha256Hex(normalizePhoneE164ish(src.phone));
  }

  if (src.external_id) {
    out.external_id = src.external_id;
  }

  return out;
}


