const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB, query } = require('./config/db');
const { renderTrackingSuccessHTML, renderTrackingNotFoundHTML } = require('./services/trackingRenderer');
const { parseContactPayload } = require('./controllers/contactController');
const { sendContactNotification, sendContactAutoReply } = require('./services/emailService');

// Route Handlers
const trackingRoutes = require('./routes/trackingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const searchRoutes = require('./routes/searchRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const publicDir = path.join(__dirname, 'public');

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins in local dev (including null origin for local file:// previews)
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve Admin UI static files
app.use('/admin', express.static(path.join(publicDir, 'admin')));

// API Routes
app.use(['/api/track', '/api/tracking'], trackingRoutes);
app.use(['/api/contact', '/api/contacts'], contactRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use(['/api/settings', '/api/setting'], settingsRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nexivan Logistics API',
    time: new Date().toISOString(),
  });
});

// 404 Handler for API routes (intercept before frontend fallback)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

// Admin SPA routes
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(publicDir, 'admin/index.html'));
});

// Redirect legacy .html requests to clean URLs (excluding admin)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.endsWith('.html') && !req.path.startsWith('/admin')) {
    const cleanPath = req.path.slice(0, -5);
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    if (cleanPath === '/index') {
      return res.redirect(301, '/' + queryString);
    }
    return res.redirect(301, cleanPath + queryString);
  }
  next();
});

// ============================================================================
// Dynamic Company Settings Pre-Renderer
// ============================================================================
let cachedCompanySettings = null;
let cachedCompanySettingsTime = 0;

async function getLiveCompanySettings() {
  const now = Date.now();
  if (cachedCompanySettings && now - cachedCompanySettingsTime < 2000) {
    return cachedCompanySettings;
  }
  try {
    const res = await query(
      'SELECT email, phone, whatsapp, whatsapp_raw, address, working_hours FROM company_settings WHERE id = 1 LIMIT 1'
    );
    if (res.rows.length > 0) {
      cachedCompanySettings = res.rows[0];
      cachedCompanySettingsTime = now;
      return cachedCompanySettings;
    }
  } catch (e) {}

  return cachedCompanySettings || {
    email: 'info@nexivanlogistics.com',
    phone: '+1 (915) 217-3598',
    whatsapp: '+1 (915) 217-3598',
    whatsapp_raw: '19152173598',
    address: '1204 Sunset Ave, Los Angeles, CA',
    working_hours: 'Mon - Sat: 8:00 AM - 7:00 PM',
  };
}

async function renderHtmlWithDynamicSettings(html) {
  const s = await getLiveCompanySettings();
  const email = (s.email || 'info@nexivanlogistics.com').trim();
  const phone = (s.phone || '+1 (915) 217-3598').trim();
  const whatsapp = (s.whatsapp || '+1 (915) 217-3598').trim();
  const whatsappRaw = (s.whatsapp_raw || (whatsapp ? whatsapp.replace(/\D/g, '') : '19152173598')).trim();
  const cleanPhone = phone.replace(/[^+\d]/g, '');

  let out = html;

  // 1. Email replacements
  out = out.replace(/info@nexivanlogistics\.com/gi, email);
  out = out.replace(/info@Equitranslogistics\.com/gi, email);

  // 2. Phone number replacements
  out = out.replace(/\+1\s*\(915\)\s*217-3598/gi, phone);
  out = out.replace(/\+1\s*\(339\)\s*224-7522/gi, phone);
  out = out.replace(/\(339\)\s*224-7522/gi, phone);
  out = out.replace(/\+1\s*\(438\)\s*668-1202/gi, whatsapp);
  out = out.replace(/19152173598/g, whatsappRaw);
  out = out.replace(/3392247522/g, whatsappRaw);
  out = out.replace(/4386681202/g, whatsappRaw);

  // 3. Tel and mailto and WhatsApp hrefs
  out = out.replace(/href="tel:[^"]*"/gi, `href="tel:${cleanPhone}"`);
  out = out.replace(/href="mailto:[^"]*"/gi, `href="mailto:${email}"`);
  out = out.replace(/href="https:\/\/wa\.me\/[^"]*"/gi, `href="https://wa.me/${whatsappRaw}"`);
  out = out.replace(/web\.whatsapp\.com\/send\?phone=[0-9]+/gi, `web.whatsapp.com/send?phone=${whatsappRaw}`);

  // 4. Legacy domain and form action cleanup
  out = out.replace(/action="https?:\/\/(?:www\.)?equitransworldlogistics\.com[^"]*"/gi, 'action="/track-shipment"');
  out = out.replace(/https?:\/\/(?:www\.)?equitransworldlogistics\.com\/?/gi, '/');
  out = out.replace(/Equitransworldlogistics\.com/gi, 'Nexivan Logistics');

  // 5. Inject global settings script in <head>
  const settingsScript = `<script id="nexivan-injected-settings">window.__NEXIVAN_SETTINGS__ = ${JSON.stringify(s)}; try { localStorage.setItem('nexivan_company_settings', JSON.stringify(${JSON.stringify(s)})); } catch(e){}</script>`;
  if (out.includes('</head>')) {
    out = out.replace('</head>', `${settingsScript}\n</head>`);
  }

  return out;
}

