# 🚀 COMECE AQUI — Leia em 2 Minutos

## ✅ O Que Foi Implementado

O webhook agora processa **3 tipos de eventos de marketing** e rastreia a origem das conversões através do parâmetro `usernameIndication`.

```
🟢 register_new_user    → Lead (Meta)
🟡 deposit_generated    → InitiateCheckout (Meta)
🔵 confirmed_deposit    → Purchase - FTD (Meta)
```

---

## 🎯 Link Configurado pelo Lucas

```
https://bichomania.com/cadastrar?indication=agenciamidas
```

O parâmetro `indication` é capturado automaticamente e enviado ao Meta como `referrer_username`, permitindo rastrear a performance da Agência Midas.

---

## 🧪 Testar Agora (30 segundos)

```bash
# 1. Iniciar servidor
npm start

# 2. Em outro terminal, testar
node test-payloads.js register_new_user

# ✅ Status 200 = Funcionando!
```

---

## 📚 Documentação Completa

| Preciso de... | Arquivo | Tempo |
|---------------|---------|-------|
| Começar rápido | [QUICK_START.md](./QUICK_START.md) | 5 min |
| Ver exemplo real | [EXAMPLE_AGENCIAMIDAS.md](./EXAMPLE_AGENCIAMIDAS.md) | 10 min |
| Entender payloads | [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) | 15 min |
| Rastrear campanhas | [TRACKING_GUIDE.md](./TRACKING_GUIDE.md) | 15 min |
| Ver tudo | [INDEX.md](./INDEX.md) | - |

---

## 📊 Exemplo de Payload

### Entrada (do sistema BiChoMania)

```json
{
  "type": "register_new_user",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "+5511999999999",
  "usernameIndication": "agenciamidas",
  "fbp": "fb.1.1700000000.123456789"
}
```

### Saída (enviado ao Meta)

```json
{
  "event_name": "Lead",
  "user_data": {
    "em": "hash_sha256...",
    "ph": "hash_sha256...",
    "fbp": "fb.1.1700000000.123456789"
  },
  "custom_data": {
    "referrer_username": "agenciamidas" ← RASTREÁVEL!
  }
}
```

---

## ✅ Status

```
✅ Código implementado e testado
✅ Documentação completa (3.000+ linhas)
✅ Scripts de teste prontos
✅ Compatível com link do Lucas
✅ Pronto para produção
```

---

## 🎯 Próximo Passo

**Opção 1:** Ler [QUICK_START.md](./QUICK_START.md) para setup completo

**Opção 2:** Ler [EXAMPLE_AGENCIAMIDAS.md](./EXAMPLE_AGENCIAMIDAS.md) para exemplo real

**Opção 3:** Testar agora: `node test-payloads.js all`

---

<div align="center">

## 🎉 Tudo Pronto!

**O webhook está 100% funcional e aguardando os eventos.**

</div>

