-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'BIRTHDAY', 'CORPORATE', 'BURIAL', 'ANNIVERSARY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InviteModel" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SeatingType" AS ENUM ('PRE_ASSIGNED', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "MenuAccess" AS ENUM ('PRE_EVENT', 'AT_EVENT');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('APPETIZER', 'MAIN', 'DRINK', 'DESSERT', 'SPECIAL');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'WAITLISTED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InviteChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'MANUAL');

-- CreateEnum
CREATE TYPE "VendorRole" AS ENUM ('CATERER', 'SECURITY', 'MEDIA', 'LIVE_BAND', 'DJ', 'MC', 'HYPEMAN', 'AFTER_PARTY', 'DECORATOR', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorAccess" AS ENUM ('LIMITED', 'STANDARD', 'FULL');

-- CreateEnum
CREATE TYPE "UsherRole" AS ENUM ('MAIN', 'FLOOR');

-- CreateEnum
CREATE TYPE "GiftType" AS ENUM ('CASH_TRANSFER', 'CASH_PHYSICAL', 'PHYSICAL_ITEM');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING', 'NOTIFIED', 'RECEIVED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "businessName" TEXT,
    "businessLogo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "plannerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "EventType" NOT NULL DEFAULT 'WEDDING',
    "invitationCard" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueCapacity" INTEGER,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "rsvpDeadline" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "inviteModel" "InviteModel" NOT NULL DEFAULT 'OPEN',
    "requireOtp" BOOLEAN NOT NULL DEFAULT false,
    "totalTables" INTEGER,
    "seatsPerTable" INTEGER,
    "releaseReservedAfter" INTEGER,
    "brandColor" TEXT DEFAULT '#C9A84C',
    "brandLogo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "maxGuests" INTEGER,
    "seatingType" "SeatingType" NOT NULL DEFAULT 'DYNAMIC',
    "menuAccess" "MenuAccess" NOT NULL DEFAULT 'AT_EVENT',
    "tablePrefix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "label" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "reservedForTierId" TEXT,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatGroup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxSize" INTEGER NOT NULL DEFAULT 10,
    "tableId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "MenuCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tierId" TEXT,
    "seatGroupId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "inviteToken" TEXT,
    "inviteTokenUsed" BOOLEAN NOT NULL DEFAULT false,
    "inviteSentAt" TIMESTAMP(3),
    "inviteChannel" "InviteChannel" NOT NULL DEFAULT 'EMAIL',
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "rsvpStatus" "RSVPStatus" NOT NULL DEFAULT 'PENDING',
    "rsvpAt" TIMESTAMP(3),
    "tableId" TEXT,
    "tableNumber" TEXT,
    "seatNumber" TEXT,
    "seatAssignedAt" TIMESTAMP(3),
    "seatAssignedBy" TEXT DEFAULT 'SYSTEM',
    "qrCode" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestMeal" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "GuestMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tribute" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" "VendorRole" NOT NULL,
    "notes" TEXT,
    "portalToken" TEXT NOT NULL,
    "lastAccessed" TIMESTAMP(3),
    "canOverrideCapacity" BOOLEAN NOT NULL DEFAULT false,
    "capacityOverrideActive" BOOLEAN NOT NULL DEFAULT false,
    "capacityOverrideAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usher" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UsherRole" NOT NULL DEFAULT 'FLOOR',
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT,
    "giftType" "GiftType" NOT NULL,
    "amount" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'NGN',
    "description" TEXT,
    "status" "GiftStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "senderName" TEXT,
    "senderPhone" TEXT,
    "senderEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_plannerId_idx" ON "Event"("plannerId");

-- CreateIndex
CREATE INDEX "Event_slug_idx" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "GuestTier_eventId_idx" ON "GuestTier"("eventId");

-- CreateIndex
CREATE INDEX "Table_eventId_idx" ON "Table"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatGroup_code_key" ON "SeatGroup"("code");

-- CreateIndex
CREATE INDEX "SeatGroup_eventId_idx" ON "SeatGroup"("eventId");

-- CreateIndex
CREATE INDEX "SeatGroup_code_idx" ON "SeatGroup"("code");

-- CreateIndex
CREATE INDEX "MenuItem_eventId_idx" ON "MenuItem"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_inviteToken_key" ON "Guest"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_qrCode_key" ON "Guest"("qrCode");

-- CreateIndex
CREATE INDEX "Guest_eventId_idx" ON "Guest"("eventId");

-- CreateIndex
CREATE INDEX "Guest_qrCode_idx" ON "Guest"("qrCode");

-- CreateIndex
CREATE INDEX "Guest_inviteToken_idx" ON "Guest"("inviteToken");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "GuestMeal_guestId_menuItemId_key" ON "GuestMeal"("guestId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Tribute_guestId_key" ON "Tribute"("guestId");

-- CreateIndex
CREATE INDEX "Tribute_eventId_idx" ON "Tribute"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_portalToken_key" ON "Vendor"("portalToken");

-- CreateIndex
CREATE INDEX "Vendor_eventId_idx" ON "Vendor"("eventId");

-- CreateIndex
CREATE INDEX "Vendor_portalToken_idx" ON "Vendor"("portalToken");

-- CreateIndex
CREATE UNIQUE INDEX "Usher_accessToken_key" ON "Usher"("accessToken");

-- CreateIndex
CREATE INDEX "Usher_eventId_idx" ON "Usher"("eventId");

-- CreateIndex
CREATE INDEX "GiftRecord_eventId_idx" ON "GiftRecord"("eventId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestTier" ADD CONSTRAINT "GuestTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_reservedForTierId_fkey" FOREIGN KEY ("reservedForTierId") REFERENCES "GuestTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatGroup" ADD CONSTRAINT "SeatGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatGroup" ADD CONSTRAINT "SeatGroup_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "GuestTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_seatGroupId_fkey" FOREIGN KEY ("seatGroupId") REFERENCES "SeatGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMeal" ADD CONSTRAINT "GuestMeal_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMeal" ADD CONSTRAINT "GuestMeal_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tribute" ADD CONSTRAINT "Tribute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tribute" ADD CONSTRAINT "Tribute_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usher" ADD CONSTRAINT "Usher_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftRecord" ADD CONSTRAINT "GiftRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftRecord" ADD CONSTRAINT "GiftRecord_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
