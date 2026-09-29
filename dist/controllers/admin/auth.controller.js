import jwt from 'jsonwebtoken';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_super_secret_123';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-123';
export const loginAdmin = (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required' });
    }
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }
    // Generate JWT token valid for 24 hours
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.status(200).json({
        success: true,
        message: 'Login successful',
        token
    });
};
