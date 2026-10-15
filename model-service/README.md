---
title: PawScan Model Service
emoji: 🐕
colorFrom: orange
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# PawScan model service

FastAPI wrapper around the trained ConvNeXt-Tiny dog breed model. Works on any Docker host.

## Files that must be in this folder

| File | Where it comes from |
|---|---|
| `pawscan_dog_model.keras` | Saved by the training notebook (download it from Colab) |
| `class_names.json` | Saved by the same notebook cell |
| `app.py`, `requirements.txt`, `Dockerfile` | This repo |

## Run locally first (recommended before deploying)

```bash
pip install -r requirements.txt
uvicorn app:app --port 7860
```

Test it with any dog photo:

```bash
curl -X POST http://localhost:7860/predict -F "image=@dog.jpg"
```

Expected: JSON with `predictions` (5 items) and `belowThreshold`.

## Deploy for free on Google Cloud Run (recommended)

Hugging Face now requires a paid plan (PRO) to create Docker Spaces, so use Cloud Run instead.
Free tier (checked Oct 2026): 2 million requests, 180,000 vCPU-seconds and 360,000 GiB-seconds per month.
A billing account (credit card) is required, but a project this size should stay at $0. Set a budget alert to be safe.
Why not Render/Koyeb free? They give 512 MB RAM and TensorFlow will not fit.

1. console.cloud.google.com -> create a project, link a billing account, enable the **Cloud Run** and **Cloud Build** APIs.
2. Easiest: open **Cloud Shell** (the `>_` icon, top right). Use its menu to upload this folder
   (it must contain `app.py`, `Dockerfile`, `requirements.txt`, `pawscan_dog_model.keras`, `class_names.json`).
3. In Cloud Shell, inside the folder (choose any long random text for the key):
   ```bash
   gcloud run deploy pawscan-model --source . --region us-central1 \
     --memory 2Gi --cpu 1 --timeout 60 --max-instances 2 \
     --allow-unauthenticated --set-env-vars MODEL_API_KEY=PASTE_A_LONG_RANDOM_KEY
   ```
   (`--allow-unauthenticated` is fine because `/predict` itself demands the key.)
4. When it finishes it prints a **Service URL** like `https://pawscan-model-xxxx-uc.a.run.app`.
5. In the **backend's** `.env` / Render environment set `MODEL_URL` to that URL and `HF_TOKEN` to the SAME
   key you used for `MODEL_API_KEY` (the variable name is just historical).
6. Test it:
   ```bash
   curl -X POST "https://YOUR-URL/predict" -H "Authorization: Bearer YOUR_KEY" -F "image=@dog.jpg"
   ```

The first request after a quiet period takes 15-30 seconds (the container starts and loads TensorFlow).
Send a request a minute before a demo to warm it up.

## Other options
- **Run it on your own laptop for the demo** and expose it with a free tunnel (Cloudflare Tunnel or ngrok);
  set `MODEL_API_KEY` too. Zero cost, but the laptop must stay on.
- **Hugging Face PRO** is $9/month if you prefer a Space (set the Space to Private; then no `MODEL_API_KEY` is needed).

## Optional: checksum check (PRD security requirement)

Compute the model's SHA-256 (`sha256sum pawscan_dog_model.keras`) and set it as
a Space secret called `MODEL_SHA256`. The service refuses to start if the file
does not match.
