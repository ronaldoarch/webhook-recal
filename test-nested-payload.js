#!/usr/bin/env node

/**
 * Script de teste para formato de payload aninhado
 * 
 * Uso:
 *   node test-nested-payload.js
 *   node test-nested-payload.js --with-hmac
 */

import crypto from "crypto";

const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/webhook";
const SHARED_SECRET = process.env.SHARED_SECRET || "";
const USE_HMAC = process.argv.includes("--with-hmac");

// Payload de teste no formato aninhado (baseado no exemplo real)
const nestedPayload = {
  data: {
    user: {
      id: 3247534,
      cpf: null,
      fb_id: "fb.1.1764706925052.483983336822458795",
      phone_number: "5893247534866",
      name: "SARAH ADRIELE",
      email: "gyncasa12684@gmail.com",
      level: null,
      phone: "75988863498",
      credit: null,
      birth_date: null,
      country: "55",
      inviter: 3119257,
      user_ip: "177.283.218.13",
      guest_id: "guest-62c477db2c9e8",
      totalBet: 0,
      username: "75988863498",
      utm_term: null,
      last_name: "Adriele",
      created_at: "2025-12-02",
      first_name: "Sarah",
      updated_at: "2025-12-02T22:40:34.000000Z",
      user_agent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      utm_medium: null,
      utm_source: null,
      utm_other_name: null,
      utm_content: null,
      cpf_verified: false,
      display_name: "Sarah",
      inviter_code: "agenciamidas", // ← Indicador!
      kyc_required: 0,
      utm_campaign: null,
      hide_username: false,
      email_verified: false,
      marital_status: null,
      phone_verified: false,
      hide_statistics: false,
      documents_all_approved: false,
      affiliate_revenue_share: "50.00",
    },
    deposit: {
      amount: "10.00",
      coupon: "BEMVINDO",
      unique_id: 3730549,
      created_at: "2025-12-02 19:48:51",
      qrcodedata:
        "00020101021226840014br.gov.bcb.pix2562pix.e2ip.com.br/v2/qr/cob/be382960-dfdb-4e6c-8438-7d9c46fa95e15204200053039065B20A59222P INTERMEDIACOES LTDA6009SAO PAULO62070503***6304C84",
      deposit_count: 0,
      first_deposit: true,
    },
    event: {
      event: "DepositMade",
      event_type: "deposit_made",
    },
  },
};

// Payload simplificado para teste rápido
const simplePayload = {
  data: {
    user: {
      id: 123456,
      name: "João Silva Teste",
      email: "joao.teste@example.com",
      phone: "11999999999",
      fb_id: "fb.1.1700000000.123456789",
      user_ip: "200.100.50.10",
      user_agent: "Mozilla/5.0 (Test)",
      inviter_code: "agenciamidas",
    },
    deposit: {
      amount: "50.00",
      first_deposit: true,
      deposit_count: 0,
      unique_id: 999999,
      coupon: "TESTE50",
    },
    event: {
      event: "DepositMade",
      event_type: "deposit_made",
    },
  },
};

// Payload de cadastro (Lead)
const userCreatedPayload = {
  data: {
    user: {
      id: 789012,
      name: "Maria Santos",
      email: "maria@example.com",
      phone: "21988888888",
      birth_date: "1995-03-15",
      fb_id: "fb.1.1700000000.987654321",
      user_ip: "200.100.50.20",
      user_agent: "Mozilla/5.0 (Test)",
      inviter_code: "agenciamidas",
      utm_source: "google",
      utm_campaign: "teste_lead",
    },
    event: {
      event: "UserCreated",
      event_type: "user_created",
    },
  },
};

function generateHMAC(payload) {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", SHARED_SECRET);
  hmac.update(body);
  return "sha256=" + hmac.digest("hex");
}

async function testPayload(name, payload) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Testando: ${name}`);
  console.log(`${"=".repeat(60)}\n`);

  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
  };

  if (USE_HMAC && SHARED_SECRET) {
    headers["X-Hub-Signature-256"] = generateHMAC(payload);
    console.log("🔐 HMAC adicionado ao header\n");
  }

  console.log("📤 Payload enviado:");
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body,
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`📥 Status: ${response.status} ${response.statusText}`);
    console.log(`📥 Resposta:`);
    console.log(JSON.stringify(responseData, null, 2));

    if (response.status === 200) {
      console.log(`\n✅ ${name} - SUCESSO!`);
      return true;
    } else {
      console.log(`\n❌ ${name} - ERRO ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`\n❌ ${name} - ERRO DE CONEXÃO`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 TESTE DE PAYLOAD ANINHADO (NESTED FORMAT)          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  console.log(`📍 URL: ${WEBHOOK_URL}`);
  console.log(`🔐 HMAC: ${USE_HMAC ? "Ativado" : "Desativado"}`);

  if (USE_HMAC && !SHARED_SECRET) {
    console.log(
      "\n⚠️  AVISO: --with-hmac especificado mas SHARED_SECRET não configurado!"
    );
    console.log("Configure: export SHARED_SECRET=seu_secret\n");
  }

  const results = [];

  // Teste 1: Payload simplificado
  results.push(await testPayload("Depósito - Payload Simplificado", simplePayload));

  // Teste 2: Payload completo (igual ao exemplo real)
  results.push(await testPayload("Depósito - Payload Completo", nestedPayload));

  // Teste 3: Cadastro de usuário
  results.push(await testPayload("Cadastro - Lead", userCreatedPayload));

  // Resumo
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 RESUMO DOS TESTES");
  console.log(`${"=".repeat(60)}\n`);

  const successCount = results.filter((r) => r).length;
  const totalCount = results.length;

  console.log(`✅ Sucessos: ${successCount}/${totalCount}`);
  console.log(`❌ Falhas:   ${totalCount - successCount}/${totalCount}\n`);

  if (successCount === totalCount) {
    console.log("🎉 TODOS OS TESTES PASSARAM!\n");
    process.exit(0);
  } else {
    console.log("⚠️  ALGUNS TESTES FALHARAM\n");
    process.exit(1);
  }
}

// Tratar erros não capturados
process.on("unhandledRejection", (error) => {
  console.error("\n❌ Erro não tratado:");
  console.error(error);
  process.exit(1);
});

main();


