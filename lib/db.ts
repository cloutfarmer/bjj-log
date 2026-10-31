import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const globalDb = globalThis as typeof globalThis & { bjjPool?: Pool };

export function database(): Pool {
  if (!globalDb.bjjPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is missing.");
    const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 5000 });
    // Vercel Fluid compute can release idle connections before suspending an instance.
    attachDatabasePool(pool);
    pool.on("error", () => console.error("An idle database connection failed."));
    globalDb.bjjPool = pool;
  }
  return globalDb.bjjPool;
}
