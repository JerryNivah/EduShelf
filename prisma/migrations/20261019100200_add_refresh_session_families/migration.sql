-- CreateTable
CREATE TABLE "public"."RefreshSessionFamily" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSessionFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshSessionFamily_userId_idx" ON "public"."RefreshSessionFamily"("userId");

-- AddForeignKey
ALTER TABLE "public"."RefreshSessionFamily" ADD CONSTRAINT "RefreshSessionFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
