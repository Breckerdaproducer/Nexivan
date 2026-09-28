const PDFDocument = require('pdfkit');

/**
 * Helper to collect PDF stream into a Buffer
 */
function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));
  });
}

/**
 * Draw official Nexivan Vector Logo in PDFKit
 * Self-contained vector paths and crisp typography
 */
function drawNexivanLogo(doc, x, y, scale = 0.65) {
  doc.save();
  doc.translate(x, y);
  doc.scale(scale);

  // 1. Left Pillar (Cyan to Blue)
  doc.path('M6 52 L6 14 L20 6 L20 44 Z').fill('#0284c7');

  // 2. Dynamic Ribbon (Sky Blue)
  doc.path('M20 6 L44 38 L44 54 L20 22 Z').fill('#06b6d4');

  // 3. Right Pillar (Deep Blue)
  doc.path('M44 22 L44 54 L58 46 L58 8 Z').fill('#0369a1');

  // 4. Forward Accent Dart (White)
  doc.path('M25 25 L38 35 L28 35 Z').fill('#ffffff');

  doc.restore();

  // Typography beside mark
  const textX = x + Math.round(62 * scale);
  doc.save();
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(16).text('NEXIVAN', textX, y + 2, { lineBreak: false });
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7.5).text('LOGISTICS', textX + 1, y + 18, { lineBreak: false, characterSpacing: 2 });
  doc.restore();
}

/**
 * Draw carrier barcode representation
 */
function drawBarcode(doc, x, y, width, height, text) {
  doc.save();
  const chars = String(text).toUpperCase();
  let curX = x;
  const unit = width / 95;
  for (let i = 0; i < 48; i++) {
    const charCode = chars.charCodeAt(i % chars.length) || 65;
    const isThick = (charCode + i * 7) % 3 === 0;
    const w = isThick ? unit * 2.2 : unit * 1.0;
    if (i % 2 === 0) {
      doc.rect(curX, y, w, height).fill('#0f172a');
    }
    curX += w + unit * 0.9;
    if (curX > x + width - 4) break;
  }
  doc.restore();
}

/**
 * Format currency string safely
 */
function formatCurrency(val) {
  if (!val) return '$0.00';
  const clean = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return String(val);
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format date string safely
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Helper to draw a clean structured cell with a label and value
 */
function drawInfoCell(doc, x, y, width, height, label, value, options = {}) {
  doc.save();
  doc.rect(x, y, width, height).lineWidth(0.5).stroke('#cbd5e1');
  if (options.bg) {
    doc.rect(x, y, width, height).fill(options.bg);
  }
  doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(6).text(label.toUpperCase(), x + 6, y + 4, { width: width - 12, lineBreak: false });
  doc.fillColor(options.color || '#0f172a').font(options.font || 'Helvetica-Bold').fontSize(options.size || 7.8).text(value || 'N/A', x + 6, y + 14, { width: width - 12, height: height - 16, lineBreak: false, ellipsis: true });
  doc.restore();
}

/**
 * Draw party contact box with dedicated non-overlapping lines
 */
function drawPartyBox(doc, x, y, width, height, title, party) {
  doc.save();
  doc.rect(x, y, width, height).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(x, y, width, 18).fill('#f8fafc');
  doc.moveTo(x, y + 18).lineTo(x + width, y + 18).lineWidth(0.5).stroke('#cbd5e1');
  
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.2).text(title, x + 8, y + 5, { width: width - 16, lineBreak: false });

  // Name
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5).text(party.name || 'N/A', x + 8, y + 24, { width: width - 16, lineBreak: false, ellipsis: true });

  // Address (dedicated single line or 2-line bounded)
  doc.fillColor('#475569').font('Helvetica').fontSize(7.2);
  doc.text(`Address: ${party.address || 'N/A'}`, x + 8, y + 38, { width: width - 16, height: 18, ellipsis: true });

  // Phone
  doc.text(`Phone: ${party.phone || 'N/A'}`, x + 8, y + 58, { width: width - 16, lineBreak: false, ellipsis: true });

  // Email
  doc.text(`Email: ${party.email || 'N/A'}`, x + 8, y + 70, { width: width - 16, lineBreak: false, ellipsis: true });

  // Station / Hub
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7);
  doc.text(`Hub / Facility: ${party.hub || 'N/A'}`, x + 8, y + 83, { width: width - 16, lineBreak: false, ellipsis: true });

  doc.restore();
}

/**
 * ============================================================================
 * 1. AIR WAYBILL (AWB) PDF GENERATOR (EXECUTIVE POLISHED SUITE)
 * ============================================================================
 */
