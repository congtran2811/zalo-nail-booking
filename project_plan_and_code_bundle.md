# Complete Project Bundle: Zalo Nail/Spa Booking System
**Stack:** Node.js (TypeScript), PostgreSQL, Redis, Google Calendar API  
**Deployment Target:** Render / Supabase / Upstash (Free Tier)

---

## 1. Directory Structure

```text
zalo-nail-booking/
├── .env.example
├── package.json
├── tsconfig.json
├── db/
│   └── schema.sql
└── src/
    ├── config/
    │   ├── database.ts
    │   ├── redis.ts
    │   └── google.ts
    ├── services/
    │   ├── lock.service.ts
    │   ├── booking.service.ts
    │   └── calendar.service.ts
    └── server.ts
```

---

## 2. Configuration & Environment Files

### File: `package.json`
```json
{
  "name": "zalo-nail-booking",
  "version": "1.0.0",
  "description": "Real-time nail & spa booking system with Redis concurrency locks and Google Calendar integration",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "googleapis": "^137.0.0",
    "ioredis": "^5.4.1",
    "pg": "^8.11.5",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "@types/pg": "^8.11.6",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
```

### File: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

### File: `.env.example`
```env
PORT=3000
NODE_ENV=development

# PostgreSQL Connection (Supabase or Neon)
DATABASE_URL=postgres://postgres:your_password@ep-cool-host.pooler.supabase.com:5432/postgres

# Redis Connection (Upstash Redis)
REDIS_URL=rediss://default:your_token@your-redis-instance.upstash.io:6379

# Google Calendar API OAuth2 Settings
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=1//your_refresh_token
```

---

## 3. Database Schema

### File: `db/schema.sql`
```sql
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
```

---

## 4. Application Source Code

### File: `src/config/database.ts`
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### File: `src/config/redis.ts`
```typescript
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
```

### File: `src/config/google.ts`
```typescript
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

export const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
```

### File: `src/services/lock.service.ts`
```typescript
import { redis } from '../config/redis.js';

export class LockService {
  /**
   * Temporary hold on a slot for 3 minutes (180 seconds)
   */
  static async acquireSlotHold(slotKey: string, sessionId: string): Promise<boolean> {
    const key = `lock:hold:${slotKey}`;
    const result = await redis.set(key, sessionId, 'EX', 180, 'NX');
    return result === 'OK';
  }

  static async releaseSlotHold(slotKey: string, sessionId: string): Promise<void> {
    const key = `lock:hold:${slotKey}`;
    const currentSession = await redis.get(key);
    if (currentSession === sessionId) {
      await redis.del(key);
    }
  }
}
```

### File: `src/services/calendar.service.ts`
```typescript
import { calendar } from '../config/google.js';

export class CalendarService {
  static async syncBookingToGoogleCalendar(booking: {
    customer_name: string;
    customer_phone: string;
    start_time: Date;
    end_time: Date;
  }): Promise<string | null> {
    try {
      const event = {
        summary: `[Nail/Spa] Khách: ${booking.customer_name}`,
        description: `SĐT Zalo khách hàng: ${booking.customer_phone}`,
        start: { dateTime: new Date(booking.start_time).toISOString() },
        end: { dateTime: new Date(booking.end_time).toISOString() }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error);
      return null;
    }
  }
}
```

### File: `src/services/booking.service.ts`
```typescript
import { pool } from '../config/database.js';

export interface CreateBookingDTO {
  customerName: string;
  customerPhone: string;
  serviceId: number;
  startTime: string;
  endTime: string;
}

export class BookingService {
  static async createBooking(dto: CreateBookingDTO) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Pessimistic lock check for overlapping slots
      const overlapQuery = `
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND start_time < $2
          AND end_time > $1
        FOR UPDATE;
      `;

      const overlapResult = await client.query(overlapQuery, [dto.startTime, dto.endTime]);

      if (overlapResult.rows.length > 0) {
        throw new Error('SLOT_ALREADY_BOOKED');
      }

      const insertQuery = `
        INSERT INTO bookings (customer_name, customer_phone, service_id, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      const result = await client.query(insertQuery, [
        dto.customerName,
        dto.customerPhone,
        dto.serviceId,
        dto.startTime,
        dto.endTime
      ]);

      await client.query('COMMIT');
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### File: `src/server.ts`
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { BookingService } from './services/booking.service.js';
import { LockService } from './services/lock.service.js';
import { CalendarService } from './services/calendar.service.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.json());

// Real-time Socket Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('hold_slot', async (data: { slotKey: string }) => {
    const success = await LockService.acquireSlotHold(data.slotKey, socket.id);
    if (success) {
      io.emit('slot_held', { slotKey: data.slotKey, by: socket.id });
    } else {
      socket.emit('hold_failed', { slotKey: data.slotKey, message: 'Slot is currently being held' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Endpoint: Ping to avoid Render spindown
app.get('/ping', (_req, res) => {
  res.status(200).send('PONG');
});

// Endpoint: Booking Creation
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await BookingService.createBooking(req.body);

    // Notify connected clients via WebSockets
    io.emit('booking_confirmed', { startTime: booking.start_time, endTime: booking.end_time });

    // Asynchronously sync to Google Calendar
    CalendarService.syncBookingToGoogleCalendar(booking).catch(console.error);

    return res.status(201).json({ success: true, booking });
  } catch (error: any) {
    if (error.message === 'SLOT_ALREADY_BOOKED') {
      return res.status(409).json({ success: false, message: 'Khung giờ này vừa có người đặt' });
    }
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 5. Import Instructions for Antigravity IDE

1. Download or copy the code content above.
2. In **Antigravity IDE**, create a new workspace folder.
3. Use the AI Assistant/Agent feature in Antigravity and prompt:  
   > *"Extract and create all project files according to the structure defined in this Markdown file."*
4. Run `npm install` in the terminal to fetch dependencies.
5. Create a `.env` file based on `.env.example` with your database and API credentials.