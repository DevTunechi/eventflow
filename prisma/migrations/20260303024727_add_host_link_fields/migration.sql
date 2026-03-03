/*
  Warnings:

  - A unique constraint covering the columns `[hostToken]` on the table `Event` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "hostEmail" TEXT,
ADD COLUMN     "hostName" TEXT,
ADD COLUMN     "hostToken" TEXT,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Event_hostToken_key" ON "Event"("hostToken");
