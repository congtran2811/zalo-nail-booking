/**
 * scripts/test-google-calendar.mjs
 *
 * Standalone smoke-test for Google Calendar API integration.
 * Run with:  node scripts/test-google-calendar.mjs
 *
 * Tests:
 *   0. Pre-flight env var check
 *   1. CREATE event
 *   2. GET event (verify fields)
 *   3. UPDATE event (+1 hour reschedule)
 *   4. DELETE event (cleanup)
 */

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const GREEN  = s => `\x1b[32m${s}\x1b[0m`;
const RED    = s => `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => `\x1b[33m${s}\x1b[0m`;
const BOLD   = s => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(GREEN(`  ✅ PASS`) + ` ${label}`);
    passed++;
  } else {
    console.log(RED(`  ❌ FAIL`) + ` ${label}` + (detail ? ` — ${detail}` : ''));
    failed++;
  }
}

// ── Setup Google Auth ─────────────────────────────────────────────────────────

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TIMEZONE    = 'Asia/Ho_Chi_Minh';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTestBooking(offsetMinutes = 15) {
  const start = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const end   = new Date(start.getTime() + 45 * 60 * 1000);
  return {
    customer_name:  'Test Khách Hàng (auto)',
    customer_phone: '0900000000',
    service_name:   'Làm Móng / Manicure',
    start_time: start,
    end_time:   end,
    notes: '🔬 Event test tự động — sẽ bị xóa sau khi test xong'
  };
}

function buildEventBody(booking) {
  return {
    summary: `[Nail/Spa] ${booking.customer_name}`,
    description: [
      `📱 SĐT Zalo: ${booking.customer_phone}`,
      `💅 Dịch vụ: ${booking.service_name}`,
      `📝 Ghi chú: ${booking.notes}`,
      ``,
      `⚙️  Tạo tự động bởi test-google-calendar.mjs`
    ].join('\n'),
    start: { dateTime: new Date(booking.start_time).toISOString(), timeZone: TIMEZONE },
    end:   { dateTime: new Date(booking.end_time).toISOString(),   timeZone: TIMEZONE },
    colorId: '11',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }
      ]
    }
  };
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log(BOLD('\n🧪 Google Calendar Integration Test'));
  console.log('═'.repeat(50));

  // ── 0. Pre-flight ─────────────────────────────────────────────────────────
  console.log(YELLOW('\n[0] Pre-flight: Environment Variables'));
  for (const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','GOOGLE_REFRESH_TOKEN']) {
    assert(!!process.env[key], `${key} is set`);
  }

  // ── 1. CREATE ─────────────────────────────────────────────────────────────
  console.log(YELLOW('\n[1] CREATE — calendar.events.insert()'));
  const booking = makeTestBooking(15);
  console.log(`     Start: ${booking.start_time.toLocaleString('vi-VN', { timeZone: TIMEZONE })}`);
  console.log(`     End:   ${booking.end_time.toLocaleString('vi-VN',   { timeZone: TIMEZONE })}`);

  let eventId = null;
  let eventLink = null;
  try {
    const resp = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: buildEventBody(booking),
      sendUpdates: 'none'
    });
    eventId   = resp.data.id;
    eventLink = resp.data.htmlLink;
    assert(!!eventId,   'Event ID returned');
    assert(!!eventLink, 'Event link returned');
    console.log(`     Event ID:   ${eventId}`);
    console.log(`     Event Link: ${eventLink}`);
  } catch (err) {
    assert(false, 'Event created', err?.message);
    printSummary();
    return;
  }

  // ── 2. GET ────────────────────────────────────────────────────────────────
  console.log(YELLOW('\n[2] GET — calendar.events.get()'));
  try {
    const resp = await calendar.events.get({ calendarId: CALENDAR_ID, eventId });
    assert(resp.data.id === eventId, 'Event ID matches');
    assert(resp.data.summary?.includes(booking.customer_name), `Summary contains "${booking.customer_name}"`);
    assert(resp.data.description?.includes(booking.customer_phone), `Description contains phone`);
    assert(resp.data.reminders?.overrides?.length === 2, 'Reminders set (2 overrides)');
    console.log(`     Summary: ${resp.data.summary}`);
    console.log(`     Status:  ${resp.data.status}`);
  } catch (err) {
    assert(false, 'Event fetched', err?.message);
  }

  // ── 3. UPDATE ─────────────────────────────────────────────────────────────
  console.log(YELLOW('\n[3] UPDATE — calendar.events.update() (+1 hour)'));
  const updated = makeTestBooking(75); // shift +1h
  updated.notes = '🔬 Updated — rescheduled test event';
  try {
    const resp = await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: buildEventBody(updated),
      sendUpdates: 'none'
    });
    assert(resp.data.id === eventId, 'Updated event ID matches');

    // Verify start time changed
    const newStart = new Date(resp.data.start?.dateTime ?? '');
    const expectedStart = new Date(updated.start_time);
    const diffMs = Math.abs(newStart.getTime() - expectedStart.getTime());
    assert(diffMs < 5000, 'Start time updated correctly (within 5s tolerance)');
    console.log(`     New start: ${newStart.toLocaleString('vi-VN', { timeZone: TIMEZONE })}`);
  } catch (err) {
    assert(false, 'Event updated', err?.message);
  }

  // ── 4. DELETE ─────────────────────────────────────────────────────────────
  console.log(YELLOW('\n[4] DELETE — calendar.events.delete() (cleanup)'));
  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId, sendUpdates: 'none' });
    assert(true, 'Delete API call succeeded (HTTP 204)');
  } catch (err) {
    assert(false, 'Event deleted', err?.message);
  }

  // Verify deletion — Google returns status:'cancelled', not 404
  await new Promise(r => setTimeout(r, 1500));
  try {
    const resp = await calendar.events.get({ calendarId: CALENDAR_ID, eventId });
    // Google marks deleted events as 'cancelled' rather than returning 404
    const isCancelled = resp.data.status === 'cancelled';
    assert(isCancelled, `Deleted event has status "cancelled" (got: "${resp.data.status}")`);
  } catch (err) {
    // 410 Gone or 404 Not Found also count as success
    const isGone = err?.code === 410 || err?.code === 404 || err?.status === 410 || err?.status === 404;
    assert(isGone, 'Deleted event returns 410 Gone / 404 Not Found');
  }

  printSummary();
}

function printSummary() {
  const total = passed + failed;
  console.log('\n' + '═'.repeat(50));
  console.log(BOLD('📊 Test Summary'));
  console.log(`   Total:  ${total}`);
  console.log(GREEN(`   Passed: ${passed}`));
  if (failed > 0) console.log(RED(`   Failed: ${failed}`));
  console.log('');
  if (failed === 0) {
    console.log(GREEN(BOLD('🎉 All tests passed! Google Calendar integration is fully working.')));
  } else {
    console.log(RED(BOLD(`⚠️  ${failed} test(s) failed. Check credentials and network.`)));
    process.exit(1);
  }
  console.log('');
}

runTests().catch(err => {
  console.error(RED('\n💥 Unhandled error:'), err);
  process.exit(1);
});
