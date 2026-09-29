import { pool } from '../../config/database.js';
export const getBlockedSlots = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM blocked_slots ORDER BY start_time ASC');
        return res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const createBlockedSlot = async (req, res) => {
    try {
        const { start_time, end_time, reason } = req.body;
        if (!start_time || !end_time) {
            return res.status(400).json({ success: false, message: 'start_time and end_time are required' });
        }
        if (new Date(start_time) >= new Date(end_time)) {
            return res.status(400).json({ success: false, message: 'start_time must be before end_time' });
        }
        const { rows } = await pool.query('INSERT INTO blocked_slots (start_time, end_time, reason) VALUES ($1::timestamptz, $2::timestamptz, $3) RETURNING *', [start_time, end_time, reason || null]);
        return res.status(201).json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const deleteBlockedSlot = async (req, res) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM blocked_slots WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Blocked slot not found' });
        }
        return res.status(200).json({ success: true, message: 'Blocked slot deleted' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
