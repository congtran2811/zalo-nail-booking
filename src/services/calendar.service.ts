import { google, calendar_v3 } from 'googleapis';
import { pool } from '../config/database.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarBookingInput {
  customer_name: string;
  customer_phone: string;
  start_time: Date | string;
  end_time: Date | string;
  service_name?: string;
  notes?: string;
}

export interface CalendarSyncResult {
  success: boolean;
  eventId: string | null;
  eventLink: string | null;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/** Exponential back-off sleep */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Get dynamic google calendar client */
async function getActiveCalendarClient() {
  const { rows } = await pool.query('SELECT * FROM google_calendar_configs WHERE is_active = true LIMIT 1');
  if (rows.length === 0) {
    throw new Error('No active Google Calendar configuration found in database.');
  }

  const config = rows[0];
  const oauth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({ refresh_token: config.refresh_token });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/** Build a rich, structured Calendar event body */
function buildEventBody(booking: CalendarBookingInput): calendar_v3.Schema$Event {
  const startISO = new Date(booking.start_time).toISOString();
  const endISO   = new Date(booking.end_time).toISOString();
  const service  = booking.service_name ?? 'Dịch vụ Nail/Spa';

  const descLines = [
    `📱 SĐT Zalo: ${booking.customer_phone}`,
    `💅 Dịch vụ: ${service}`,
    booking.notes ? `📝 Ghi chú: ${booking.notes}` : null,
    ``,
    `⚙️  Tạo tự động bởi Zalo Nail Booking System`
  ].filter(Boolean).join('\n');

  return {
    summary:     `[Nail/Spa] ${booking.customer_name}`,
    description: descLines,
    start: { dateTime: startISO, timeZone: TIMEZONE },
    end:   { dateTime: endISO,   timeZone: TIMEZONE },
    colorId: '11', // Tomato red — easily visible in Calendar
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },  // 1 hour before
        { method: 'popup', minutes: 15 }   // 15 min before
      ]
    }
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Google Calendar Service
 *
 * All methods are async and safe to call fire-and-forget (they never throw).
 * Failures are logged and returned in the result object so the caller
 * can decide whether to retry or store the pending sync for later.
 */
export class CalendarService {
  /**
   * Create a Google Calendar event for a confirmed booking.
   *
   * Retries up to MAX_RETRY_ATTEMPTS times with exponential back-off on
   * transient errors (rate limits, network timeouts).
   *
   * @returns CalendarSyncResult — always resolves, never rejects
   */
  static async syncBookingToGoogleCalendar(
    booking: CalendarBookingInput
  ): Promise<string | null> {
    const result = await CalendarService.createEvent(booking);
    return result.eventId;
  }

  /**
   * Full event creation with retry and detailed result.
   */
  static async createEvent(
    booking: CalendarBookingInput
  ): Promise<CalendarSyncResult> {
    const eventBody = buildEventBody(booking);

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const calendar = await getActiveCalendarClient();
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventBody,
          sendUpdates: 'none' // don't spam guests
        });

        const eventId   = response.data.id   ?? null;
        const eventLink = response.data.htmlLink ?? null;

        console.log(
          `[CalendarService] Event created (attempt ${attempt}):`,
          eventId, '|', eventLink
        );

        return { success: true, eventId, eventLink };

      } catch (err: any) {
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS;
        const isRetryable   = [429, 500, 503].includes(err?.code ?? err?.status);

        console.error(
          `[CalendarService] createEvent attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed:`,
          err?.message ?? err
        );

        if (!isRetryable || isLastAttempt) {
          return {
            success: false,
            eventId: null,
            eventLink: null,
            error: err?.message ?? 'Unknown error'
          };
        }

        // Exponential back-off: 1s, 2s, 4s …
        await sleep(RETRY_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    // Unreachable, but satisfies TS exhaustiveness
    return { success: false, eventId: null, eventLink: null, error: 'Max retries exceeded' };
  }

  /**
   * Update an existing Calendar event (e.g. when customer reschedules).
   */
  static async updateEvent(
    googleEventId: string,
    booking: CalendarBookingInput
  ): Promise<CalendarSyncResult> {
    try {
      const calendar = await getActiveCalendarClient();
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: buildEventBody(booking),
        sendUpdates: 'none'
      });

      return {
        success: true,
        eventId:   response.data.id       ?? null,
        eventLink: response.data.htmlLink  ?? null
      };
    } catch (err: any) {
      console.error('[CalendarService] updateEvent failed:', err?.message);
      return {
        success: false,
        eventId: null,
        eventLink: null,
        error: err?.message
      };
    }
  }

  /**
   * Delete a Calendar event (e.g. when booking is cancelled).
   */
  static async deleteEvent(googleEventId: string): Promise<boolean> {
    try {
      const calendar = await getActiveCalendarClient();
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
        sendUpdates: 'none'
      });
      console.log(`[CalendarService] Event deleted: ${googleEventId}`);
      return true;
    } catch (err: any) {
      console.error('[CalendarService] deleteEvent failed:', err?.message);
      return false;
    }
  }

  /**
   * Fetch a single event by its Google Event ID.
   * Useful for verifying sync status.
   */
  static async getEvent(googleEventId: string): Promise<calendar_v3.Schema$Event | null> {
    try {
      const calendar = await getActiveCalendarClient();
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleEventId
      });
      return response.data;
    } catch (err: any) {
      console.error('[CalendarService] getEvent failed:', err?.message);
      return null;
    }
  }
}
