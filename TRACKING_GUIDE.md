# 🎯 Guia de Rastreamento e Indicações

Este documento explica como usar o rastreamento de indicações e parâmetros UTM no webhook.

---

## 📍 Rastreamento de Indicações

### Como Funciona

1. **Link de Divulgação**
   ```
   https://bichomania.com/cadastrar?indication=agenciamidas
   ```

2. **Sistema Captura o Parâmetro**
   - O parâmetro `indication` é capturado pelo sistema
   - É transformado em `usernameIndication` no payload do webhook

3. **Webhook Processa**
   - Campo `usernameIndication` é enviado em todos os eventos
   - É armazenado como `referrer_username` no `custom_data`
   - Enviado para o Meta CAPI para análise

### Exemplo Prático

**URL divulgada:**
```
https://bichomania.com/cadastrar?indication=agenciamidas
```

**Payload enviado ao webhook:**
```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "usernameIndication": "agenciamidas",  ← Capturado da URL
  "utm_source": "facebook",
  "utm_campaign": "conversao_q4"
}
```

**Dados enviados ao Meta:**
```json
{
  "event_name": "Lead",
  "custom_data": {
    "referrer_username": "agenciamidas",  ← Rastreável no Meta
    "utm_source": "facebook",
    "utm_campaign": "conversao_q4"
  }
}
```

---

## 🔗 Usando em Diferentes Páginas

Você pode usar o parâmetro `indication` em **qualquer página** do site:

### Exemplos:

```
# Página de cadastro
https://bichomania.com/cadastrar?indication=agenciamidas

# Página inicial
https://bichomania.com?indication=agenciamidas

# Página de promoção
https://bichomania.com/promocao?indication=agenciamidas

# Página de depósito
https://bichomania.com/deposito?indication=agenciamidas

# Com outros parâmetros UTM
https://bichomania.com/cadastrar?utm_source=facebook&utm_campaign=q4&indication=agenciamidas
```

### ⚠️ Importante

- Sempre mantenha `?indication=agenciamidas` no final da URL (ou use `&` se já houver outros parâmetros)
- O sistema deve capturar esse parâmetro e incluir no payload do webhook como `usernameIndication`

---

## 📊 Rastreamento por Evento

O `usernameIndication` é processado em **todos os eventos**:

### 1️⃣ Registro de Novo Usuário

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "usernameIndication": "agenciamidas"
}
```

**Resultado no Meta:** Lead com `referrer_username: "agenciamidas"`

### 2️⃣ Depósito Gerado

```json
{
  "type": "deposit_generated",
  "name": "João Silva",
  "email": "joao@example.com",
  "value": 100.50,
  "usernameIndication": "agenciamidas"
}
```

**Resultado no Meta:** InitiateCheckout com `referrer_username: "agenciamidas"`

### 3️⃣ Depósito Confirmado

```json
{
  "type": "confirmed_deposit",
  "name": "João Silva",
  "email": "joao@example.com",
  "value": 100.50,
  "first_deposit": true,
  "usernameIndication": "agenciamidas"
}
```

**Resultado no Meta:** Purchase (FTD) com `referrer_username: "agenciamidas"`

---

## 🎯 Múltiplos Indicadores

Você pode criar diferentes links para rastrear diferentes fontes:

```bash
# Agência Midas
https://bichomania.com/cadastrar?indication=agenciamidas

# Influencer João
https://bichomania.com/cadastrar?indication=influencer_joao

# Afiliado Pedro
https://bichomania.com/cadastrar?indication=afiliado_pedro

# Campanha Facebook
https://bichomania.com/cadastrar?indication=facebook_ads_001
```

### Análise no Meta

Depois você pode filtrar no Meta Events Manager:

1. Ir em **Events Manager** → **Test Events**
2. Filtrar por `custom_data.referrer_username`
3. Ver quais indicadores trazem mais conversões

---

## 🔍 Combinando com Parâmetros UTM

Para rastreamento completo, combine `indication` com parâmetros UTM:

### Estrutura Recomendada

```
https://bichomania.com/cadastrar?
  utm_source=facebook&
  utm_medium=cpc&
  utm_campaign=conversao_q4_2024&
  utm_content=criativo_A&
  indication=agenciamidas
```

### Payload Resultante

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "usernameIndication": "agenciamidas",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "conversao_q4_2024",
  "origem_cid": "facebook_ads"
}
```

### Dados no Meta CAPI

```json
{
  "event_name": "Lead",
  "custom_data": {
    "referrer_username": "agenciamidas",
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "conversao_q4_2024",
    "origem_cid": "facebook_ads"
  }
}
```

---

## 📈 Relatórios e Análises

### No Meta Ads Manager

1. **Criar Segmento Personalizado**
   - Eventos com `referrer_username = "agenciamidas"`
   - Comparar performance entre indicadores

