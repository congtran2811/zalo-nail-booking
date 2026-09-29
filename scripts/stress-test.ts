/**
 * scripts/stress-test.ts
 *
 * Concurrency Test for Booking Race Conditions
 *
 * Simulates 10 concurrent requests attempting to book the EXACT SAME SLOT
 * at the same time to verify that PostgreSQL transaction locking (FOR UPDATE)
 * prevents double-booking.
 *
 * Expected outcome: 1 request succeeds (HTTP 201), 9 requests fail (HTTP 409).
 */

const API_URL = 'http://localhost:3000/api/bookings';

// ANSI colors for console output
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function runConcurrencyTest() {
  console.log(BOLD('\n💣 Concurrency Stress Test: 10 Concurrent Bookings to 1 Slot'));
  console.log('═'.repeat(65));

  // Build target slot (day after tomorrow at 14:00)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(14, 0, 0, 0); // 14:00 local time
  const startISO = tomorrow.toISOString();

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 45);
  const endISO = tomorrowEnd.toISOString();

  console.log(`Target Slot: ${startISO} to ${endISO}`);
  console.log('Firing 10 requests simultaneously...');

  // Create 10 identical payloads (different user names to track which one wins)
  const requests = Array.from({ length: 10 }).map((_, index) => {
    return {
      customerName:  `User ${index + 1}`,
      customerPhone: `090000000${index}`,
      serviceId:     1,
      serviceName:   'Làm Móng',
      startTime:     startISO,
      endTime:       endISO
    };
  });

  // Prepare fetch promises
  const promises = requests.map(async (payload, idx) => {
    try {
      const start = Date.now();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      const latency = Date.now() - start;

      return {
        id: idx + 1,
        status: res.status,
        success: data.success,
        message: data.message,
        latency
      };
    } catch (err: any) {
      return { id: idx + 1, status: 500, success: false, message: err.message, latency: 0 };
    }
  });

  // Fire them all AT THE EXACT SAME TIME
  const results = await Promise.all(promises);

  // Analyze results
  const successful = results.filter(r => r.status === 201 || r.success === true);
  const conflicts  = results.filter(r => r.status === 409);
  const errors     = results.filter(r => r.status !== 201 && r.status !== 409);

  console.log('\n' + BOLD('📊 Results Analysis'));
  console.log('═'.repeat(65));

  // Print individual results sorted by latency (approximate order of completion)
  results.sort((a, b) => a.latency - b.latency).forEach(r => {
    const time = `${r.latency}ms`.padEnd(5);
    if (r.success) {
      console.log(`${GREEN('✅ SUCCESS')} [${time}] User ${r.id}: HTTP ${r.status}`);
    } else if (r.status === 409) {
      console.log(`${YELLOW('⚠️  CONFLICT')} [${time}] User ${r.id}: HTTP ${r.status} - ${r.message}`);
    } else {
      console.log(`${RED('❌ ERROR')}   [${time}] User ${r.id}: HTTP ${r.status} - ${r.message}`);
    }
  });

  console.log('\n' + BOLD('📈 Summary'));
  console.log(`Expected : 1 Success, 9 Conflicts`);
  console.log(`Actual   : ${successful.length} Success, ${conflicts.length} Conflicts, ${errors.length} Errors`);

  // Assertions
  if (successful.length === 1 && conflicts.length === 9) {
    console.log('\n' + GREEN(BOLD('🎉 RACE-CONDITION PREVENTION WORKS PERFECTLY!')));
    console.log('Only 1 booking was committed to PostgreSQL. The transaction FOR UPDATE block successfully locked the slot for the winner and rejected the others.');
  } else if (successful.length > 1) {
    console.log('\n' + RED(BOLD('❌ CRITICAL FAILURE: DOUBLE BOOKING OCCURRED!')));
    console.log('Multiple requests managed to book the same slot. Check PostgreSQL locking logic.');
    process.exit(1);
  } else {
    console.log('\n' + YELLOW(BOLD('⚠️ UNEXPECTED RESULT')));
    process.exit(1);
  }
}

runConcurrencyTest().catch(console.error);
