# 🔄 Formato de Payload Aninhado (Nested Payload)

## 📋 Visão Geral

O webhook agora suporta payloads com estrutura aninhada no formato:

```json
{
  "data": {
    "user": { ... },
    "deposit": { ... },
    "event": { ... }
  }
}
```

Este formato é **automaticamente normalizado** para o formato interno do webhook.

---

## ✅ Eventos Suportados

### 1. **DepositMade** → `confirmed_deposit` (Purchase/FTD)

```json
{
  "data": {
    "user": {
      "id": 3247534,
      "name": "SARAH ADRIELE",
      "first_name": "Sarah",
      "last_name": "Adriele",
      "email": "user@example.com",
      "phone": "75988863498",
      "phone_number": "5893247534866",
      "fb_id": "fb.1.1764706925052.483983336822458795",
      "user_ip": "177.283.218.13",
      "user_agent": "Mozilla/5.0...",
      "inviter_code": "9C06TP2QUS",
      "utm_source": "facebook",
      "utm_medium": "cpc",
      "utm_campaign": "black_friday"
    },
    "deposit": {
      "amount": "10.00",
      "coupon": "BEMVINDO",
      "unique_id": 3730549,
      "qrcodedata": "00020101021226840014br.gov.bcb.pix...",
      "deposit_count": 0,
      "first_deposit": true
    },
    "event": {
      "event": "DepositMade",
      "event_type": "deposit_made"
    }
  }
}
```

**Mapeamento automático:**
- `event_type: "deposit_made"` → `type: "confirmed_deposit"`
- `user.name` → `name`
- `user.email` → `email` (hasheado)
- `user.phone` → `phone` (hasheado)
- `user.fb_id` → `fbp`
- `user.inviter_code` → `usernameIndication` → `custom_data.referrer_username`
- `deposit.amount` → `value`
- `deposit.first_deposit` → `first_deposit`
- `deposit.coupon` → `custom_data.coupon`
- `deposit.unique_id` → `custom_data.transaction_id`

**Evento enviado ao Meta:**
- `event_name: "Purchase"`
- `custom_data.event_type: "FTD"` (se first_deposit = true)
- `custom_data.value: 10.00`
- `custom_data.currency: "BRL"`

---

### 2. **UserCreated** → `register_new_user` (Lead)

```json
{
  "data": {
    "user": {
      "id": 123456,
      "name": "João Silva",
      "email": "joao@example.com",
      "phone": "11999999999",
      "birth_date": "1990-05-10",
      "fb_id": "fb.1.1700000000.123456789",
      "user_ip": "200.100.50.10",
      "user_agent": "Mozilla/5.0...",
      "inviter_code": "agenciamidas",
      "utm_source": "google",
      "utm_campaign": "campanha_teste"
    },
    "event": {
      "event": "UserCreated",
      "event_type": "user_created"
    }
  }
}
```

**Mapeamento automático:**
- `event_type: "user_created"` → `type: "register_new_user"`
- Mesma lógica de extração de dados do usuário
- Evento enviado ao Meta: `Lead`

---

## 🔍 Como Funciona a Normalização

### Passo 1: Detecção

O webhook detecta se o payload tem a estrutura `{data: {user, deposit, event}}`:

```javascript
if (p.data && typeof p.data === "object") {
  // Normalização ativada
}
```

### Passo 2: Extração

Dados são extraídos de cada objeto:

```javascript
// Tipo de evento
p.type = event.event_type; // "deposit_made"

// Dados do usuário
p.name = user.name;
p.email = user.email;
p.phone = user.phone || user.phone_number;
p.fbp = user.fb_id;
p.usernameIndication = user.inviter_code;

// Dados do depósito
p.value = parseFloat(deposit.amount);
p.first_deposit = deposit.first_deposit;
```

### Passo 3: Mapeamento de Alias

Eventos são mapeados para tipos internos:

```javascript
// "deposit_made" → "confirmed_deposit"
// "user_created" → "register_new_user"
```

### Passo 4: Processamento Normal

O payload normalizado é processado normalmente pelo webhook.

---

## 🧪 Testando o Novo Formato

### Teste Manual com cURL

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "user": {
        "id": 12345,
        "name": "João Silva",
        "email": "joao@example.com",
        "phone": "11999999999",
        "fb_id": "fb.1.1700000000.123456789",
        "user_ip": "200.100.50.10",
        "user_agent": "Mozilla/5.0...",
        "inviter_code": "agenciamidas"
      },
      "deposit": {
        "amount": "50.00",
        "first_deposit": true,
        "deposit_count": 0,
        "unique_id": 123456,
        "coupon": "BEMVINDO"
      },
      "event": {
        "event": "DepositMade",
        "event_type": "deposit_made"
      }
    }
  }'
