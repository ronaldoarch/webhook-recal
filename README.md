## Webhook CAPI (Meta/Facebook)

Node 20 (fetch nativo). Rotas:

- GET `/health`
- GET `/webhook` (challenge Meta opcional via `hub.mode`, `hub.verify_token`, `hub.challenge`)
- POST `/webhook` (webhook principal)
- POST `/webhook/fluxlabs` (webhook específico para eventos do FluxLabs)

### 📋 Novos Payloads de Marketing

Este webhook agora suporta **payloads específicos para eventos de marketing**, permitindo integração com múltiplos clientes. Os eventos são processados automaticamente e enviados para a Meta Conversion API.

**Eventos suportados:**
- 🟢 `register_new_user` → Mapeado para **Lead**
- 🟡 `deposit_generated` → Mapeado para **InitiateCheckout**
- 🔵 `confirmed_deposit` → Mapeado para **Purchase** (FTD ou REDEPOSIT)

**📚 Documentação:**
- 🚀 [QUICK_START.md](./QUICK_START.md) - Guia rápido para começar
- 📖 [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) - Exemplos detalhados dos payloads
- 🎯 [TRACKING_GUIDE.md](./TRACKING_GUIDE.md) - Guia de rastreamento de indicações
- 🔄 [FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md) - Fluxo visual dos dados
- 🔗 [FLUXLABS_INTEGRATION.md](./FLUXLABS_INTEGRATION.md) - Integração com FluxLabs
- 🎯 [MULTIPLE_PIXELS.md](./MULTIPLE_PIXELS.md) - Configuração de múltiplos pixels

**🧪 Script de teste:** Use `node test-payloads.js <tipo-evento>` para testar os payloads rapidamente.

**🎯 Rastreamento de Indicações:**
O webhook processa automaticamente o parâmetro `usernameIndication` (capturado de URLs como `?indication=agenciamidas`) e envia como `custom_data.referrer_username` para o Meta, permitindo rastrear a origem de cada conversão.

**🔗 Integração com FluxLabs:**
O webhook agora suporta receber eventos diretamente do FluxLabs através da rota `/webhook/fluxlabs`. Os eventos são mapeados automaticamente para o formato esperado. Veja [FLUXLABS_INTEGRATION.md](./FLUXLABS_INTEGRATION.md) para mais detalhes.

**🎯 Múltiplos Pixels:**
O webhook suporta múltiplos pixels do Meta simultaneamente. Você pode configurar quais pixels recebem eventos do FluxLabs e quais recebem eventos gerais. Veja [MULTIPLE_PIXELS.md](./MULTIPLE_PIXELS.md) para mais detalhes.

### Variáveis de ambiente

#### Configuração Básica (Pixel Único - Compatibilidade)
- `PORT` (definida pela plataforma)
- `PIXEL_ID` (obrigatória se não usar múltiplos pixels)
- `ACCESS_TOKEN` (obrigatória se não usar múltiplos pixels)
- `PIXEL_NAME` (opcional, nome do pixel)
- `PIXEL_HAS_FLUXLABS` (opcional, "true" se o pixel tem FluxLabs)

#### Configuração de Múltiplos Pixels

**Opção 1: JSON String (Recomendado)**
```bash
PIXELS='[{"id":"123456","token":"abc123","name":"Pixel Principal","has_fluxlabs":true},{"id":"789012","token":"def456","name":"Pixel Secundário","has_fluxlabs":false}]'
```

**Opção 2: Variáveis Individuais**
```bash
PIXEL_ID_1=123456
ACCESS_TOKEN_1=abc123
PIXEL_NAME_1=Pixel Principal
PIXEL_HAS_FLUXLABS_1=true

PIXEL_ID_2=789012
ACCESS_TOKEN_2=def456
PIXEL_NAME_2=Pixel Secundário
PIXEL_HAS_FLUXLABS_2=false
```

#### Outras Variáveis
- `VERIFY_TOKEN` (opcional, para GET /webhook)
- `SHARED_SECRET` (opcional, ativa verificação HMAC do raw body)
- `FLUXLABS_SECRET` (opcional, ativa verificação HMAC para eventos do FluxLabs)
- `REDIS_URL` (opcional, para controle de FTD distribuído)
- `ALLOW_EVENTS` (opcional, filtro de eventos permitidos)
- `DEPOSIT_EVENT_TYPES` (opcional, aliases customizados para eventos de depósito)

### Regras de mapeamento e validação

