# 🔗 Integração com FluxLabs

Este documento explica como integrar o webhook com o sistema FluxLabs para receber eventos automaticamente.

---

## 📋 Visão Geral

O webhook agora suporta receber eventos diretamente do **FluxLabs** através da rota `/webhook/fluxlabs`. O sistema mapeia automaticamente os eventos do FluxLabs para o formato esperado pelo Meta Conversion API.

---

## 🚀 Como Funciona

### 1. Configuração no FluxLabs

No painel do FluxLabs, configure as URLs de webhook para apontar para:

```
https://seu-dominio.com/webhook/fluxlabs
```

### 2. Eventos Suportados

O webhook detecta e mapeia automaticamente os seguintes tipos de eventos do FluxLabs:

| Evento FluxLabs | Mapeado Para | Evento Meta CAPI |
|----------------|--------------|------------------|
| `register`, `signup`, `user_created`, `cadastro` | `register_new_user` | `Lead` |
| `deposit_generated`, `deposit_created`, `pix_generated` | `deposit_generated` | `InitiateCheckout` ou `Purchase` |
| `deposit_confirmed`, `deposit_paid`, `pix_confirmed` | `confirmed_deposit` | `Purchase` (FTD) |

---

## 📤 Formatos de Payload Aceitos

O webhook é flexível e aceita diferentes formatos de payload do FluxLabs. Os campos são mapeados automaticamente.

### Exemplo 1: Cadastro de Usuário

```json
{
  "type": "user_created",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0...",
  "referrer": "agenciamidas",
  "utm_source": "facebook"
}
```

**Ou usando nomes alternativos:**

```json
{
  "event_type": "register",
  "full_name": "João Silva",
  "user_email": "joao@example.com",
  "telephone": "+5511999999999",
  "birth_date": "1990-05-10",
  "ip": "200.100.50.10",
  "affiliate": "agenciamidas"
}
```

### Exemplo 2: Depósito Gerado

```json
{
  "type": "deposit_created",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "amount": 100.50,
  "qr_code": "00020126360014BR.GOV.BCB.PIX...",
  "copy_paste": "00020126580014BR.GOV.BCB.PIX...",
  "referrer": "agenciamidas"
}
```

**Ou:**

```json
{
  "event": "pix_generated",
  "user_name": "João Silva",
  "user_email": "joao@example.com",
  "deposit_amount": 100.50,
  "qrCode": "00020126360014BR.GOV.BCB.PIX...",
  "affiliate": "agenciamidas"
}
```

### Exemplo 3: Depósito Confirmado

```json
{
  "type": "deposit_paid",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "value": 100.50,
  "is_first_deposit": true,
  "total_deposits": 1,
  "referrer": "agenciamidas"
}
```

**Ou:**

```json
{
  "event_type": "payment_confirmed",
  "full_name": "João Silva",
  "user_email": "joao@example.com",
  "amount": 100.50,
  "first_deposit": true,
  "approved_deposits": 1,
  "indication": "agenciamidas"
}
```

---

## 🔄 Mapeamento Automático de Campos

O webhook mapeia automaticamente os seguintes campos comuns do FluxLabs:

### Nome
- `name` → `name`
- `full_name` → `name`
- `user_name` → `name`

### Email
- `email` → `email`
- `user_email` → `email`

### Telefone
- `phone` → `phone`
- `telephone` → `phone`
- `mobile` → `phone`

### Data de Nascimento
- `date_birth` → `date_birth`
- `birth_date` → `date_birth`
- `date_of_birth` → `date_birth`

### Valor (Depósitos)
- `value` → `value`
- `amount` → `value`
- `deposit_amount` → `value`

### IP Address
- `ip_address` → `ip_address`
- `ip` → `ip_address`
- `client_ip` → `ip_address`

### User Agent
- `user_agent` → `user_agent`
- `userAgent` → `user_agent`

### Indicador/Referrer
- `usernameIndication` → `usernameIndication`
- `referrer` → `usernameIndication`
- `affiliate` → `usernameIndication`
- `indication` → `usernameIndication`

### Primeiro Depósito
- `first_deposit` → `first_deposit`
- `is_first_deposit` → `first_deposit`
- `isFirstDeposit` → `first_deposit`

---

