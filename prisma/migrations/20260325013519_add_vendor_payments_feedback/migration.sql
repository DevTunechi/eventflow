/*
  Warnings:

  - You are about to drop the column `message` on the `VendorFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `VendorFeedback` table. All the data in the column will be lost.
  - You are about to drop the column `submittedAt` on the `VendorFeedback` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendorId,eventId]` on the table `VendorFeedback` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ComplaintRaisedBy" AS ENUM ('PLANNER', 'VENDOR');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_DISCUSSION', 'RESOLVED');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "totalCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "VendorFeedback" DROP COLUMN "message",
DROP COLUMN "rating",
DROP COLUMN "submittedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "plannerComment" TEXT,
ADD COLUMN     "plannerRating" INTEGER,
ADD COLUMN     "plannerWouldHire" BOOLEAN,
ADD COLUMN     "vendorComment" TEXT,
ADD COLUMN     "vendorRating" INTEGER,
ADD COLUMN     "vendorWouldWork" BOOLEAN;

-- DropEnum
DROP TYPE "VendorAccess";

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "receiptUrl" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "disputeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorComplaint" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "raisedBy" "ComplaintRaisedBy" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_idx" ON "VendorPayment"("vendorId");

-- CreateIndex
CREATE INDEX "VendorPayment_eventId_idx" ON "VendorPayment"("eventId");

-- CreateIndex
CREATE INDEX "VendorComplaint_vendorId_idx" ON "VendorComplaint"("vendorId");

-- CreateIndex
CREATE INDEX "VendorComplaint_eventId_idx" ON "VendorComplaint"("eventId");

-- CreateIndex
CREATE INDEX "VendorFeedback_vendorId_idx" ON "VendorFeedback"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorFeedback_vendorId_eventId_key" ON "VendorFeedback"("vendorId", "eventId");

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorComplaint" ADD CONSTRAINT "VendorComplaint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorComplaint" ADD CONSTRAINT "VendorComplaint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
