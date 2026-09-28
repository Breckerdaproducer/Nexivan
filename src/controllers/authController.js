const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const adminRes = await query(
      'SELECT * FROM admins WHERE username = $1 OR email = $1 LIMIT 1',
      [username.trim()]
    );

    if (adminRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your username and password.',
      });
    }

    const admin = adminRes.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your username and password.',
      });
    }

    // Generate JWT (valid for 7 days)
    const payload = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Set HTTP-only Cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: payload,
    });
  } catch (error) {
    console.error('[Auth Error] Login failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
}

async function logout(req, res) {
  res.clearCookie('admin_token');
  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
}

async function getMe(req, res) {
  return res.json({
    success: true,
    admin: req.admin,
  });
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const adminRes = await query('SELECT password_hash FROM admins WHERE id = $1', [adminId]);
    if (adminRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, adminRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password does not match.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      hashed,
      adminId,
    ]);

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('[Auth Error] Update password failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
}

module.exports = {
  login,
  logout,
  getMe,
  updatePassword,
};
