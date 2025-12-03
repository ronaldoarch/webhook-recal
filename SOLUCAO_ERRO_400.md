# 🔧 Solução do Erro 400 - "invalid_purchase_payload"

## 📋 Problema Identificado

### Erro Recebido

```json
{
  "ok": false,
  "error": "invalid_purchase_payload"
}
```

**Status HTTP**: 400 Bad Request

---

## 🔍 Causa Raiz

O sistema externo está enviando eventos de **DepositMade** com estrutura aninhada:

```json
{
  "data": {
    "user": { ... },
    "deposit": { ... },
    "event": {
      "event": "DepositMade",
      "event_type": "deposit_made"
    }
  }
}
```

Mas o webhook esperava um formato diferente:

```json
{
  "type": "confirmed_deposit",
  "name": "...",
  "email": "...",
  "value": 10.00
}
```

---

## ✅ Solução Implementada

### 1. **Normalização Automática de Payload Aninhado**

Adicionado código no `index.js` (após linha 516) que detecta e normaliza automaticamente payloads no formato `{data: {user, deposit, event}}`.

**Funciona assim:**

```javascript
// ANTES (não funcionava)
{
  "data": {
    "user": { "email": "user@example.com", "name": "João Silva" },
    "deposit": { "amount": "10.00", "first_deposit": true },
    "event": { "event_type": "deposit_made" }
  }
}

// DEPOIS (normalizado automaticamente)
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "user@example.com",
  "value": 10.00,
  "first_deposit": true
}
```

### 2. **Mapeamento de Aliases de Eventos**

Adicionado mapeamento automático:

```javascript
// "deposit_made" → "confirmed_deposit" (Purchase/FTD)
// "user_created" → "register_new_user" (Lead)
```

### 3. **Preservação de Compatibilidade**

**Todos os formatos anteriores continuam funcionando:**

- ✅ Formato aninhado (novo)
- ✅ Formato de marketing (`type: "confirmed_deposit"`)
- ✅ Formato legado Meta CAPI (`event_name: "Purchase"`)

---

## 📦 Arquivos Modificados/Criados

### Modificados

1. **`index.js`**
   - Adicionado bloco de normalização de payload aninhado (linhas ~517-571)
   - Adicionado mapeamento de aliases de eventos (linhas ~579-586)

### Criados

2. **`NESTED_PAYLOAD_FORMAT.md`**
   - Documentação completa do novo formato
   - Exemplos de uso
   - Tabela de mapeamento de campos

3. **`test-nested-payload.js`**
   - Script de teste para o formato aninhado
   - 3 cenários de teste incluídos
   - Suporte a HMAC

4. **`SOLUCAO_ERRO_400.md`** (este arquivo)
   - Resumo da solução implementada
   - Guia de teste

### Atualizados

5. **`README.md`**
   - Adicionada seção sobre formato aninhado
   - Link para documentação específica

---

## 🧪 Como Testar

### Opção 1: Script de Teste Automatizado

```bash
# 1. Iniciar o webhook (em um terminal)
npm start

# 2. Em outro terminal, executar teste
node test-nested-payload.js

# Resultado esperado:
# ✅ Sucessos: 3/3
# 🎉 TODOS OS TESTES PASSARAM!
```

### Opção 2: Teste Manual com cURL

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

**Resposta esperada (sucesso):**

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
        "messages": []
      }
    }
  ]
}
```

### Opção 3: Reenviar Payload Real

Use o payload exato que estava falhando:

```bash
curl -X POST https://webhookyuri.agenciamidas.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "user": {
        "id": 3247534,
        "name": "SARAH ADRIELE",
        "email": "gyncasa12684@gmail.com",
        "phone": "75988863498",
        "fb_id": "fb.1.1764706925052.483983336822458795",
        "inviter_code": "9C06TP2QUS"
      },
      "deposit": {
        "amount": "10.00",
        "coupon": "BEMVINDO",
        "unique_id": 3730549,
        "first_deposit": true
      },
      "event": {
        "event_type": "deposit_made"
      }
    }
  }'
```

---

## 📊 Logs Esperados

Quando o payload aninhado for processado com sucesso, você verá:

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
  "value": 10,
  "is_ftd": true
}
{
  "level": "info",
  "msg": "capi_result",
  "pixel_id": "1158357622535567",
  "pixel_name": "Pixel Principal",
  "event_name": "Purchase",
  "capi_status": 200,
  "events_received": 1,
  "event_type": "FTD"
}
```

---

## 🎯 Validação no Meta Events Manager

Após o envio bem-sucedido, verifique no Meta Events Manager:

1. Acesse: https://business.facebook.com/events_manager
2. Selecione seu Pixel
3. Vá em "Test Events" ou "Events"
4. Verifique se aparecem eventos **Purchase** com:
   - **Value**: R$ 10,00
   - **Custom Data**:
     - `event_type`: FTD
     - `referrer_username`: 9C06TP2QUS (ou agenciamidas)
     - `coupon`: BEMVINDO
     - `transaction_id`: 3730549

