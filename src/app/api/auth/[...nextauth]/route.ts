import { handlers } from "@/lib/auth";

// The full auth config pulls in nodemailer (Nodemailer provider), bcrypt
// (Credentials provider), and the Prisma client (adapter) — all Node-only.
// Pin this route to the Node.js runtime so it isn't accidentally promoted to
// the edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
