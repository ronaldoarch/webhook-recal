# 🎯 Exemplo Prático — Agência Midas

Este documento mostra um exemplo real de uso do webhook com o link configurado pelo Lucas.

---

## 📋 Contexto

**Mensagem do Lucas:**
> "Bom dia, criei o link de divulgação para vocês usarem nas campanhas para conseguirmos ter mais precisão nas métricas: https://bichomania.com/cadastrar?indication=agenciamidas"

> "Assim poderão filtrar pelo parâmetro usernameIndication no payload do webhook"

> "Caso for divulgar outra página, basta manter o parâmetro '?indication=agenciamidas' no final da url"

---

## 🔗 Links de Divulgação

### Links Configurados

```bash
# Página de cadastro (principal)
https://bichomania.com/cadastrar?indication=agenciamidas

# Outras páginas (exemplos)
https://bichomania.com?indication=agenciamidas
https://bichomania.com/promocao?indication=agenciamidas
https://bichomania.com/bonus?indication=agenciamidas
```

### Com Parâmetros UTM

```bash
# Facebook Ads
https://bichomania.com/cadastrar?utm_source=facebook&utm_campaign=conversao_q4&indication=agenciamidas

# Google Ads
https://bichomania.com/cadastrar?utm_source=google&utm_campaign=conversao_q4&indication=agenciamidas

# Instagram Bio
https://bichomania.com/cadastrar?utm_source=instagram&utm_medium=bio&indication=agenciamidas
```

---

## 📊 Jornada Real do Usuário

### Passo 1: Usuário clica no link

```
URL divulgada pela Agência Midas:
https://bichomania.com/cadastrar?indication=agenciamidas
```

### Passo 2: Sistema captura o parâmetro

```javascript
// O site bichomania.com captura automaticamente
const urlParams = new URLSearchParams(window.location.search);
const indication = urlParams.get('indication');
// indication = "agenciamidas"
```

### Passo 3: Usuário preenche cadastro

```
Nome: João Silva
Email: joao@gmail.com
Telefone: (11) 99999-9999
```

### Passo 4: Sistema envia evento ao webhook

```json
POST https://seu-webhook.com/webhook
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@gmail.com",
  "phone": "+5511999999999",
  "date_birth": "1990-05-10",
  "ip_address": "200.100.50.10",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "fbp": "fb.1.1730825000.123456789",
  "fbc": "fb.1.1730825000.ABCDEF123",
  "usernameIndication": "agenciamidas",  ← CAPTURADO DA URL
  "utm_source": "facebook",
  "utm_campaign": "conversao_q4"
}
```

### Passo 5: Webhook processa e envia ao Meta

```json
POST https://graph.facebook.com/v18.0/{PIXEL_ID}/events
{
  "data": [{
    "event_name": "Lead",
    "event_time": 1730825000,
    "action_source": "website",
    "event_source_url": "https://bichomania.com/cadastro",
    "user_data": {
      "em": "hash_do_email...",
      "ph": "hash_do_telefone...",
      "fbp": "fb.1.1730825000.123456789",
      "fbc": "fb.1.1730825000.ABCDEF123"
    },
    "custom_data": {
      "referrer_username": "agenciamidas",  ← RASTREÁVEL NO META!
      "utm_source": "facebook",
      "utm_campaign": "conversao_q4"
    }
  }]
}
```

---

## 🧪 Testar Localmente

### Opção 1: Script de Teste

```bash
# O script já está configurado com "agenciamidas"
node test-payloads.js register_new_user
```

Saída esperada:
```
🚀 Enviando payload do tipo: register_new_user
📍 URL: http://localhost:3000/webhook
🔐 Secret: ***

📦 Payload:
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao.silva@example.com",
  "phone": "+5511999999999",
  "usernameIndication": "agenciamidas",
  "utm_source": "google",
  "utm_campaign": "campanha_teste"
}

✅ Resposta recebida (Status: 200)
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "capi_status": 200,
  "events_received": 1
}

✅ Sucesso!
```

### Opção 2: cURL Manual

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "register_new_user",
    "name": "João Silva",
    "email": "joao@gmail.com",
    "phone": "+5511999999999",
    "date_birth": "1990-05-10",
    "usernameIndication": "agenciamidas",
    "fbp": "fb.1.1730825000.123456789"
  }'
