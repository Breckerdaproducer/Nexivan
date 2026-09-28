const nodemailer = require('nodemailer');
const { query } = require('../config/db');
const {
  generateAirWaybillPDF,
  generateCommercialInvoicePDF,
  generateProofOfDeliveryPDF,
} = require('./pdfService');
require('dotenv').config();

let transporter = null;

/**
 * Nexivan Logistics Logo for email service
 */
const NEXIVAN_LOGO_URL = 'https://nexivanlogistics.com/assets/images/nexivan-logo.svg';
const NEXIVAN_LOGO_SVG = `<img src="https://nexivanlogistics.com/assets/images/nexivan-logo.svg" alt="Nexivan Logistics" width="180" height="37" style="display: block; width: 180px; height: auto; max-height: 37px; border: 0; outline: none; text-decoration: none;" />`;

async function getCompanyContactInfo() {
  try {
    const res = await query('SELECT email, phone, whatsapp, address FROM company_settings WHERE id = 1 LIMIT 1');
    if (res.rows.length > 0) return res.rows[0];
  } catch (e) {}
  return {
    email: process.env.ADMIN_NOTIFY_EMAIL || 'info@nexivanlogistics.com',
    phone: '',
    whatsapp: '',
    address: 'United States',
  };
}

function getTransporter() {
  if (transporter) return transporter;

  const hasSMTP = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (hasSMTP) {
    const rawPort = parseInt(process.env.SMTP_PORT || '465', 10);
    // Port 465 is implicit TLS (secure: true). Port 587 uses explicit STARTTLS (secure: false).
    const isSecure = rawPort === 465 ? true : (rawPort === 587 ? false : process.env.SMTP_SECURE === 'true');
    const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: rawPort,
      secure: isSecure,
      family: 4,
      auth: {
        user: process.env.SMTP_USER,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log(`[Email] Configured custom SMTP: ${process.env.SMTP_HOST}:${rawPort} (secure: ${isSecure})`);
  } else {
    // Development / Mock Transporter
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n================== [EMAIL DISPATCH LOG] ==================');
        console.log(`From:        ${mailOptions.from}`);
        console.log(`To:          ${Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to}`);
        console.log(`Subject:     ${mailOptions.subject}`);
        if (mailOptions.attachments && mailOptions.attachments.length > 0) {
          console.log(`Attachments: ${mailOptions.attachments.map(a => `${a.filename} (${(a.content.length / 1024).toFixed(1)} KB)`).join(', ')}`);
        } else {
          console.log('Attachments: None');
        }
        console.log('--- Body Preview ---');
        console.log((mailOptions.text || mailOptions.html.replace(/<[^>]*>?/gm, ' ')).substring(0, 240).replace(/\s+/g, ' '));
        console.log('==========================================================\n');
        return { messageId: 'mock-' + Date.now(), accepted: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to] };
      },
    };
    console.log('[Email] Safe Dev Mode active (emails with PDF attachments logged to console).');
  }

  return transporter;
}

/**
 * Helper to collect valid client emails
 */
function getClientRecipients(shipment) {
  const recipients = new Set();
  if (shipment.receiver_email && shipment.receiver_email.includes('@')) {
    recipients.add(shipment.receiver_email.trim());
  }
  if (shipment.shipper_email && shipment.shipper_email.includes('@')) {
    recipients.add(shipment.shipper_email.trim());
  }
  return Array.from(recipients);
}

/**
 * Unified, clean email layout wrapper:
 * - Pure white background (#ffffff)
 * - Deep black / slate-900 text (#0f172a)
 * - Subtle primary color (#0284c7) accents
 * - Clean logo in the header
 * - Unified responsive typography and footer
 */
