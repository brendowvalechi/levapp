# Levapp

Marketplace mobile que conecta clientes e transportadores para pequenos fretes, carretos e mudanças em Uberlândia (e futuramente outras cidades).

## Repositórios

| Projeto | Stack | Porta |
|---------|-------|-------|
| `frete-facil-api/` | FastAPI + PostgreSQL + Redis | 8000 |
| `frete-facil-mobile/` | React Native + Expo | 19000 |
| `frete-facil-admin/` | Next.js 15 + Tailwind | 3000 |

## Início rápido

### 1. Subir banco e Redis
```bash
cp .env.example .env
docker-compose up db redis -d
```

### 2. Rodar a API
```bash
cd frete-facil-api
cp .env.example .env
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
# Acesse: http://localhost:8000/docs
```

### 3. Rodar o app mobile
```bash
cd frete-facil-mobile
cp .env.example .env
npm install
npx expo start
# Escaneie o QR com Expo Go
```

### 4. Rodar o painel admin
```bash
cd frete-facil-admin
cp .env.example .env
npm install
npm run dev
# Acesse: http://localhost:3000
```

## Testes (API)
```bash
cd frete-facil-api
pytest
```

## Sprints
Consulte o [Roadmap Técnico](./01_Roadmap_Tecnico.pdf) para o plano completo de 10 sprints.

## Variáveis de ambiente obrigatórias para produção
- `SECRET_KEY` — gere com `openssl rand -hex 32`
- `DATABASE_URL` — PostgreSQL + PostGIS
- `REDIS_URL`
- `MERCADOPAGO_ACCESS_TOKEN`
- `GOOGLE_MAPS_API_KEY`
- `ZENVIA_TOKEN` ou `TWILIO_*` (SMS OTP)
- `FIREBASE_CREDENTIALS_JSON` (push notifications)
