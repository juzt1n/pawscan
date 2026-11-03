import "dotenv/config";
import { connectDb } from "./src/db.js";
import app from "./src/app.js";

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

const port = process.env.PORT || 3001;
connectDb()
  .then(() => app.listen(port, () => console.log(`PawScan API listening on port ${port}`)))
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });