import { Request, Response } from 'express';
import { BookingService } from '../services/booking.service.js';
import { SettingsService } from '../services/settings.service.js';
import { google } from 'googleapis';

export const getBookings = async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    const status = req.query.status as string | undefined;
    
    const bookings = await BookingService.getAllBookings(date, status);
    return res.status(200).json({ success: true, data: bookings });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const booking = await BookingService.updateBookingStatus(id, status);
    return res.status(200).json({ success: true, booking });
  } catch (error: any) {
    console.error('Error updating booking status:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Google Configs ---
export const getGoogleAuthUrl = async (req: Request, res: Response) => {
  try {
    // In a real app, generate a real OAuth URL using googleapis
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + process.env.GOOGLE_CLIENT_ID + '&redirect_uri=' + encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || '') + '&response_type=code&scope=https://www.googleapis.com/auth/calendar.events%20https://www.googleapis.com/auth/userinfo.email&access_type=offline&prompt=consent';
    return res.status(200).json({ success: true, url });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info to get email
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });
    const userInfo = await oauth2.userinfo.get();
    
    // Save to DB (only save if refresh token is provided)
    if (userInfo.data.email && tokens.access_token) {
      await SettingsService.addGoogleConfig(
        userInfo.data.email, 
        tokens.access_token, 
        tokens.refresh_token || '', 
        tokens.expiry_date || 0
      );
    }
    
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed: ' + error);
  }
};

export const getGoogleConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await SettingsService.getGoogleConfigs();
    return res.status(200).json({ success: true, data: configs });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const activateGoogleConfig = async (req: Request, res: Response) => {
  try {
    await SettingsService.activateGoogleConfig(req.params.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteGoogleConfig = async (req: Request, res: Response) => {
  try {
    await SettingsService.deleteGoogleConfig(req.params.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Business Hours ---
export const getBusinessHours = async (req: Request, res: Response) => {
  try {
    const hours = await SettingsService.getBusinessHours();
    return res.status(200).json({ success: true, data: hours });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateBusinessHours = async (req: Request, res: Response) => {
  try {
    const promises = req.body.map((bh: any) => 
      SettingsService.updateBusinessHour(bh.day_of_week, bh.open_time, bh.close_time, bh.is_closed)
    );
    await Promise.all(promises);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Blocked Slots ---
export const getBlockedSlots = async (req: Request, res: Response) => {
  try {
    const blocks = await SettingsService.getBlockedSlots();
    return res.status(200).json({ success: true, data: blocks });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addBlockedSlot = async (req: Request, res: Response) => {
  try {
    const { startTime, endTime, reason } = req.body;
    const block = await SettingsService.addBlockedSlot(startTime, endTime, reason);
    return res.status(200).json({ success: true, block });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteBlockedSlot = async (req: Request, res: Response) => {
  try {
    await SettingsService.deleteBlockedSlot(req.params.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
