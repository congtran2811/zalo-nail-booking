import { pool } from '../../config/database.js';
export const getBusinessHours = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM business_hours ORDER BY day_of_week ASC');
        return res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const updateBusinessHours = async (req, res) => {
    try {
        const { hours } = req.body; // Expect array of { day_of_week, open_time, close_time, is_closed }
        if (!Array.isArray(hours)) {
            return res.status(400).json({ success: false, message: 'Invalid payload, expected array of hours' });
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const h of hours) {
                await client.query(`UPDATE business_hours 
           SET open_time = $1, close_time = $2, is_closed = $3 
           WHERE day_of_week = $4`, [h.open_time, h.close_time, h.is_closed, h.day_of_week]);
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Business hours updated successfully' });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
