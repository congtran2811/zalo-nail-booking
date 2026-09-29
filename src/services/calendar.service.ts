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
