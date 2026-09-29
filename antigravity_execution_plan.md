# 🚀 Antigravity Agent Execution Plan: Zalo Nail/Spa Booking System

This document serves as an instruction set for the **Antigravity AI Agent** to execute the development, testing, and deployment of the Zalo Nail/Spa booking system.

---

## 🎯 Project Goal
Build and deploy a zero-cost, highly responsive, real-time booking engine using **Node.js, TypeScript, PostgreSQL, Upstash Redis, and Google Calendar API**.

---

##  PHASE 1: Project Setup & Infrastructure Config

- [ ] **Task 1.1: Project Initialization**
  - Prompt Agent: `Extract all source files from project_bundle.md into their respective folder paths.`
  - Run `npm install` to install all dependencies.
  - Verify TypeScript compilation using `npx tsc --noEmit`.

- [ ] **Task 1.2: Environment Setup**
  - Copy `.env.example` to `.env`.
  - Fill in Supabase / Neon PostgreSQL connection string (`DATABASE_URL`).
  - Fill in Upstash Redis URL (`REDIS_URL`).
  - Fill in Google OAuth2 Credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`).

- [ ] **Task 1.3: Database Migration**
  - Execute `db/schema.sql` on the PostgreSQL instance.
  - Confirm table creation for `services` and `bookings`, along with index `idx_bookings_time_range`.

---

## 🛠️ PHASE 2: Core Backend Development & Enhancements

- [ ] **Task 2.1: Available Slots Endpoint (`GET /api/slots`)**
  - **Goal:** Return list of open time slots for a given date, filtering out booked slots and active Redis holds.
  - Create route `GET /api/slots?date=YYYY-MM-DD`.
  - Fetch existing bookings from PostgreSQL for that date.
  - Fetch active Redis holds matching `lock:hold:*`.
  - Generate available 30-min/45-min interval slots and return JSON array.

- [ ] **Task 2.2: Slot Hold System (`POST /api/slots/hold`)**
  - Create REST endpoint fallback for holding a slot if WebSocket is unavailable.
  - Ensure TTL is strictly set to 180 seconds in Redis.

- [ ] **Task 2.3: Zalo Link Generator Utility**
  - Create a helper module `src/utils/zalo.ts`.
  - Generate deep-link URLs to redirect users back to Zalo personal chat upon successful booking confirmation: `https://zalo.me/<CHỦ_TIỆM_PHONE>?text=<BOOKING_INFO>`.

---

## 🎨 PHASE 3: Frontend Web Form (Vercel Ready)

- [ ] **Task 3.1: Single-Page Booking Interface (`public/index.html` or React app)**
  - Build responsive mobile-friendly UI using TailwindCSS.
  - Components needed:
    - Service selector dropdown / cards.
    - Date picker & Interactive time-slot grid.
    - Customer Info form (Name, Zalo Phone).
    - Real-time indicator ("Slot selected by another user" status).

- [ ] **Task 3.2: WebSocket Client Integration**
  - Connect Socket.io client to backend server.
  - Disable/gray out time slots dynamically when receiving `slot_held` or `booking_confirmed` events.

---

## 🧪 PHASE 4: Concurrency & System Testing

- [ ] **Task 4.1: Concurrency Testing Script**
  - Create `tests/concurrency.test.ts`.
  - Simulate 10 simultaneous requests attempting to book the exact same slot at $T_0$.
  - Assert that **only 1 request succeeds (HTTP 201)** and **9 requests fail with HTTP 409 (Conflict)**.

- [ ] **Task 4.2: Google Calendar Integration Test**
  - Trigger a booking creation and verify event creation on Google Calendar.
  - Ensure failure in Google Calendar sync does NOT rollback PostgreSQL transaction (it must fail silently or queue a retry).

---

## 🚀 PHASE 5: Deployment & Keeping Warm

- [ ] **Task 5.1: Backend Deployment to Render / Railway**
  - Deploy Node.js server.
  - Set production Environment Variables in the Cloud dashboard.

- [ ] **Task 5.2: Configure Keep-Alive Ping**
  - Setup external cron (e.g. `cron-job.org` or `UptimeRobot`) to ping `GET /ping` every 10 minutes to prevent Render free-tier cold starts.

- [ ] **Task 5.3: Frontend Deployment**
  - Deploy static booking interface to Vercel or Netlify.
  - Attach the final Web Form URL to Zalo personal auto-responder / bio link.