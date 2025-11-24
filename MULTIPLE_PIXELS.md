# 🎯 Configuração de Múltiplos Pixels

Este documento explica como configurar e usar múltiplos pixels do Meta no webhook.

---

## 📋 Visão Geral

O webhook suporta **múltiplos pixels do Meta** simultaneamente. Isso permite:

- ✅ Enviar eventos para vários pixels ao mesmo tempo
- ✅ Configurar quais pixels recebem eventos do FluxLabs
- ✅ Gerenciar diferentes clientes/projetos em um único webhook
- ✅ Especificar quais pixels receberão cada evento

---

## ⚙️ Configuração

### Opção 1: JSON String (Recomendado)

Configure a variável `PIXELS` com um JSON contendo todos os pixels:

```bash
PIXELS='[
  {
    "id": "123456789",
    "token": "EAAxxxxxxxxxxxxx",
    "name": "Pixel Principal",
    "has_fluxlabs": true
  },
  {
    "id": "987654321",
    "token": "EAAyyyyyyyyyyyyy",
    "name": "Pixel Cliente A",
    "has_fluxlabs": false
  },
  {
    "id": "555555555",
    "token": "EAAzzzzzzzzzzzzz",
    "name": "Pixel Cliente B",
    "has_fluxlabs": true
  }
]'
```

### Opção 2: Variáveis Individuais

Configure cada pixel usando variáveis numeradas:

```bash
# Pixel 1
PIXEL_ID_1=123456789
ACCESS_TOKEN_1=EAAxxxxxxxxxxxxx
PIXEL_NAME_1=Pixel Principal
PIXEL_HAS_FLUXLABS_1=true

# Pixel 2
PIXEL_ID_2=987654321
ACCESS_TOKEN_2=EAAyyyyyyyyyyyyy
PIXEL_NAME_2=Pixel Cliente A
PIXEL_HAS_FLUXLABS_2=false

# Pixel 3
PIXEL_ID_3=555555555
ACCESS_TOKEN_3=EAAzzzzzzzzzzzzz
PIXEL_NAME_3=Pixel Cliente B
PIXEL_HAS_FLUXLABS_3=true
```

### Opção 3: Configuração Única (Compatibilidade)

Para manter compatibilidade com versões anteriores, você ainda pode usar:

```bash
PIXEL_ID=123456789
ACCESS_TOKEN=EAAxxxxxxxxxxxxx
PIXEL_NAME=Pixel Principal
PIXEL_HAS_FLUXLABS=true
```

---

## 🎯 Como Funciona

### Rota `/webhook` (Principal)

Envia eventos para **todos os pixels** configurados:

```bash
curl -X POST https://seu-dominio.com/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "register_new_user",
    "name": "João Silva",
    "email": "joao@example.com"
  }'
```

**Resultado:** Evento enviado para todos os pixels configurados.

### Rota `/webhook/fluxlabs`

Envia eventos apenas para pixels com `has_fluxlabs: true`:

```bash
curl -X POST https://seu-dominio.com/webhook/fluxlabs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user_created",
    "name": "Maria Santos",
    "email": "maria@example.com"
  }'
```

**Resultado:** Evento enviado apenas para pixels que têm FluxLabs habilitado.

---

## 🎛️ Especificar Pixels no Payload

Você pode especificar quais pixels receberão o evento usando o campo `pixel_ids` ou `pixels`:

### Exemplo 1: Especificar IDs dos Pixels

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "pixel_ids": ["123456789", "987654321"]
}
```

### Exemplo 2: Usar Campo `pixels`

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "pixels": ["123456789"]
}
```

**Resultado:** Evento enviado apenas para os pixels especificados.

---

## 📊 Resposta do Webhook

