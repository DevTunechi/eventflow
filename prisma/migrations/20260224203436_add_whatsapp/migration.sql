/*
  Warnings:

  - You are about to drop the column `waAccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waBusinessName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waConnectedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waDisplayName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waMessagesSent` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waPhoneNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waPhoneNumberId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `waWabaId` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "waAccessToken",
DROP COLUMN "waBusinessName",
DROP COLUMN "waConnectedAt",
DROP COLUMN "waDisplayName",
DROP COLUMN "waMessagesSent",
DROP COLUMN "waPhoneNumber",
DROP COLUMN "waPhoneNumberId",
DROP COLUMN "waWabaId";
