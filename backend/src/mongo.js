import dns from "node:dns";
import { MongoClient } from "mongodb";

// Atlas "mongodb+srv://" addresses need a DNS SRV lookup. Some home routers,
// school networks and Node on Windows can't answer those, which shows up as
// "querySrv ECONNREFUSED". If that happens, retry once using public DNS
// (Cloudflare and Google). Only the SRV/TXT lookups are affected.
// Override the servers with DNS_SERVERS=1.1.1.1,8.8.8.8 in .env if needed.
export async function connectMongo(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error("MONGODB_URI is not set in .env");
  try {
    const client = new MongoClient(uri);
    await client.connect();
    return client;
  } catch (err) {
    if (!/querySrv|ENOTFOUND _mongodb|ECONNREFUSED.*_mongodb/i.test(String(err?.message))) throw err;
    const servers = (process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8").split(",").map((s) => s.trim()).filter(Boolean);
    console.warn(`MongoDB SRV lookup failed (${err.message}). Retrying with DNS ${servers.join(", ")}...`);
    dns.setServers(servers);
    const client = new MongoClient(uri);
    await client.connect();
    return client;
  }
}
