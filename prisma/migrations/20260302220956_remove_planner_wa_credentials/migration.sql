-- AlterTable
ALTER TABLE "User" ADD COLUMN     "waAccessToken" TEXT,
ADD COLUMN     "waBusinessName" TEXT,
ADD COLUMN     "waConnectedAt" TIMESTAMP(3),
ADD COLUMN     "waDisplayName" TEXT,
ADD COLUMN     "waMessagesSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waPhoneNumber" TEXT,
ADD COLUMN     "waPhoneNumberId" TEXT,
ADD COLUMN     "waWabaId" TEXT;
