-- prisma/migrations/XXXXXXXX_add_venue_map_fields/migration.sql
-- Run: npx prisma migrate dev --name add_venue_map_fields

ALTER TABLE "Event" ADD COLUMN "venueLat"    DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "venueLng"    DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "venueMapUrl" TEXT;
