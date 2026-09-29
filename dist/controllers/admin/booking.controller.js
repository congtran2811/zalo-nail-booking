import { pool } from '../../config/database.js';
import { BookingService } from '../../services/booking.service.js';
export const getBookings = async (req, res) => {
    try {
        const { date, status } = req.query;
        let query = 'SELECT b.*, s.name as service_name FROM bookings b JOIN services s ON b.service_id = s.id WHERE 1=1';
        const params = [];
        if (date) {
            params.push(date);
            query += ` AND DATE(b.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $${params.length}::date`;
        }
        if (status) {
            params.push(status);
            query += ` AND b.status = $${params.length}`;
        }
        query += ' ORDER BY b.start_time ASC';
        const { rows } = await pool.query(query, params);
        return res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const { rows } = await pool.query('UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        // TODO: If cancelled, maybe we should also delete from Google Calendar.
        // For now, just updating DB status.
        return res.status(200).json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const createManualBooking = async (req, res) => {
    try {
        // Manual bookings go through the same rigorous BookingService logic to prevent overlaps
        const booking = await BookingService.createBooking(req.body);
        return res.status(201).json({ success: true, data: booking });
    }
    catch (error) {
        if (error.message === 'SLOT_ALREADY_BOOKED') {
            return res.status(409).json({ success: false, message: 'Khung giờ này đã có người đặt.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};
