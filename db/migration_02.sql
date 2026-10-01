-- Create Business Hours table
CREATE TABLE IF NOT EXISTS business_hours (
    id SERIAL PRIMARY KEY,
    day_of_week INT NOT NULL UNIQUE CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '20:00',
    is_closed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed Business Hours (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES 
(0, '09:00', '20:00', false),
(1, '09:00', '20:00', false),
(2, '09:00', '20:00', false),
(3, '09:00', '20:00', false),
(4, '09:00', '20:00', false),
(5, '09:00', '20:00', false),
(6, '09:00', '20:00', false)
ON CONFLICT (day_of_week) DO NOTHING;

-- Create Blocked Slots table
CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create Google Configs table (for multi-calendar support)
CREATE TABLE IF NOT EXISTS google_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expiry_date BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
