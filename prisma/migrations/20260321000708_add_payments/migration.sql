-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "TopUpType" AS ENUM ('GUESTS', 'WHATSAPP', 'CHECKIN');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paystackCustomerCode" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paystackSubCode" TEXT,
    "paystackCustomerCode" TEXT,
    "paystackEmailToken" TEXT,
    "amount" INTEGER NOT NULL,
    "nextBillingDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "TopUpType" NOT NULL,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "guestBonus" INTEGER DEFAULT 200,
    "paystackRef" TEXT,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "reference" TEXT,
    "amount" INTEGER,
    "status" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_paystackSubCode_idx" ON "Subscription"("paystackSubCode");

-- CreateIndex
CREATE UNIQUE INDEX "EventTopUp_paystackRef_key" ON "EventTopUp"("paystackRef");

-- CreateIndex
CREATE INDEX "EventTopUp_userId_idx" ON "EventTopUp"("userId");

-- CreateIndex
CREATE INDEX "EventTopUp_eventId_idx" ON "EventTopUp"("eventId");

-- CreateIndex
CREATE INDEX "EventTopUp_paystackRef_idx" ON "EventTopUp"("paystackRef");

-- CreateIndex
CREATE INDEX "PaymentLog_userId_idx" ON "PaymentLog"("userId");

-- CreateIndex
CREATE INDEX "PaymentLog_reference_idx" ON "PaymentLog"("reference");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTopUp" ADD CONSTRAINT "EventTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTopUp" ADD CONSTRAINT "EventTopUp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