## 🔐 Autenticação

### Opção 1: HMAC-SHA256 (Recomendado)

Configure a variável de ambiente `FLUXLABS_SECRET` no seu servidor:

```bash
FLUXLABS_SECRET=seu_secret_aqui
```

No FluxLabs, configure o header de assinatura:
- **Header:** `X-Signature` ou `X-Hub-Signature-256`
- **Formato:** `sha256=<hash>` ou apenas `<hash>`

### Opção 2: Sem Autenticação

Se não configurar `FLUXLABS_SECRET`, o webhook aceitará requisições sem verificação de assinatura (não recomendado para produção).

---

## 🧪 Testando a Integração

### 1. Teste Básico

```bash
curl -X POST https://seu-dominio.com/webhook/fluxlabs?test=true \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_created",
    "name": "Teste FluxLabs",
    "email": "teste@example.com"
  }'
```

**Resposta esperada:**
```json
{
  "ok": true,
  "test": true,
  "source": "fluxlabs"
}
```

### 2. Teste com Evento Real

```bash
curl -X POST https://seu-dominio.com/webhook/fluxlabs \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<sua_assinatura>" \
  -d '{
    "type": "register",
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "+5511999999999",
    "date_birth": "1990-05-10",
    "ip_address": "200.100.50.10",
    "referrer": "agenciamidas"
  }'
```

**Resposta esperada:**
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
  },
  "source": "fluxlabs"
}
```

---

## 📊 Logs e Monitoramento

O webhook registra logs específicos para eventos do FluxLabs:

### Log de Recebimento
```json
{
  "level": "info",
  "msg": "fluxlabs_event_received",
  "original_type": "user_created",
  "mapped_type": "register_new_user",
  "has_user_data": true
}
```

### Log de Processamento
```json
{
  "level": "info",
  "msg": "fluxlabs_register_new_user_processed",
  "email": "***",
  "phone": "***"
}
```

### Log de Resultado
```json
{
  "level": "info",
  "msg": "fluxlabs_capi_result",
  "event_name": "Lead",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "capi_status": 200,
  "events_received": 1,
  "event_type": null
}
```

---

## ⚙️ Configuração de Múltiplos Pixels

O webhook suporta múltiplos pixels do Meta. Você pode configurar quais pixels têm FluxLabs habilitado.

### Configuração via JSON (Recomendado)

```bash
PIXELS='[
  {
    "id": "123456789",
    "token": "seu_token_aqui",
    "name": "Pixel Principal",
    "has_fluxlabs": true
  },
  {
    "id": "987654321",
    "token": "outro_token_aqui",
    "name": "Pixel Secundário",
    "has_fluxlabs": false
  }
]'
```

### Configuração via Variáveis Individuais

```bash
# Pixel 1 (com FluxLabs)
PIXEL_ID_1=123456789
ACCESS_TOKEN_1=seu_token_aqui
PIXEL_NAME_1=Pixel Principal
PIXEL_HAS_FLUXLABS_1=true

# Pixel 2 (sem FluxLabs)
PIXEL_ID_2=987654321
ACCESS_TOKEN_2=outro_token_aqui
PIXEL_NAME_2=Pixel Secundário
PIXEL_HAS_FLUXLABS_2=false
```

### Como Funciona

- **Rota `/webhook`**: Envia eventos para **todos os pixels** configurados
- **Rota `/webhook/fluxlabs`**: Envia eventos apenas para pixels com `has_fluxlabs: true`

### Especificar Pixels no Payload (Opcional)

Você pode especificar quais pixels receberão o evento:

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "pixel_ids": ["123456789", "987654321"]
}
```

