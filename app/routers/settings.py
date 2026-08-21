from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_setting, set_setting
from app.config import AVAILABLE_MODELS, DEFAULT_MODEL
from app.services.gemini_service import get_active_gemini_key, get_active_model, test_gemini_key

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    gemini_api_key: str = None
    gemini_model: str = None

class KeyTestRequest(BaseModel):
    api_key: str

@router.get("")
def get_settings():
    raw_key = get_active_gemini_key()
    masked_key = ""
    has_key = bool(raw_key)
    if raw_key:
        if len(raw_key) > 8:
            masked_key = raw_key[:4] + "..." + raw_key[-4:]
        else:
            masked_key = "********"

    active_model = get_active_model()

    return {
        "has_api_key": has_key,
        "masked_api_key": masked_key,
        "active_model": active_model,
        "available_models": AVAILABLE_MODELS
    }

@router.post("")
def update_settings(data: SettingsUpdate):
    if data.gemini_api_key is not None:
        set_setting("gemini_api_key", data.gemini_api_key.strip())
    if data.gemini_model is not None:
        set_setting("gemini_model", data.gemini_model.strip())
    return {"status": "saved", "has_api_key": bool(get_active_gemini_key())}

@router.post("/test-key")
def test_key_endpoint(data: KeyTestRequest):
    key = data.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Chave de API não informada")
    result = test_gemini_key(key)
    return result
