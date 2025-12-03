# 🔧 Correção: Evento CompleteRegistration para Agência Midas

## ❌ Problema Identificado

### Comportamento Anterior:
```json
{
  "level": "info",
  "msg": "capi_result",
  "event_name": "PageView",  ❌ ERRADO
  "pixel_id": "1167095248843821"
}
```

**O payload da Agência Midas estava sendo enviado como `PageView` em vez de `CompleteRegistration`.**

---

## ✅ Solução Implementada

### Mudanças no Código:

#### 1. **Event Name Definido Diretamente**

**Antes:**
```javascript
if (p.tags.includes("Registered-customer")) {
  p.type = "register_new_user";
  // ❌ event_name não era definido aqui
}
```

**Depois:**
```javascript
if (p.tags.includes("Registered-customer")) {
  p.type = "register_new_user";
  p.event_name = "CompleteRegistration"; // ✅ Definido diretamente
}
```

#### 2. **User Data Preparado Automaticamente**

Adicionado processamento completo de `user_data` na normalização:

```javascript
// Preparar user_data
p.user_data = p.user_data || {};
if (p.email) p.user_data.email = p.email;
if (p.phone) p.user_data.phone = p.phone;
if (p.name) {
  const nameParts = p.name.trim().split(" ");
  p.user_data.fn = nameParts[0]; // Primeiro nome
  p.user_data.ln = nameParts.slice(1).join(" "); // Sobrenome
}
if (p.date_birth) {
  p.user_data.db = p.date_birth.replace(/-/g, ""); // YYYYMMDD
}
if (p.ip_address) {
  p.user_data.client_ip_address = p.ip_address;
}
if (p.user_agent) {
  p.user_data.client_user_agent = p.user_agent;
}
```

#### 3. **URL de Origem**

```javascript
if (!p.event_source_url) {
  p.event_source_url = "https://topbets.agenciamidas.com/cadastro";
}
```

---

## 🧪 Como Testar

### 1. Reiniciar o Webhook

```bash
npm start
```

### 2. Enviar Teste

Em outro terminal:

```bash
node test-agenciamidas-format.js
```

### 3. Verificar Logs do Servidor

**Logs Esperados:**

```json
{
  "level": "info",
  "msg": "detected_agenciamidas_format",
  "has_tags": true,
  "has_affiliate": true
}
{
  "level": "info",
  "msg": "normalized_agenciamidas_payload",
  "detected_type": "register_new_user",
  "event_name": "CompleteRegistration",  ✅ CORRETO
  "has_cpf": true,
  "affiliate": "agenciamidas",
  "email": "***",
  "phone": "***"
}
{
  "level": "info",
  "msg": "capi_result",
  "pixel_id": "1167095248843821",
  "pixel_name": "Pixel Principal",
  "event_name": "CompleteRegistration",  ✅ CORRETO
  "event_id": "33e796a4-0d9b-404c-ad6e-cec2c9b568dd",
  "capi_status": 200,
  "events_received": 1
}
```

---

## 📊 Comparação: Antes vs Depois

### Payload de Entrada (Mesmo em Ambos)

```json
{
  "tags": ["Registered-customer"],
  "name": "João Silva Santos",
  "cpf": "123.456.789-00",
  "birth_date": "1995-09-11",
  "email": "joao.silva@example.com",
  "phone": "(11) 99999-9999",
  "affiliate": "agenciamidas",
  "registration_date": "2024-01-15 13:00:00",
  "ip_address": "177.123.45.67",
  "user_agent": "Mozilla/5.0..."
}
```

### Evento Enviado ao Meta

#### ❌ ANTES (Incorreto)

```json
{
  "event_name": "PageView",  ❌ ERRADO
  "user_data": {
    // Dados incompletos ou ausentes
  },
  "custom_data": {}
}
```

#### ✅ DEPOIS (Correto)

