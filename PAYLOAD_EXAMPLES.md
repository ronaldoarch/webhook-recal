# 📋 Exemplos de Payloads — Webhook de Marketing

Este documento contém exemplos práticos de como enviar os payloads para o webhook.

---

## 🔧 **Configuração**

**Endpoint:** `POST /webhook`

**Headers obrigatórios:**
```
Content-Type: application/json
X-Signature: <HMAC-SHA256 do body com SHARED_SECRET>
```

---

## 🟢 **Evento 1: `register_new_user`**

Enviado quando um novo lead se registra na plataforma.

### Payload de Exemplo

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "user_indicador",
  "origem_cid": "google_ads",
  "utm_source": "google",
  "utm_campaign": "campanha_teste",
  "utm_medium": "cpc"
}
```

### O que acontece

✅ O evento é mapeado para **`Lead`** no Meta CAPI  
✅ Nome completo é separado em `first_name` e `last_name`  
✅ Data de nascimento é formatada de `YYYY-MM-DD` para `YYYYMMDD`  
✅ E-mail e telefone são hasheados automaticamente (SHA-256)  
✅ Parâmetros UTM são incluídos em `custom_data`  
✅ IP e User Agent são capturados para o Meta  

### Resposta Esperada

```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "capi_status": 200,
  "events_received": 1,
  "capi_response": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "..."
  }
}
```

---

## 🟡 **Evento 2: `deposit_generated`**

Enviado quando um depósito PIX é gerado.

**⚠️ IMPORTANTE:** O comportamento deste evento varia conforme o cambista:
- **Para `usernameIndication: "agenciamidas"`**: Mapeado como **`Purchase`** (FTD - finalização de compra)
- **Para outros cambistas**: Mapeado como **`InitiateCheckout`** (PIX criado, aguardando pagamento)

### Payload de Exemplo (Agência Midas)

```json
{
  "type": "deposit_generated",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "agenciamidas",
  "qrCode": "00020126360014BR.GOV.BCB.PIX...",
  "copiaECola": "00020126580014BR.GOV.BCB.PIX...",
  "value": 100.50
}
```

### O que acontece (Agência Midas)

✅ O evento é mapeado para **`Purchase`** no Meta CAPI (não InitiateCheckout!)  
✅ Valor do depósito é incluído em `custom_data.value`  
✅ `event_type` é definido como **`FTD`** automaticamente  
✅ Códigos PIX são truncados para evitar logs grandes  
✅ Todos os dados do usuário são processados e hasheados  

### Payload de Exemplo (Outros Cambistas)

```json
{
  "type": "deposit_generated",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "outro_cambista",
  "qrCode": "00020126360014BR.GOV.BCB.PIX...",
  "copiaECola": "00020126580014BR.GOV.BCB.PIX...",
  "value": 100.50
}
```

### O que acontece (Outros Cambistas)

✅ O evento é mapeado para **`InitiateCheckout`** no Meta CAPI  
✅ Valor do depósito é incluído em `custom_data.value`  
✅ Códigos PIX são truncados para evitar logs grandes  
✅ Todos os dados do usuário são processados e hasheados  

### Resposta Esperada

```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "capi_status": 200,
  "events_received": 1,
  "capi_response": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "..."
  }
}
```

---

## 🔵 **Evento 3: `confirmed_deposit`**

Enviado quando o depósito é confirmado (pagamento recebido).

### Payload de Exemplo (Primeiro Depósito - FTD)

```json
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "user_indicador",
  "value": 100.50,
  "first_deposit": true,
  "approved_deposits": 1
}
```

### O que acontece (FTD)

✅ O evento é mapeado para **`Purchase`** no Meta CAPI  
✅ `event_type` é definido como **`FTD`** (First Time Deposit)  
✅ Valor é incluído em `custom_data.value` com moeda BRL  
✅ Número de depósitos aprovados é incluído em `custom_data`  

### Payload de Exemplo (Redepósito)

```json
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "user_indicador",
  "value": 200.00,
  "first_deposit": false,
  "approved_deposits": 3
}
```

### O que acontece (REDEPOSIT)

⚠️ **O evento é IGNORADO** (conforme política atual)  
✅ É registrado nos logs como `redeposit_ignored`  

### Resposta Esperada (FTD)

```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440002",
  "capi_status": 200,
  "events_received": 1,
  "capi_response": {
    "events_received": 1,
    "messages": [],
    "fbtrace_id": "..."
  }
}
```

### Resposta Esperada (REDEPOSIT)

```json
{
  "ok": true,
  "ignored": true,
  "reason": "redeposit_ignored",
  "approved_deposits": 3
}
```

---

## 🔐 **Autenticação (HMAC-SHA256)**

Para calcular a assinatura:

```javascript
const crypto = require('crypto');

