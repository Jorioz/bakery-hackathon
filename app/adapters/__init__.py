"""Price sources. Each adapter returns RawListing rows; the rest of the pipeline doesn't care which ran."""
from .base import Adapter, RawListing
from .flipp import FlippAdapter
from .mock import MockAdapter

ADAPTERS: dict[str, type[Adapter]] = {"flipp": FlippAdapter, "mock": MockAdapter}
