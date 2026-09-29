import { pool } from '../../config/database.js';
export const getServices = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM services ORDER BY id ASC');
        return res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const createService = async (req, res) => {
    try {
        const { name, duration_minutes, price } = req.body;
        if (!name || !duration_minutes || price === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const { rows } = await pool.query('INSERT INTO services (name, duration_minutes, price) VALUES ($1, $2, $3) RETURNING *', [name, duration_minutes, price]);
        return res.status(201).json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, duration_minutes, price } = req.body;
        const check = await pool.query('SELECT id FROM services WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        const { rows } = await pool.query('UPDATE services SET name = $1, duration_minutes = $2, price = $3 WHERE id = $4 RETURNING *', [name, duration_minutes, price, id]);
        return res.status(200).json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if service exists
        const check = await pool.query('SELECT id FROM services WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        // Usually we would soft-delete or check foreign key constraints in bookings table
        // For simplicity we just attempt to delete. 
        // Wait, if it's referenced in bookings, it will throw a constraint error.
        // Let's catch that specifically.
        try {
            await pool.query('DELETE FROM services WHERE id = $1', [id]);
            return res.status(200).json({ success: true, message: 'Service deleted successfully' });
        }
        catch (dbError) {
            if (dbError.code === '23503') { // foreign_key_violation
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete service because it is referenced in existing bookings'
                });
            }
            throw dbError;
        }
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
