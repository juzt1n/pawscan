"""
PawScan model service (FastAPI)

Loads the trained Keras model once at start-up and exposes:
  GET  /health   -> quick "is it alive" check
  POST /predict  -> multipart upload, field name "image"

Response shape matches mock.js exactly:
  {
    "predictions": [{"breed": "golden retriever", "confidence": 0.9134}, ... 5 items],
    "belowThreshold": false
  }

IMPORTANT: the model has its own preprocessing layer inside it, so we feed it
RAW 0-255 pixel values. Do NOT divide by 255 or normalise anything here.
"""
import hashlib
import io
import json
import os

import numpy as np
import tensorflow as tf
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MODEL_PATH = "pawscan_dog_model.keras"
CLASS_NAMES_PATH = "class_names.json"
IMG_SIZE = 224
THRESHOLD = 0.40          # top score below this -> belowThreshold = true
TOP_K = 5                 # mock.js returns 5 predictions
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def clean(name: str) -> str:
    """'n02085620-chihuahua' -> 'chihuahua'; 'n02108915-french_bulldog' -> 'french bulldog'.
    Lower-cased so it matches the keys in breed_health.json / breeds.js."""
    base = name.split("-", 1)[-1] if "-" in name else name
    return base.replace("_", " ").lower()


# --- Start-up: integrity check (PRD security requirement), then load model ---
_expected = os.environ.get("MODEL_SHA256")
if _expected and sha256_of(MODEL_PATH) != _expected.strip().lower():
    raise RuntimeError("Model checksum mismatch - refusing to start.")

model = tf.keras.models.load_model(MODEL_PATH)

with open(CLASS_NAMES_PATH) as f:
    BREEDS = [clean(n) for n in json.load(f)]

num_outputs = model.output_shape[-1]
if num_outputs != len(BREEDS):
    raise RuntimeError(
        f"class_names.json has {len(BREEDS)} names but the model outputs {num_outputs}."
    )

app = FastAPI(title="PawScan model service")

# Shared secret (PRD: only the Express backend may call this service).
# Set MODEL_API_KEY here and the SAME value as HF_TOKEN in the backend's .env.
# On a host that is already private (e.g. a private Hugging Face Space) you can leave it unset.
API_KEY = os.environ.get("MODEL_API_KEY")


def require_key(authorization: str = Header(default="")):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok", "classes": len(BREEDS)}


# Plain `def` (not async) so FastAPI runs it in a worker thread and the
# slow model call does not block other requests.
@app.post("/predict")
def predict(image: UploadFile = File(...), _auth: None = Depends(require_key)):
    data = image.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")

    try:
        pil = Image.open(io.BytesIO(data))
        pil = ImageOps.exif_transpose(pil)   # phone photos are often rotated via EXIF
        pil = pil.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="File is not a valid image.")

    arr = np.asarray(pil, dtype=np.float32)                       # raw 0-255
    arr = tf.image.resize(arr, (IMG_SIZE, IMG_SIZE)).numpy()      # same resize as training
    batch = np.expand_dims(arr, axis=0)                           # (1, 224, 224, 3)

    probs = model.predict(batch, verbose=0)[0]
    top = np.argsort(probs)[::-1][:TOP_K]

    return {
        "predictions": [
            {"breed": BREEDS[i], "confidence": round(float(probs[i]), 4)} for i in top
        ],
        "belowThreshold": bool(probs[top[0]] < THRESHOLD),
    }
