import { Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { google } from 'googleapis';

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

export const getGoogleConfigs = async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, gmail_address, is_active, created_at FROM google_calendar_configs ORDER BY id ASC');
    return res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createGoogleConfig = async (req: Request, res: Response) => {
  try {
    const { gmail_address, client_id, client_secret, refresh_token } = req.body;
    
    if (!gmail_address || !client_id || !client_secret || !refresh_token) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if it's the first config, if so make it active
    const check = await pool.query('SELECT COUNT(*) FROM google_calendar_configs');
    const is_active = parseInt(check.rows[0].count) === 0;

    const { rows } = await pool.query(
      'INSERT INTO google_calendar_configs (gmail_address, client_id, client_secret, refresh_token, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, gmail_address, is_active',
      [gmail_address, client_id, client_secret, refresh_token, is_active]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGoogleConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { gmail_address, client_id, client_secret, refresh_token } = req.body;

    const { rowCount } = await pool.query(
      'UPDATE google_calendar_configs SET gmail_address = $1, client_id = $2, client_secret = $3, refresh_token = $4 WHERE id = $5',
      [gmail_address, client_id, client_secret, refresh_token, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Config not found' });
    }

    return res.status(200).json({ success: true, message: 'Config updated' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const activateGoogleConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Deactivate all
      await client.query('UPDATE google_calendar_configs SET is_active = false');
      
      // Activate selected
      const { rowCount } = await client.query('UPDATE google_calendar_configs SET is_active = true WHERE id = $1', [id]);
      
      if (rowCount === 0) {
        throw new Error('Config not found');
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: 'Config activated successfully' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGoogleConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM google_calendar_configs WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Config not found' });
    }
    
    return res.status(200).json({ success: true, message: 'Config deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGoogleAuthUrl = (req: Request, res: Response) => {
  try {
    const oauth2Client = getOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force to get refresh_token every time
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    });
    return res.status(200).json({ success: true, url });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const googleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Authorization code missing');
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh_token returned. Please try again and make sure to allow offline access (force consent).');
    }

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const gmail_address = userInfo.data.email;

    if (!gmail_address) {
      return res.status(400).send('Could not fetch email address from Google.');
    }

    // Check if it's the first config, if so make it active
    const check = await pool.query('SELECT COUNT(*) FROM google_calendar_configs');
    const is_active = parseInt(check.rows[0].count) === 0;

    // Delete existing config for this email if exists
    await pool.query('DELETE FROM google_calendar_configs WHERE gmail_address = $1', [gmail_address]);

    // Insert new config
    await pool.query(
      'INSERT INTO google_calendar_configs (gmail_address, client_id, client_secret, refresh_token, is_active) VALUES ($1, $2, $3, $4, $5)',
      [
        gmail_address,
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        tokens.refresh_token,
        is_active
      ]
    );

    // Redirect back to settings page
    return res.redirect('/admin/settings');
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    return res.status(500).send('Authentication failed: ' + error.message);
  }
};
