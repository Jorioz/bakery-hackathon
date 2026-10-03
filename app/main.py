from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import db
from .routers import admin, inventory, kitchen, prices, recipes, specials


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Bakery Price API", lifespan=lifespan)
app.include_router(admin.router)
app.include_router(kitchen.router)
app.include_router(prices.router)
app.include_router(recipes.router)
app.include_router(inventory.router)
app.include_router(specials.router)
# Admin dashboard at /admin (mounted after the API router so /admin/api/* wins).
app.mount("/admin", StaticFiles(directory=Path(__file__).parent / "static" / "admin", html=True), name="admin")
