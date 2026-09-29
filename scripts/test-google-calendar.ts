/**
 * scripts/test-google-calendar.ts
 *
 * Standalone smoke-test for Google Calendar API integration.
 *
 * Run with:
 *   npx ts-node-dev --transpile-only scripts/test-google-calendar.ts
 *
 * What it tests:
 *   1. OAuth2 token refresh (verifies GOOGLE_* env vars are valid)
 *   2. Event CREATE  → verifies event appears in primary calendar
 *   3. Event GET     → fetches the created event and validates fields
 *   4. Event UPDATE  → reschedules the event by +1 hour
 *   5. Event DELETE  → removes the test event (cleanup)
 */

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
dotenv.config();

import { CalendarService } from '../src/services/calendar.service.js';
import type { CalendarBookingInput } from '../src/services/calendar.service.js';

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(GREEN(`  ✅ PASS`) + ` ${label}`);
    passed++;
  } else {
    console.log(RED(`  ❌ FAIL`) + ` ${label}` + (detail ? ` — ${detail}` : ''));
    failed++;
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a test booking 15 minutes from now (so it's valid in calendar) */
function makeTestBooking(offsetMinutes = 15) {
  const start = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const end   = new Date(start.getTime() + 45 * 60 * 1000); // 45-min service

  return {
    customer_name:  'Test Khách Hàng (auto)',
    customer_phone: '0900000000',
    service_name:   'Làm Móng / Manicure',
    start_time: start,
    end_time:   end,
    notes: '🔬 Đây là event test tự động — sẽ bị xóa ngay sau khi test xong'
  };
}

// ── Main test runner ──────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log(BOLD('\n🧪 Google Calendar Integration Test'));
  console.log('═'.repeat(50));

  // ── Pre-flight: env vars ────────────────────────────────────────────────────
  console.log(YELLOW('\n[0] Pre-flight: Environment Variables'));
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GOOGLE_REFRESH_TOKEN'
  ];
  for (const key of requiredEnvVars) {
    assert(!!process.env[key], `${key} is set`, `value: ${process.env[key] ? '[PRESENT]' : '[MISSING]'}`);
  }

  // ── Test 1: CREATE event ────────────────────────────────────────────────────
  console.log(YELLOW('\n[1] CREATE — syncBookingToGoogleCalendar()'));
  const booking = makeTestBooking();
  console.log(`     Start: ${booking.start_time.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  console.log(`     End:   ${booking.end_time.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

  const result = await CalendarService.createEvent(booking);

  assert(result.success, 'Event created successfully');
  assert(typeof result.eventId === 'string' && result.eventId.length > 0, 'Event ID returned');
  assert(typeof result.eventLink === 'string' && result.eventLink!.startsWith('https://'), 'Event link returned');

  if (!result.eventId) {
    console.log(RED('\n⛔ Cannot continue — event creation failed. Check credentials.'));
    if (result.error) console.log(RED(`   Error: ${result.error}`));
    printSummary();
    return;
  }

  const eventId = result.eventId;
  console.log(`     Event ID:   ${eventId}`);
  console.log(`     Event Link: ${result.eventLink}`);

  // ── Test 2: GET event ───────────────────────────────────────────────────────
  console.log(YELLOW('\n[2] GET — getEvent()'));
  const fetchedEvent = await CalendarService.getEvent(eventId);

  assert(fetchedEvent !== null, 'Event fetched from Calendar');
  assert(fetchedEvent?.id === eventId, 'Event ID matches');
  assert(
    fetchedEvent?.summary?.includes(booking.customer_name) ?? false,
    `Summary contains customer name "${booking.customer_name}"`
  );
  assert(
    fetchedEvent?.description?.includes(booking.customer_phone) ?? false,
    `Description contains phone "${booking.customer_phone}"`
  );
  console.log(`     Summary: ${fetchedEvent?.summary}`);

  // ── Test 3: UPDATE event ────────────────────────────────────────────────────
  console.log(YELLOW('\n[3] UPDATE — updateEvent() (+1 hour rescheduled)'));
  const updatedBooking = makeTestBooking(75); // shift +1 hour more
  updatedBooking.notes = '🔬 Updated event — test reschedule';

  const updateResult = await CalendarService.updateEvent(eventId, updatedBooking);
  assert(updateResult.success, 'Event updated successfully');
  assert(updateResult.eventId === eventId, 'Updated event ID matches original');

  // Verify the update in Calendar
  const updatedEvent = await CalendarService.getEvent(eventId);
  const expectedStart = updatedBooking.start_time.toISOString();
  assert(
    updatedEvent?.start?.dateTime?.startsWith(expectedStart.substring(0, 16)) ?? false,
    'Start time updated correctly'
  );

  // ── Test 4: DELETE event ────────────────────────────────────────────────────
  console.log(YELLOW('\n[4] DELETE — deleteEvent() (cleanup)'));
  const deleted = await CalendarService.deleteEvent(eventId);
  assert(deleted, 'Event deleted successfully');

  // Verify deletion — getEvent should return null
  await new Promise(r => setTimeout(r, 1500)); // brief pause for Google's propagation
  const deletedEvent = await CalendarService.getEvent(eventId);
  assert(deletedEvent === null, 'Deleted event no longer fetchable (returns null)');

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n' + '═'.repeat(50));
  console.log(BOLD('📊 Test Summary'));
  console.log(`   Total:  ${total}`);
  console.log(GREEN(`   Passed: ${passed}`));
  if (failed > 0) console.log(RED(`   Failed: ${failed}`));
  console.log('');

  if (failed === 0) {
    console.log(GREEN(BOLD('🎉 All tests passed! Google Calendar integration is working.')));
  } else {
    console.log(RED(BOLD(`⚠️  ${failed} test(s) failed. Check credentials and network.`)));
    process.exit(1);
  }
  console.log('');
}

// ── Entry point ───────────────────────────────────────────────────────────────
runTests().catch(err => {
  console.error(RED('\n💥 Unhandled error in test runner:'), err);
  process.exit(1);
});
