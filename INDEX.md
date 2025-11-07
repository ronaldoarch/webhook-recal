# 📚 Índice de Documentação — Webhook de Marketing

Bem-vindo ao webhook de marketing integrado com Meta CAPI! Este índice te guia por toda a documentação disponível.

---

## 🚀 Começando

### Para Usuários Novos

1. **[QUICK_START.md](./QUICK_START.md)** ⭐ **COMECE AQUI!**
   - Instalação rápida
   - Configuração básica
   - Primeiros testes
   - Solução de problemas comuns

2. **[README.md](./README.md)**
   - Visão geral do projeto
   - Variáveis de ambiente
   - Regras de mapeamento
   - Deploy em produção

---

## 📖 Documentação Técnica

### Payloads e Eventos

3. **[PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md)**
   - Estrutura completa dos 3 tipos de eventos
   - Exemplos de payloads JSON
   - Campos obrigatórios e opcionais
   - Respostas esperadas
   - Autenticação HMAC-SHA256
   - Troubleshooting de erros

### Rastreamento e Analytics

4. **[TRACKING_GUIDE.md](./TRACKING_GUIDE.md)**
   - Como usar o parâmetro `indication` nas URLs
   - Rastreamento de múltiplos indicadores
   - Combinação com parâmetros UTM
   - Análise de resultados no Meta
   - Exemplos práticos de uso

### Fluxo de Dados

5. **[FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)**
   - Fluxo visual completo (do clique ao Meta)
   - Jornada do usuário passo a passo
   - Transformação de dados em cada etapa
   - Exemplo de caso real
   - Checklist de verificação

### Exemplo Prático

6. **[EXAMPLE_AGENCIAMIDAS.md](./EXAMPLE_AGENCIAMIDAS.md)** ⭐ **EXEMPLO REAL**
   - Caso de uso real com link `?indication=agenciamidas`
   - Jornada completa do usuário
   - Como verificar no Meta Events Manager
   - Logs esperados
   - Dicas para otimização

### Estrutura do Projeto

7. **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)**
   - Árvore completa de arquivos
   - Detalhamento de cada componente
   - Mapa de dependências
   - Fluxo de dados visual
   - Estatísticas do projeto

---

## 🧪 Ferramentas de Teste

### Script de Teste

8. **[test-payloads.js](./test-payloads.js)**
   - Script executável para testes rápidos
   - Payloads pré-configurados com `usernameIndication: "agenciamidas"`
   - Geração automática de assinaturas HMAC
   - Teste de todos os eventos de uma vez

**Uso:**
```bash
# Testar evento específico
node test-payloads.js register_new_user
node test-payloads.js deposit_generated
node test-payloads.js confirmed_deposit_ftd

# Testar todos os eventos
node test-payloads.js all

# Ver ajuda
node test-payloads.js --help
```

---

## 📋 Referência Rápida

### Tipos de Eventos

| Arquivo | Tipo do Payload | Evento no Meta | Quando Usar |
|---------|-----------------|----------------|-------------|
| 🟢 | `register_new_user` | `Lead` | Novo usuário se registra |
| 🟡 | `deposit_generated` | `InitiateCheckout` | PIX é gerado (antes do pagamento) |
| 🔵 | `confirmed_deposit` | `Purchase` (FTD) | Primeiro depósito é confirmado |
| ⚪ | `confirmed_deposit` | ❌ (ignorado) | Redepósito (first_deposit=false) |

### Campos Importantes

| Campo | Origem | Destino no Meta | Propósito |
|-------|--------|-----------------|-----------|
| `type` | Payload | `event_name` | Identifica o tipo de evento |
| `usernameIndication` | URL `?indication=X` | `custom_data.referrer_username` | Rastreia origem/indicador |
| `email` | Formulário | `user_data.em` (hash) | Matching de usuário |
| `phone` | Formulário | `user_data.ph` (hash) | Matching de usuário |
| `fbp`, `fbc` | Meta Pixel | `user_data.fbp`, `fbc` | Atribuição precisa |
| `value` | Depósito | `custom_data.value` | Valor da conversão |

