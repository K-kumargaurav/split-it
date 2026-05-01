-- CreateEnum
CREATE TYPE "GroupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "group_invites" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "GroupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,

    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invite_links" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_invites_tokenHash_key" ON "group_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "group_invites_groupId_status_idx" ON "group_invites"("groupId", "status");

-- CreateIndex
CREATE INDEX "group_invites_invitedEmail_idx" ON "group_invites"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "group_invite_links_tokenHash_key" ON "group_invite_links"("tokenHash");

-- CreateIndex
CREATE INDEX "group_invite_links_groupId_idx" ON "group_invite_links"("groupId");

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
