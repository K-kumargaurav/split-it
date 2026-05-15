import dns from "dns/promises"

export async function GET() {
  let dnsResult = null
  try {
    const addresses = await dns.lookup("aws-0-ap-south-1.pooler.supabase.com")
    dnsResult = { resolved: true, address: addresses.address }
  } catch (e) {
    dnsResult = { resolved: false, error: String(e) }
  }

  return Response.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    dns: dnsResult,
  })
}