async function generateAirWaybillPDF(shipment, products = [], settings = {}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 24, bottom: 24, left: 36, right: 36 },
  });

  const bufferPromise = streamToBuffer(doc);

  const trackingNo = shipment.tracking_number || 'NX-000000';
  const origin = shipment.origin || 'Origin Terminal';
  const destination = shipment.destination || 'Destination Terminal';
  const status = (shipment.status || 'In Transit').toUpperCase();
  const transportMode = shipment.transport_mode || shipment.service_type || 'Road Freight';
  const paymentMode = shipment.payment_mode || 'Prepaid';
  const totalFreight = formatCurrency(shipment.total_freight);
  const pickupDate = formatDate(shipment.pickup_date || shipment.shipment_date || new Date());
  const pickupTime = (shipment.pickup_time || '10:00 AM').trim();
  const etaDate = formatDate(shipment.estimated_delivery_date || shipment.expected_delivery_date);
  const currentDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const fX = 36;
  const fY = 24;
  const fW = 540;
  const fH = 744;

  // Outer Border Frame
  doc.rect(fX, fY, fW, fH).lineWidth(1.2).stroke('#0f172a');

  // ---------------- HEADER (y: 30 - 90) ----------------
  drawNexivanLogo(doc, 48, 34, 0.65);
  doc.fillColor('#475569').font('Helvetica').fontSize(6.8);
  doc.text('GLOBAL TELEMETRY FREIGHT DISPATCH \u2022 COMPUTERIZED AIR WAYBILL', 48, 70, { width: 260, lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5);
  doc.text(`Operations Desk: ${settings.phone || '+1 (915) 217-3598'}  |  HQ: 1204 Sunset Ave, Los Angeles, CA`, 48, 80, { width: 260, lineBreak: false });

  const refX = 320;
  const refY = 32;
  const refW = 246;
  const refH = 58;

  doc.rect(refX, refY, refW, refH).lineWidth(1).stroke('#0284c7');
  doc.rect(refX, refY, refW, 16).fill('#0284c7');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('OFFICIAL AIR WAYBILL (AWB) & CONSIGNMENT NOTE', refX + 8, refY + 4, { lineBreak: false });

  doc.fillColor('#0b1e36').font('Courier-Bold').fontSize(13).text(trackingNo, refX + 8, refY + 22, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.5).text(`Date: ${currentDateStr}  |  Station: Web Operations  |  Mode: ${transportMode}`, refX + 8, refY + 42, { width: refW - 12, lineBreak: false, ellipsis: true });

  doc.moveTo(fX, 96).lineTo(fX + fW, 96).lineWidth(1).stroke('#0f172a');

  // ---------------- ROUTE & DISPATCH STRIP (y: 96 - 122) ----------------
  doc.rect(fX, 96, fW, 26).fill('#f1f5f9');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
  doc.text(`ORIGIN: ${origin}`, 48, 104, { width: 140, lineBreak: false, ellipsis: true });
  doc.fillColor('#0284c7').text(`DESTINATION: ${destination}`, 192, 104, { width: 155, lineBreak: false, ellipsis: true });
  doc.fillColor('#0f172a').text(`STATUS: ${status}`, 352, 104, { width: 95, lineBreak: false, ellipsis: true });
  doc.fillColor('#059669').text(`EST. DELIVERY: ${etaDate}`, 452, 104, { width: 114, lineBreak: false, ellipsis: true });

  doc.moveTo(fX, 122).lineTo(fX + fW, 122).lineWidth(1).stroke('#0f172a');

  // ---------------- SHIPPER & CONSIGNEE BOXES (y: 128 - 226) ----------------
  const boxY = 128;
  const boxW = 264;
  const boxH = 98;

  drawPartyBox(doc, 42, boxY, boxW, boxH, '1. SHIPPER / CONSIGNOR (ORIGIN)', {
    name: shipment.shipper_name || 'Commercial Consignor',
    address: shipment.shipper_address || origin,
    phone: shipment.shipper_phone || 'N/A',
    email: shipment.shipper_email || 'N/A',
    hub: origin,
  });

  drawPartyBox(doc, 312, boxY, boxW, boxH, '2. CONSIGNEE / RECIPIENT (DESTINATION)', {
    name: shipment.receiver_name || 'Valued Recipient',
    address: shipment.receiver_address || destination,
    phone: shipment.receiver_phone || 'N/A',
    email: shipment.receiver_email || 'N/A',
    hub: destination,
  });

  // ---------------- FREIGHT SPECIFICATIONS GRID (y: 234 - 296) ----------------
  let curY = 234;
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('3. CONSIGNMENT & FREIGHT SPECIFICATIONS', 42, curY, { lineBreak: false });
  curY += 12;

  const cellH = 25;
  const colW = Math.floor(534 / 4);

  drawInfoCell(doc, 42, curY, colW, cellH, 'Commodity / Cargo Type', shipment.product || 'Commercial Goods');
  drawInfoCell(doc, 42 + colW, curY, colW, cellH, 'Transportation Mode', transportMode);
  drawInfoCell(doc, 42 + colW * 2, curY, colW, cellH, 'Package Type', shipment.package_type || 'Standard Parcel');
  drawInfoCell(doc, 42 + colW * 3, curY, colW, cellH, 'Total Pieces / Quantity', `${shipment.quantity || 1} Units / Pcs`);
  curY += cellH;

  drawInfoCell(doc, 42, curY, colW, cellH, 'Total Gross Weight', shipment.weight || 'Standard Weight');
  drawInfoCell(doc, 42 + colW, curY, colW, cellH, 'Payment Mode', paymentMode);
  drawInfoCell(doc, 42 + colW * 2, curY, colW, cellH, 'Pickup Date & Time', `${pickupDate} ${pickupTime}`);
  drawInfoCell(doc, 42 + colW * 3, curY, colW, cellH, 'Total Freight Charges', totalFreight, { color: '#0284c7', font: 'Helvetica-Bold', size: 9.5 });
  curY += cellH + 8;

  // ---------------- ITEMIZED MANIFEST TABLE (y: 302 - 384) ----------------
  const itemList = products && products.length > 0 ? products : [{
    product_name: shipment.product || 'Commercial Freight Goods',
    package_type: shipment.package_type || 'Standard Parcel',
    dimensions: shipment.dimensions || 'Standard',
    weight: shipment.weight || 'Standard Weight',
    quantity: shipment.quantity || 1,
  }];

  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text(`4. ITEMIZED CARGO MANIFEST (${itemList.length} LINE ${itemList.length === 1 ? 'ITEM' : 'ITEMS'})`, 42, curY, { lineBreak: false });
  curY += 12;

  const c0 = 42;
  const wNum = 24;
  const wDesc = 205;
  const wType = 95;
  const wDim = 85;
  const wWt = 70;
  const wQty = 55;

  doc.rect(c0, curY, 534, 16).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.8);
  doc.text('#', c0 + 6, curY + 4, { width: wNum - 8, lineBreak: false });
  doc.text('ITEM DESCRIPTION', c0 + wNum + 6, curY + 4, { width: wDesc - 8, lineBreak: false });
  doc.text('PACKAGE TYPE', c0 + wNum + wDesc + 6, curY + 4, { width: wType - 8, lineBreak: false });
  doc.text('DIMENSIONS (L\u00d7W\u00d7H)', c0 + wNum + wDesc + wType + 6, curY + 4, { width: wDim - 8, lineBreak: false });
  doc.text('UNIT WEIGHT', c0 + wNum + wDesc + wType + wDim + 6, curY + 4, { width: wWt - 8, lineBreak: false });
  doc.text('QTY', c0 + wNum + wDesc + wType + wDim + wWt + 6, curY + 4, { width: wQty - 12, align: 'right', lineBreak: false });
  curY += 16;

  const maxItems = Math.min(itemList.length, 3);
  for (let i = 0; i < maxItems; i++) {
    const item = itemList[i];
    const rowH = 18;
    if (i % 2 === 0) doc.rect(c0, curY, 534, rowH).fill('#f8fafc');
    doc.rect(c0, curY, 534, rowH).lineWidth(0.3).stroke('#e2e8f0');

    doc.fillColor('#64748b').font('Helvetica').fontSize(6.8).text(String(i + 1), c0 + 6, curY + 5, { width: wNum - 8, lineBreak: false });
    doc.fillColor('#0f172a').font('Helvetica-Bold').text(item.product_name || item.product || 'Commercial Goods', c0 + wNum + 6, curY + 5, { width: wDesc - 8, lineBreak: false, ellipsis: true });
    doc.font('Helvetica').text(item.package_type || 'Standard', c0 + wNum + wDesc + 6, curY + 5, { width: wType - 8, lineBreak: false, ellipsis: true });
    doc.text(item.dimensions || 'Standard', c0 + wNum + wDesc + wType + 6, curY + 5, { width: wDim - 8, lineBreak: false, ellipsis: true });
    doc.text(item.weight || 'Standard', c0 + wNum + wDesc + wType + wDim + 6, curY + 5, { width: wWt - 8, lineBreak: false, ellipsis: true });
    doc.font('Helvetica-Bold').text(String(item.quantity || 1), c0 + wNum + wDesc + wType + wDim + wWt + 6, curY + 5, { width: wQty - 12, align: 'right', lineBreak: false });
    curY += rowH;
  }

  curY += 8;

  // ---------------- SPECIAL INSTRUCTIONS (y: ~390 - 440) ----------------
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('5. SPECIAL INSTRUCTIONS & HANDLING REMARKS', 42, curY, { lineBreak: false });
  curY += 12;

  const remarksH = 36;
  doc.rect(42, curY, 534, remarksH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, remarksH).fill('#f8fafc');
  doc.rect(42, curY, 3, remarksH).fill('#0284c7');
  doc.fillColor('#334155').font('Helvetica').fontSize(7.2);
  const remarksText = shipment.comment || shipment.notes || 'Consignment accepted in standard tamper-evident packaging. Handle with care. Climate controlled transport where applicable. Inspect seal integrity upon transfer.';
  doc.text(remarksText, 52, curY + 6, { width: 516, height: remarksH - 10, ellipsis: true });
  curY += remarksH + 10;

  // ---------------- SIGNATURES & VERIFICATION (y: ~450 - 540) ----------------
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('6. AUTHORIZATION, CARRIER SEAL & DELIVERY RECEIPT', 42, curY, { lineBreak: false });
  curY += 12;

  const signBoxW = 172;
  const signBoxH = 74;

  // 1. Dispatch Officer
  doc.rect(42, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('AUTHORIZED CARRIER DISPATCH OFFICER', 48, curY + 4, { lineBreak: false });
  doc.moveTo(50, curY + 50).lineTo(204, curY + 50).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7).text('Nexivan Operations Officer', 50, curY + 54, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6).text(`Issued: ${currentDateStr}`, 50, curY + 63, { lineBreak: false });

  // 2. Official Seal Stamp
  const sealX = 223;
  doc.rect(sealX, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(sealX + 10, curY + 8, signBoxW - 20, signBoxH - 16).lineWidth(1).stroke('#0284c7');
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7).text('OFFICIAL VERIFICATION', sealX + 26, curY + 15, { lineBreak: false });
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5).text('NEXIVAN DISPATCH NETWORK', sealX + 18, curY + 28, { lineBreak: false });
  doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(6.5).text('AUTHENTIC CARRIER RECORD', sealX + 22, curY + 40, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(5.5).text(`ID: ${trackingNo}`, sealX + 38, curY + 52, { lineBreak: false });

  // 3. Consignee Delivery Signature
  const recSignX = 404;
  doc.rect(recSignX, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(recSignX, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('CONSIGNEE SIGNATURE ON DELIVERY', recSignX + 6, curY + 4, { lineBreak: false });
  doc.moveTo(recSignX + 8, curY + 50).lineTo(recSignX + 164, curY + 50).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5).text('Date & Time: ________________________', recSignX + 8, curY + 54, { lineBreak: false });
  doc.text('Received in Good Condition & Order', recSignX + 8, curY + 63, { lineBreak: false });
  curY += signBoxH + 10;

  // ---------------- BARCODE & TELEMETRY STRIP (y: ~550 - 620) ----------------
  const barStripH = 46;
  doc.rect(42, curY, 534, barStripH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, barStripH).fill('#ffffff');

  drawBarcode(doc, 52, curY + 7, 180, 22, trackingNo);
  doc.fillColor('#475569').font('Courier-Bold').fontSize(7).text(`* ${trackingNo} *`, 52, curY + 32, { width: 180, align: 'center', lineBreak: false });

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7).text('COMPUTERIZED FREIGHT TELEMETRY ARCHIVE', 252, curY + 7, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.5);
  doc.text(`Verify online: https://nexivanlogistics.com/track-shipment?tracking=${encodeURIComponent(trackingNo)}`, 252, curY + 18, { width: 310, lineBreak: false, ellipsis: true });
  doc.text('This digital consignment record is registered and validated across all transit checkpoints.', 252, curY + 28, { width: 310, lineBreak: false });
  curY += barStripH + 10;

  // ---------------- TERMS & CONDITIONS OF CARRIAGE (y: ~630 - 700) ----------------
  const termsH = 50;
  doc.rect(42, curY, 534, termsH).lineWidth(0.5).stroke('#e2e8f0');
  doc.rect(42, curY, 534, termsH).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('SUMMARY OF CARRIER CONDITIONS OF CONTRACT & INTERNATIONAL CARRIAGE RULES', 48, curY + 5, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(5.8);
  doc.text(
    '1. Carriage hereunder is subject to the rules and limitations relating to liability established by the Warsaw or Montreal Convention.\n' +
    '2. The carrier declares that cargo accepted is subject to standard screening and security controls. Sender certifies that shipment contains no dangerous goods.\n' +
    '3. Claims for damage or delay must be notified in writing within 14 days of receipt. All operations governed by Nexivan Standard Carriage Terms.',
    48, curY + 16, { width: 522, lineGap: 3 }
  );

  // ---------------- FOOTER (Anchored cleanly at bottom) ----------------
  const footY = fY + fH - 42;
  doc.rect(fX, footY, fW, 42).fill('#0f172a');

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('NEXIVAN LOGISTICS \u2022 OFFICIAL AIR WAYBILL & FREIGHT CONSIGNMENT NOTE', 48, footY + 7, { lineBreak: false });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5);
  doc.text(`Customer Service: ${settings.phone || '+1 (915) 217-3598'}  |  Email: ${settings.email || 'info@nexivanlogistics.com'}  |  Web: https://nexivanlogistics.com`, 48, footY + 19, { width: 516, lineBreak: false });
  doc.text('CONFIDENTIAL CARRIER RECORD \u2022 FOR AUTHORIZED FREIGHT FORWARDING AND CUSTOMS PURPOSES ONLY', 48, footY + 29, { width: 516, lineBreak: false });

  doc.end();
  return bufferPromise;
}

