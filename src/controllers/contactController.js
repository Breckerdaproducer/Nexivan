const { query } = require('../config/db');
const { sendContactNotification, sendContactAutoReply } = require('../services/emailService');

/**
 * Normalize input from various form payloads (JSON, URL-encoded, or WPForms formats)
 */
function parseContactPayload(body) {
  let firstName = '';
  let lastName = '';
  let phone = '';
  let email = '';
  let message = '';

  // 1. Direct field names
  if (body.firstName || body.first_name) firstName = (body.firstName || body.first_name).trim();
  if (body.lastName || body.last_name) lastName = (body.lastName || body.last_name).trim();
  if (body.phone) phone = body.phone.trim();
  if (body.email) email = body.email.trim();
  if (body.message) message = body.message.trim();

  // 2. Full name provided in one field
  if (!lastName && (body.name || body.fullName)) {
    const parts = (body.name || body.fullName).trim().split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || 'Customer';
  }

  // 3. WPForms format: wpforms.fields (can be object or array compacted by qs)
  if (body.wpforms && body.wpforms.fields) {
    const f = body.wpforms.fields;
    if (Array.isArray(f)) {
      for (const item of f) {
        if (!item) continue;
        if (typeof item === 'object') {
          if (item.first || item.last) {
            firstName = item.first || firstName;
            lastName = item.last || lastName;
          }
        } else if (typeof item === 'string') {
          const s = item.trim();
          if (s.includes('@') && !email) {
            email = s;
          } else if (/^[\d+\-\s()]{4,}$/.test(s) && !phone) {
            phone = s;
          } else if (!message && s.length > 0) {
            message = s;
          }
        }
      }
    } else if (typeof f === 'object') {
      if (f['1']) {
        firstName = f['1'].first || firstName;
        lastName = f['1'].last || lastName;
      }
      if (f['2']) phone = String(f['2']).trim() || phone;
      if (f['3']) email = String(f['3']).trim() || email;
      if (f['4']) message = String(f['4']).trim() || message;
    }
  }

  // 4. Flat bracket notation fallback
  if (!firstName && body['wpforms[fields][1][first]']) firstName = body['wpforms[fields][1][first]'].trim();
  if (!lastName && body['wpforms[fields][1][last]']) lastName = body['wpforms[fields][1][last]'].trim();
  if (!phone && body['wpforms[fields][2]']) phone = String(body['wpforms[fields][2]']).trim();
  if (!email && body['wpforms[fields][3]']) email = String(body['wpforms[fields][3]']).trim();
  if (!message && body['wpforms[fields][4]']) message = String(body['wpforms[fields][4]']).trim();

  return { firstName, lastName, phone, email, message };
}

/**
 * PUBLIC: Handle Contact Form Submission
 * POST /api/contact
 */
async function submitContact(req, res) {
  try {
    const { firstName, lastName, phone, email, message } = parseContactPayload(req.body);

    // Validation
    const errors = [];
    if (!firstName) errors.push('First name is required.');
    if (!lastName) errors.push('Last name is required.');
    if (!email || !email.includes('@')) errors.push('A valid email address is required.');
    if (!message || message.length < 3) errors.push('Please enter a valid message or question.');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(' '),
        errors,
      });
    }

    // Insert into DB
    const insertRes = await query(
      `INSERT INTO contact_messages (first_name, last_name, phone, email, message, status)
       VALUES ($1, $2, $3, $4, $5, 'unread')
       RETURNING id, created_at`,
      [firstName, lastName, phone, email, message]
    );

    const messageRecord = insertRes.rows[0];

    // Trigger async email notifications (will not block or crash HTTP response)
    Promise.allSettled([
      sendContactNotification({ firstName, lastName, phone, email, message }),
      sendContactAutoReply({ firstName, email }),
    ]).then((results) => {
      console.log(`[Contact Form] Dispatched emails for message ID ${messageRecord.id}.`);
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Your message has been received and our team will get back to you shortly.',
      id: messageRecord.id,
    });
  } catch (error) {
    console.error('[Contact Error] Form submission failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to send your message at this time. Please try again or contact us directly at info@nexivanlogistics.com.',
    });
  }
}

/**
 * ADMIN: Get all contact messages
 * GET /api/admin/messages
 */
async function getAllMessages(req, res) {
  try {
    const { status, page = 1, limit = 20, q } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    const conditions = [];
    const values = [];

    if (status && status !== 'all') {
      values.push(status.trim());
      conditions.push(`status = $${values.length}`);
    }

    if (q && q.trim()) {
      values.push(`%${q.trim()}%`);
      const pIdx = values.length;
      conditions.push(
        `(first_name ILIKE $${pIdx} OR last_name ILIKE $${pIdx} OR email ILIKE $${pIdx} OR message ILIKE $${pIdx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM contact_messages ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM contact_messages
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(parseInt(limit, 10), offset);
    const dataRes = await query(dataQuery, values);

    return res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      messages: dataRes.rows,
    });
  } catch (error) {
    console.error('[Admin Message Error] Get all messages:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve messages.' });
  }
}

/**
 * ADMIN: Update message status (e.g. read, replied, archived)
 * PUT /api/admin/messages/:id/status
 */
async function updateMessageStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const isReplied = status === 'replied';
    const updateRes = await query(
      `UPDATE contact_messages 
       SET status = $1, replied_at = CASE WHEN $2 THEN NOW() ELSE replied_at END 
       WHERE id = $3 RETURNING *`,
      [status, isReplied, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    return res.json({
      success: true,
      message: `Message status updated to ${status}.`,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error('[Admin Message Error] Update message status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update message status.' });
  }
}

/**
 * ADMIN: Delete message
 * DELETE /api/admin/messages/:id
 */
async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM contact_messages WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    return res.json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (error) {
    console.error('[Admin Message Error] Delete message:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
}

module.exports = {
  submitContact,
  parseContactPayload,
  getAllMessages,
  updateMessageStatus,
  deleteMessage,
};
