# 🔄 Suporte Multi-Formato de Payloads

## 📋 Visão Geral

O webhook foi projetado para receber **múltiplos formatos de payload de diferentes sistemas** sem conflitos. Cada formato é detectado automaticamente e normalizado para o formato interno esperado.

---

## ✅ Formatos Suportados

### **Formato 1: Agência Midas (Webhook com Tags)**

**Detecção automática:** Possui `tags` (array) e `affiliate`, mas NÃO possui `type` nem `data`

#### Estrutura Original

```json
{
  "tags": ["Registered-customer"],
  "name": "Nome Cliente",
  "cpf": "000.000.000-00",
  "birth_date": "1995-09-11",
  "email": "cliente@email.com",
  "phone": "(99) 99999-9999",
  "affiliate": "codigo-afiliado",
  "registration_date": "2023-11-08 13:00:00",
  "ip_address": "999.999.99.99",
  "user_agent": "Mozilla/5.0..."
}
```

#### Como é Normalizado

```javascript
// Detectado automaticamente como Formato Agência Midas
p.type = "register_new_user"; // Se tags incluir "Registered-customer"
p.date_birth = p.birth_date; // birth_date → date_birth
p.usernameIndication = p.affiliate; // affiliate → usernameIndication

// Campos adicionais vão para custom_data
p.custom_data = {
  cpf: "000.000.000-00",
  registration_date: "2023-11-08 13:00:00",
  tags: "Registered-customer"
}
```

#### Evento Enviado ao Meta

```json
{
  "event_name": "Lead",
  "user_data": {
    "em": "hash_do_email",
    "ph": "hash_do_telefone",
    "fn": "Nome",
    "ln": "Cliente",
    "db": "19950911",
    "client_ip_address": "999.999.99.99",
    "client_user_agent": "Mozilla/5.0..."
  },
  "custom_data": {
    "cpf": "000.000.000-00",
    "registration_date": "2023-11-08 13:00:00",
    "tags": "Registered-customer",
    "referrer_username": "codigo-afiliado"
  }
}
```

---

### **Formato 2: Payload Aninhado (data.user.deposit.event)**

**Detecção automática:** Possui objeto `data` com sub-objetos `user`, `deposit`, `event`

#### Estrutura Original

```json
{
  "data": {
    "user": {
      "id": 3247534,
      "name": "SARAH ADRIELE",
      "email": "user@example.com",
      "phone": "75988863498",
      "fb_id": "fb.1.1764706925052.483983336822458795",
      "inviter_code": "9C06TP2QUS"
    },
    "deposit": {
      "amount": "10.00",
      "first_deposit": true,
      "coupon": "BEMVINDO"
    },
    "event": {
      "event_type": "deposit_made"
    }
  }
}
```

#### Como é Normalizado

```javascript
// Extrair dados de cada objeto
p.type = "confirmed_deposit"; // event.event_type mapeado
p.name = user.name;
p.email = user.email;
p.phone = user.phone;
p.fbp = user.fb_id;
p.usernameIndication = user.inviter_code;
p.value = parseFloat(deposit.amount);
p.first_deposit = deposit.first_deposit;
p.custom_data = {
  coupon: deposit.coupon,
  transaction_id: deposit.unique_id
};
```

---

### **Formato 3: Marketing Padrão (type explícito)**

**Detecção automática:** Possui campo `type` ou `action` no nível raiz

#### Estrutura Original

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "usernameIndication": "agenciamidas"
}
```

#### Como é Processado

Nenhuma normalização necessária - já está no formato esperado. Processado diretamente.

---

### **Formato 4: Meta CAPI Direto (event_name)**

**Detecção automática:** Possui campo `event_name` no nível raiz

#### Estrutura Original

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

#### Como é Processado

Formato legado - processado com hash automático de PII se necessário.

---

## 🔍 Como Funciona a Detecção

### Ordem de Detecção

O webhook verifica os formatos nesta ordem:

```javascript
// 1. Formato Agência Midas (tags + affiliate)
if (Array.isArray(p.tags) && p.affiliate && !p.type && !p.data) {
  // Normalizar formato Agência Midas
}