function buildCleanEmailHTML({ title, subtitle, bodyContent, companyInfo, actionButton = null }) {
  const appUrl = (process.env.APP_URL || 'https://nexivanlogistics.com').replace(/\/$/, '');


  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
          
          <!-- Unified Brand Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <a href="${appUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      ${NEXIVAN_LOGO_SVG}
                    </a>
                  </td>
                  <td align="right" style="vertical-align: middle; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">
                    Global Dispatch
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Title & Subtitle -->
          <tr>
            <td style="padding: 28px 32px 12px 32px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${title}
              </h1>
              ${subtitle ? `
                <p style="margin: 6px 0 0; font-size: 13.5px; color: #475569; line-height: 1.5;">
                  ${subtitle}
                </p>
              ` : ''}
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 12px 32px 28px 32px; font-size: 14px; line-height: 1.6; color: #0f172a;">
              ${bodyContent}

              ${actionButton ? `
                <div style="margin: 28px 0 8px; text-align: left;">
                  <a href="${actionButton.url}" target="_blank" style="background-color: #0284c7; color: #ffffff; font-size: 13.5px; font-weight: 600; text-decoration: none; padding: 11px 22px; border-radius: 6px; display: inline-block;">
                    ${actionButton.text} &rarr;
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Clean Muted Footer -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11.5px; line-height: 1.6; color: #64748b;">
              <p style="margin: 0;">
                <strong>Nexivan Logistics Inc.</strong> &bull; ${companyInfo.address || '1204 Sunset Ave, Los Angeles, CA'}
              </p>
              <p style="margin: 4px 0 0;">
                Support: <a href="tel:${(companyInfo.phone || '').replace(/[^+\d]/g, '')}" style="color: #0284c7; text-decoration: none;">${companyInfo.phone}</a> &bull; 
                <a href="mailto:${companyInfo.email}" style="color: #0284c7; text-decoration: none;">${companyInfo.email}</a> &bull; 
                <a href="${appUrl}" style="color: #0284c7; text-decoration: none;">nexivanlogistics.com</a>
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #94a3b8;">
                &copy; 2020 Nexivan Logistics. All rights reserved. Automated dispatch telemetry notification.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * 1. Send alert to Admin when a new contact inquiry is received
 * Sent to ADMIN_NOTIFY_EMAIL in .env
 */
async function sendContactNotification({ firstName, lastName, email, phone, message }) {
  const mailer = getTransporter();
  const companyInfo = await getCompanyContactInfo();

  // Prioritize ADMIN_NOTIFY_EMAIL from .env
  const adminRecipients = new Set();
  if (process.env.ADMIN_NOTIFY_EMAIL && process.env.ADMIN_NOTIFY_EMAIL.includes('@')) {
    adminRecipients.add(process.env.ADMIN_NOTIFY_EMAIL.trim());
  }
  if (companyInfo.email && companyInfo.email.includes('@')) {
    adminRecipients.add(companyInfo.email.trim());
  }
  const toRecipients = adminRecipients.size > 0 ? Array.from(adminRecipients) : ['info@nexivanlogistics.com'];
  const fromAddress = process.env.SMTP_FROM || `"Nexivan Logistics Alerts" <${companyInfo.email || 'info@nexivanlogistics.com'}>`;

  const bodyContent = `
    <p style="margin-top: 0; font-size: 14px; color: #334155;">
      A customer has submitted a new inquiry via the website contact form:
    </p>

    <!-- Details Table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0; background-color: #ffffff;">
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #f1f5f9;">Full Name:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${firstName} ${lastName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Email Address:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}" style="color: #0284c7; text-decoration: none;">${email}</a></td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Phone Number:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${phone || 'Not provided'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569;">Received:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; color: #0f172a;">${new Date().toLocaleString()}</td>
      </tr>
    </table>

    <!-- Message Box -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 3px solid #0284c7; padding: 14px 16px; border-radius: 4px; margin: 18px 0;">
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #475569; display: block; margin-bottom: 6px;">Customer Inquiry:</span>
      <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: #0f172a; white-space: pre-line;">${message}</p>
    </div>
  `;

  const html = buildCleanEmailHTML({
    title: 'New Website Inquiry',
    subtitle: `Received from ${firstName} ${lastName}`,
    bodyContent,
    companyInfo,
    actionButton: {
      text: `Reply to ${email}`,
      url: `mailto:${email}?subject=Re:%20Nexivan%20Logistics%20Inquiry`,
    },
  });

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toRecipients,
      replyTo: email,
      subject: `[New Inquiry] ${firstName} ${lastName} via Contact Form`,
      text: `Name: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nMessage:\n${message}`,
      html,
    });
    console.log(`[Email] Contact notification sent to admin: ${toRecipients.join(', ')} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipients: toRecipients };
  } catch (error) {
    console.error('[Email Error] Failed to send admin notification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 2. Send acknowledgment auto-reply to the customer
 */
async function sendContactAutoReply({ firstName, email }) {
  const mailer = getTransporter();
  const companyInfo = await getCompanyContactInfo();
  const fromAddress = process.env.SMTP_FROM || `"Nexivan Logistics Support" <${companyInfo.email}>`;

  const bodyContent = `
    <p style="margin-top: 0; font-size: 14px; color: #0f172a;">
      Dear <strong>${firstName}</strong>,
    </p>
    <p style="font-size: 14px; color: #334155;">
      Thank you for contacting <strong>Nexivan Logistics</strong>. We have received your inquiry and our dispatch support team is currently reviewing your request.
    </p>
    <p style="font-size: 14px; color: #334155;">
      A dedicated logistics representative will follow up with you within 2 to 4 business hours.
    </p>

    <!-- Support Details Box -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 3px solid #0284c7; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #475569; display: block; margin-bottom: 6px;">Need Immediate Assistance?</span>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #0f172a;">
        Our 24/7 Operations Desk is available directly:<br>
        <strong>Phone:</strong> <a href="tel:${(companyInfo.phone || '').replace(/[^+\d]/g, '')}" style="color: #0284c7; text-decoration: none;">${companyInfo.phone}</a><br>
        <strong>Email:</strong> <a href="mailto:${companyInfo.email}" style="color: #0284c7; text-decoration: none;">${companyInfo.email}</a>
      </p>
    </div>

    <p style="margin-bottom: 0; font-size: 13.5px; color: #475569;">
      Warm regards,<br>
      <strong style="color: #0f172a;">Nexivan Logistics Operations Team</strong>
    </p>
  `;

  const html = buildCleanEmailHTML({
    title: 'Inquiry Received',
    subtitle: 'Thank you for reaching out to Nexivan Logistics',
    bodyContent,
    companyInfo,
  });

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Inquiry Received – Nexivan Logistics',
      text: `Dear ${firstName},\n\nThank you for contacting Nexivan Logistics. We have received your message and our team will get back to you shortly.\n\nWarm regards,\nNexivan Logistics Team`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Error] Failed to send customer auto-reply:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 3. Send email to client when creating tracking WITH 2 PDF ATTACHMENTS
 * - Official Air Waybill (AWB)
 * - Commercial Freight Invoice (or Proof of Delivery if status is Delivered)
 */
async function sendShipmentCreationEmail(shipment, products = []) {
  const mailer = getTransporter();
  const recipients = getClientRecipients(shipment);

  if (recipients.length === 0) {
    console.log(`[Email] No recipient email on consignment ${shipment.tracking_number}. Skipping creation email.`);
    return { success: false, reason: 'No client email found' };
  }

  const companyInfo = await getCompanyContactInfo();
  const fromAddress = process.env.SMTP_FROM || `"Nexivan Logistics Dispatch" <${companyInfo.email}>`;
  const trackingNo = shipment.tracking_number;
  const isDelivered = (shipment.status || '').toLowerCase() === 'delivered';
  const appUrl = (process.env.APP_URL || 'https://nexivanlogistics.com').replace(/\/$/, '');
  const trackLink = `${appUrl}/track-shipment?tracking=${encodeURIComponent(trackingNo)}`;

  console.log(`[Email] Generating 2 official PDF attachments for consignment ${trackingNo}...`);

  // Generate 2 PDF attachments in parallel
  const waybillPromise = generateAirWaybillPDF(shipment, products, companyInfo);
  const secondDocPromise = isDelivered
    ? generateProofOfDeliveryPDF(shipment, { status: 'Delivered', location: shipment.destination }, companyInfo)
    : generateCommercialInvoicePDF(shipment, products, companyInfo);

  const [waybillBuffer, secondDocBuffer] = await Promise.all([waybillPromise, secondDocPromise]);

  const attachments = [
    {
      filename: `AirWaybill_${trackingNo}.pdf`,
      content: waybillBuffer,
      contentType: 'application/pdf',
    },
    {
      filename: isDelivered ? `Proof_Of_Delivery_${trackingNo}.pdf` : `Commercial_Invoice_${trackingNo}.pdf`,
      content: secondDocBuffer,
      contentType: 'application/pdf',
    },
  ];

  const clientName = shipment.receiver_name || shipment.shipper_name || 'Valued Client';
  const etaStr = shipment.estimated_delivery_date
    ? new Date(shipment.estimated_delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Pending carrier schedule';

  const bodyContent = `
    <p style="margin-top: 0; font-size: 14px; color: #0f172a;">
      Dear <strong>${clientName}</strong>,
    </p>
    <p style="font-size: 14px; color: #334155;">
      Your freight consignment has been registered and verified in the Nexivan Logistics Global Dispatch Network.
    </p>

    <!-- Waybill Key Details Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0; background-color: #ffffff;">
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Waybill Number:</td>
        <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; font-family: monospace; color: #0284c7; border-bottom: 1px solid #f1f5f9;">${trackingNo}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Route:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${shipment.origin || 'Origin'} &rarr; ${shipment.destination || 'Destination'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Transport Mode:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${shipment.transport_mode || 'Road Freight'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Consignment Status:</td>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${(shipment.status || 'In Transit').toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Estimated Delivery:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${etaStr}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569;">Total Freight:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; font-weight: 700; color: #0f172a;">${shipment.total_freight || '$0.00'} (${shipment.payment_mode || 'Prepaid'})</td>
      </tr>
    </table>

    <!-- 2 PDF Attachments Note -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 3px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin: 18px 0;">
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #475569; display: block; margin-bottom: 4px;">Attached Official Documents (PDF):</span>
      <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #0f172a; line-height: 1.5;">
        <li><strong>Air Waybill (AWB):</strong> <code>AirWaybill_${trackingNo}.pdf</code></li>
        <li><strong>${isDelivered ? 'Proof of Delivery (POD)' : 'Commercial Freight Invoice'}:</strong> <code>${isDelivered ? `Proof_Of_Delivery_${trackingNo}.pdf` : `Commercial_Invoice_${trackingNo}.pdf`}</code></li>
      </ul>
    </div>
  `;

  const html = buildCleanEmailHTML({
    title: 'Consignment Registered',
    subtitle: `Waybill Reference: ${trackingNo}`,
    bodyContent,
    companyInfo,
    actionButton: {
      text: 'Track Consignment Live',
      url: trackLink,
    },
  });

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: recipients,
      subject: `Consignment Registered [Waybill #${trackingNo}] – Nexivan Logistics`,
      text: `Your consignment #${trackingNo} (${shipment.origin} -> ${shipment.destination}) has been registered. Track live: ${trackLink}. Official Air Waybill and Invoice attached.`,
      html,
      attachments,
    });
    console.log(`[Email] Consignment creation email sent to ${recipients.join(', ')} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipients };
  } catch (error) {
    console.error('[Email Error] Failed to send consignment creation email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 4. Send status update to receiver/shipper with PDF attachments
 * - If status is 'Delivered': attaches Proof of Delivery (POD) + Air Waybill
 * - If other status: attaches updated Air Waybill
 */
async function sendShipmentStatusUpdate(shipment, checkpoint = {}, options = {}) {
  const mailer = getTransporter();
  const recipients = getClientRecipients(shipment);

  if (recipients.length === 0) {
    console.log(`[Email] No recipient email on consignment ${shipment.tracking_number}. Skipping status update email.`);
    return { success: false, reason: 'No client email found' };
  }

  const companyInfo = await getCompanyContactInfo();
  const fromAddress = process.env.SMTP_FROM || `"Nexivan Logistics Dispatch" <${companyInfo.email}>`;
  const trackingNo = shipment.tracking_number;
  const currentStatus = (checkpoint.status || shipment.status || 'In Transit').trim();
  const isDelivered = currentStatus.toLowerCase() === 'delivered';
  const appUrl = (process.env.APP_URL || 'https://nexivanlogistics.com').replace(/\/$/, '');
  const trackLink = `${appUrl}/track-shipment?tracking=${encodeURIComponent(trackingNo)}`;

  // Build attachments based on status:
  // Only attach Proof of Delivery (POD) + Waybill when status reaches 'Delivered'
  // Intermediate status updates (In Transit, Picked Up, Out for Delivery, etc.) are sent as lightweight notifications
  const attachments = [];
  try {
    if (isDelivered) {
      console.log(`[Email] Final delivery reached for #${trackingNo}. Generating Proof of Delivery (POD) & Waybill PDFs...`);
      const podBuffer = await generateProofOfDeliveryPDF(shipment, checkpoint, companyInfo);
      const waybillBuffer = await generateAirWaybillPDF(shipment, options.products || [], companyInfo);
      attachments.push(
        {
          filename: `Proof_Of_Delivery_${trackingNo}.pdf`,
          content: podBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `AirWaybill_${trackingNo}.pdf`,
          content: waybillBuffer,
          contentType: 'application/pdf',
        }
      );
    }
  } catch (pdfErr) {
    console.error('[Email Warning] Error generating delivery PDF:', pdfErr.message);
  }

  const clientName = shipment.receiver_name || shipment.shipper_name || 'Valued Client';
  const eventTime = new Date(checkpoint.checkpoint_time || Date.now()).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bodyContent = `
    <p style="margin-top: 0; font-size: 14px; color: #0f172a;">
      Dear <strong>${clientName}</strong>,
    </p>
    <p style="font-size: 14px; color: #334155;">
      Your consignment has reached a new checkpoint in the dispatch telemetry system:
    </p>

    <!-- Milestone Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0; background-color: #ffffff;">
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; width: 40%; border-bottom: 1px solid #f1f5f9;">Consignment:</td>
        <td style="padding: 10px 14px; font-size: 13.5px; font-weight: 700; font-family: monospace; color: #0284c7; border-bottom: 1px solid #f1f5f9;">#${trackingNo}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Current Status:</td>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${currentStatus.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Location:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${checkpoint.location || shipment.current_location || shipment.destination}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Timestamp:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${eventTime}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: #475569;">Carrier Note:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a;">${checkpoint.description || 'Milestone verified and logged in dispatch system.'}</td>
      </tr>
    </table>

    ${attachments.length > 0 ? `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 3px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin: 18px 0;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #475569; display: block; margin-bottom: 4px;">Attached Document${attachments.length > 1 ? 's' : ''} (PDF):</span>
        <span style="font-size: 12.5px; color: #0f172a;">${attachments.map(a => `<code>${a.filename}</code>`).join(', ')}</span>
      </div>
    ` : ''}
  `;

  const html = buildCleanEmailHTML({
    title: `Consignment Update: ${currentStatus}`,
    subtitle: `Waybill Reference: #${trackingNo}`,
    bodyContent,
    companyInfo,
    actionButton: {
      text: 'View Live Tracking Progress',
      url: trackLink,
    },
  });

  try {
    const emailSubject = isDelivered
      ? `Consignment Delivered [Proof of Delivery] – Waybill #${trackingNo}`
      : `Consignment Update [#${trackingNo} – ${currentStatus}]`;

    const info = await mailer.sendMail({
      from: fromAddress,
      to: recipients,
      subject: emailSubject,
      text: `Shipment #${trackingNo} update: ${currentStatus} at ${checkpoint.location || 'Facility'}. Note: ${checkpoint.description || 'In transit'}. Track live: ${trackLink}`,
      html,
      attachments,
    });
    console.log(`[Email] Consignment status update email sent to ${recipients.join(', ')} (Message ID: ${info.messageId}) [PDF attachments: ${attachments.length}]`);
    return { success: true, messageId: info.messageId, recipients };
  } catch (error) {
    console.error('[Email Error] Failed to send status update email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 5. Send a direct test email to verify SMTP and brand logo rendering
 */
async function sendTestEmail(targetEmail) {
  const mailer = getTransporter();
  const companyInfo = await getCompanyContactInfo();
  const fromAddress = process.env.SMTP_FROM || `"Nexivan Logistics" <${companyInfo.email || 'info@nexivanlogistics.com'}>`;
  const recipient = (targetEmail || 'whumobrianrinywe2@gmail.com').trim();

  const bodyContent = `
    <p style="margin-top: 0; font-size: 14.5px; color: #0f172a; line-height: 1.6;">
      This is a <strong>system verification test email</strong> from the Nexivan Logistics automated dispatch engine.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #15803d; display: block; margin-bottom: 4px;">SMTP Connection Verified</span>
      <span style="font-size: 13.5px; color: #166534; font-weight: 600;">Your email service is active, authenticated, and successfully dispatching with the official Nexivan brand assets.</span>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0; background-color: #ffffff;">
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #f1f5f9;">Recipient:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${recipient}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">SMTP Host:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${process.env.SMTP_HOST || 'Local Mock'}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Sender Address:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${fromAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569;">Timestamp:</td>
        <td style="padding: 10px 14px; font-size: 13px; color: #0f172a;">${new Date().toUTCString()}</td>
      </tr>
    </table>
  `;

  const html = buildCleanEmailHTML({
    title: 'Nexivan Dispatch — Email System Test',
    subtitle: 'System verification message with hosted SVG brand logo',
    bodyContent,
    companyInfo,
    actionButton: {
      text: 'Visit Nexivan Logistics',
      url: 'https://nexivanlogistics.com',
    },
  });

  const mailOptions = {
    from: fromAddress,
    to: recipient,
    subject: `Nexivan Logistics — Email Service Test [${new Date().toLocaleTimeString()}]`,
    text: `Nexivan Logistics Email Service Test\n\nThis is a system verification email sent to ${recipient}.\nSMTP Host: ${process.env.SMTP_HOST}\nTimestamp: ${new Date().toISOString()}`,
    html,
  };

  try {
    const info = await mailer.sendMail(mailOptions);
    console.log(`[Email] Test email sent successfully to ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipient };
  } catch (error) {
    console.error('[Email Error] Failed to send test email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendContactNotification,
  sendContactAutoReply,
  sendShipmentCreationEmail,
  sendShipmentStatusUpdate,
  sendTestEmail,
};
