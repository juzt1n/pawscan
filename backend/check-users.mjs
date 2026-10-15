import "dotenv/config";
import { connectMongo } from "./src/mongo.js";

const c = await connectMongo();
const db = c.db(process.env.DB_NAME || "pawscan");
console.log("database:", db.databaseName);
console.log(
  await db.collection("users")
    .find({}, { projection: { email: 1, accountType: 1, failedLogins: 1, lockUntil: 1 } })
    .toArray()
);
await c.close();