import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDb } from "./src/db.js";
import authRoutes from "./src/routes/auth.js";
import accountRoutes from "./src/routes/account.js";
import scanRoutes from "./src/routes/scans.js";
import clinicRoutes from "./src/routes/clinics.js";
import adminRoutes from "./src/routes/admin.js";
import breedRoutes from "./src/routes/breeds.js";
import stripeRoutes from "./src/routes/stripe.js";

for (const k of ["MONGODB_URI", "JWT_SECRET", "MODEL_URL", "HF_TOKEN"]) {
  if (!process.env[k]) {
    console.error(`Missing environment variable: ${k}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy
app.disable("x-powered-by");
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: "100kb" }));

// One log line per API request (shows up in Render's Logs tab)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path === "/health") return;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} in ${Date.now() - start} ms (${req.headers["content-length"] || 0} bytes in)`);
  });
  next();
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", accountRoutes);
app.use("/api", scanRoutes);
app.use("/api", clinicRoutes);
app.use("/api", breedRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stripe", stripeRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Image too large (max 5 MB)." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request too large." });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again later." });
});

const port = process.env.PORT || 3001;
connectDb()
  .then(() => app.listen(port, () => console.log(`PawScan API listening on port ${port}`)))
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
