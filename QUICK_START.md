# 🚀 Guia Rápido — Webhook de Marketing

Este guia mostra como começar a usar o webhook rapidamente.

---

## ⚡ Início Rápido

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env`:

```env
PORT=3000
PIXEL_ID=seu_pixel_id
ACCESS_TOKEN=seu_access_token
SHARED_SECRET=seu_secret_para_hmac
```

### 3. Iniciar o servidor

```bash
npm start
```

O webhook estará disponível em `http://localhost:3000/webhook`

---

## 🧪 Testar Rapidamente

### Opção 1: Script de Teste (Recomendado)

```bash
# Testar registro de usuário
node test-payloads.js register_new_user

# Testar depósito gerado
node test-payloads.js deposit_generated

# Testar depósito confirmado (FTD)
node test-payloads.js confirmed_deposit_ftd

# Testar todos os eventos
node test-payloads.js all
```

### Opção 2: cURL Manual

```bash
# Registro de usuário
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "register_new_user",
    "name": "João Silva",
    "email": "joao.silva@example.com",
    "phone": "+5511999999999",
    "date_birth": "1990-05-10",
    "fbp": "fb.1.1700000000.123456789"
  }'

# Depósito confirmado (FTD)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "confirmed_deposit",
    "name": "João Silva",
    "email": "joao.silva@example.com",
    "phone": "+5511999999999",
    "fbp": "fb.1.1700000000.123456789",
    "value": 100.50,
    "first_deposit": true,
    "approved_deposits": 1
  }'
```

---

## 📋 Eventos Disponíveis

| Tipo do Evento            | Descrição                        | Evento no Meta  |
| ------------------------- | -------------------------------- | --------------- |
| `register_new_user`       | Novo usuário registrado          | Lead            |
| `deposit_generated`       | PIX gerado (aguardando pagamento)| InitiateCheckout|
| `confirmed_deposit` (FTD) | Primeiro depósito confirmado     | Purchase (FTD)  |

---

## 🔍 Ver Logs

O servidor registra todos os eventos processados:

```bash
# Durante o desenvolvimento
npm start

# Você verá logs como:
# {"level":"info","msg":"register_new_user_processed","email":"***","phone":"***"}
# {"level":"info","msg":"confirmed_deposit_processed","value":100.5,"event_type":"FTD"}
```

---

## 📖 Documentação Completa

- [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) - Exemplos detalhados de todos os payloads
- [README.md](./README.md) - Documentação completa do webhook

---

## 🔐 Segurança (HMAC)

### Gerar Assinatura (Node.js)

```javascript
const crypto = require('crypto');

const payload = JSON.stringify({
  type: "register_new_user",
  name: "João Silva",
  email: "joao@example.com"
});

const secret = "seu_shared_secret";
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log(`X-Signature: sha256=${signature}`);
```

### Enviar com Assinatura

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=sua_assinatura_aqui" \
  -d '{"type":"register_new_user","name":"João Silva"}'
```

---

## ❓ Problemas Comuns

### Erro: Missing PIXEL_ID and/or ACCESS_TOKEN

**Solução:** Configure as variáveis de ambiente `PIXEL_ID` e `ACCESS_TOKEN` no arquivo `.env`

### Erro: 401 Unauthorized (invalid_signature)

**Solução:** Verifique se a assinatura HMAC está correta ou remova `SHARED_SECRET` do `.env` para desabilitar a validação

### Evento Ignorado: redeposit_ignored

**Informação:** Por padrão, redepósitos são ignorados. Apenas FTDs (first_deposit=true) são enviados ao Meta

---

## 🔧 Configurações Avançadas

### Variáveis de Ambiente Opcionais

```env
# Controle de FTD com Redis (opcional)
REDIS_URL=redis://localhost:6379

# Filtrar eventos permitidos (opcional)
ALLOW_EVENTS=Lead,Purchase,InitiateCheckout

# Aliases customizados para eventos de depósito (opcional)
DEPOSIT_EVENT_TYPES=deposit_made,payment_confirmed,pix_paid
```

---

## 📊 Monitoramento

### Health Check

```bash
curl http://localhost:3000/health
```

Resposta:
```json
{
  "ok": true,
  "ts": 1730825000000
}
```

### Verificar Conexão com Meta

```bash
# Enviar evento de teste
node test-payloads.js test
```

---

## 🚢 Deploy em Produção

### Render / Railway / Fly.io

1. Faça push do código para um repositório Git
2. Configure as variáveis de ambiente no painel
3. O servidor iniciará automaticamente com `npm start`

### Docker

```bash
docker build -t webhook-recal .
docker run -p 3000:3000 \
  -e PIXEL_ID=seu_pixel_id \
  -e ACCESS_TOKEN=seu_token \
  webhook-recal
```

---

## 💡 Dicas

1. ✅ Use `test-payloads.js` para testar rapidamente durante o desenvolvimento
2. ✅ Sempre inclua `fbp` e `fbc` nos payloads para melhor atribuição
3. ✅ Configure `SHARED_SECRET` em produção para segurança
4. ✅ Use Redis (`REDIS_URL`) em produção para controle distribuído de FTD
5. ✅ Monitore os logs para verificar o processamento dos eventos

---

## 🆘 Suporte

Para mais informações:
- Veja a [documentação completa](./README.md)
- Veja os [exemplos de payloads](./PAYLOAD_EXAMPLES.md)
- Execute `node test-payloads.js --help` para ajuda do script de teste