Quando múltiplos pixels são usados, a resposta inclui informações sobre todos os envios:

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
  "pixels_sent": 3,
  "all_results": [
    {
      "pixel_id": "123456789",
      "pixel_name": "Pixel Principal",
      "status": 200,
      "events_received": 1
    },
    {
      "pixel_id": "987654321",
      "pixel_name": "Pixel Cliente A",
      "status": 200,
      "events_received": 1
    },
    {
      "pixel_id": "555555555",
      "pixel_name": "Pixel Cliente B",
      "status": 200,
      "events_received": 1
    }
  ]
}
```

---

## 🔍 Verificar Configuração

### Endpoint `/health`

```bash
curl https://seu-dominio.com/health
```

**Resposta:**
```json
{
  "ok": true,
  "ts": 1700000000000,
  "pixels_configured": 3,
  "pixels": [
    {
      "id": "123456789",
      "name": "Pixel Principal",
      "has_fluxlabs": true
    },
    {
      "id": "987654321",
      "name": "Pixel Cliente A",
      "has_fluxlabs": false
    },
    {
      "id": "555555555",
      "name": "Pixel Cliente B",
      "has_fluxlabs": true
    }
  ]
}
```

### Endpoint GET `/webhook/fluxlabs`

```bash
curl https://seu-dominio.com/webhook/fluxlabs
```

**Resposta:**
```json
{
  "ok": true,
  "endpoint": "/webhook/fluxlabs",
  "method": "POST",
  "pixels_with_fluxlabs": 2,
  "pixels": [
    {
      "id": "123456789",
      "name": "Pixel Principal"
    },
    {
      "id": "555555555",
      "name": "Pixel Cliente B"
    }
  ],
  "message": "Este endpoint aceita apenas requisições POST. Use POST para enviar eventos do FluxLabs."
}
```

---

## 🎯 Casos de Uso

### Caso 1: Múltiplos Clientes

Você tem 3 clientes, cada um com seu próprio pixel:

```bash
PIXELS='[
  {"id":"111","token":"token1","name":"Cliente A","has_fluxlabs":true},
  {"id":"222","token":"token2","name":"Cliente B","has_fluxlabs":false},
  {"id":"333","token":"token3","name":"Cliente C","has_fluxlabs":true}
]'
```

- Eventos do FluxLabs vão apenas para Cliente A e Cliente C
- Eventos da rota `/webhook` vão para todos os 3 clientes

### Caso 2: Pixel Principal + Pixel de Backup

Você quer enviar para um pixel principal e manter um backup:

```bash
PIXELS='[
  {"id":"111","token":"token1","name":"Principal","has_fluxlabs":true},
  {"id":"222","token":"token2","name":"Backup","has_fluxlabs":false}
]'
```

- Todos os eventos vão para ambos os pixels
- FluxLabs envia apenas para o pixel principal

### Caso 3: Pixels Específicos por Evento

Você quer enviar eventos diferentes para pixels diferentes:

```json
// Evento para pixel específico
{
  "type": "register_new_user",
  "name": "João",
  "email": "joao@example.com",
  "pixel_ids": ["111"]
}

// Evento para outro pixel
{
  "type": "confirmed_deposit",
  "name": "Maria",
  "email": "maria@example.com",
  "value": 100,
  "pixel_ids": ["222"]
}
```

---

## ⚠️ Troubleshooting

### Nenhum pixel configurado

**Erro:**
```json
{
  "ok": false,
  "error": "missing_pixel_or_token"
}
```

**Solução:** Verifique se `PIXELS` ou `PIXEL_ID` está configurado corretamente.

### Nenhum pixel com FluxLabs

**Erro:**
```json
{
  "ok": false,
  "error": "no_fluxlabs_pixels",
  "message": "Nenhum pixel configurado com FluxLabs habilitado"
}
```

**Solução:** Configure pelo menos um pixel com `has_fluxlabs: true`.

### Pixel não encontrado

Se você especificar `pixel_ids` que não existem na configuração, esses pixels serão ignorados. Apenas os pixels válidos receberão o evento.

---

## 📝 Logs

O webhook registra logs para cada pixel:

```json
{
  "level": "info",
  "msg": "capi_result",
  "pixel_id": "123456789",
  "pixel_name": "Pixel Principal",
  "event_name": "Lead",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "capi_status": 200,
  "events_received": 1
}
```

---

## ✅ Checklist

- [ ] Pixels configurados via `PIXELS` ou variáveis individuais
- [ ] Cada pixel tem `id`, `token` e `name`
- [ ] Pixels com FluxLabs têm `has_fluxlabs: true`
- [ ] Endpoint `/health` mostra todos os pixels
- [ ] Endpoint GET `/webhook/fluxlabs` mostra pixels com FluxLabs
- [ ] Eventos sendo enviados corretamente
- [ ] Logs mostrando envios para múltiplos pixels

---

## 🎓 Conclusão

O sistema de múltiplos pixels está **pronto e funcionando**!

Basta:
1. ✅ Configurar os pixels via `PIXELS` ou variáveis individuais
2. ✅ Especificar quais têm FluxLabs (`has_fluxlabs: true`)
3. ✅ Enviar eventos normalmente
4. ✅ O webhook distribui automaticamente para os pixels corretos

**Tudo funciona automaticamente!** 🚀

