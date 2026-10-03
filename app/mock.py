"""Faux merchant prices derived from the StatCan baseline (hackathon mock data)."""
import random

from . import config


def mock_price(merchant: str, product_name: str, base_price: float) -> float:
    rng = random.Random(f"{merchant}|{product_name}")  # same inputs -> same price
    noise = rng.uniform(-config.NOISE, config.NOISE)
    return round(base_price * config.MERCHANT_MULTIPLIERS[merchant] * (1 + noise), 2)


def mock_prices(product_name: str, base_price: float) -> dict[str, float]:
    return {m: mock_price(m, product_name, base_price) for m in config.MERCHANT_MULTIPLIERS}
