import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
  }
  return dummyHashPromise;
}

// Used to keep credentials sign-in timing constant when the user does not exist
// or has no password hash. Without this, attackers can enumerate accounts by
// measuring response time (no bcrypt = ~120 ms faster).
export async function dummyVerifyPassword(plain: string): Promise<void> {
  const hash = await getDummyHash();
  await bcrypt.compare(plain, hash);
}