2. **Atribuição**
   - Ver quais indicadores geram mais FTDs
   - Calcular ROI por indicador

3. **Otimização**
   - Identificar melhores fontes
   - Alocar budget conforme performance

### Exemplo de Query (Meta API)

```javascript
// Buscar eventos do indicador "agenciamidas"
{
  "filtering": [{
    "field": "custom_data.referrer_username",
    "operator": "EQUAL",
    "value": "agenciamidas"
  }]
}
```

---

## 🧪 Testar Rastreamento

### 1. Script de Teste

```bash
# Testar com indicador
node test-payloads.js register_new_user
```

O payload padrão já inclui:
```json
{
  "usernameIndication": "user_indicador"
}
```

### 2. Payload Customizado

Crie um arquivo `custom-payload.json`:

```json
{
  "type": "register_new_user",
  "name": "Teste Indicação",
  "email": "teste@agenciamidas.com",
  "phone": "+5511999999999",
  "usernameIndication": "agenciamidas",
  "utm_source": "facebook",
  "utm_campaign": "teste_indicacao"
}
```

Envie:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d @custom-payload.json
```

### 3. Verificar nos Logs

```bash
# Você verá:
{
  "level": "info",
  "msg": "register_new_user_processed",
  "email": "***",
  "phone": "***"
}

# E no Meta Events Manager:
# custom_data.referrer_username: "agenciamidas"
```

---

## 💡 Melhores Práticas

### ✅ Faça

1. Use nomes descritivos para indicadores: `agenciamidas`, `influencer_joao`
2. Combine com parâmetros UTM para rastreamento completo
3. Teste os links antes de divulgar
4. Monitore regularmente os eventos no Meta
5. Documente todos os indicadores criados

### ❌ Evite

1. Usar caracteres especiais nos indicadores (use apenas letras, números e underscore)
2. Criar indicadores muito longos (máximo 50 caracteres)
3. Usar espaços (use underscore: `agencia_midas` ✅, não `agencia midas` ❌)
4. Esquecer de incluir o parâmetro no payload do webhook

---

## 🔐 Segurança

O campo `usernameIndication` é enviado ao Meta CAPI mas:

- ✅ Não contém dados sensíveis
- ✅ É usado apenas para atribuição
- ✅ Não identifica usuários individualmente
- ✅ Segue LGPD e políticas do Meta

---

## 📋 Checklist de Implementação

- [ ] Sistema captura parâmetro `indication` da URL
- [ ] Parâmetro é incluído como `usernameIndication` no payload
- [ ] Webhook está configurado e rodando
- [ ] Variáveis `PIXEL_ID` e `ACCESS_TOKEN` configuradas
- [ ] Links de divulgação criados e testados
- [ ] Eventos aparecendo no Meta Events Manager
- [ ] Campo `referrer_username` visível no custom_data
- [ ] Equipe treinada para usar os links corretos

---

## 🆘 Troubleshooting

### Indicador não aparece no Meta

**Problema:** `referrer_username` não aparece em `custom_data`

**Soluções:**
1. Verificar se o payload inclui `usernameIndication`
2. Verificar logs do webhook: `"msg":"register_new_user_processed"`
3. Verificar no Meta Events Manager → Test Events
4. Aguardar até 30 minutos para sincronização

### Indicador com valor errado

**Problema:** `referrer_username` tem valor diferente do esperado

**Soluções:**
1. Verificar URL completa usada na divulgação
2. Verificar se sistema está capturando corretamente
3. Verificar payload enviado ao webhook (logs)
4. Testar com script: `node test-payloads.js register_new_user`

---

## 📞 Exemplos de Uso Real

### Caso 1: Agência de Marketing

```
Agência: "Midas"
Indicador: "agenciamidas"
Link: https://bichomania.com/cadastrar?indication=agenciamidas
```

Resultado: Todos os leads/depósitos terão `referrer_username: "agenciamidas"`

### Caso 2: Múltiplos Afiliados

```
Afiliado 1: indication=afiliado_joao
Afiliado 2: indication=afiliado_maria
Afiliado 3: indication=afiliado_pedro
```

Resultado: Cada afiliado é rastreado separadamente

### Caso 3: Campanha Facebook + Google

```
Facebook: indication=fb_campanha_q4
Google: indication=google_campanha_q4
```

Resultado: Comparação de performance entre canais

---

## 🎓 Conclusão

O sistema de rastreamento está **pronto e funcionando**! 

Basta:
1. ✅ Criar links com `?indication=seu_indicador`
2. ✅ Divulgar os links
3. ✅ Sistema captura automaticamente
4. ✅ Webhook processa e envia ao Meta
5. ✅ Analisar resultados no Meta Ads Manager

**Tudo funciona automaticamente!** 🚀

