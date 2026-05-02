# frete-facil-api — Contexto para Claude Code

## Stack
- Python 3.12 + FastAPI 0.115 (async)
- SQLAlchemy 2.0 (async) + Alembic
- PostgreSQL 16 + PostGIS (geoespacial obrigatório para buscas de motoristas próximos)
- Redis (localização ao vivo, cache, filas Celery)
- Pydantic v2 para schemas e configuração

## Estrutura de módulos
```
app/
  main.py          ← FastAPI app + middlewares + routers
  database.py      ← engine async, Base, get_db dependency
  core/
    config.py      ← Settings (pydantic-settings)
    security.py    ← JWT, hash_password, verify_password
    redis.py       ← async Redis client
  models/          ← SQLAlchemy models (um arquivo por entidade)
  schemas/         ← Pydantic schemas (request/response)
  routers/         ← FastAPI routers (um por recurso)
  services/        ← business logic (chamado pelos routers)
  tasks/           ← Celery tasks
```

## Convenções
- Um arquivo por entidade em models/, schemas/, routers/, services/
- Routers usam prefix="/api/v1/nome-do-recurso"
- Schemas: `NomeCreate`, `NomeUpdate`, `NomeResponse`
- Serviços recebem `db: AsyncSession` como primeiro argumento
- Soft delete: nunca `DELETE` físico em User, Ride — usar `deleted_at`
- IDs: UUID4 em todas as entidades
- Migrations: sempre via Alembic (`alembic revision --autogenerate -m "desc"`)
- NUNCA construir SQL cru com f-strings

## Testes
- `pytest` com `pytest-asyncio`
- Banco de teste separado: `fretefacil_test`
- Fixtures em `tests/conftest.py`
- Sempre criar testes junto com cada endpoint novo

## Segurança
- Senhas: bcrypt via passlib
- JWT: access 15min + refresh 30 dias
- Rate limiting nas rotas de auth/OTP
- Idempotency-Key obrigatório em rotas de pagamento