Ou:

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "pixels": ["123456789"]
}
```

---

## 🔧 Configuração no FluxLabs

### Passo 1: Acessar Configurações de Webhook

1. Faça login no painel do FluxLabs
2. Vá em **Configurações** → **Webhooks**
3. Clique em **Adicionar Webhook**

### Passo 2: Configurar URL

**URL do Webhook:**
```
https://seu-dominio.com/webhook/fluxlabs
```

### Passo 3: Selecionar Eventos

Selecione os eventos que deseja receber:
- ✅ Cadastro de usuário
- ✅ Depósito gerado
- ✅ Depósito confirmado
- ✅ Outros eventos (se disponíveis)

### Passo 4: Configurar Autenticação (Opcional)

Se configurou `FLUXLABS_SECRET`, adicione o header de assinatura:
- **Header:** `X-Signature`
- **Valor:** Calcule o HMAC-SHA256 do body com o secret

### Passo 5: Testar

Use o botão "Testar Webhook" no painel do FluxLabs ou envie uma requisição manual.

---

## 🎯 Múltiplas URLs do FluxLabs

O FluxLabs pode fornecer diferentes URLs para diferentes eventos. Todas devem apontar para a mesma rota:

```
# URL para cadastros
https://seu-dominio.com/webhook/fluxlabs

# URL para depósitos
https://seu-dominio.com/webhook/fluxlabs

# URL para pagamentos
https://seu-dominio.com/webhook/fluxlabs
```

O webhook detecta automaticamente o tipo de evento pelo campo `type`, `event_type` ou `event` no payload.

---

## ⚠️ Troubleshooting

### Evento não está sendo processado

**Problema:** O evento é recebido mas não aparece no Meta.

**Soluções:**
1. Verifique os logs do servidor para ver o tipo de evento recebido
2. Verifique se o tipo de evento está sendo mapeado corretamente
3. Verifique se `PIXEL_ID` e `ACCESS_TOKEN` estão configurados
4. Verifique se o evento não está sendo bloqueado por `ALLOW_EVENTS`

### Erro 401 - Unauthorized

**Problema:** Requisição rejeitada por autenticação.

**Soluções:**
1. Verifique se `FLUXLABS_SECRET` está configurado corretamente
2. Verifique se a assinatura HMAC está sendo calculada corretamente
3. Verifique se o header `X-Signature` está sendo enviado

### Evento mapeado incorretamente

**Problema:** O tipo de evento não está sendo reconhecido.

**Soluções:**
1. Verifique o campo `type`, `event_type` ou `event` no payload
2. Adicione logs para ver o payload recebido
3. O webhook tenta mapear automaticamente, mas você pode ajustar a função `mapFluxLabsEvent` se necessário

---

## 📝 Exemplos Completos

### Exemplo 1: Cadastro Completo

```json
{
  "type": "user_created",
  "name": "Maria Santos",
  "email": "maria@example.com",
  "phone": "+5511988888888",
  "date_birth": "1985-03-15",
  "ip_address": "200.100.50.20",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "referrer": "agenciamidas",
  "utm_source": "google",
  "utm_campaign": "campanha_q4",
  "utm_medium": "cpc"
}
```

### Exemplo 2: Depósito com PIX

```json
{
  "type": "deposit_created",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "amount": 250.00,
  "qr_code": "00020126360014BR.GOV.BCB.PIX0114+55119999999995204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***63041D3D",
  "copy_paste": "00020126580014BR.GOV.BCB.PIX...",
  "referrer": "agenciamidas",
  "ip_address": "200.100.50.10"
}
```

### Exemplo 3: Depósito Confirmado (FTD)

```json
{
  "type": "deposit_confirmed",
  "name": "Pedro Costa",
  "email": "pedro@example.com",
  "phone": "+5511977777777",
  "value": 500.00,
  "is_first_deposit": true,
  "approved_deposits": 1,
  "referrer": "agenciamidas",
  "ip_address": "200.100.50.30"
}
```

---

## ✅ Checklist de Integração

- [ ] Variável `FLUXLABS_SECRET` configurada (opcional mas recomendado)
- [ ] URL do webhook configurada no FluxLabs: `https://seu-dominio.com/webhook/fluxlabs`
- [ ] Eventos selecionados no painel do FluxLabs
- [ ] Teste básico realizado com sucesso
- [ ] Eventos aparecendo nos logs do servidor
- [ ] Eventos sendo enviados ao Meta CAPI
- [ ] Eventos visíveis no Meta Events Manager

---

## 🎓 Conclusão

A integração com o FluxLabs está **pronta e funcionando**! 

Basta:
1. ✅ Configurar a URL no FluxLabs
2. ✅ Selecionar os eventos desejados
3. ✅ Testar a integração
4. ✅ Monitorar os logs

**Tudo funciona automaticamente!** 🚀

