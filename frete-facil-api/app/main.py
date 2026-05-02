from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import settings
from app.core.redis import close_redis
from app.core.limiter import limiter
from app.routers import health, auth, users, uploads, documents, admin, rides, chat, tracking, payments, reviews


if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.2,
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="API do marketplace de fretes e carretos Levapp",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — Sprint 0
app.include_router(health.router)

# Routers — Sprint 1: Auth
app.include_router(auth.router)
app.include_router(users.router)

# Routers — Sprint 2: Documents & Verification
app.include_router(uploads.router)
app.include_router(documents.router)
app.include_router(admin.router)

# Dev static files for local uploads
if settings.is_development:
    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Sprint 3 — Rides & Offers
app.include_router(rides.router)

# Sprint 4 — Chat
app.include_router(chat.router)

# Sprint 5 — Tracking
app.include_router(tracking.router)

# Sprint 6 — Payments
app.include_router(payments.router)

# Sprint 7 — Reviews
app.include_router(reviews.router)
