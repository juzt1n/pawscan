import { Router } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUCCESS_URL = `${process.env.PUBLIC_BASE_URL}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL  = `${process.env.PUBLIC_BASE_URL}/api/stripe/cancel`;

// POST /api/stripe/create-checkout-session
// Auth required — req.user comes from your existing JWT middleware
router.post("/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: process.env.PREMIUM_CURRENCY || "sgd",
          unit_amount: Number(process.env.PREMIUM_PRICE_CENTS || 490),
          product_data: {
            name: "PawScan Premium (monthly)",
            description: "Unlimited scans, dog profiles, health watchlist",
          },
        },
        quantity: 1,
      }],
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      metadata: { userId: String(req.user._id) },
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/return?session_id=xxx
// Stripe redirects here after successful payment.
// This page is loaded inside the app's WebView — when the app sees this URL,
// it extracts session_id, closes the WebView, and calls /activate-premium.
router.get("/return", (req, res) => {
  res.type("html").send(`
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{font-family:-apple-system,system-ui,sans-serif;padding:48px 24px;
           text-align:center;color:#1a1a1a;background:#fafaf7}
      h1{font-size:24px;margin:0 0 8px}
      p{font-size:14px;color:#666;margin:0}
      .check{font-size:48px;margin-bottom:16px}
    </style></head><body>
      <div class="check">✅</div>
      <h1>Payment complete</h1>
      <p>You can return to the PawScan app.</p>
    </body></html>
  `);
});

// GET /api/stripe/cancel
// Stripe redirects here if the user closes the checkout page.
router.get("/cancel", (req, res) => {
  res.type("html").send(`
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{font-family:-apple-system,system-ui,sans-serif;padding:48px 24px;
           text-align:center;color:#1a1a1a;background:#fafaf7}
      h1{font-size:24px;margin:0 0 8px}
      p{font-size:14px;color:#666;margin:0}
    </style></head><body>
      <h1>Payment cancelled</h1>
      <p>You can return to the PawScan app.</p>
    </body></html>
  `);
});

// POST /api/stripe/activate-premium
// Body: { sessionId }
// Server-side verification: we retrieve the session from Stripe and check
// it actually got paid before flipping the user's tier.
router.post("/activate-premium", requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    await getDb().collection("users").updateOne(
      { _id: new ObjectId(String(req.user._id)) },
      {
        $set: {
          tier: "premium",
          premiumSince: new Date(),
          premiumPaymentIntentId: session.payment_intent,
        },
      }
    );

    res.json({ ok: true, tier: "premium" });
  } catch (err) {
    console.error("activate-premium error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;