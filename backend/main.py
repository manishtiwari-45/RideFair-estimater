from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pickle
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv()

# ── Global model store ────────────────────────────────────────────────────────
models: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup. Fail fast if the .pkl file is missing."""
    try:
        with open("all_models.pkl", "rb") as f:
            data = pickle.load(f)
        models["price"]   = data["price_model"]
        models["scam"]    = data["scam_model"]
        models["hotspot"] = data["hotspot_model"]
        print("✅ Models loaded successfully.")
    except FileNotFoundError:
        raise RuntimeError(
            "❌ 'all_models.pkl' not found. Run train_ai.py first!"
        )
    yield
    models.clear()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="RideFair AI API",
    description=(
        "AI-powered auto-rickshaw fare estimator. "
        "Uses Linear Regression for price prediction, "
        "Logistic Regression for scam detection, "
        "and K-Means Clustering for hotspot mapping."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — credentials are not used so allow_origins="*" is valid here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Schemas ───────────────────────────────────────────────────────────

class PriceRequest(BaseModel):
    distance_km: float = Field(..., gt=0, le=200,  description="Trip distance in km (1–200)")
    hour:        int   = Field(..., ge=0, le=23,   description="Hour of day (0–23)")
    is_weekend:  int   = Field(..., ge=0, le=1,    description="1 = weekend, 0 = weekday")


class ScamRequest(BaseModel):
    distance_km: float = Field(..., gt=0,  le=200,  description="Trip distance in km")
    price_asked: float = Field(..., gt=0,  le=10000, description="Price quoted by driver (₹)")


# ── Response Schemas ──────────────────────────────────────────────────────────

class PriceResponse(BaseModel):
    fair_price: float
    message:    str

class ScamResponse(BaseModel):
    verdict:           str
    scam_probability:  float
    warning:           str

class HotspotPoint(BaseModel):
    lat: float
    lon: float

class HotspotResponse(BaseModel):
    hotspots: list[HotspotPoint]

class HealthResponse(BaseModel):
    status:        str
    models_loaded: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def home():
    return {"message": "RideFair AI is Online.", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["Info"])
def health():
    """Health check — returns whether models are loaded."""
    return {"status": "ok", "models_loaded": bool(models)}


@app.post("/predict-price", response_model=PriceResponse, tags=["Predictions"])
def predict_price(data: PriceRequest):
    """
    Predict a fair auto-rickshaw fare using Linear Regression.
    Considers distance, time of day, and day type (weekend/weekday).
    """
    try:
        features = pd.DataFrame([{
            "dist_km":    data.distance_km,
            "hour":       data.hour,
            "is_weekend": data.is_weekend,
        }])
        predicted = float(models["price"].predict(features)[0])
        return {
            "fair_price": round(predicted, 2),
            "message":    "Calculated based on historical ride data.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


@app.post("/detect-scam", response_model=ScamResponse, tags=["Predictions"])
def detect_scam(data: ScamRequest):
    """
    Classify a ride as SCAM or FAIR using Logistic Regression.
    Uses price-per-km as a key feature to catch inflated rates.
    """
    try:
        price_per_km = data.price_asked / data.distance_km
        features = pd.DataFrame([{
            "dist_km":     data.distance_km,
            "price":       data.price_asked,
            "price_per_km": price_per_km,
        }])
        is_scam     = int(models["scam"].predict(features)[0])
        probability = float(models["scam"].predict_proba(features)[0][1])
        verdict     = "SCAM" if is_scam == 1 else "FAIR"
        return {
            "verdict":          verdict,
            "scam_probability": round(probability * 100, 1),
            "warning":          "Price is abnormally high!" if is_scam == 1 else "Price looks reasonable.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scam detection failed: {e}")


@app.get("/hotspots", response_model=HotspotResponse, tags=["Map"])
def get_hotspots():
    """Return K-Means cluster centres as pickup hotspot coordinates."""
    try:
        centers   = models["hotspot"].cluster_centers_
        hotspots  = [{"lat": float(c[0]), "lon": float(c[1])} for c in centers]
        return {"hotspots": hotspots}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hotspot fetch failed: {e}")