/**
 * ============================================================================
 * 2. COMMERCIAL INVOICE PDF GENERATOR (EXECUTIVE POLISHED SUITE)
 * ============================================================================
 */
async function generateCommercialInvoicePDF(shipment, products = [], settings = {}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 24, bottom: 24, left: 36, right: 36 },
  });

  const bufferPromise = streamToBuffer(doc);

  const trackingNo = shipment.tracking_number || 'NX-000000';
  const invoiceNo = `INV-${trackingNo.replace(/[^A-Z0-9]/gi, '')}`;
  const origin = shipment.origin || 'Origin Terminal';
  const destination = shipment.destination || 'Destination Terminal';
  const paymentMode = shipment.payment_mode || 'Prepaid';
  const totalFreight = formatCurrency(shipment.total_freight);
  const currentDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const invoiceDate = formatDate(shipment.pickup_date || shipment.shipment_date || new Date());

  const fX = 36;
  const fY = 24;
  const fW = 540;
  const fH = 744;

  doc.rect(fX, fY, fW, fH).lineWidth(1.2).stroke('#0b1e36');

  // Header
  drawNexivanLogo(doc, 48, 34, 0.65);
  doc.fillColor('#475569').font('Helvetica').fontSize(6.8);
  doc.text('COMMERCIAL FREIGHT BILLING & CUSTOMS DECLARATION', 48, 70, { width: 260, lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5);
  doc.text(`Finance Operations: ${settings.phone || '+1 (915) 217-3598'}  |  HQ: 1204 Sunset Ave, Los Angeles, CA`, 48, 80, { width: 260, lineBreak: false });

  const refX = 320;
  const refY = 32;
  const refW = 246;
  const refH = 58;

  doc.rect(refX, refY, refW, refH).lineWidth(1).stroke('#0284c7');
  doc.rect(refX, refY, refW, 16).fill('#0284c7');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('COMMERCIAL FREIGHT INVOICE', refX + 8, refY + 4, { lineBreak: false });

  doc.fillColor('#0b1e36').font('Courier-Bold').fontSize(13).text(invoiceNo, refX + 8, refY + 22, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.5).text(`Date: ${invoiceDate}  |  Terms: ${paymentMode}  |  Currency: USD`, refX + 8, refY + 42, { width: refW - 12, lineBreak: false, ellipsis: true });

  doc.moveTo(fX, 96).lineTo(fX + fW, 96).lineWidth(1).stroke('#0b1e36');

  // Summary strip
  doc.rect(fX, 96, fW, 26).fill('#f1f5f9');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.5);
  doc.text(`WAYBILL REF: ${trackingNo}`, 48, 104, { width: 145, lineBreak: false, ellipsis: true });
  doc.fillColor('#0284c7').text(`MODE: ${shipment.transport_mode || 'Road Freight'}`, 200, 104, { width: 120, lineBreak: false, ellipsis: true });
  doc.fillColor('#0b1e36').text(`TERMS: ${paymentMode.split(' ')[0]}`, 330, 104, { width: 105, lineBreak: false, ellipsis: true });
  doc.fillColor('#059669').text(`STATUS: ${paymentMode.toUpperCase().split(' ')[0]}`, 445, 104, { width: 120, lineBreak: false, ellipsis: true });

  doc.moveTo(fX, 122).lineTo(fX + fW, 122).lineWidth(1).stroke('#0b1e36');

  // Parties
  const boxY = 128;
  const boxW = 264;
  const boxH = 98;

  drawPartyBox(doc, 42, boxY, boxW, boxH, '1. BILL FROM / CARRIER (EXPORTER)', {
    name: 'NEXIVAN LOGISTICS INC.',
    address: 'Global Freight Forwarding & Logistics Operations',
    phone: settings.phone || '+1 (915) 217-3598',
    email: settings.email || 'info@nexivanlogistics.com',
    hub: `Origin Facility: ${origin}`,
  });

  drawPartyBox(doc, 312, boxY, boxW, boxH, '2. BILL TO / CONSIGNEE (IMPORTER)', {
    name: shipment.receiver_name || 'Valued Recipient',
    address: shipment.receiver_address || destination,
    phone: shipment.receiver_phone || 'N/A',
    email: shipment.receiver_email || 'N/A',
    hub: `Destination Terminal: ${destination}`,
  });

  // Charges Table
  let curY = 234;
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('3. ITEMIZED FREIGHT & CARGO CHARGES', 42, curY, { lineBreak: false });
  curY += 12;

  const c0 = 42;
  const wDesc = 230;
  const wType = 95;
  const wWeight = 75;
  const wQty = 45;
  const wAmt = 89;

  doc.rect(c0, curY, 534, 16).fill('#0b1e36');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.8);
  doc.text('LINE ITEM DESCRIPTION', c0 + 6, curY + 4, { width: wDesc - 8, lineBreak: false });
  doc.text('PACKAGE TYPE', c0 + wDesc + 6, curY + 4, { width: wType - 8, lineBreak: false });
  doc.text('WEIGHT', c0 + wDesc + wType + 6, curY + 4, { width: wWeight - 8, lineBreak: false });
  doc.text('QTY', c0 + wDesc + wType + wWeight + 6, curY + 4, { width: wQty - 8, lineBreak: false });
  doc.text('TOTAL (USD)', c0 + wDesc + wType + wWeight + wQty + 6, curY + 4, { width: wAmt - 12, align: 'right', lineBreak: false });
  curY += 16;

  const itemList = products && products.length > 0 ? products : [{
    product_name: shipment.product || 'Commercial Cargo Line Item',
    package_type: shipment.package_type || 'Standard Parcel',
    weight: shipment.weight || 'Standard Weight',
    quantity: shipment.quantity || 1,
  }];

  const maxItems = Math.min(itemList.length, 3);
  for (let i = 0; i < maxItems; i++) {
    const item = itemList[i];
    const rowH = 18;
    if (i % 2 === 0) doc.rect(c0, curY, 534, rowH).fill('#f8fafc');
    doc.rect(c0, curY, 534, rowH).lineWidth(0.3).stroke('#e2e8f0');

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7).text(item.product_name || item.product || 'Cargo Line Item', c0 + 6, curY + 5, { width: wDesc - 8, lineBreak: false, ellipsis: true });
    doc.font('Helvetica').text(item.package_type || 'Standard Parcel', c0 + wDesc + 6, curY + 5, { width: wType - 8, lineBreak: false, ellipsis: true });
    doc.text(item.weight || 'N/A', c0 + wDesc + wType + 6, curY + 5, { width: wWeight - 8, lineBreak: false, ellipsis: true });
    doc.text(String(item.quantity || 1), c0 + wDesc + wType + wWeight + 6, curY + 5, { width: wQty - 8, lineBreak: false });
    doc.font('Helvetica-Bold').text(i === 0 ? totalFreight : '$0.00', c0 + wDesc + wType + wWeight + wQty + 6, curY + 5, { width: wAmt - 12, align: 'right', lineBreak: false });
    curY += rowH;
  }

  curY += 10;

  // Breakdown & Settlement Boxes
  const boxBottomY = curY;
  const leftBoxW = 264;
  const rightBoxX = 312;
  const rightBoxW = 264;

  // Left: Terms
  doc.rect(42, boxBottomY, leftBoxW, 80).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, boxBottomY, leftBoxW, 16).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.8).text('PAYMENT ACCOUNTING TERMS & SETTLEMENT', 48, boxBottomY + 4, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.8);
  doc.text(`Payment Settlement Method: ${paymentMode}`, 48, boxBottomY + 22, { width: 250, lineBreak: false, ellipsis: true });
  doc.text(`Consignment Tracking Reference: ${trackingNo}`, 48, boxBottomY + 34, { width: 250, lineBreak: false, ellipsis: true });
  doc.text('This invoice constitutes authentic commercial freight billing.', 48, boxBottomY + 46, { width: 250, lineBreak: false });
  doc.text('All operations governed by international carriage standards.', 48, boxBottomY + 58, { width: 250, lineBreak: false });

  // Right: Totals
  doc.rect(rightBoxX, boxBottomY, rightBoxW, 80).lineWidth(0.5).stroke('#cbd5e1');
  doc.fillColor('#475569').font('Helvetica').fontSize(7.2).text('Subtotal Freight Charges:', rightBoxX + 10, boxBottomY + 8);
  doc.fillColor('#0f172a').font('Helvetica-Bold').text(totalFreight, rightBoxX + 175, boxBottomY + 8, { width: 78, align: 'right' });

  doc.fillColor('#475569').font('Helvetica').fontSize(7.2).text('Port & Terminal Handling:', rightBoxX + 10, boxBottomY + 22);
  doc.fillColor('#0f172a').font('Helvetica').text('$0.00 (Included)', rightBoxX + 175, boxBottomY + 22, { width: 78, align: 'right' });

  doc.fillColor('#475569').font('Helvetica').fontSize(7.2).text('Customs Documentation:', rightBoxX + 10, boxBottomY + 36);
  doc.fillColor('#0f172a').font('Helvetica').text('$0.00 (Included)', rightBoxX + 175, boxBottomY + 36, { width: 78, align: 'right' });

  doc.rect(rightBoxX, boxBottomY + 52, rightBoxW, 28).fill('#0b1e36');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('TOTAL AMOUNT DUE:', rightBoxX + 10, boxBottomY + 60, { lineBreak: false });
  doc.fillColor('#38bdf8').font('Helvetica-Bold').fontSize(10).text(totalFreight, rightBoxX + 165, boxBottomY + 59, { width: 88, align: 'right', lineBreak: false });

  curY = boxBottomY + 80 + 10;

  // 4. Financial Signatory & Corporate Endorsement
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('4. AUTHORIZED FINANCIAL SIGNATORY & CORPORATE ENDORSEMENT', 42, curY, { lineBreak: false });
  curY += 12;

  const signBoxW = 172;
  const signBoxH = 74;

  // 1. Finance Officer
  doc.rect(42, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('AUTHORIZED FINANCIAL CONTROLLER', 48, curY + 4, { lineBreak: false });
  doc.moveTo(50, curY + 50).lineTo(204, curY + 50).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7).text('Nexivan Treasury Controller', 50, curY + 54, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6).text(`Audit Ref: FIN-${trackingNo.replace(/[^0-9]/g, '')}`, 50, curY + 63, { lineBreak: false });

  // 2. Official Finance Stamp
  const sealX = 223;
  doc.rect(sealX, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(sealX + 10, curY + 8, signBoxW - 20, signBoxH - 16).lineWidth(1).stroke('#0284c7');
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(7).text('OFFICIAL FINANCE SEAL', sealX + 28, curY + 15, { lineBreak: false });
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5).text('NEXIVAN TREASURY & BILLING', sealX + 18, curY + 28, { lineBreak: false });
  doc.fillColor('#10b981').font('Helvetica-Bold').fontSize(6.5).text('SETTLEMENT CERTIFIED', sealX + 26, curY + 40, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(5.5).text(`REF: ${invoiceNo}`, sealX + 38, curY + 52, { lineBreak: false });

  // 3. Customs Broker Endorsement
  const recSignX = 404;
  doc.rect(recSignX, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(recSignX, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('CUSTOMS CLEARANCE ENDORSEMENT', recSignX + 6, curY + 4, { lineBreak: false });
  doc.moveTo(recSignX + 8, curY + 50).lineTo(recSignX + 164, curY + 50).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5).text('Port / Customs Stamp: ________________', recSignX + 8, curY + 54, { lineBreak: false });
  doc.text('Tariff Schedule Verified for Clearance', recSignX + 8, curY + 63, { lineBreak: false });
  curY += signBoxH + 10;

  // Barcode strip
  const barStripH = 46;
  doc.rect(42, curY, 534, barStripH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, barStripH).fill('#ffffff');

  drawBarcode(doc, 52, curY + 7, 180, 22, invoiceNo);
  doc.fillColor('#475569').font('Courier-Bold').fontSize(7).text(`* ${invoiceNo} *`, 52, curY + 32, { width: 180, align: 'center', lineBreak: false });

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7).text('AUTHENTIC COMMERCIAL INVOICE ARCHIVE', 252, curY + 7, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.5);
  doc.text(`Verify online: https://nexivanlogistics.com/track-shipment?tracking=${encodeURIComponent(trackingNo)}`, 252, curY + 18, { width: 310, lineBreak: false, ellipsis: true });
  doc.text('This invoice is recorded in the carrier billing ledger. All currency transactions in USD.', 252, curY + 28, { width: 310, lineBreak: false });
  curY += barStripH + 10;

  // Declaration
  const declH = 50;
  doc.rect(42, curY, 534, declH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, declH).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7).text('CARRIER COMMERCIAL DECLARATION & CUSTOMS COMPLIANCE', 48, curY + 5, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.2);
  doc.text(
    'I hereby certify that this invoice represents an authentic and truthful account of commercial carriage charges.\n' +
    'The cargo description and declared valuation are certified for international customs clearance and port transit.\n' +
    `Authorized by Nexivan Logistics Finance Operations  |  Computerized Record Issued: ${currentDateStr}`,
    48, curY + 16, { width: 522, lineGap: 3 }
  );

  // Footer
  const footY = fY + fH - 42;
  doc.rect(fX, footY, fW, 42).fill('#0b1e36');

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('NEXIVAN LOGISTICS \u2022 OFFICIAL COMMERCIAL FREIGHT INVOICE', 48, footY + 7, { lineBreak: false });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(6.5);
  doc.text(`Billing Inquiries: ${settings.email || 'info@nexivanlogistics.com'}  |  Operations: ${settings.phone || '+1 (915) 217-3598'}  |  Web: https://nexivanlogistics.com`, 48, footY + 19, { width: 516, lineBreak: false });
  doc.text('CONFIDENTIAL FINANCIAL RECORD \u2022 ISSUED PURSUANT TO INTERNATIONAL TRADE AND CUSTOMS REGULATIONS', 48, footY + 29, { width: 516, lineBreak: false });

  doc.end();
  return bufferPromise;
}

