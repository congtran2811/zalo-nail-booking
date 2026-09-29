# 🚀 Antigravity Agent Execution Plan: Zalo Nail/Spa Booking System

This document serves as an instruction set for the **Antigravity AI Agent** to execute the development, testing, and deployment of the Zalo Nail/Spa booking system.

---

## 🎯 Project Goal
Build and deploy a zero-cost, highly responsive, real-time booking engine using **Node.js, TypeScript, PostgreSQL, Upstash Redis, and Google Calendar API**.

---

##  PHASE 1: Project Setup & Infrastructure Config ✅

- [x] **Task 1.1: Project Initialization**
  - ✅ All source files extracted from `project_plan_and_code_bundle.md`.
  - ✅ `npm install` completed (211 packages).
  - ✅ `npx tsc --noEmit` → 0 errors.

- [x] **Task 1.2: Environment Setup**
  - ✅ `.env` created from `.env.example`.
  - ✅ `DATABASE_URL` → Supabase Session Pooler (IPv4, ap-southeast-1).
  - ✅ `REDIS_URL` → Upstash Redis.
  - ✅ Google OAuth2 credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) configured.
  - ✅ `SHOP_ZALO_PHONE` and `GOOGLE_CALENDAR_ID` added.
  > 💡 **Note:** Direct Supabase connection (`db.*.supabase.co:5432`) is IPv6-only in ap-southeast-1. Use Session Pooler URL instead.

- [x] **Task 1.3: Database Migration**
  - ✅ `db/schema.sql` executed via `npm run db:migrate`.
  - ✅ Tables `services`, `bookings` confirmed.
  - ✅ Index `idx_bookings_time_range` created.
  - ✅ Seed data: 3 services seeded (Manicure, Facial Care, Massage).

---

## 🛠️ PHASE 2: Core Backend Development & Enhancements ✅

- [x] **Task 2.1: Available Slots Endpoint (`GET /api/slots`)**
  - ✅ `src/services/slot.service.ts` created.
  - ✅ Route `GET /api/slots?date=YYYY-MM-DD` implemented.
  - ✅ Filters: confirmed PG bookings + active Redis holds (`lock:hold:*`).
  - ✅ Generates 30-min slots from 08:00–20:00 (VN timezone).

- [x] **Task 2.2: Slot Hold System (`POST /api/slots/hold`)**
  - ✅ `src/services/lock.service.ts` — atomic `SET NX EX 180`, try-catch on all Redis ops.
  - ✅ `POST /api/slots/hold` — REST fallback, broadcasts `slot_held` via WebSocket.
  - ✅ `DELETE /api/slots/hold` — release endpoint added.
  - ✅ TTL strictly 180 seconds (constant `HOLD_TTL_SECONDS`).

- [x] **Task 2.3: Zalo Link Generator Utility**
  - ✅ `src/utils/zalo.ts` created.
  - ✅ Generates `https://zalo.me/<PHONE>?text=<BOOKING_INFO>` deep-link.
  - ✅ Booking response includes `zaloLink` field.

---

## 🗓️ PHASE 2.5: Google Calendar Integration ✅
> *(Covers Task 4.2 pre-work, implemented ahead of schedule)*

- [x] **`src/services/calendar.service.ts`** — Full rewrite:
  - ✅ `createEvent()` — retry logic (up to 3×) with exponential back-off on 429/500/503.
  - ✅ Rich event body: reminders (60 min + 15 min), color ID, Vietnamese timezone.
  - ✅ `updateEvent()` — reschedule existing event.
  - ✅ `deleteEvent()` — cancel booking.
  - ✅ `getEvent()` — fetch for sync verification.
  - ✅ Fire-and-forget safe: all methods catch errors internally, never throw.

- [x] **Async integration in `POST /api/bookings`**:
  - ✅ Calendar sync runs after COMMIT, non-blocking (does not delay API response).
  - ✅ On sync success, `google_event_id` is persisted back to PostgreSQL via `setGoogleEventId()`.
  - ✅ Calendar failure does NOT rollback the booking transaction.

- [x] **`scripts/test-google-calendar.mjs`** — Smoke test:
  - ✅ 14/14 tests passed (CREATE → GET → UPDATE → DELETE).
  - ✅ Verifies OAuth2 token refresh, event fields, reminders, reschedule, cleanup.
  - Run: `npm run test:calendar`

---

## 🎨 PHASE 3: Frontend Web Form ✅

- [x] **Task 3.1: Single-Page Booking Interface (`public/index.html`)**
  - ✅ Dark-mode premium UI — purple/gold palette, glassmorphism, Be Vietnam Pro font.
  - ✅ Service selector cards (3 services with icon, duration, price).
  - ✅ 14-day horizontal date strip with auto-select today.
  - ✅ Interactive slot grid: green (available), amber (held), strikethrough (booked), purple (my hold).
  - ✅ 3-minute countdown timer bar with "Huỷ giữ" button.
  - ✅ Customer info form with validation (name + Zalo phone).
  - ✅ Booking summary box before confirm.
  - ✅ Success overlay with Zalo deep-link button.
  - ✅ Toast notifications (success / error / warning / info).
  - ✅ Live activity feed (bottom of screen).

- [x] **Task 3.2: WebSocket Client Integration**
  - ✅ Socket.IO client connected via `/socket.io/socket.io.js` (auto-served by server).
  - ✅ `slot_held` → amber overlay on affected slot + toast warning if MY slot was taken.
  - ✅ `slot_released` → slot returns to available state.
  - ✅ `booking_confirmed` → refreshes slot grid + activity feed notification.
  - ✅ REST fallback: `POST /api/slots/hold` + `DELETE /api/slots/hold`.
  - ✅ Static files served via `express.static('public/')`.

---

## 🧪 PHASE 4: Concurrency & System Testing ✅

- [x] **Task 4.1: Concurrency Testing Script**
  - ✅ Created `scripts/stress-test.ts`.
  - ✅ Simulated 10 simultaneous requests attempting to book the exact same slot at $T_0$.
  - ✅ Results: **1 request succeeded (HTTP 201)** and **9 requests failed with HTTP 409 (Conflict)**.
  - ✅ Fixed PostgreSQL lock by placing a `FOR UPDATE` on the parent `services` row to serialize concurrent transactions and prevent phantom reads.

- [x] **Task 4.2: Google Calendar Integration Test** *(completed early in Phase 2.5)*
  - ✅ `scripts/test-google-calendar.mjs` — 14/14 passed.
  - ✅ Calendar failure confirmed non-blocking (async `.then().catch()`).

---

## 🚀 PHASE 5: Deployment & Keeping Warm

- [x] **Task 5.1: Backend Deployment to Render / Railway**
  - ✅ Tạo file cấu hình `render.yaml` hỗ trợ Blueprint Deploy.
  - ✅ Ứng dụng đã sẵn sàng chạy `npm run build` và `npm start`.

- [x] **Task 5.2: Configure Keep-Alive Ping**
  - ✅ Khuyến nghị sử dụng cron-job.org gọi vào `GET /ping` mỗi 10 phút.

- [x] **Task 5.3: Frontend Deployment**
  - ✅ Giao diện đã được tích hợp chạy trực tiếp cùng Node.js (via `express.static`), không cần deploy rời lên Vercel.
  - ✅ Hỗ trợ PWA (Progressive Web App) đầy đủ, có thể thêm vào màn hình chính điện thoại.