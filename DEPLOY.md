# Deploy — Levapp

Guia completo para subir o Levapp em produção no VPS `82.197.65.66`.

---

## Pré-requisitos no servidor

```bash
# Ubuntu 22.04 LTS — executar como root ou com sudo
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git curl

# Adicionar usuário ao grupo docker (substitua <user> pelo seu usuário)
usermod -aG docker <user>
newgrp docker
```

---

## 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USER/frete-facil.git /opt/frete-facil
cd /opt/frete-facil
```

---

## 2. Criar o arquivo .env.prod

Copie o exemplo e preencha **todos** os valores:

```bash
cp frete-facil-api/.env.example .env.prod
nano .env.prod
```

Variáveis obrigatórias em produção:

| Variável | Descrição |
|---|---|
| `SECRET_KEY` | `openssl rand -hex 32` |
| `POSTGRES_USER/PASSWORD/DB` | Credenciais do banco |
| `REDIS_PASSWORD` | Senha do Redis |
| `MERCADOPAGO_ACCESS_TOKEN` | Token live do MP |
| `MERCADOPAGO_WEBHOOK_SECRET` | Hash do webhook MP |
| `FCM_SERVER_KEY` | Chave do Firebase Cloud Messaging |
| `R2_*` | Credenciais do Cloudflare R2 |
| `SENTRY_DSN` | DSN do projeto no sentry.io |
| `ZENVIA_TOKEN` | Token da Zenvia (SMS OTP) |
| `APP_BASE_URL` | `https://api.fretefacil.com.br` |
| `CORS_ORIGINS` | `https://admin.fretefacil.com.br` |

---

## 3. Configurar SSL

Coloque os certificados TLS em `nginx/certs/`:

```bash
mkdir -p nginx/certs
# Opção A — Certbot (Let's Encrypt)
apt install -y certbot
certbot certonly --standalone -d api.fretefacil.com.br -d admin.fretefacil.com.br
cp /etc/letsencrypt/live/api.fretefacil.com.br/fullchain.pem nginx/certs/fretefacil.crt
cp /etc/letsencrypt/live/api.fretefacil.com.br/privkey.pem  nginx/certs/fretefacil.key
chmod 600 nginx/certs/fretefacil.key
```

> Para renovação automática adicione ao cron: `0 3 * * * certbot renew --quiet && docker compose -f docker-compose.prod.yml restart nginx`

---

## 4. Build e subir os containers

```bash
cd /opt/frete-facil

# Build das imagens (primeira vez ~5 min)
docker compose -f docker-compose.prod.yml build

# Subir tudo
docker compose -f docker-compose.prod.yml up -d

# Acompanhar logs
docker compose -f docker-compose.prod.yml logs -f api
```

As migrações são aplicadas automaticamente na inicialização do container `api` via `alembic upgrade head`.

---

## 5. Criar o primeiro administrador

```bash
docker compose -f docker-compose.prod.yml exec api \
  python scripts/seed_admin.py \
  --email admin@fretefacil.com.br \
  --phone 5534999999999 \
  --password SenhaForte123
```

---

## 6. DNS

Aponte os registros A para `82.197.65.66`:

| Subdomínio | IP |
|---|---|
| `api.fretefacil.com.br` | `82.197.65.66` |
| `admin.fretefacil.com.br` | `82.197.65.66` |

---

## 7. Variáveis do app mobile

Crie `frete-facil-mobile/.env` (ou `.env.production`):

```env
EXPO_PUBLIC_API_URL=https://api.fretefacil.com.br
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_SENTRY_DSN=https://XXXX@oXXXX.ingest.sentry.io/XXXX
```

---

## 8. Build do app mobile (EAS)

```bash
cd frete-facil-mobile
npm install

# Configurar EAS (primeira vez)
npx eas-cli login
npx eas-cli build:configure

# Build Android
npx eas-cli build --platform android --profile production

# Build iOS
npx eas-cli build --platform ios --profile production
```

---

## 9. Atualizações OTA (expo-updates)

Após cada release de JS (sem mudanças nativas):

```bash
cd frete-facil-mobile
npx eas-cli update --branch production --message "descrição da update"
```

---

## 10. Operações do dia-a-dia

### Ver logs
```bash
docker compose -f docker-compose.prod.yml logs -f [api|celery-worker|admin|nginx]
```

### Reiniciar um serviço
```bash
docker compose -f docker-compose.prod.yml restart api
```

### Aplicar nova versão
```bash
git pull
docker compose -f docker-compose.prod.yml build api admin
docker compose -f docker-compose.prod.yml up -d --no-deps api admin celery-worker
```

### Backup do banco
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Rodar migration manualmente
```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

## 11. Monitoramento

- **Sentry** — erros backend em `sentry.io`
- **Logs do nginx** — `/var/log/nginx/` via `docker exec levapp-nginx tail -f /var/log/nginx/error.log`
- **Flower** (Celery monitor) — para habilitar, adicione o serviço ao `docker-compose.prod.yml`:
  ```yaml
  flower:
    image: mher/flower
    command: celery --broker=redis://:${REDIS_PASSWORD}@redis:6379/0 flower --port=5555
    expose: ["5555"]
  ```

---

## Estrutura de portas (internas)

| Serviço | Porta interna | Exposta externamente |
|---|---|---|
| api (FastAPI) | 8000 | Não — via nginx |
| admin (Next.js) | 3000 | Não — via nginx |
| nginx | 80, 443 | Sim |
| db (PostgreSQL) | 5432 | Não |
| redis | 6379 | Não |
