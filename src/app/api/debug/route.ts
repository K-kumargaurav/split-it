export async function GET() {
  let parsed = null
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    parsed = {
      host: url.hostname,
      port: url.port,
      user: url.username,
      database: url.pathname.slice(1),
      hasPassword: !!url.password,
    }
  } catch (e) {
    parsed = { error: "URL parse failed: " + String(e) }
  }

  return Response.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    hasBrevo: !!process.env.BREVO_SMTP_HOST,
    nodeEnv: process.env.NODE_ENV,
    dbParsed: parsed,
  })
}