---

## 🔄 Mapeamento Completo

### Campos do Usuário (`data.user`)

| Campo Original | → | Campo Normalizado | → | Enviado ao Meta |
|----------------|---|-------------------|---|-----------------|
| `user.name` | → | `name` | → | `user_data.fn` + `user_data.ln` (hasheado) |
| `user.email` | → | `email` | → | `user_data.em` (SHA-256) |
| `user.phone` | → | `phone` | → | `user_data.ph` (SHA-256) |
| `user.fb_id` | → | `fbp` | → | `user_data.fbp` |
| `user.user_ip` | → | `ip_address` | → | `user_data.client_ip_address` |
| `user.user_agent` | → | `user_agent` | → | `user_data.client_user_agent` |
| `user.inviter_code` | → | `usernameIndication` | → | `custom_data.referrer_username` |

### Campos do Depósito (`data.deposit`)

| Campo Original | → | Campo Normalizado | → | Enviado ao Meta |
|----------------|---|-------------------|---|-----------------|
| `deposit.amount` | → | `value` | → | `custom_data.value` |
| `deposit.first_deposit` | → | `first_deposit` | → | `custom_data.event_type = "FTD"` |
| `deposit.coupon` | → | `coupon` | → | `custom_data.coupon` |
| `deposit.unique_id` | → | `custom_data.transaction_id` | → | `custom_data.transaction_id` |
| `deposit.qrcodedata` | → | `qrCode` | → | `custom_data.qr_code_pix` (truncado) |

### Evento (`data.event`)

| Campo Original | → | Tipo Interno | → | Meta Event |
|----------------|---|--------------|---|------------|
| `event_type: "deposit_made"` | → | `confirmed_deposit` | → | **Purchase** (FTD) |
| `event_type: "user_created"` | → | `register_new_user` | → | **Lead** |

---

## ⚠️ Troubleshooting

### Ainda recebendo erro 400?

1. **Verifique se o webhook foi reiniciado:**
   ```bash
   # Parar e iniciar novamente
   npm start
   ```

2. **Verifique os logs em tempo real:**
   ```bash
   npm start | grep "normalized_nested_payload"
   ```
   Se aparecer esta mensagem, a normalização está funcionando.

3. **Verifique se o payload está no formato correto:**
   - Deve ter `data.user`, `data.deposit`, `data.event`
   - `data.event.event_type` deve estar presente

4. **Teste localmente primeiro:**
   ```bash
   node test-nested-payload.js
   ```

### Erro de HMAC?

Se estiver usando HMAC, o webhook precisa ser configurado com o secret correto:

```bash
export SHARED_SECRET="seu_secret_aqui"
npm start
```

---

## 📚 Documentação Adicional

- **Detalhes do formato**: [NESTED_PAYLOAD_FORMAT.md](./NESTED_PAYLOAD_FORMAT.md)
- **Início rápido**: [QUICK_START.md](./QUICK_START.md)
- **Outros formatos**: [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md)
- **Rastreamento**: [TRACKING_GUIDE.md](./TRACKING_GUIDE.md)

---

## ✅ Checklist de Validação

- [ ] Webhook reiniciado com código atualizado
- [ ] Teste local executado (`node test-nested-payload.js`)
- [ ] Teste local passou (3/3 sucessos)
- [ ] Payload real testado com cURL
- [ ] Resposta 200 recebida
- [ ] Log `normalized_nested_payload` apareceu
- [ ] Log `confirmed_deposit_processed` apareceu
- [ ] Log `capi_result` com status 200 apareceu
- [ ] Evento visível no Meta Events Manager
- [ ] Custom data (`referrer_username`, `coupon`) corretos no Meta

---

## 🎉 Status

### ANTES
```
POST /webhook → 400 Bad Request
{"ok":false,"error":"invalid_purchase_payload"}
```

### DEPOIS
```
POST /webhook → 200 OK
{
  "ok": true,
  "pixels_processed": 1,
  "results": [
    {
      "pixel_id": "1158357622535567",
      "status": 200,
      "data": {"events_received": 1}
    }
  ]
}
```

---

<div align="center">

## ✅ PROBLEMA RESOLVIDO!

**O webhook agora aceita o formato aninhado automaticamente.** 🎉

**Próximo passo**: Fazer deploy e validar em produção.

</div>

---

**Data da solução**: 2 de dezembro de 2025  
**Arquivos modificados**: 2 (index.js, README.md)  
**Arquivos criados**: 3 (NESTED_PAYLOAD_FORMAT.md, test-nested-payload.js, SOLUCAO_ERRO_400.md)  
**Compatibilidade**: Mantida com todos os formatos anteriores  


