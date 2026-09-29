-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Services
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

-- Table: Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    service_id INT REFERENCES services(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',
    google_event_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for overlapping slot checks
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON bookings (start_time, end_time);

-- Seed Initial Services Data
INSERT INTO services (name, duration_minutes, price) VALUES
('Làm Móng / Manicure', 45, 150000),
('Chăm Sóc Da Mặt / Facial Care', 60, 300000),
('Massage Cổ Vai Gáy', 30, 200000)
ON CONFLICT DO NOTHING;
