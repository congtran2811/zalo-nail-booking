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

-- Table: Business Hours (Giờ mở cửa mặc định)
CREATE TABLE IF NOT EXISTS business_hours (
    day_of_week INT PRIMARY KEY, -- 0 = Sunday, 1 = Monday, ... 6 = Saturday
    open_time TIME NOT NULL DEFAULT '08:00',
    close_time TIME NOT NULL DEFAULT '20:00',
    is_closed BOOLEAN NOT NULL DEFAULT false
);

-- Seed Default Business Hours (Mon-Sun: 08:00 - 20:00)
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES
(0, '08:00', '20:00', false),
(1, '08:00', '20:00', false),
(2, '08:00', '20:00', false),
(3, '08:00', '20:00', false),
(4, '08:00', '20:00', false),
(5, '08:00', '20:00', false),
(6, '08:00', '20:00', false)
ON CONFLICT DO NOTHING;

-- Table: Blocked Slots (Giờ nghỉ, bận việc)
CREATE TABLE IF NOT EXISTS blocked_slots (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for checking blocked overlapping times
CREATE INDEX IF NOT EXISTS idx_blocked_slots_time_range ON blocked_slots (start_time, end_time);

-- Table: Google Calendar Configs
CREATE TABLE IF NOT EXISTS google_calendar_configs (
    id SERIAL PRIMARY KEY,
    gmail_address VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


