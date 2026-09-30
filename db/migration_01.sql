-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS booking_services (
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    service_id INT REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (booking_id, service_id)
);

-- 2. Migrate existing data (Move service_id from bookings to booking_services)
INSERT INTO booking_services (booking_id, service_id)
SELECT id, service_id 
FROM bookings 
WHERE service_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the service_id column from bookings
ALTER TABLE bookings DROP COLUMN IF EXISTS service_id;
