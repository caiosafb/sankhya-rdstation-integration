# Sankhya RD Station Integration

Sistema de integração entre Sankhya ERP e RD Station CRM.

## 🚀 Quick Start

1. Clone o repositório
2. Copie `.env.example` para `.env` e configure
3. Execute `docker-compose up -d`
4. Execute `npm install`
5. Execute `npm run start:dev`

## 📚 Documentação

### Endpoints

- `/sankhya/fornecedores` - Gerenciar fornecedores
- `/sankhya/produtos` - Gerenciar produtos
- `/sankhya/pedidos` - Gerenciar pedidos
- `/rdstation/contatos` - Gerenciar contatos
- `/sync/*` - Controle de sincronização

### Tecnologias

- NestJS
- PostgreSQL
- Redis (Bull Queue)
- Docker
- TypeORM

## 🔧 Desenvolvimento

```bash
npm run start:dev    # Desenvolvimento
npm run test        # Testes
npm run build       # Build
```

## 📝 Licença

MIT
