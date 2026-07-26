import { Pool, PoolClient } from "pg";

declare global {
  var harvestPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://harvest:harvest@localhost:5432/harvest_db";

export const pool =
  global.harvestPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 15000,
  });

if (process.env.NODE_ENV !== "production") {
  global.harvestPool = pool;
}

/**
 * Transaction utility that handles connection checkout, commit/rollback, and cleanup
 * Accepts a callback that receives an active database client inside a transaction
 * Automatically commits on success, rolls back on error, and always releases the client
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
