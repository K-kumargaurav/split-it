import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(
    `SELECT key, count, reset_at FROM rate_limit_buckets WHERE key LIKE '%otp-send%' ORDER BY reset_at DESC`
  );
  if (rows.length === 0) {
    console.log("No otp-send rate limit buckets found");
  } else {
    for (const b of rows) {
      const expired = new Date(b.reset_at) < new Date();
      console.log(`Key: ${b.key}`);
      console.log(`  Count: ${b.count}, Reset at: ${b.reset_at.toISOString()}, Expired: ${expired}`);
    }
  }
  await pool.end();
}

main();
