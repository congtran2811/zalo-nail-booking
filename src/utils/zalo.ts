/**
 * Task 2.3 — Zalo deep-link generator utility
 *
 * Generates a Zalo deep-link URL that redirects a customer back to the
 * shop owner's Zalo chat with a pre-filled booking confirmation message.
 *
 * Deep-link format: https://zalo.me/<PHONE>?text=<ENCODED_MESSAGE>
 */

export interface BookingInfo {
  customerName: string;
  serviceName: string;
  startTime: string | Date;
  endTime: string | Date;
}

/**
 * Format a Date (or ISO string) to Vietnamese locale: dd/MM/yyyy HH:mm
 */
function formatVNDateTime(dt: string | Date): string {
  const d = new Date(dt);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Generate the confirmation message text
 */
export function buildBookingConfirmationText(info: BookingInfo): string {
  const start = formatVNDateTime(info.startTime);
  const end = formatVNDateTime(info.endTime);
  return (
    `✅ Đặt lịch thành công!\n` +
    `👤 Khách: ${info.customerName}\n` +
    `💅 Dịch vụ: ${info.serviceName}\n` +
    `🕐 Thời gian: ${start} – ${end}\n` +
    `Cảm ơn bạn đã đặt lịch tại tiệm! 🙏`
  );
}

/**
 * Build a Zalo deep-link that opens chat with the shop owner
 * and pre-fills the booking confirmation message.
 *
 * @param shopPhone - The shop owner's Zalo phone number (e.g. "0912345678")
 * @param info      - Booking details to embed in the message
 * @returns         - Full Zalo deep-link URL
 */
export function generateZaloDeepLink(shopPhone: string, info: BookingInfo): string {
  const message = buildBookingConfirmationText(info);
  const encodedMessage = encodeURIComponent(message);
  return `https://zalo.me/${shopPhone}?text=${encodedMessage}`;
}
