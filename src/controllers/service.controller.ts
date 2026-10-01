import { Request, Response } from 'express';
import { pool } from '../config/database.js';

export const getServices = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id ASC');
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addService = async (req: Request, res: Response) => {
  try {
    const { name, duration_minutes, price } = req.body;
    const query = `
      INSERT INTO services (name, duration_minutes, price)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, duration_minutes, price]);
    return res.status(200).json({ success: true, service: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, duration_minutes, price } = req.body;
    const query = `
      UPDATE services
      SET name = $1, duration_minutes = $2, price = $3
      WHERE id = $4
      RETURNING *;
    `;
    const result = await pool.query(query, [name, duration_minutes, price, id]);
    return res.status(200).json({ success: true, service: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteService = async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