```json
{
  "event_name": "CompleteRegistration",  ✅ CORRETO
  "event_time": 1733234702,
  "action_source": "website",
  "event_source_url": "https://topbets.agenciamidas.com/cadastro",
  "user_data": {
    "em": "hash_sha256_do_email",
    "ph": "hash_sha256_do_telefone",
    "fn": "João",
    "ln": "Silva Santos",
    "db": "19950911",
    "client_ip_address": "177.123.45.67",
    "client_user_agent": "Mozilla/5.0..."
  },
  "custom_data": {
    "cpf": "123.456.789-00",
    "registration_date": "2024-01-15 13:00:00",
    "tags": "Registered-customer",
    "referrer_username": "agenciamidas"
  }
}
```

---

## 🎯 Eventos do Meta

### CompleteRegistration

**Descrição:** Evento disparado quando alguém completa um formulário de cadastro.

**Quando usar:**
- ✅ Cadastro de novo usuário
- ✅ Registro completo na plataforma
- ✅ Formulário de inscrição finalizado

**Por que usar CompleteRegistration em vez de Lead:**
- ✅ **Mais específico**: Lead pode ser qualquer ação inicial, CompleteRegistration é a conclusão
- ✅ **Melhor para otimização**: Meta consegue otimizar melhor para cadastros completos
- ✅ **Maior qualidade**: Indica uma ação mais valiosa do que apenas um lead

---

## 📋 Checklist de Validação

Após implementar a correção:

- [ ] Webhook reiniciado
- [ ] Teste executado com `node test-agenciamidas-format.js`
- [ ] Logs mostram `"event_name":"CompleteRegistration"`
- [ ] Logs mostram `"detected_agenciamidas_format"`
- [ ] Logs mostram `"normalized_agenciamidas_payload"`
- [ ] `capi_status: 200` (sucesso)
- [ ] Verificado no Meta Events Manager que evento é `CompleteRegistration`

---

## 🔍 Troubleshooting

### Problema: Ainda está enviando PageView

**Soluções:**

1. **Verificar se o webhook foi reiniciado**
   ```bash
   # Parar o processo atual (Ctrl+C)
   # Iniciar novamente
   npm start
   ```

2. **Verificar se o payload tem as tags corretas**
   ```json
   {
     "tags": ["Registered-customer"]  // Deve incluir essa tag
   }
   ```

3. **Verificar logs de detecção**
   - Deve aparecer: `"detected_agenciamidas_format"`
   - Se não aparecer, o formato não está sendo detectado

### Problema: Evento não chega ao Meta

**Soluções:**

1. **Verificar PIXEL_ID e ACCESS_TOKEN**
   ```bash
   # No arquivo .env
   PIXEL_ID=1167095248843821
   ACCESS_TOKEN=seu_token_aqui
   ```

2. **Verificar capi_status nos logs**
   - `200` = Sucesso
   - `400` = Erro no payload
   - `401` = Token inválido

3. **Verificar no Meta Events Manager → Test Events**
   - Eventos devem aparecer em tempo real

---

## 🎉 Resultado Final

### No Meta Events Manager

Agora você verá:

```
📊 Evento Recebido
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Event Name:     CompleteRegistration  ✅
Event Time:     2024-12-03 13:45:02
Event Source:   https://topbets.agenciamidas.com/cadastro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 User Data (Hashed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:          hash_sha256...
Phone:          hash_sha256...
First Name:     João
Last Name:      Silva Santos
Birth Date:     19950911
IP Address:     177.123.45.67
User Agent:     Mozilla/5.0...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Custom Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CPF:                    123.456.789-00
Registration Date:      2024-01-15 13:00:00
Tags:                   Registered-customer
Referrer Username:      agenciamidas
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📚 Arquivos Relacionados

- **[index.js](./index.js)** - Código principal com a correção
- **[test-agenciamidas-format.js](./test-agenciamidas-format.js)** - Script de teste
- **[MULTI_FORMAT_SUPPORT.md](./MULTI_FORMAT_SUPPORT.md)** - Documentação multi-formato

---

<div align="center">

## ✅ Correção Implementada com Sucesso!

**O webhook agora envia corretamente `CompleteRegistration` para cadastros da Agência Midas!** 🎉

</div>

