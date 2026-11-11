ALTER TABLE "PopDevice" ADD COLUMN "tokenHash" TEXT;
ALTER TABLE "PopDevice" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "PopDevice_tokenHash_key" ON "PopDevice"("tokenHash");
CREATE TABLE "DevicePairing" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevicePairing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevicePairing_codeHash_key" ON "DevicePairing"("codeHash");
CREATE INDEX "DevicePairing_workspaceId_expiresAt_idx" ON "DevicePairing"("workspaceId", "expiresAt");
ALTER TABLE "DevicePairing" ADD CONSTRAINT "DevicePairing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePairing" ADD CONSTRAINT "DevicePairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
