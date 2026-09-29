import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token format' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string };
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    // Token is valid and role is admin
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
  }
};