---

## 🎯 Por Caso de Uso

### Quero configurar o webhook pela primeira vez
→ [QUICK_START.md](./QUICK_START.md)

### Quero ver um exemplo real de uso
→ [EXAMPLE_AGENCIAMIDAS.md](./EXAMPLE_AGENCIAMIDAS.md) ⭐

### Quero entender a estrutura dos payloads
→ [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md)

### Quero rastrear diferentes fontes de tráfego
→ [TRACKING_GUIDE.md](./TRACKING_GUIDE.md)

### Quero entender como os dados fluem
→ [FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)

### Quero usar o link ?indication=agenciamidas
→ [EXAMPLE_AGENCIAMIDAS.md](./EXAMPLE_AGENCIAMIDAS.md) ⭐

### Quero testar rapidamente
→ `node test-payloads.js <evento>`

### Quero fazer deploy em produção
→ [README.md](./README.md) → Seção "Deploy"

### Estou tendo problemas
→ [QUICK_START.md](./QUICK_START.md) → Seção "Problemas Comuns"

---

## 🔑 Conceitos Importantes

### 1. Indicação (Referral Tracking)

**O que é?**
- Parâmetro na URL: `?indication=agenciamidas`
- Capturado pelo sistema e enviado como `usernameIndication`
- Armazenado no Meta como `custom_data.referrer_username`

**Para que serve?**
- Rastrear qual fonte/indicador trouxe o usuário
- Comparar performance entre diferentes canais
- Calcular ROI por indicador

**Onde aprender mais?**
→ [TRACKING_GUIDE.md](./TRACKING_GUIDE.md)

### 2. FTD (First Time Deposit)

**O que é?**
- Primeiro depósito confirmado de um usuário
- Identificado pelo campo `first_deposit: true`
- Enviado ao Meta como `Purchase` com `event_type: "FTD"`

**Importante:**
- ✅ FTDs são enviados ao Meta
- ❌ Redepósitos são ignorados (por padrão)

**Onde aprender mais?**
→ [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) → Seção "confirmed_deposit"

### 3. Hash de PII (Personally Identifiable Information)

**O que é?**
- Dados sensíveis (email, telefone) são hasheados com SHA-256
- Meta faz matching mas não armazena dados em claro
- LGPD compliant

**Exemplos:**
- `"joao@example.com"` → `"a1b2c3d4e5f6..."` (64 caracteres)
- `"+5511999999999"` → `"f6e5d4c3b2a1..."` (64 caracteres)

**Onde aprender mais?**
→ [README.md](./README.md) → Seção "Hash automático de PII"

### 4. Meta Pixel (fbp, fbc)

**O que é?**
- `fbp`: Facebook Browser Pixel (cookie `_fbp`)
- `fbc`: Facebook Click (capturado do parâmetro `fbclid`)

**Para que serve?**
- Atribuição precisa de conversões
- Matching entre eventos do site e anúncios

**Onde aprender mais?**
→ [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md) → Qualquer exemplo de payload

---

## 📊 Fluxo de Trabalho Recomendado

### Setup Inicial (uma vez)

```
1. Ler QUICK_START.md
2. Configurar variáveis de ambiente
3. Iniciar servidor: npm start
4. Testar: node test-payloads.js test
5. Verificar no Meta Events Manager
```

### Desenvolvimento (diário)

```
1. Fazer alterações no código
2. Testar: node test-payloads.js <evento>
3. Verificar logs do servidor
4. Validar no Meta Events Manager
5. Commit e deploy
```

### Produção (campanhas)

```
1. Criar links com ?indication=nome_indicador
2. Divulgar links nas campanhas
3. Monitorar eventos no Meta
4. Analisar performance por indicador
5. Otimizar budget conforme resultados
```

