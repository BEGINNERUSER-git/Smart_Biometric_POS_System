import hashlib
import os
import time
from typing import Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()


class ScanAndPayRequest(BaseModel):
    userId: str = Field(..., min_length=1)
    merchantId: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    # Optional raw payload your camera/model may provide (frame id, device id, etc.)
    sample: Optional[str] = None


class ScanAndPayResponse(BaseModel):
    palmHash: str
    backend: dict


app = FastAPI(title="Palm Vein ML Bridge", version="1.0.0")
BACKEND_URL = os.getenv("POS_BACKEND_URL", "http://localhost:5000")


def generate_palm_hash(sample: Optional[str] = None) -> str:
    """
    Replace this stub with your actual NIR capture + CNN embedding logic.

    Production behavior should:
    - Capture palm ROI from NIR camera
    - Run CNN to get 256-d embedding
    - Serialize and hash (or directly use secure hash of embedding)
    """
    seed = sample or f"demo:{time.time_ns()}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


@app.get("/health")
def health():
    return {"ok": True, "backend": BACKEND_URL}


@app.post("/scan-and-pay", response_model=ScanAndPayResponse)
def scan_and_pay(payload: ScanAndPayRequest):
    palm_hash = generate_palm_hash(payload.sample)
try:
        resp = requests.post(
            f"{BACKEND_URL}/api/pay",
            json={
                "userId": payload.userId,
                "merchantId": payload.merchantId,
                "amount": payload.amount,
                "palmHash": palm_hash,
            },
            timeout=30,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Backend unreachable: {e}") from e

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return {"palmHash": palm_hash, "backend": resp.json()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("palm_bridge:app", host="0.0.0.0", port=int(os.getenv("ML_PORT", "7000")), reload=True)