```

---

## 📈 Analisando no Meta Events Manager

### Passo 1: Acessar Events Manager

```
1. Ir para: https://business.facebook.com/events_manager
2. Selecionar o Pixel correto
3. Clicar em "Test Events"
```

### Passo 2: Buscar Eventos

```
Filtros:
- Event Name: Lead
- Time Range: Last 24 hours
```

### Passo 3: Ver Detalhes do Evento

```json
Event Details:
{
  "event_name": "Lead",
  "event_time": "2024-11-05 10:30:00",
  "user_data": {
    "em": "a1b2c3...",
    "ph": "d4e5f6...",
    "fbp": "fb.1.1730825000.123456789",
    "fbc": "fb.1.1730825000.ABCDEF123"
  },
  "custom_data": {
    "referrer_username": "agenciamidas",  ← AQUI ESTÁ!
    "utm_source": "facebook",
    "utm_campaign": "conversao_q4"
  }
}
```

### Passo 4: Criar Relatório Customizado

```
1. Events Manager → Aggregate Event Measurement
2. Criar filtro: custom_data.referrer_username = "agenciamidas"
3. Ver métricas:
   - Total de Leads
   - Total de Purchases (FTD)
   - Valor total (R$)
   - Taxa de conversão
```

---

## 📊 Exemplo de Relatório

### Dados do Dia

```
Data: 05/11/2024
Indicador: agenciamidas

┌─────────────────────────────────────────┐
│ LEADS                                    │
├─────────────────────────────────────────┤
│ Total de cadastros: 45                   │
│ Horário pico: 14h-16h (12 cadastros)    │
│ Origem principal: Facebook (30)         │
│ Origem secundária: Google (15)          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ DEPÓSITOS GERADOS                        │
├─────────────────────────────────────────┤
│ PIX criados: 18                          │
│ Valor médio: R$ 125,50                   │
│ Valor total: R$ 2.259,00                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ FTDs (First Time Deposits)               │
├─────────────────────────────────────────┤
│ Depósitos confirmados: 12                │
│ Taxa de conversão: 26,7% (12/45)         │
│ Valor total: R$ 1.450,00                 │
│ Ticket médio: R$ 120,83                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ROI                                      │
├─────────────────────────────────────────┤
│ Investimento em ads: R$ 500,00           │
│ Receita (FTDs): R$ 1.450,00              │
│ ROI: 190% (lucro de R$ 950,00)           │
└─────────────────────────────────────────┘
```

---

## 🎯 Diferentes Indicadores (Múltiplas Fontes)

### Cenário: Agência testa diferentes canais

```bash
# Canal: Facebook Ads
https://bichomania.com/cadastrar?indication=agenciamidas_fb

# Canal: Google Ads
https://bichomania.com/cadastrar?indication=agenciamidas_google

# Canal: Instagram Stories
https://bichomania.com/cadastrar?indication=agenciamidas_ig

# Canal: TikTok Ads
https://bichomania.com/cadastrar?indication=agenciamidas_tiktok
```

### Resultado no Meta

```
Filtrar por referrer_username:
- agenciamidas_fb: 30 Leads → 12 FTDs (40%)
- agenciamidas_google: 20 Leads → 8 FTDs (40%)
- agenciamidas_ig: 15 Leads → 4 FTDs (26%)
- agenciamidas_tiktok: 10 Leads → 2 FTDs (20%)

Conclusão: Facebook e Google têm melhor conversão!
```

---

## 📝 Logs do Webhook

### Evento: Register New User

```json
{
  "level": "info",
  "msg": "register_new_user_processed",
  "email": "***",
  "phone": "***",
  "timestamp": "2024-11-05T10:30:00.000Z"
}

{
  "level": "info",
  "msg": "capi_result",
  "event_name": "Lead",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "capi_status": 200,
  "events_received": 1,
  "event_type": null
}
```

### Evento: Deposit Generated

```json
{
  "level": "info",
  "msg": "deposit_generated_processed",
  "value": 100.5,
  "timestamp": "2024-11-05T10:35:00.000Z"
}