---

## 🛠️ Arquivos do Projeto

### Código Fonte

- **[index.js](./index.js)**
  - Servidor Express principal
  - Lógica de processamento dos eventos
  - Integração com Meta CAPI
  - Validação HMAC

- **[src/utils/hash.js](./src/utils/hash.js)**
  - Funções de hashing SHA-256
  - Normalização de email/telefone

- **[package.json](./package.json)**
  - Dependências do projeto
  - Scripts de execução

### Documentação

- **[README.md](./README.md)** - Documentação principal
- **[QUICK_START.md](./QUICK_START.md)** - Guia de início rápido
- **[PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md)** - Exemplos de payloads
- **[TRACKING_GUIDE.md](./TRACKING_GUIDE.md)** - Guia de rastreamento
- **[FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)** - Diagramas de fluxo
- **[INDEX.md](./INDEX.md)** - Este arquivo

### Testes

- **[test-payloads.js](./test-payloads.js)** - Script de teste

### Infraestrutura

- **[Dockerfile](./Dockerfile)** - Container Docker
- **[.env.example]** - Exemplo de variáveis (criar se necessário)

---

## 🎓 Glossário

| Termo | Significado |
|-------|-------------|
| **CAPI** | Conversion API - API de conversões do Meta/Facebook |
| **FTD** | First Time Deposit - Primeiro depósito |
| **HMAC** | Hash-based Message Authentication Code - Autenticação |
| **PIX** | Sistema de pagamento instantâneo brasileiro |
| **PII** | Personally Identifiable Information - Dados pessoais |
| **UTM** | Urchin Tracking Module - Parâmetros de rastreamento |
| **Webhook** | Endpoint HTTP que recebe eventos |

---

## 📞 Suporte

### Problemas Comuns

Veja a seção "Troubleshooting" em:
- [QUICK_START.md](./QUICK_START.md#-problemas-comuns)
- [PAYLOAD_EXAMPLES.md](./PAYLOAD_EXAMPLES.md#-troubleshooting)

### Verificar Logs

```bash
# Ver logs do servidor
npm start

# Logs aparecem no formato JSON
{"level":"info","msg":"register_new_user_processed"}
```

### Testar Conexão

```bash
# Health check
curl http://localhost:3000/health

# Teste simples
node test-payloads.js test
```

---

## 🔄 Atualizações

### Versão Atual: 2.0

**Novidades:**
- ✅ Suporte a 3 tipos de eventos de marketing
- ✅ Rastreamento de indicações (`usernameIndication`)
- ✅ Script de teste automatizado
- ✅ Documentação completa
- ✅ Suporte a múltiplos clientes

**Compatibilidade:**
- ✅ Mantém compatibilidade com payloads legados
- ✅ Suporta eventos customizados anteriores
- ✅ Todas as configurações existentes continuam funcionando

---

## 🎯 Próximos Passos

1. ✅ Ler [QUICK_START.md](./QUICK_START.md)
2. ✅ Configurar ambiente local
3. ✅ Testar com `test-payloads.js`
4. ✅ Validar eventos no Meta Events Manager
5. ✅ Criar links com `?indication=seu_indicador`
6. ✅ Fazer deploy em produção
7. ✅ Monitorar e otimizar campanhas

---

## 📄 Licença

Este projeto é proprietário. Uso interno apenas.

---

## 🙏 Créditos

Desenvolvido para integração com Meta CAPI para rastreamento de eventos de marketing.

**Stack:**
- Node.js 20
- Express
- Meta Conversion API v18.0
- Redis (opcional)

---

**Última atualização:** Novembro 2024

**Documentação mantida por:** Equipe de Desenvolvimento

---

<div align="center">

**🚀 Pronto para começar? [Vá para QUICK_START.md](./QUICK_START.md)**

</div>

