const { query } = require('../config/db');

const DEFAULT_SETTINGS = {
  id: 1,
  email: 'info@nexivanlogistics.com',
  phone: '+1 (915) 217-3598',
  whatsapp: '+1 (915) 217-3598',
  whatsapp_raw: '19152173598',
  address: '1204 Sunset Ave, Los Angeles, CA',
  working_hours: 'Mon - Sat: 8:00 AM - 7:00 PM',
};

/**
 * Public Endpoint: GET /api/settings
 * Used by frontend nexivan-api.js to dynamically hydrate contact points across the entire site
 */
async function getPublicSettings(req, res) {
  try {
    const result = await query(
      `SELECT email, phone, whatsapp, whatsapp_raw, address, working_hours, updated_at
       FROM company_settings
       WHERE id = 1
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      settings: {
        email: row.email || DEFAULT_SETTINGS.email,
        phone: row.phone || DEFAULT_SETTINGS.phone,
        whatsapp: row.whatsapp || DEFAULT_SETTINGS.whatsapp,
        whatsapp_raw: row.whatsapp_raw || (row.whatsapp ? row.whatsapp.replace(/\D/g, '') : DEFAULT_SETTINGS.whatsapp_raw),
        address: row.address || DEFAULT_SETTINGS.address,
        working_hours: row.working_hours || DEFAULT_SETTINGS.working_hours,
        updated_at: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[Settings] Error fetching settings:', error.message);
    // Fallback gracefully so frontend always gets values
    return res.json({
      success: true,
      settings: DEFAULT_SETTINGS,
      warning: 'Loaded default fallback settings due to database error.',
    });
  }
}

/**
 * Admin Endpoint: GET /api/admin/settings
 * Used by Admin Portal to populate Settings Tab
 */
async function getAdminSettings(req, res) {
  try {
    const result = await query(
      `SELECT id, email, phone, whatsapp, whatsapp_raw, address, working_hours, updated_at
       FROM company_settings
       WHERE id = 1
       LIMIT 1`
    );

    const settings = result.rows.length > 0 ? result.rows[0] : DEFAULT_SETTINGS;
    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('[Settings] Error fetching admin settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve company settings.',
      error: error.message,
    });
  }
}

/**
 * Admin Endpoint: PUT /api/admin/settings (or POST)
 * Updates email, call phone, WhatsApp number, and address
 */
async function updateSettings(req, res) {
  try {
    let { email, phone, whatsapp, address, working_hours } = req.body;

    // Validation
    email = (email || '').trim();
    phone = (phone || '').trim();
    whatsapp = (whatsapp || '').trim();
    address = (address || '').trim();
    working_hours = (working_hours || '').trim();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone / Call number is required.' });
    }

    if (!whatsapp) {
      // Default to phone if whatsapp is left empty
      whatsapp = phone;
    }

    // Compute raw WhatsApp digits for direct link https://wa.me/<whatsapp_raw>
    let whatsapp_raw = whatsapp.replace(/\D/g, '');
    if (!whatsapp_raw) {
      whatsapp_raw = phone.replace(/\D/g, '');
    }

    // Default fallbacks if empty or omitted
    if (!address) {
      const existing = await query('SELECT address FROM company_settings WHERE id = 1 LIMIT 1');
      address = (existing.rows[0] && existing.rows[0].address) || '1204 Sunset Ave, Los Angeles, CA';
    }
    if (!working_hours) {
      const existing = await query('SELECT working_hours FROM company_settings WHERE id = 1 LIMIT 1');
      working_hours = (existing.rows[0] && existing.rows[0].working_hours) || 'Mon - Sat: 8:00 AM - 7:00 PM';
    }

    // Upsert into company_settings
    const result = await query(
      `INSERT INTO company_settings (id, email, phone, whatsapp, whatsapp_raw, address, working_hours, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         whatsapp = EXCLUDED.whatsapp,
         whatsapp_raw = EXCLUDED.whatsapp_raw,
         address = EXCLUDED.address,
         working_hours = EXCLUDED.working_hours,
         updated_at = NOW()
       RETURNING id, email, phone, whatsapp, whatsapp_raw, address, working_hours, updated_at`,
      [email, phone, whatsapp, whatsapp_raw, address, working_hours]
    );

    const updated = result.rows[0];
    console.log(`[Settings] Company settings updated by admin (${req.admin ? req.admin.username : 'admin'}):`, {
      email: updated.email,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      whatsapp_raw: updated.whatsapp_raw,
    });

    return res.json({
      success: true,
      message: 'Company settings updated successfully! Changes are live across the website.',
      settings: updated,
    });
  } catch (error) {
    console.error('[Settings] Error updating settings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company settings.',
      error: error.message,
    });
  }
}

/**
 * Helper to fetch settings internally (e.g. for email notifications)
 */
async function getCachedOrDBSettings() {
  try {
    const res = await query('SELECT email, phone, whatsapp, whatsapp_raw, address, working_hours FROM company_settings WHERE id = 1 LIMIT 1');
    if (res.rows.length > 0) return res.rows[0];
  } catch (e) {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

module.exports = {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
  getCachedOrDBSettings,
};
