import pg from "pg"

export async function GET() {
  let dbTest = null
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    const client = new pg.Client({
      host: url.hostname,
      port: parseInt(url.port),
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    })
    await client.connect()
    const result = await client.query("SELECT 1 as test")
    await client.end()
    dbTest = { connected: true, result: result.rows[0] }
  } catch (e) {
    dbTest = { connected: false, error: String(e) }
  }

  return Response.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    dbTest,
  })
}