const payload = JSON.stringify({
  type: "register_new_user",
  name: "João Silva",
  // ... resto do payload
});

const secret = process.env.SHARED_SECRET;
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

// Enviar no header: X-Signature: sha256=<signature>
```

### Exemplo com cURL

```bash
# 1. Criar payload
PAYLOAD='{"type":"register_new_user","name":"João Silva","email":"joao@example.com","phone":"+5511999999999","date_birth":"1990-05-10"}'

# 2. Calcular assinatura
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "SEU_SHARED_SECRET" | sed 's/^.* //')

# 3. Enviar requisição
curl -X POST https://seu-webhook.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

---

## 🧪 **Modo de Teste**

Para testar o webhook sem enviar eventos ao Meta CAPI:

```bash
curl -X POST https://seu-webhook.com/webhook?test=true \
  -H "Content-Type: application/json" \
  -d '{"type":"webhook.test"}'
```

Ou adicionar no payload:

```json
{
  "test": true,
  "type": "webhook.test"
}
```

---

## 📊 **Mapeamento de Eventos**

| Tipo do Payload       | Evento no Meta CAPI | Descrição                                      |
| --------------------- | ------------------- | ---------------------------------------------- |
| `register_new_user`   | `Lead`              | Novo usuário registrado                        |
| `deposit_generated`   | `Purchase` (FTD)    | **[agenciamidas]** Finalização de compra       |
| `deposit_generated`   | `InitiateCheckout`  | **[outros]** PIX gerado, aguardando pagamento  |
| `confirmed_deposit`   | `Purchase` (FTD)    | Primeiro depósito confirmado                   |
| `confirmed_deposit`   | ❌ (ignorado)       | Redepósito (first_deposit=false)               |

---

## 🚀 **Integração Multi-Cliente**

Este webhook foi projetado para receber eventos de múltiplos clientes. Todos os payloads seguem a mesma estrutura, facilitando a integração.

### Boas Práticas

1. **Sempre envie o campo `type`** para identificar o evento
2. **Inclua `fbp` e `fbc`** quando disponíveis para melhor atribuição
3. **Envie `ip_address` e `user_agent`** para melhor matching no Meta
4. **Use `usernameIndication`** para rastrear indicações
5. **Inclua parâmetros UTM** para análise de origem

---

## 📝 **Logs e Monitoramento**

O webhook registra logs em JSON para cada evento processado:

```json
{
  "level": "info",
  "msg": "register_new_user_processed",
  "email": "***",
  "phone": "***"
}
```

```json
{
  "level": "info",
  "msg": "confirmed_deposit_processed",
  "value": 100.50,
  "event_type": "FTD",
  "approved_deposits": 1
}
```

---

## ❓ **Troubleshooting**

### Erro 401 - Unauthorized

```json
{
  "ok": false,
  "error": "invalid_signature"
}
```

**Solução:** Verifique se a assinatura HMAC-SHA256 está correta.

### Erro 400 - Invalid Purchase Payload

```json
{
  "ok": false,
  "error": "invalid_purchase_payload"
}
```

**Solução:** Certifique-se de que eventos de `Purchase` incluem `value` (número) e `currency`.

### Evento Ignorado

```json
{
  "ok": true,
  "ignored": true,
  "reason": "redeposit_ignored"
}
```

**Informação:** Redepósitos são ignorados por padrão. Apenas FTDs são enviados ao Meta.

---

## 📞 **Suporte**

Para dúvidas ou problemas, verifique os logs do servidor para mais detalhes sobre o processamento dos eventos.