async function sendRenderedHtml(res, filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const rendered = await renderHtmlWithDynamicSettings(raw);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(rendered);
  } catch (err) {
    return res.sendFile(filePath);
  }
}

// ============================================================================
// Frontend Page Routing (Clean URLs)
// ============================================================================

// 1. Home
app.get(['/', '/index', '/home'], (req, res) => {
  sendRenderedHtml(res, path.join(publicDir, 'index.html'));
});

// 2. About Us
app.get(['/about', '/about-us'], (req, res) => {
  sendRenderedHtml(res, path.join(publicDir, 'about-us.html'));
});

// 3. Services
app.get(['/services', '/service'], (req, res) => {
  sendRenderedHtml(res, path.join(publicDir, 'services.html'));
});

// 3b. Frontend Search Handler (Smart local router for search forms)
app.get('/search', (req, res) => {
  const q = (req.query.s || req.query.q || '').trim();
  if (!q) {
    return res.redirect(303, '/track-shipment');
  }
  const lower = q.toLowerCase();
  if (lower.includes('truck') || lower.includes('road')) return res.redirect(303, '/service/truck-freight');
  if (lower.includes('air') || lower.includes('flight') || lower.includes('plane')) return res.redirect(303, '/service/air-freight');
  if (lower.includes('ship') || lower.includes('ocean') || lower.includes('sea')) return res.redirect(303, '/service/ship-freight');
  if (lower.includes('train') || lower.includes('rail')) return res.redirect(303, '/service/train-freight');
  if (lower.includes('van') || lower.includes('courier')) return res.redirect(303, '/service/van-freight');
  if (lower.includes('drone')) return res.redirect(303, '/service/drone-freight');
  if (lower.includes('wagon')) return res.redirect(303, '/service/wagon-freight');
  if (lower.includes('contact') || lower.includes('support')) return res.redirect(303, '/contacts');
  if (lower.includes('about')) return res.redirect(303, '/about-us');
  if (lower.includes('service')) return res.redirect(303, '/services');
  return res.redirect(303, `/track-shipment?tracking=${encodeURIComponent(q)}`);
});

// 4. Consignment Tracking - POST Handler (handles form submit seamlessly)
app.post(['/track', '/track-shipment', '/tracking'], (req, res) => {
  const number = (
    req.body.tracking ||
    req.body.wpcargo_tracking_number ||
    req.body.number ||
    req.body.num ||
    req.body.s ||
    req.body.q ||
    ''
  ).trim();

  if (number) {
    return res.redirect(303, `/track-shipment?tracking=${encodeURIComponent(number)}#nexivan-tracking-result-box`);
  }
  return res.redirect(303, '/track-shipment');
});

