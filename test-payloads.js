#!/usr/bin/env node

/**
 * Script de teste para os payloads do webhook de marketing
 * 
 * Uso:
 *   node test-payloads.js <tipo-evento> [url] [secret]
 * 
 * Exemplos:
 *   node test-payloads.js register_new_user
 *   node test-payloads.js deposit_generated http://localhost:3000/webhook
 *   node test-payloads.js confirmed_deposit http://localhost:3000/webhook meu_secret
 */

import crypto from 'crypto';

// Configurações padrão
const DEFAULT_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const DEFAULT_SECRET = process.env.SHARED_SECRET || '';

// Payloads de exemplo
const PAYLOADS = {
  register_new_user: {
    type: "register_new_user",
    name: "João Silva",
    email: "joao.silva@example.com",
    phone: "+5511999999999",
    date_birth: "1990-05-10",
    ip_address: "200.100.50.10",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    fbp: "fb.1.1700000000.123456789",
    fbc: "fb.1.1700000000.ABCDEF123",
    usernameIndication: "user_indicador",
    origem_cid: "google_ads",
    utm_source: "google",
    utm_campaign: "campanha_teste",
    utm_medium: "cpc"
  },
  
  deposit_generated: {
    type: "deposit_generated",
    name: "João Silva",
    email: "joao.silva@example.com",
    phone: "+5511999999999",
    date_birth: "1990-05-10",
    ip_address: "200.100.50.10",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    fbp: "fb.1.1700000000.123456789",
    fbc: "fb.1.1700000000.ABCDEF123",
    usernameIndication: "user_indicador",
    qrCode: "00020126360014BR.GOV.BCB.PIX01148146234600152040000530398654041.005802BR5913Loja Exemplo6009SAO PAULO62410503***50300017BR.GOV.BCB.BRCODE01051.0.063044C3A",
    copiaECola: "00020126580014BR.GOV.BCB.PIX01368146234600152040000530398654041.005802BR5925EMPRESA EXEMPLO LTDA6014BELO HORIZONTE62070503***6304A1B2",
    value: 100.50
  },
  
  confirmed_deposit_ftd: {
    type: "confirmed_deposit",
    name: "João Silva",
    email: "joao.silva@example.com",
    phone: "+5511999999999",
    date_birth: "1990-05-10",
    ip_address: "200.100.50.10",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    fbp: "fb.1.1700000000.123456789",
    fbc: "fb.1.1700000000.ABCDEF123",
    usernameIndication: "user_indicador",
    value: 100.50,
    first_deposit: true,
    approved_deposits: 1
  },
  
  confirmed_deposit_redeposit: {
    type: "confirmed_deposit",
    name: "João Silva",
    email: "joao.silva@example.com",
    phone: "+5511999999999",
    date_birth: "1990-05-10",
    ip_address: "200.100.50.10",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    fbp: "fb.1.1700000000.123456789",
    fbc: "fb.1.1700000000.ABCDEF123",
    usernameIndication: "user_indicador",
    value: 200.00,
    first_deposit: false,
    approved_deposits: 3
  },
  
  test: {
    type: "webhook.test",
    test: true,
    timestamp: new Date().toISOString()
  }
};

function calculateSignature(payload, secret) {
  if (!secret) return null;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

async function sendWebhook(eventType, url, secret) {
  const payload = PAYLOADS[eventType];
  
  if (!payload) {
    console.error(`❌ Tipo de evento inválido: ${eventType}`);
    console.log(`\nEventos disponíveis:`);
    Object.keys(PAYLOADS).forEach(key => {
      console.log(`  - ${key}`);
    });
    process.exit(1);
  }
  
  const payloadString = JSON.stringify(payload, null, 2);
  const signature = calculateSignature(JSON.stringify(payload), secret);
  
  console.log(`\n🚀 Enviando payload do tipo: ${eventType}`);
  console.log(`📍 URL: ${url}`);
  console.log(`🔐 Secret: ${secret ? '***' : '(não configurado)'}`);
  console.log(`\n📦 Payload:`);
  console.log(payloadString);
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (signature) {
    headers['X-Signature'] = signature;
    console.log(`\n🔑 Assinatura: ${signature.substring(0, 20)}...`);
  }
  
  console.log(`\n⏳ Enviando requisição...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    console.log(`\n✅ Resposta recebida (Status: ${response.status})`);
    console.log(JSON.stringify(responseData, null, 2));
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`\n✅ Sucesso!`);
    } else {
      console.log(`\n⚠️  Atenção: Status ${response.status}`);
    }
    
  } catch (error) {
    console.error(`\n❌ Erro ao enviar requisição:`);
    console.error(error.message);
    process.exit(1);
  }
}

// Menu de ajuda
function showHelp() {
  console.log(`
📋 Script de Teste - Webhook de Marketing

Uso:
  node test-payloads.js <tipo-evento> [url] [secret]

Tipos de eventos disponíveis:
  register_new_user           - Novo usuário registrado (Lead)
  deposit_generated           - Depósito PIX gerado (InitiateCheckout)
  confirmed_deposit_ftd       - Primeiro depósito confirmado (Purchase FTD)
  confirmed_deposit_redeposit - Redepósito confirmado (ignorado)
  test                        - Teste simples do webhook

Argumentos:
  tipo-evento    (obrigatório) - Tipo do evento a ser testado
  url            (opcional)    - URL do webhook (padrão: ${DEFAULT_URL})
  secret         (opcional)    - Secret para HMAC (padrão: SHARED_SECRET env)

Variáveis de ambiente:
  WEBHOOK_URL     - URL padrão do webhook
  SHARED_SECRET   - Secret padrão para assinatura HMAC

Exemplos:
  node test-payloads.js register_new_user
  node test-payloads.js deposit_generated http://localhost:3000/webhook
  node test-payloads.js confirmed_deposit_ftd http://localhost:3000/webhook meu_secret
  node test-payloads.js test

Para testar todos os eventos:
  node test-payloads.js all
`);
}

// Função para testar todos os eventos
async function testAll(url, secret) {
  const events = Object.keys(PAYLOADS).filter(k => k !== 'test');
  
  console.log(`\n🧪 Testando todos os eventos (${events.length} eventos)\n`);
  
  for (const eventType of events) {
    await sendWebhook(eventType, url, secret);
    console.log(`\n${'='.repeat(80)}\n`);
    
    // Aguardar 1 segundo entre requisições
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Todos os testes concluídos!`);
}

// Parse de argumentos
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  showHelp();
  process.exit(0);
}

const eventType = args[0];
const url = args[1] || DEFAULT_URL;
const secret = args[2] || DEFAULT_SECRET;

// Testar todos os eventos
if (eventType === 'all') {
  testAll(url, secret);
} else {
  // Testar evento específico
  sendWebhook(eventType, url, secret);
}