```

### Resposta Esperada

```json
{
  "ok": true,
  "pixels_processed": 1,
  "results": [
    {
      "pixel_id": "1158357622535567",
      "pixel_name": "Pixel Principal",
      "status": 200,
      "data": {
        "events_received": 1,
        "messages": [],
        "fbtrace_id": "..."
      }
    }
  ]
}
```

### Log Esperado

```json
{
  "level": "info",
  "msg": "normalized_nested_payload",
  "original_structure": "data.user.deposit.event",
  "detected_type": "deposit_made"
}
{
  "level": "info",
  "msg": "confirmed_deposit_processed",
  "email": "***",
  "phone": "***",
  "value": 50,
  "is_ftd": true
}
{
  "level": "info",
  "msg": "capi_result",
  "pixel_id": "1158357622535567",
  "pixel_name": "Pixel Principal",
  "event_name": "Purchase",
  "event_id": "...",
  "capi_status": 200,
  "events_received": 1,
  "event_type": "FTD"
}
```

---

## 📊 Campos Mapeados

### Objeto `user`

| Campo Original | Campo Normalizado | Tipo | Notas |
|----------------|-------------------|------|-------|
| `user.name` | `name` | string | Nome completo |
| `user.first_name` | `name` (parte) | string | Combinado com last_name |
| `user.last_name` | `name` (parte) | string | Combinado com first_name |
| `user.email` | `email` | string | Hasheado automaticamente |
| `user.phone` | `phone` | string | Hasheado automaticamente |
| `user.phone_number` | `phone` | string | Alias de `phone` |
| `user.birth_date` | `date_birth` | string | Formato: YYYY-MM-DD |
| `user.id` | `user_id` | number | ID do usuário no sistema |
| `user.fb_id` | `fbp` | string | Meta Pixel Browser ID |
| `user.user_ip` | `ip_address` | string | IP do usuário |
| `user.user_agent` | `user_agent` | string | User Agent |
| `user.inviter_code` | `usernameIndication` | string | Código do indicador |
| `user.utm_source` | `utm_source` | string | Origem UTM |
| `user.utm_medium` | `utm_medium` | string | Meio UTM |
| `user.utm_campaign` | `utm_campaign` | string | Campanha UTM |
| `user.utm_content` | `utm_content` | string | Conteúdo UTM |
| `user.utm_term` | `utm_term` | string | Termo UTM |

### Objeto `deposit`

| Campo Original | Campo Normalizado | Tipo | Notas |
|----------------|-------------------|------|-------|
| `deposit.amount` | `value` | number | Valor do depósito |
| `deposit.first_deposit` | `first_deposit` | boolean | Se é o primeiro depósito |
| `deposit.deposit_count` | `deposit_count` | number | Número de depósitos anteriores |
| `deposit.unique_id` | `custom_data.transaction_id` | string | ID da transação |
| `deposit.coupon` | `custom_data.coupon` | string | Cupom utilizado |
| `deposit.qrcodedata` | `qrCode`, `copiaECola` | string | Dados do QR Code PIX |

### Objeto `event`

| Campo Original | Campo Normalizado | Tipo | Notas |
|----------------|-------------------|------|-------|
| `event.event_type` | `type` | string | Tipo do evento |
| `event.event` | (ignorado) | string | Nome legível do evento |

---

## 🔄 Compatibilidade

### ✅ Formatos Suportados Simultaneamente

O webhook agora suporta **3 formatos** de payload:

#### 1. **Formato Aninhado** (Novo)
```json
{
  "data": {
    "user": {...},
    "deposit": {...},
    "event": {...}
  }
}
```

#### 2. **Formato de Marketing** (Atual)
```json
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "joao@example.com",
  "value": 50.00,
  "first_deposit": true
}
```

#### 3. **Formato Legado** (Meta CAPI Direto)
```json
{
  "event_name": "Purchase",
  "custom_data": {
    "value": 50.00,
    "currency": "BRL"
  },
  "user_data": {
    "email": "joao@example.com"
  }
}
```

Todos os 3 formatos funcionam **simultaneamente** sem conflito.

---

## 🔐 Segurança

### Validação HMAC

O formato aninhado também suporta validação HMAC:

```bash
# Gerar HMAC do payload
SECRET="seu_secret_aqui"
PAYLOAD='{"data":{"user":{...}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# Enviar com header
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

---

## 📝 Notas Importantes

### ✅ Vantagens do Formato Aninhado

- **Organização**: Dados separados logicamente (user, deposit, event)
- **Extensibilidade**: Fácil adicionar novos campos sem conflitos
- **Compatibilidade**: Funciona junto com formatos existentes
- **Automático**: Normalização transparente

### ⚠️ Considerações

1. **Prioridade de Campos**: Se o mesmo campo existir em `data.user.email` e `email`, o de nível superior tem prioridade
2. **Aliases**: `phone` e `phone_number` são equivalentes
3. **Moeda**: Sempre assume `BRL` para depósitos
4. **Evento Padrão**: `deposit_made` é mapeado para `confirmed_deposit` (Purchase/FTD)

---

## 📚 Referências

- [QUICK_START.md](./QUICK_START.md) - Guia de início rápido
- [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) - Exemplos de todos os formatos
- [README.md](./README.md) - Documentação principal

---

## 🎯 Exemplo Completo com Resposta

### Request

```json
POST /webhook HTTP/1.1
Content-Type: application/json

{
  "data": {
    "user": {
      "id": 3247534,
      "name": "SARAH ADRIELE",
      "email": "user@example.com",
      "phone": "75988863498",
      "fb_id": "fb.1.1764706925052.123456789",
      "inviter_code": "agenciamidas"
    },
    "deposit": {
      "amount": "10.00",
      "first_deposit": true,
      "deposit_count": 0,
      "coupon": "BEMVINDO"
    },
    "event": {
      "event_type": "deposit_made"
    }
  }
}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ok": true,
  "pixels_processed": 1,
  "results": [
    {
      "pixel_id": "1158357622535567",
      "pixel_name": "Pixel Principal",
      "status": 200,
      "data": {
        "events_received": 1,
        "fbtrace_id": "AXt7..."
      }
    }
  ]
}
```

### Meta Events Manager

**Evento recebido:**
- **Event**: Purchase
- **Value**: R$ 10,00
- **Custom Data**:
  - `event_type`: FTD
  - `referrer_username`: agenciamidas
  - `coupon`: BEMVINDO
  - `transaction_id`: 3730549

---

<div align="center">

## ✅ Formato Aninhado Totalmente Suportado!

**Seu sistema pode enviar payloads neste formato sem problemas.** 🎉

</div>