{
  "level": "info",
  "msg": "capi_result",
  "event_name": "InitiateCheckout",
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "capi_status": 200,
  "events_received": 1,
  "event_type": null
}
```

### Evento: Confirmed Deposit (FTD)

```json
{
  "level": "info",
  "msg": "confirmed_deposit_processed",
  "value": 100.5,
  "event_type": "FTD",
  "approved_deposits": 1,
  "timestamp": "2024-11-05T10:37:00.000Z"
}

{
  "level": "info",
  "msg": "capi_result",
  "event_name": "Purchase",
  "event_id": "550e8400-e29b-41d4-a716-446655440002",
  "capi_status": 200,
  "events_received": 1,
  "event_type": "FTD"
}
```

---

## ✅ Checklist de Implementação

### Para o Sistema BiChoMania

- [x] Capturar parâmetro `indication` da URL
- [x] Preservar durante a jornada do usuário
- [x] Incluir como `usernameIndication` nos payloads
- [x] Enviar em todos os 3 eventos:
  - [x] register_new_user
  - [x] deposit_generated
  - [x] confirmed_deposit

### Para o Webhook

- [x] Receber campo `usernameIndication`
- [x] Processar e transformar em `custom_data.referrer_username`
- [x] Enviar ao Meta CAPI
- [x] Registrar nos logs

### Para a Agência Midas

- [x] Link configurado: `?indication=agenciamidas`
- [x] Usar em todas as campanhas
- [x] Monitorar eventos no Meta Events Manager
- [x] Analisar performance
- [x] Otimizar investimento

---

## 🔍 Verificação Rápida

### 1. Testar Link

```bash
# Abrir no navegador
https://bichomania.com/cadastrar?indication=agenciamidas

# Verificar se parâmetro aparece na URL
✅ Aparece? Pode continuar!
```

### 2. Testar Webhook

```bash
# Enviar evento de teste
node test-payloads.js register_new_user

# Verificar resposta
✅ Status 200? Sucesso!
✅ events_received: 1? Perfeito!
```

### 3. Verificar no Meta

```bash
# Meta Events Manager → Test Events
# Buscar evento recente
# Verificar custom_data

✅ referrer_username: "agenciamidas"? Funcionando!
```

---

## 💡 Dicas para Agência Midas

### 1. Criar Links Específicos

```bash
# Por campanha
?indication=agenciamidas_black_friday
?indication=agenciamidas_natal
?indication=agenciamidas_ano_novo

# Por criativo
?indication=agenciamidas_video_01
?indication=agenciamidas_carousel_02
?indication=agenciamidas_stories_03
```

### 2. Combinar com UTM

```bash
# Rastreamento completo
?utm_source=facebook
&utm_campaign=conversao_q4
&utm_medium=cpc
&utm_content=criativo_a
&indication=agenciamidas
```

### 3. Documentar Links

```
Manter planilha:
- Data de criação
- Canal (Facebook, Google, etc)
- Campanha
- Link completo
- Performance (atualizar semanalmente)
```

### 4. Analisar Semanalmente

```
Toda segunda-feira:
1. Acessar Meta Events Manager
2. Filtrar por referrer_username
3. Exportar dados
4. Comparar com semana anterior
5. Otimizar budget
```

---

## 🎓 Resumo

### O que o Lucas configurou:

✅ Link: `https://bichomania.com/cadastrar?indication=agenciamidas`
✅ Parâmetro `indication` é capturado automaticamente
✅ Enviado ao webhook como `usernameIndication`

### O que o webhook faz:

✅ Recebe o campo `usernameIndication`
✅ Processa e transforma em `custom_data.referrer_username`
✅ Envia ao Meta CAPI
✅ Disponível para análise no Events Manager

### Resultado:

✅ **Rastreamento completo de todos os eventos da Agência Midas!**
✅ **Possível filtrar e analisar performance separadamente!**
✅ **ROI calculado com precisão!**

---

## 🚀 Próximos Passos

1. ✅ Sistema BiChoMania já está capturando `indication`
2. ✅ Webhook já está processando `usernameIndication`
3. ✅ Dados já estão indo para o Meta
4. 🎯 **Próximo passo:** Criar campanhas e monitorar resultados!

---

**Tudo está pronto e funcionando! 🎉**

O webhook está **100% preparado** para processar o link configurado pelo Lucas.