- `event_name` permitido: `PageView`, `Lead`, `CompleteRegistration`, `Purchase`, `FTD`.
- `FTD` é transformado em `Purchase` e adiciona `custom_data.event_type = "FTD"`.
- `Purchase` (inclusive FTD mapeado): exige `custom_data.value` numérico e `custom_data.currency`.
- `Lead`, `CompleteRegistration`, `PageView`: sem validações rígidas.
- `event_time`: se ausente, `Math.floor(Date.now()/1000)`.
- `event_id`: se ausente, `crypto.randomUUID()`.
- `action_source`: sempre `website`.
- `event_source_url`: enviado apenas se fornecido.
- `fbp/fbc`: extraídos de body (`fbp`/`fbc`), headers (`x-fbp`/`x-fbc`) e cookies (`_fbp`/`_fbc`); se houver `fbclid` no body, `_fbc = fb.1.<epoch>.<fbclid>`.
- `client_ip_address`: `x-forwarded-for` (primeiro IP) ou `req.ip`.
- `client_user_agent`: header `user-agent`.

### Hash automático de PII

- Se vier `user_data.email`/`email` em claro: normaliza (trim+lower) e gera `em` (sha256 hex)
- Se vier `user_data.phone`/`phone` em claro: normaliza (somente dígitos, preserva DDI) e gera `ph` (sha256 hex)
- Se `em`/`ph` já forem hash de 64 hex, são mantidos.
- `external_id` é preservado.

### HMAC opcional

Se `SHARED_SECRET` estiver definido, exigir cabeçalho `X-Hub-Signature-256` ou `X-Signature`/`X-Signature-Hmac` com HMAC-SHA256 do corpo bruto. Formatos aceitos: `sha256=<hex>` ou `<hex>`. Requisições inválidas retornam 401.

### Exemplos de payload

#### 🆕 Novos Payloads de Marketing (Recomendado)

**Registro de novo usuário:**
```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0...",
  "fbp": "fb.1.1700000000.123456789",
  "fbc": "fb.1.1700000000.ABCDEF123",
  "usernameIndication": "user_indicador",
  "utm_source": "google",
  "utm_campaign": "campanha_teste"
}
```

**Depósito gerado (PIX criado):**
```json
{
  "type": "deposit_generated",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "fbp": "fb.1.1700000000.123456789",
  "value": 100.50,
  "qrCode": "00020126360014BR.GOV.BCB.PIX...",
  "copiaECola": "00020126580014BR.GOV.BCB.PIX..."
}
```

**Depósito confirmado (FTD):**
```json
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "fbp": "fb.1.1700000000.123456789",
  "value": 100.50,
  "first_deposit": true,
  "approved_deposits": 1
}
```

---

#### Payloads Legados (ainda suportados)

FTD como Purchase (recomendado):

```json
{
  "event_name": "Purchase",
  "event_source_url": "https://seubet.com/deposito-sucesso",
  "custom_data": {
    "value": 200.0,
    "currency": "BRL",
    "event_type": "FTD",
    "account_id": "user123"
  },
  "user_data": {
    "email": "cliente@email.com",
    "phone": "+55 11 99999-0000",
    "external_id": "uid_123"
  }
}
```

FTD (custom):

```json
{
  "event_name": "FTD",
  "event_source_url": "https://seubet.com/deposito-sucesso",
  "custom_data": {
    "value": 200.0,
    "currency": "BRL",
    "account_id": "user123"
  }
}
```

Lead:

```json
{
  "event_name": "Lead",
  "event_source_url": "https://seubet.com/form-sucesso",
  "user_data": { "email": "lead@dominio.com" }
}
```

CompleteRegistration:

```json
{
  "event_name": "CompleteRegistration",
  "event_source_url": "https://seubet.com/cadastro/sucesso",
  "user_data": { "email": "user@dominio.com" }
}
```

### Testes (Windows CMD, uma linha)

Purchase (FTD):

```cmd
curl -i -X POST https://SEU_DOMINIO/webhook -H "Content-Type: application/json" -d "{\"event_name\":\"Purchase\",\"event_source_url\":\"https://seubet.com/deposito-sucesso\",\"custom_data\":{\"value\":200.00,\"currency\":\"BRL\",\"event_type\":\"FTD\",\"account_id\":\"user123\"},\"user_data\":{\"email\":\"cliente@email.com\",\"phone\":\"+55 11 99999-0000\",\"external_id\":\"uid_123\"}}"
```

Lead:

```cmd
curl -i -X POST https://SEU_DOMINIO/webhook -H "Content-Type: application/json" -d "{\"event_name\":\"Lead\",\"event_source_url\":\"https://seubet.com/form-sucesso\",\"user_data\":{\"email\":\"lead@dominio.com\"}}"
```

### Deploy

- Node 20 LTS
- Build: `npm ci` ou `npm install`
- Start: `npm start`
- Configure envs: `PIXEL_ID`, `ACCESS_TOKEN`, `VERIFY_TOKEN` (opcional), `SHARED_SECRET` (opcional)