// 2. Payload Aninhado (data.user.deposit.event)
else if (p.data && typeof p.data === "object") {
  // Normalizar payload aninhado
}

// 3. Formato Marketing ou Meta CAPI Direto
else {
  // Processar formato padrão
}
```

### Prioridade de Campos

Se o mesmo campo existir em múltiplos lugares:

1. **Nível raiz** tem prioridade máxima
2. **Campos normalizados** são usados se raiz estiver vazia
3. **Valores padrão** são aplicados se nenhum estiver presente

---

## 🧪 Testando Cada Formato

### Formato 1: Agência Midas

```bash
node test-agenciamidas-format.js
```

Saída esperada:
```
✅ Webhook processou com sucesso
✅ Detectado como formato Agência Midas
✅ Normalizado para register_new_user
✅ CPF adicionado ao custom_data
✅ Evento enviado ao Meta CAPI
```

### Formato 2: Payload Aninhado

```bash
node test-nested-payload.js
```

Saída esperada:
```
✅ Webhook processou com sucesso
✅ Detectado como payload aninhado
✅ Normalizado para confirmed_deposit
✅ Evento enviado ao Meta CAPI
```

### Formato 3: Marketing Padrão

```bash
node test-payloads.js register_new_user
```

Saída esperada:
```
✅ Webhook processou com sucesso
✅ Formato padrão detectado
✅ Evento enviado ao Meta CAPI
```

---

## 📊 Mapeamento de Campos por Formato

### Campos Comuns (Todos os Formatos)

| Campo Esperado | Formato 1 (Midas) | Formato 2 (Aninhado) | Formato 3 (Padrão) |
|----------------|-------------------|----------------------|---------------------|
| `name` | `name` | `data.user.name` | `name` |
| `email` | `email` | `data.user.email` | `email` |
| `phone` | `phone` | `data.user.phone` | `phone` |
| `date_birth` | `birth_date` | `data.user.birth_date` | `date_birth` |
| `ip_address` | `ip_address` | `data.user.user_ip` | `ip_address` |
| `user_agent` | `user_agent` | `data.user.user_agent` | `user_agent` |

### Campos Específicos do Formato Agência Midas

| Campo Original | Destino | Notas |
|----------------|---------|-------|
| `tags` | `custom_data.tags` | Array convertido para string separada por vírgula |
| `cpf` | `custom_data.cpf` | Preservado como string |
| `affiliate` | `usernameIndication` | Mapeado para rastreamento de indicação |
| `birth_date` | `date_birth` | Normalizado para formato padrão |
| `registration_date` | `custom_data.registration_date` | Preservado no custom_data |

---

## 🚨 Logs de Detecção

### Quando Formato Agência Midas é Detectado

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
  "has_cpf": true,
  "affiliate": "codigo-afiliado"
}
```

### Quando Payload Aninhado é Detectado

```json
{
  "level": "info",
  "msg": "normalized_nested_payload",
  "original_structure": "data.user.deposit.event",
  "detected_type": "deposit_made"
}
```

---

## ⚙️ Adicionando Novo Formato

### Passo 1: Identificar Características Únicas

Exemplo: Novo sistema tem campo `system_id` e `action_type`

### Passo 2: Adicionar Detecção

```javascript
// No index.js, adicionar ANTES dos outros formatos
if (p.system_id && p.action_type && !p.type && !p.data) {
  console.log(JSON.stringify({
    level: "info",
    msg: "detected_new_system_format",
    system_id: p.system_id
  }));
  
  // Normalizar campos
  p.type = mapActionType(p.action_type);
  // ... mais normalizações
}
```

### Passo 3: Criar Teste

```bash
# Criar test-newsystem-format.js
# Testar com payload real
node test-newsystem-format.js
```

### Passo 4: Documentar

Adicionar seção neste documento explicando o novo formato.

---

## 🔐 Segurança

### Validação HMAC