/**
 * ============================================================================
 * 3. PROOF OF DELIVERY (POD) PDF GENERATOR (EXECUTIVE POLISHED SUITE)
 * ============================================================================
 */
async function generateProofOfDeliveryPDF(shipment, checkpoint = {}, settings = {}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 24, bottom: 24, left: 36, right: 36 },
  });

  const bufferPromise = streamToBuffer(doc);

  const trackingNo = shipment.tracking_number || 'NX-000000';
  const podNo = `POD-${trackingNo.replace(/[^A-Z0-9]/gi, '')}`;
  const origin = shipment.origin || 'Origin Hub';
  const destination = shipment.destination || 'Destination City';
  const deliveryDate = checkpoint.checkpoint_time ? formatDate(checkpoint.checkpoint_time) : formatDate(shipment.updated_at || new Date());
  const deliveryTime = checkpoint.checkpoint_time ? new Date(checkpoint.checkpoint_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '14:30 PM';
  const receiverName = shipment.receiver_name || 'Valued Consignee';
  const receiverAddress = shipment.receiver_address || destination;
  const currentDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const fX = 36;
  const fY = 24;
  const fW = 540;
  const fH = 744;

  doc.rect(fX, fY, fW, fH).lineWidth(1.2).stroke('#065f46');

  // Header
  drawNexivanLogo(doc, 48, 34, 0.65);
  doc.fillColor('#065f46').font('Helvetica').fontSize(6.8);
  doc.text('GLOBAL CONSIGNMENT TELEMETRY \u2022 OFFICIAL PROOF OF DELIVERY', 48, 70, { width: 260, lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6.5);
  doc.text(`Operations Desk: ${settings.phone || '+1 (915) 217-3598'}  |  HQ: 1204 Sunset Ave, Los Angeles, CA`, 48, 80, { width: 260, lineBreak: false });

  const refX = 320;
  const refY = 32;
  const refW = 246;
  const refH = 58;

  doc.rect(refX, refY, refW, refH).lineWidth(1).stroke('#059669');
  doc.rect(refX, refY, refW, 16).fill('#059669');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('PROOF OF DELIVERY (POD) CERTIFICATE', refX + 8, refY + 4, { lineBreak: false });

  doc.fillColor('#065f46').font('Courier-Bold').fontSize(13).text(podNo, refX + 8, refY + 22, { lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Bold').fontSize(6.8).text('STATUS: DELIVERED & SIGNED', refX + 8, refY + 42, { lineBreak: false });

  doc.moveTo(fX, 96).lineTo(fX + fW, 96).lineWidth(1).stroke('#065f46');

  // Delivery Banner
  doc.rect(fX, 96, fW, 26).fill('#ecfdf5');
  doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(8);
  doc.text(`CONSIGNMENT #${trackingNo} DELIVERED & ACCEPTED IN GOOD CONDITION`, 48, 104, { width: 516, lineBreak: false });

  doc.moveTo(fX, 122).lineTo(fX + fW, 122).lineWidth(1).stroke('#065f46');

  // Telemetry Log Card
  const logY = 128;
  doc.rect(42, logY, 534, 66).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, logY, 534, 16).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.2).text('1. OFFICIAL TELEMETRY DISPATCH LOG', 48, logY + 4, { lineBreak: false });

  doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7.2).text('Delivery Event Status:', 48, logY + 22, { width: 120, lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Bold').text('DELIVERED - SIGNED AND ACCEPTED', 160, logY + 22, { lineBreak: false });

  doc.fillColor('#475569').font('Helvetica-Bold').text('Delivery Timestamp:', 48, logY + 36, { width: 120, lineBreak: false });
  doc.fillColor('#0f172a').font('Helvetica').text(`${deliveryDate} at ${deliveryTime}`, 160, logY + 36, { lineBreak: false });

  doc.fillColor('#475569').font('Helvetica-Bold').text('Delivery Hub / Facility:', 48, logY + 50, { width: 120, lineBreak: false });
  doc.fillColor('#0f172a').font('Helvetica').text(`${checkpoint.location || destination} (Consignee Final Address)`, 160, logY + 50, { lineBreak: false, ellipsis: true });

  // Parties
  const boxY = 200;
  const boxW = 264;
  const boxH = 98;

  drawPartyBox(doc, 42, boxY, boxW, boxH, '2. RECIPIENT / CONSIGNEE (DELIVERED TO)', {
    name: receiverName,
    address: receiverAddress,
    phone: shipment.receiver_phone || 'N/A',
    email: shipment.receiver_email || 'N/A',
    hub: `Destination: ${destination}`,
  });

  drawPartyBox(doc, 312, boxY, boxW, boxH, '3. SHIPPER / CONSIGNOR (ORIGIN)', {
    name: shipment.shipper_name || 'Commercial Consignor',
    address: shipment.shipper_address || origin,
    phone: shipment.shipper_phone || 'N/A',
    email: shipment.shipper_email || 'N/A',
    hub: `Origin: ${origin}`,
  });

  // Cargo Verified Grid
  let curY = 306;
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('4. CARGO VERIFIED ON FINAL DELIVERY', 42, curY, { lineBreak: false });
  curY += 12;

  const colW = Math.floor(534 / 4);
  drawInfoCell(doc, 42, curY, colW, 26, 'Delivered Commodity', shipment.product || 'Commercial Goods');
  drawInfoCell(doc, 42 + colW, curY, colW, 26, 'Transport Mode', shipment.transport_mode || 'Road Freight');
  drawInfoCell(doc, 42 + colW * 2, curY, colW, 26, 'Quantity Accepted', `${shipment.quantity || 1} Units / Pcs`, { color: '#059669' });
  drawInfoCell(doc, 42 + colW * 3, curY, colW, 26, 'Packaging & Weight', `${shipment.weight || 'Standard'} \u2022 ${shipment.package_type || 'Parcel'}`);
  curY += 36;

  // Consignee Formal Acceptance
  const acceptH = 90;
  doc.rect(42, curY, 534, acceptH).lineWidth(0.75).stroke('#059669');
  doc.rect(42, curY, 534, 16).fill('#ecfdf5');
  doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(7.5).text('5. CONSIGNEE FORMAL ACKNOWLEDGMENT & SIGNATURE OF RECEIPT', 48, curY + 4, { lineBreak: false });

  doc.fillColor('#334155').font('Helvetica').fontSize(7.2);
  doc.text('I hereby certify that the consignment referenced above has been delivered in full, inspected, and accepted in good order and condition without exception or damage.', 48, curY + 22, { width: 520, lineBreak: false });

  // Signature line
  const sigY = curY + 66;
  doc.moveTo(48, sigY).lineTo(230, sigY).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.2).text('Consignee Signature / Representative Stamp', 48, sigY + 5, { lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Oblique').fontSize(8.5).text(receiverName, 48, sigY - 12, { lineBreak: false });

  // Seal Center
  const sealX = 250;
  doc.rect(sealX, curY + 40, 115, 44).lineWidth(1).stroke('#0284c7');
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(6.8).text('NEXIVAN TELEMETRY', sealX + 18, curY + 48, { lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Bold').fontSize(6.5).text('DELIVERY CONFIRMED', sealX + 16, curY + 60, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(5.5).text('SYSTEM RECORD VALIDATED', sealX + 12, curY + 71, { lineBreak: false });

  // Timestamp Right
  doc.moveTo(380, sigY).lineTo(560, sigY).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.2).text('Delivery Timestamp Verified', 380, sigY + 5, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(`${deliveryDate} - ${deliveryTime}`, 380, sigY - 12, { lineBreak: false });
  curY += acceptH + 10;

  // 6. CHAIN OF CUSTODY & FINAL HANDOVER INSPECTION (3 Boxes)
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7.8).text('6. CHAIN OF CUSTODY & FINAL HANDOVER INSPECTION', 42, curY, { lineBreak: false });
  curY += 12;

  const signBoxW = 172;
  const signBoxH = 74;

  // 1. Delivery Courier
  doc.rect(42, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('FINAL-MILE COURIER OFFICER', 48, curY + 4, { lineBreak: false });
  doc.moveTo(50, curY + 50).lineTo(204, curY + 50).lineWidth(0.5).stroke('#94a3b8');
  doc.fillColor('#059669').font('Helvetica-Bold').fontSize(7).text('Nexivan Courier Operations', 50, curY + 54, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(6).text(`Unit Ref: NX-CR-${trackingNo.slice(-4) || '8190'}`, 50, curY + 63, { lineBreak: false });

  // 2. Terminal Station Seal
  const sealX2 = 223;
  doc.rect(sealX2, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(sealX2 + 10, curY + 8, signBoxW - 20, signBoxH - 16).lineWidth(1).stroke('#059669');
  doc.fillColor('#059669').font('Helvetica-Bold').fontSize(7).text('TERMINAL DISPATCH SEAL', sealX2 + 24, curY + 15, { lineBreak: false });
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5).text('DESTINATION HUB SECURED', sealX2 + 22, curY + 28, { lineBreak: false });
  doc.fillColor('#0284c7').font('Helvetica-Bold').fontSize(6.5).text('CARGO HANDOVER COMPLETE', sealX2 + 18, curY + 40, { lineBreak: false });
  doc.fillColor('#64748b').font('Helvetica').fontSize(5.5).text(`POD REF: ${podNo}`, sealX2 + 38, curY + 52, { lineBreak: false });

  // 3. Handover Inspection Verification
  const recSignX2 = 404;
  doc.rect(recSignX2, curY, signBoxW, signBoxH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(recSignX2, curY, signBoxW, 15).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(6.5).text('HANDOVER INTEGRITY CHECK', recSignX2 + 6, curY + 4, { lineBreak: false });
  doc.fillColor('#334155').font('Helvetica').fontSize(6.5);
  doc.text('1. Tamper Seals: INTACT', recSignX2 + 10, curY + 24, { lineBreak: false });
  doc.text('2. Packaging Condition: PERFECT', recSignX2 + 10, curY + 36, { lineBreak: false });
  doc.text('3. Weight Verified on Handover', recSignX2 + 10, curY + 48, { lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Bold').fontSize(6.5).text('DISCHARGED WITHOUT EXCEPTION', recSignX2 + 10, curY + 60, { lineBreak: false });
  curY += signBoxH + 10;

  // Barcode strip
  const barStripH = 46;
  doc.rect(42, curY, 534, barStripH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, barStripH).fill('#ffffff');

  drawBarcode(doc, 52, curY + 7, 180, 22, podNo);
  doc.fillColor('#475569').font('Courier-Bold').fontSize(7).text(`* ${podNo} *`, 52, curY + 32, { width: 180, align: 'center', lineBreak: false });

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7).text('AUTHENTIC PROOF OF DELIVERY ARCHIVE', 252, curY + 7, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.5);
  doc.text(`Verify online: https://nexivanlogistics.com/track-shipment?tracking=${encodeURIComponent(trackingNo)}`, 252, curY + 18, { width: 310, lineBreak: false, ellipsis: true });
  doc.text('This delivery certificate constitutes conclusive carrier evidence of final receipt.', 252, curY + 28, { width: 310, lineBreak: false });
  curY += barStripH + 10;

  // Archival statement
  const declH = 48;
  doc.rect(42, curY, 534, declH).lineWidth(0.5).stroke('#cbd5e1');
  doc.rect(42, curY, 534, declH).fill('#f8fafc');
  doc.fillColor('#0b1e36').font('Helvetica-Bold').fontSize(7).text('DELIVERY AUDIT & ARCHIVAL CONFIRMATION', 48, curY + 5, { lineBreak: false });
  doc.fillColor('#475569').font('Helvetica').fontSize(6.2);
  doc.text(
    'This Proof of Delivery certificate is generated automatically from carrier GPS & milestone telemetry.\n' +
    'Recipient confirmation recorded on official handheld scanner terminal. Signature verified upon cargo handover.\n' +
    `Computerized Delivery Log Sealed: ${currentDateStr}  |  Archived in Nexivan Global Network.`,
    48, curY + 16, { width: 522, lineGap: 3 }
  );

  // Footer
  const footY = fY + fH - 42;
  doc.rect(fX, footY, fW, 42).fill('#064e3b');

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text('NEXIVAN LOGISTICS \u2022 GLOBAL CONSIGNMENT PROOF OF DELIVERY (POD)', 48, footY + 7, { lineBreak: false });
  doc.fillColor('#a7f3d0').font('Helvetica').fontSize(6.5);
  doc.text(`Official Delivery Record  |  Operations Desk: ${settings.phone || '+1 (915) 217-3598'}  |  Email: ${settings.email || 'info@nexivanlogistics.com'}`, 48, footY + 19, { width: 516, lineBreak: false });
  doc.text('CONFIDENTIAL PROOF OF DELIVERY RECORD \u2022 CONSTITUTES CONCLUSIVE LEGAL EVIDENCE OF DISCHARGE', 48, footY + 29, { width: 516, lineBreak: false });

  doc.end();
  return bufferPromise;
}

module.exports = {
  generateAirWaybillPDF,
  generateCommercialInvoicePDF,
  generateProofOfDeliveryPDF,
};
