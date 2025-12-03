import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const SHARED_SECRET = process.env.SHARED_SECRET || '';

// Payload exato do formato Agência Midas (conforme imagem)
const payloadAgenciaMidas = {
  "tags": ["Registered-customer"],
  "name": "João Silva Santos",
  "cpf": "123.456.789-00",
  "birth_date": "1995-09-11",
  "email": "joao.silva@example.com",
  "phone": "(11) 99999-9999",
  "affiliate": "agenciamidas",
  "registration_date": "2024-01-15 13:00:00",
  "ip_address": "177.123.45.67",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function calculateSignature(payload, secret) {
  if (!secret) return null;
  const bodyString = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyString);
  return 'sha256=' + hmac.digest('hex');
}

async function testWebhook() {
  console.log('\n🧪 Testando Formato Agência Midas\n');
  console.log('═'.repeat(60));
  
  const signature = calculateSignature(payloadAgenciaMidas, SHARED_SECRET);
  
  console.log('\n📦 Payload Agência Midas:');
  console.log(JSON.stringify(payloadAgenciaMidas, null, 2));
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (signature) {
    headers['X-Signature'] = signature;
    console.log('\n🔐 Assinatura HMAC calculada');
  }
  
  console.log(`\n📍 Enviando para: ${WEBHOOK_URL}`);
  console.log('⏳ Aguardando resposta...\n');
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadAgenciaMidas)
    });
    
    const result = await response.json();
    
    console.log('═'.repeat(60));
    console.log(`\n✅ Resposta recebida (Status: ${response.status})\n`);
    console.log(JSON.stringify(result, null, 2));
    console.log('\n' + '═'.repeat(60));
    
    // Validações
    console.log('\n📊 Validações:');
    
    if (response.status === 200 && result.ok) {
      console.log('✅ Webhook processou com sucesso');
      
      if (result.event_id) {
        console.log(`✅ Event ID gerado: ${result.event_id}`);
      }
      
      if (result.capi_status === 200) {
        console.log('✅ Evento enviado ao Meta CAPI com sucesso');
      }
      
      if (result.events_received > 0) {
        console.log(`✅ Meta recebeu ${result.events_received} evento(s)`);
      }
      
      console.log('\n🎯 Verificações Importantes:');
      console.log('- Verifique nos logs do servidor se aparece "event_name":"CompleteRegistration"');
      console.log('- O evento deve ser "CompleteRegistration" (Concluir Inscrição)');
      console.log('- NÃO deve ser "PageView"');
      
      console.log('\n🎉 Teste concluído com sucesso!');
      console.log('\n💡 Verifique os logs do servidor para confirmar o event_name');
      
    } else if (result.ignored) {
      console.log(`⚠️  Evento ignorado: ${result.reason}`);
    } else {
      console.log(`❌ Erro no processamento: ${result.error || 'unknown'}`);
    }
    
  } catch (error) {
    console.log('\n' + '═'.repeat(60));
    console.log('\n❌ Erro ao enviar requisição:\n');
    console.error(error.message);
    console.log('\n💡 Certifique-se de que o webhook está rodando em ' + WEBHOOK_URL);
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
}

// Executar teste
testWebhook();