Todos os formatos suportam validação HMAC usando os mesmos headers:

```
X-Signature: sha256=<hash>
X-Hub-Signature-256: sha256=<hash>
X-Webhook-Signature: sha256=<hash>
```

O webhook automaticamente normaliza e valida qualquer um desses headers.

---

## 📝 Boas Práticas

### ✅ DO (Fazer)

1. **Sempre incluir campos obrigatórios**: `email`, `name` (ou equivalentes)
2. **Usar estrutura consistente**: Não misturar formatos no mesmo sistema
3. **Incluir timestamp**: Ajuda na ordenação e debug
4. **Logar no sistema origem**: Facilita troubleshooting

### ❌ DON'T (Não Fazer)

1. **Não inventar novos campos sem necessidade**: Use os campos padrão quando possível
2. **Não enviar dados sensíveis sem hash**: CPF, RG, etc devem ser opcionais
3. **Não assumir ordem de processamento**: Payloads podem chegar fora de ordem
4. **Não depender de campos específicos do Meta**: Use campos genéricos

---

## 🎯 Compatibilidade

### ✅ Garantias

- **Todos os formatos funcionam simultaneamente** sem conflitos
- **Adição de novos formatos não quebra formatos existentes**
- **Campos desconhecidos são ignorados** sem causar erros
- **Validação HMAC funciona para todos os formatos**

### ⚠️ Limitações

- **Campos com mesmo nome em diferentes formatos** podem ter comportamentos ligeiramente diferentes
- **Ordem de detecção importa**: Formatos mais específicos devem vir antes
- **Normalização é unidirecional**: Payload original não é modificado

---

## 📞 Troubleshooting

### Problema: Payload não é detectado corretamente

**Solução:**
1. Verificar logs do servidor para ver qual formato foi detectado
2. Comparar estrutura do payload com os formatos documentados
3. Adicionar logs temporários para debug

### Problema: Campos não estão sendo mapeados

**Solução:**
1. Verificar se o campo existe no payload original
2. Verificar se a lógica de normalização inclui esse campo
3. Adicionar mapeamento específico se necessário

### Problema: Evento enviado ao Meta está incorreto

**Solução:**
1. Verificar logs de `capi_result` para ver o que foi enviado
2. Verificar se o `event_name` foi mapeado corretamente
3. Verificar se `custom_data` e `user_data` estão completos

---

## 📚 Exemplos Completos

### Exemplo 1: Integração Agência Midas

```bash
# Sistema: Plataforma de cadastro da Agência Midas
# Endpoint: POST https://seu-webhook.com/webhook
# Formato: tags + affiliate

curl -X POST https://seu-webhook.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["Registered-customer"],
    "name": "Maria Santos",
    "cpf": "987.654.321-00",
    "birth_date": "1988-03-20",
    "email": "maria@example.com",
    "phone": "(21) 98888-7777",
    "affiliate": "agenciamidas",
    "registration_date": "2024-01-15 14:30:00",
    "ip_address": "191.123.45.67",
    "user_agent": "Mozilla/5.0..."
  }'
```

**Resultado:**
- ✅ Detectado como Formato Agência Midas
- ✅ Normalizado para `register_new_user`
- ✅ Enviado ao Meta como evento `Lead`
- ✅ CPF incluído em `custom_data`

---

## 🎉 Resumo

### O Webhook Suporta:

✅ **4 formatos diferentes simultaneamente**  
✅ **Detecção automática de formato**  
✅ **Normalização transparente**  
✅ **Sem conflitos entre formatos**  
✅ **Fácil adicionar novos formatos**  
✅ **Compatibilidade retroativa garantida**

### Próximos Passos:

1. Testar cada formato individualmente
2. Verificar logs de detecção
3. Validar eventos no Meta Events Manager
4. Adicionar novos formatos conforme necessário

---

<div align="center">

## 🚀 Sistema Multi-Formato Totalmente Operacional!

**O webhook está preparado para receber payloads de múltiplos sistemas sem conflitos.** 🎉

</div>

