"""Weekly specials: the faux Parfait variants and a live Flipp scout for their add-ins."""
from fastapi import APIRouter

from .. import config, specials
from ..adapters import FlippAdapter

router = APIRouter(prefix="/specials", tags=["specials"])


@router.get("")
def list_specials():
    return specials.catalogue()


@router.get("/scout")
def scout_specials(postal_code: str = config.FLIPP_POSTAL_CODE):
    """Searches this week's Flipp flyers for every add-in; specials with the most add-ins on sale rank first."""
    return specials.scout(FlippAdapter(postal_code))
