-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Reshape verification_tokens. Table has no rows yet (no flows write to it),
-- so drop the legacy NextAuth-style columns and add the typed columns.
DROP INDEX IF EXISTS "verification_tokens_token_key";
DROP INDEX IF EXISTS "verification_tokens_identifier_token_key";

ALTER TABLE "verification_tokens"
    DROP COLUMN "token",
    ADD COLUMN "tokenHash" TEXT NOT NULL,
    ADD COLUMN "purpose" "VerificationPurpose" NOT NULL,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_purpose_key" ON "verification_tokens"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");
