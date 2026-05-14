export async function GET() {
  return Response.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    hasBrevo: !!process.env.BREVO_SMTP_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
}