// 4. Consignment Tracking - GET Handler (with Server-Side Pre-Rendering)
app.get(['/track', '/track-shipment', '/tracking'], async (req, res) => {
  const trk = (
    req.query.tracking ||
    req.query.wpcargo_tracking_number ||
    req.query.number ||
    req.query.num ||
    req.query.trk ||
    req.query.s ||
    req.query.q ||
    ''
  ).trim();

  const filePath = path.join(publicDir, 'track-shipment.html');

  if (!trk) {
    return sendRenderedHtml(res, filePath);
  }

  try {
    let html = fs.readFileSync(filePath, 'utf8');
    const cleanNum = trk.toUpperCase();

    // Query database for shipment
    const shipRes = await query(
      'SELECT * FROM shipments WHERE UPPER(tracking_number) = $1 LIMIT 1',
      [cleanNum]
    );

    let resultCardHTML = '';

    if (shipRes.rows.length > 0) {
      const shipment = shipRes.rows[0];
      const cpRes = await query(
        'SELECT * FROM shipment_checkpoints WHERE shipment_id = $1 ORDER BY checkpoint_time ASC, id ASC',
        [shipment.id]
      );
      const prodRes = await query(
        'SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC',
        [shipment.id]
      );
      shipment.products = prodRes.rows;
      resultCardHTML = renderTrackingSuccessHTML(shipment, cpRes.rows);
    } else {
      resultCardHTML = renderTrackingNotFoundHTML(cleanNum);
    }

    // Inject into result container
    const placeholder = '<div id="nexivan-tracking-result-box" class="nexivan-tracking-results-wrap" style="margin-top: 24px; min-height: 20px;"></div>';
    if (html.includes(placeholder)) {
      html = html.replace(placeholder, `<div id="nexivan-tracking-result-box" class="nexivan-tracking-results-wrap" style="margin-top: 24px; min-height: 20px;">${resultCardHTML}</div>`);
    } else if (html.includes('id="nexivan-tracking-result-box"')) {
      html = html.replace(/(<div[^>]*id="nexivan-tracking-result-box"[^>]*>)(<\/div>)/, `$1${resultCardHTML}$2`);
    }

    // Pre-fill input value
    html = html.replace(/(<input[^>]*id="wpcargo_tracking_number"[^>]*value=")[^"]*(")/i, `$1${cleanNum}$2`);

    const rendered = await renderHtmlWithDynamicSettings(html);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(rendered);
  } catch (error) {
    console.error('[Server-Side Tracking Error]', error);
    return sendRenderedHtml(res, filePath);
  }
});

// 5. Contact & Support - POST Handler (for standard or fallback form submit)
app.post(['/contact', '/contacts', '/contacts/'], async (req, res) => {
  try {
    const { firstName, lastName, phone, email, message } = parseContactPayload(req.body);

    if (!firstName || !lastName || !email || !message) {
      return res.redirect(303, '/contacts?error=missing_fields');
    }

    await query(
      `INSERT INTO contact_messages (first_name, last_name, phone, email, message, status)
       VALUES ($1, $2, $3, $4, $5, 'unread')`,
      [firstName, lastName, phone, email, message]
    );

    Promise.allSettled([
      sendContactNotification({ firstName, lastName, phone, email, message }),
      sendContactAutoReply({ firstName, email }),
    ]).catch(() => {});

    return res.redirect(303, '/contacts?sent=success');
  } catch (err) {
    console.error('[Contact Form POST Error]', err);
    return res.redirect(303, '/contacts?error=server_error');
  }
});

// 5. Contact & Support - GET Handler
app.get(['/contact', '/contacts'], async (req, res) => {
  const filePath = path.join(publicDir, 'contacts.html');
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    if (req.query.sent === 'success') {
      const successBanner = `
        <div id="nex-contact-alert-banner" class="nex-alert nex-alert-success" style="display: flex; align-items: flex-start; gap: 14px; padding: 22px; margin-bottom: 24px; border-radius: 12px; background: #ecfdf5; border: 2px solid #10b981; box-shadow: 0 6px 20px rgba(16,185,129,0.18);">
          <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: #d1fae5; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-check" style="font-size: 22px; color: #059669;"></i>
          </div>
          <div>
            <strong style="font-size: 18px; color: #065f46; display: block; margin-bottom: 4px;">Inquiry Sent Successfully!</strong>
            <p style="margin: 0; font-size: 14px; color: #047857; line-height: 1.6;">Thank you for reaching out to Nexivan Logistics. Your message has been received and our dispatch support team will get back to you shortly.</p>
          </div>
        </div>
      `;
      html = html.replace(/(<form[^>]*id="wpforms-form-15455"[^>]*>)/i, `$1\n${successBanner}`);
    }
    const rendered = await renderHtmlWithDynamicSettings(html);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(rendered);
  } catch (e) {
    return sendRenderedHtml(res, filePath);
  }
});

// 6. Service Detail Pages (/service/:slug)
app.get('/service/:slug', (req, res, next) => {
  let slug = req.params.slug;
  if (!slug.endsWith('.html')) slug += '.html';
  const filePath = path.join(publicDir, 'service', slug);
  if (fs.existsSync(filePath)) {
    return sendRenderedHtml(res, filePath);
  }
  next();
});

// 7. Category Pages (/category/:slug)
app.get('/category/:slug', (req, res, next) => {
  let slug = req.params.slug;
  if (!slug.endsWith('.html')) slug += '.html';
  const filePath = path.join(publicDir, 'category', slug);
  if (fs.existsSync(filePath)) {
    return sendRenderedHtml(res, filePath);
  }
  next();
});

// 8. Blog Article Clean Routes
const blogSlugs = [
  '5-key-reasons-why-reliable-logistics-can-make-or-break-your-business',
  'how-logisku-ensures-on-time-delivery-every-time',
  'local-vs-global-shipping-which-one-suits-your-business',
];

blogSlugs.forEach((slug) => {
  app.get([`/${slug}`, `/${slug}.html`], (req, res) => {
    sendRenderedHtml(res, path.join(publicDir, `${slug}.html`));
  });
});

// Serve all static assets (css, js, images, fonts, icons)
app.use(express.static(publicDir));

// Fallback for unmatched routes
app.use((req, res) => {
  if (req.accepts('html')) {
    return sendRenderedHtml(res, path.join(publicDir, 'index.html'));
  }
  res.status(404).json({ success: false, message: 'Resource not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Initialize Database & Start Server
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Nexivan Logistics Server running on port ${PORT}`);
      console.log(`🌐 Website Home:    http://localhost:${PORT}/`);
      console.log(`📦 Tracking Page:   http://localhost:${PORT}/track-shipment`);
      console.log(`✉️ Contact Page:    http://localhost:${PORT}/contacts`);
      console.log(`🛠️ Services Page:   http://localhost:${PORT}/services`);
      console.log(`ℹ️ About Page:      http://localhost:${PORT}/about-us`);
      console.log(`🛡️ Admin Portal:    http://localhost:${PORT}/admin`);
      console.log(`📡 API Base:        http://localhost:${PORT}/api`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('CRITICAL: Server failed to start due to database error:', error.message);
    process.exit(1);
  }
}

startServer();
