export async function GET() {
  return Response.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    hasBrevo: !!process.env.BREVO_SMTP_HOST,
    nodeEnv: process.env.NODE_ENV,
    dbHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "not set",
    dbUrl: process.env.DATABASE_URL?.substring(0, 50) ?? "not set",
  });
}
