const { generateBarcodeSVG } = require('./barcodeGenerator');

/**
 * Server-side Tracking Result HTML Renderer
 * Generates tracking result cards for server-side pre-rendering
 * Supports:
 *  - Fully Responsive, Corporate Courier Mobile Layout (< 768px and < 480px)
 *  - Industry-Standard Air Waybill (AWB) Print Layout (@media print)
 */

function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return String(isoStr);
  }
}

function formatOnlyDate(dateStr) {
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

function getTransportIcon(mode) {
  const m = (mode || '').toLowerCase();
  if (m.includes('air') || m.includes('plane') || m.includes('flight')) return 'fa-plane';
  if (m.includes('ship') || m.includes('sea') || m.includes('ocean')) return 'fa-ship';
  if (m.includes('train') || m.includes('rail')) return 'fa-train';
  if (m.includes('van')) return 'fa-shuttle-van';
  if (m.includes('drone')) return 'fa-helicopter';
  return 'fa-truck';
}

function getProgressPercent(status) {
  const map = {
    'pending': 15,
    'order created': 15,
    'picked up': 35,
    'received at hub': 45,
    'in transit': 65,
    'departed facility': 70,
    'customs cleared': 75,
    'out for delivery': 85,
    'delivered': 100,
    'on hold': 50,
    'cancelled': 0,
  };
  const normalized = (status || '').toLowerCase().trim();
  return map[normalized] !== undefined ? map[normalized] : 50;
}

function renderTrackingSuccessHTML(s, checkpoints = []) {
  const statusLower = (s.status || '').toLowerCase();
  const steps = [
    { name: 'Order Placed', key: 'pending' },
    { name: 'Picked Up', key: 'picked up' },
    { name: 'In Transit', key: 'in transit' },
    { name: 'Out for Delivery', key: 'out for delivery' },
    { name: 'Delivered', key: 'delivered' },
  ];

  let activeStepIndex = 2;
  if (statusLower.includes('picked')) activeStepIndex = 1;
  else if (statusLower.includes('transit') || statusLower.includes('facility') || statusLower.includes('hub')) activeStepIndex = 2;
  else if (statusLower.includes('out for delivery')) activeStepIndex = 3;
  else if (statusLower.includes('delivered')) activeStepIndex = 4;
  else if (statusLower.includes('order') || statusLower.includes('pending')) activeStepIndex = 0;

  let statusColor = '#0284c7';
  if (statusLower.includes('delivered')) statusColor = '#10b981';
  else if (statusLower.includes('out for delivery')) statusColor = '#f59e0b';
  else if (statusLower.includes('hold')) statusColor = '#ef4444';

  const progress = s.progressPercent || getProgressPercent(s.status);
  const trackingNo = s.tracking_number || s.trackingNumber || 'NX-000000';
  const originCity = s.origin || 'Origin Terminal';
  const destCity = s.destination || 'Destination Terminal';
  const receiverAddress = s.receiver_address || (s.receiver && s.receiver.address) || destCity || 'Los Angeles, CA';
  const receiverName = s.receiver_name || (s.receiver && s.receiver.name) || 'Valued Recipient';
  const receiverPhone = s.receiver_phone || (s.receiver && s.receiver.phone) || '';
  const receiverEmail = s.receiver_email || (s.receiver && s.receiver.email) || '';

  const shipperName = s.shipper_name || (s.shipper && s.shipper.name) || 'Commercial Consignor';
  const shipperAddress = s.shipper_address || (s.shipper && s.shipper.address) || originCity || 'Origin Hub';
  const shipperPhone = s.shipper_phone || (s.shipper && s.shipper.phone) || '';
  const shipperEmail = s.shipper_email || (s.shipper && s.shipper.email) || '';

  const encodedLocation = encodeURIComponent(receiverAddress.trim());
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodedLocation}&t=m&z=14&output=embed&iwloc=near`;
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

  // 9 Core Freight Specifications
  const product = s.product || s.package_type || 'Commercial Goods';
  const transportMode = s.transport_mode || s.service_type || 'Road Freight';
  const quantity = s.quantity || 1;
  const paymentMode = s.payment_mode || 'Prepaid';
  const totalFreight = s.total_freight || '$0.00';
  const pickupDate = s.pickup_date || s.shipment_date || s.shipmentDate;
  const pickupTime = s.pickup_time || '10:00 AM';
  const etaDate = s.expected_delivery_date || s.estimated_delivery_date || s.estimatedDeliveryDate;
  const commentText = s.comment || s.notes || '';
  const weight = s.weight || '15 kg';
  const packageType = s.package_type || 'Standard Freight Parcel';
  const transportIcon = getTransportIcon(transportMode);
  const currentLoc = (s.current_location || s.currentLocation || (checkpoints.length > 0 ? (checkpoints[checkpoints.length - 1].location || checkpoints[checkpoints.length - 1].checkpoint_location) : '') || originCity).trim();
  const currentLocDisplay = currentLoc ? currentLoc.split(',')[0] : '';

  // Crisp Code 128 (Subtype B) Barcode
  const barcodeSvg = generateBarcodeSVG(trackingNo, {
    height: 48,
    barWidth: 2,
    showText: true,
    textColor: '#0b1e36',
  });

  const printBarcodeSvg = generateBarcodeSVG(trackingNo, {
    height: 44,
    barWidth: 1.8,
    showText: true,
    textColor: '#0f172a',
  });

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // ==========================================================================
  // PART 1: SCREEN & MOBILE DISPLAY CARD (.nex-screen-only)
  // ==========================================================================
  let html = `
    <!-- SCREEN & MOBILE TRACKING CARD -->
    <div class="nex-track-card nex-track-success-card nex-screen-only">
      
      <!-- Top Badges & Waybill Reference -->
      <div class="nex-mobile-header-top">
        <div class="nex-status-badges-wrap">
          <span class="nex-badge-pill" style="background-color: ${statusColor};">
            ${(s.status || 'In Transit').toUpperCase()}
          </span>
          <span class="nex-mode-badge">
            <i class="fas ${transportIcon}"></i> ${transportMode}
          </span>
        </div>
        <div class="nex-actions-quick">
          <button onclick="window.print()" class="nex-quick-print-btn" title="Print Official Waybill">
            <i class="fas fa-print"></i> <span class="hide-xs">Print</span>
          </button>
        </div>
      </div>

      <!-- Main Tracking Heading & Route -->
      <div class="nex-track-main-heading">
        <div class="nex-title-and-copy">
          <h2 class="nex-tracking-number">
            Consignment <span class="nex-track-no-highlight">#${trackingNo}</span>
          </h2>
          <button type="button" class="nex-copy-code-btn" onclick="navigator.clipboard.writeText('${trackingNo}'); alert('Tracking code ${trackingNo} copied to clipboard!');" title="Copy tracking number">
            <i class="far fa-copy"></i>
          </button>
        </div>
        <div class="nex-route-badge-row">
          <div class="nex-route-point">
            <i class="fas fa-circle-dot text-brand"></i>
            <strong>${originCity}</strong>
          </div>
          <div class="nex-route-arrow">
            <i class="fas fa-arrow-right"></i>
          </div>
          <div class="nex-route-point">
            <i class="fas fa-location-dot text-success"></i>
            <strong>${destCity}</strong>
          </div>
        </div>
      </div>

      <!-- Official Barcode Presentation Card -->
      <div class="nex-barcode-card">
        <div class="nex-barcode-title">
          <i class="fas fa-barcode"></i> Official 1D Barcode &bull; ISO/IEC 15417 Standard
        </div>
        <div class="nex-barcode-svg-wrap">
          ${barcodeSvg}
        </div>
        <div class="nex-barcode-meta">
          Human-readable waybill code verified for automated sorting and hub dispatch
        </div>
      </div>

      <!-- Delivery Schedule & Freight Cost Mini-Banner -->
      <div class="nex-metrics-banner">
        <div class="nex-metric-box">
          <span class="nex-metric-lbl"><i class="far fa-calendar-check text-brand"></i> Expected Delivery</span>
          <span class="nex-metric-val text-brand">${formatOnlyDate(etaDate)}</span>
        </div>
        <div class="nex-metric-box">
          <span class="nex-metric-lbl"><i class="fas fa-file-invoice-dollar text-success"></i> Total Freight</span>
          <span class="nex-metric-val text-dark">${totalFreight}</span>
        </div>
      </div>

      <!-- Modern Responsive Stepper (Progress Tracker) -->
      <div class="nex-stepper-container" style="position: relative; margin: 26px 0 26px; width: 100%; box-sizing: border-box;">
        <!-- Continuous Connecting Progress Line Track -->
        <div class="nex-stepper-bar-bg" style="position: absolute; top: 14px; left: 10%; right: 10%; height: 6px; background: #e2e8f0; border-radius: 9999px; z-index: 1; display: block;">
          <div class="nex-stepper-bar-fill" style="height: 100%; width: ${progress}%; background: linear-gradient(90deg, #0284c7, #06b6d4); border-radius: 9999px; transition: width 0.8s ease; display: block; box-shadow: 0 0 8px rgba(2, 132, 199, 0.35);"></div>
        </div>
        <!-- Stepper Milestone Nodes -->
        <div class="nex-stepper-points" style="position: relative; display: flex; justify-content: space-between; align-items: flex-start; z-index: 2; width: 100%;">
  `;

  steps.forEach((st, idx) => {
    const isDone = idx <= activeStepIndex;
    const isCurrent = idx === activeStepIndex;
    const circleBg = isCurrent ? '#0284c7' : isDone ? '#10b981' : '#e2e8f0';
    const circleColor = isDone || isCurrent ? '#ffffff' : '#64748b';
    const border = isCurrent ? '3px solid #7dd3fc' : 'none';

    html += `
      <div class="nex-step-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}" style="flex: 1 1 0; display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 0; box-sizing: border-box;">
        <div class="nex-step-circle" style="width: 28px; height: 28px; border-radius: 50%; background: ${circleBg}; color: ${circleColor}; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); border: ${border}; z-index: 3; position: relative;">
          ${isDone && !isCurrent ? '<i class="fas fa-check"></i>' : (idx + 1)}
        </div>
        <div class="nex-step-label ${isCurrent ? 'active' : ''}" style="font-size: 11px; font-weight: ${isCurrent ? '800' : '600'}; color: ${isCurrent ? '#0284c7' : '#64748b'}; margin-top: 6px; line-height: 1.25; word-break: break-word; text-align: center;">${st.name}</div>
      </div>
    `;
  });

  html += `
        </div>
      </div>


      <!-- Consignment & Freight Specifications (9 Fields) -->
      <div class="nex-specs-panel">
        <div class="nex-specs-header">
          <i class="fas fa-boxes-packing text-brand"></i> Consignment &amp; Freight Specifications
        </div>
        <div class="nex-specs-grid">
          <div class="nex-spec-item full-width-sm">
            <span class="nex-spec-label"><i class="fas fa-cube text-brand"></i> Product Description</span>
            <span class="nex-spec-value highlight-product">${product}</span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="fas ${transportIcon} text-brand"></i> Mode of Transportation</span>
            <span class="nex-spec-value">${transportMode}</span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="fas fa-layer-group text-brand"></i> Quantity</span>
            <span class="nex-spec-value"><span class="nex-quantity-badge">${quantity} Units / Pcs</span></span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="far fa-credit-card text-brand"></i> Payment Mode</span>
            <span class="nex-spec-value"><span class="nex-payment-badge"><i class="fas fa-shield-check"></i> ${paymentMode}</span></span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="fas fa-receipt text-brand"></i> Total Freight</span>
            <span class="nex-spec-value font-bold text-success">${totalFreight}</span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="far fa-calendar-alt text-brand"></i> Pick Up Date</span>
            <span class="nex-spec-value">${formatOnlyDate(pickupDate)}</span>
          </div>
          <div class="nex-spec-item">
            <span class="nex-spec-label"><i class="far fa-clock text-brand"></i> Pick Up Time</span>
            <span class="nex-spec-value">${pickupTime}</span>
          </div>
          <div class="nex-spec-item full-width-sm nex-spec-eta-card">
            <span class="nex-spec-label"><i class="fas fa-plane-arrival text-brand"></i> Expected Delivery Date</span>
            <span class="nex-spec-value eta-highlight">${formatOnlyDate(etaDate)}</span>
          </div>
        </div>

        ${s.products && s.products.length > 0 ? `
          <div class="nex-products-table-wrap" style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            <div style="font-size: 13px; font-weight: 700; color: #0b1e36; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-boxes-stacked" style="color: #0284c7;"></i>
                <span>Itemized Cargo Manifest (${s.products.length} ${s.products.length === 1 ? 'item' : 'items'})</span>
              </span>
              <span style="font-size: 11px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px;">
                Total Units: ${s.products.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 1), 0)} pcs
              </span>
            </div>
            <div style="overflow-x: auto; width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; min-width: 520px;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 10px 14px; width: 40px;">#</th>
                    <th style="padding: 10px 14px;">Product Description</th>
                    <th style="padding: 10px 14px;">Package Type</th>
                    <th style="padding: 10px 14px;">Dimensions</th>
                    <th style="padding: 10px 14px;">Weight</th>
                    <th style="padding: 10px 14px; text-align: right;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.products.map((p, idx) => `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#fcfdfd'};">
                      <td style="padding: 10px 14px; color: #94a3b8; font-weight: 600;">${idx + 1}</td>
                      <td style="padding: 10px 14px; font-weight: 700; color: #0b1e36;">${p.product_name || p.product || 'Standard Cargo'}</td>
                      <td style="padding: 10px 14px; color: #475569;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${p.package_type || 'Package'}</span></td>
                      <td style="padding: 10px 14px; color: #64748b; font-family: monospace;">${p.dimensions || 'N/A'}</td>
                      <td style="padding: 10px 14px; color: #64748b;">${p.weight || 'N/A'}</td>
                      <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0284c7;">${p.quantity || 1}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${commentText ? `
          <div class="nex-comment-card">
            <div class="nex-comment-header">
              <i class="fas fa-comment-dots text-brand"></i> Special Instructions &amp; Consignment Remarks
            </div>
            <div class="nex-comment-body">
              ${commentText}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Shipper & Receiver Parties -->
      <div class="nex-party-boxes">
        <div class="nex-party-card">
          <div class="nex-party-header">
            <i class="fas fa-paper-plane text-brand"></i> Shipper (Origin)
          </div>
          <div class="nex-party-name">${shipperName}</div>
          <div class="nex-party-line"><i class="fas fa-location-dot"></i> ${shipperAddress}</div>
          ${shipperPhone ? `<div class="nex-party-line"><i class="fas fa-phone"></i> ${shipperPhone}</div>` : ''}
        </div>
        <div class="nex-party-card">
          <div class="nex-party-header">
            <i class="fas fa-map-pin text-success"></i> Consignee (Destination)
          </div>
          <div class="nex-party-name">${receiverName}</div>
          <div class="nex-party-line"><i class="fas fa-location-dot"></i> ${receiverAddress}</div>
          ${receiverPhone ? `<div class="nex-party-line"><i class="fas fa-phone"></i> ${receiverPhone}</div>` : ''}
        </div>
      </div>

      <!-- Live Interactive Telemetry Transit Map with Route Corridor -->
      <div class="nex-receiver-map-card">
        <div class="nex-receiver-map-header">
          <div class="nex-map-title-wrap">
            <div class="nex-map-icon"><i class="fas fa-map-marked-alt"></i></div>
            <div>
              <h3 class="nex-map-heading">Live Telemetry &amp; Transit Corridor Map</h3>
              <p class="nex-map-subheading">Active route corridor for consignment <strong>${trackingNo}</strong> (${transportMode})</p>
            </div>
          </div>
          <a href="${externalMapsUrl}" target="_blank" rel="noopener noreferrer" class="nex-open-map-btn">
            <i class="fas fa-location-arrow"></i> Open Full GPS Map
          </a>
        </div>

        <div class="nex-map-wrapper">
          <div id="nex-interactive-telemetry-map" class="nex-map-container" style="height: 420px; min-height: 380px; width: 100%; border-radius: 12px; position: relative; z-index: 1;"></div>
          
          <!-- Map Legend Bar -->
          <div class="nex-map-legend-bar">
            <div class="legend-item">
              <span class="legend-badge warehouse"><i class="fas fa-warehouse"></i></span>
              <span>Origin Terminal</span>
            </div>
            <div class="legend-item">
              <span class="legend-badge cargo-vehicle"><i class="fas fa-box"></i></span>
              <span>Goods in Transit (${transportMode})</span>
            </div>
            <div class="legend-item">
              <span class="legend-badge delivery"><i class="fas fa-map-marker-alt"></i></span>
              <span>Delivery Destination</span>
            </div>
            <div class="legend-item" style="color: #0284c7;">
              <span style="display:inline-block; width: 18px; height: 3px; background: #0284c7; vertical-align: middle; margin-right: 4px; border-radius: 2px;"></span>
              <span>Traversed Route</span>
            </div>
            <div class="legend-item" style="color: #06b6d4;">
              <span style="display:inline-block; width: 18px; height: 0; border-top: 2px dashed #06b6d4; vertical-align: middle; margin-right: 4px;"></span>
              <span>Scheduled Route</span>
            </div>
          </div>

          <div class="nex-receiver-map-badge">
            <div class="nex-map-pin-title"><i class="fas fa-map-marker-alt"></i> Pinned Destination Address</div>
            <div class="nex-map-pin-address">${receiverAddress}</div>
            <div class="nex-map-pin-recipient">Consignee: <strong>${receiverName}</strong></div>
          </div>
        </div>
      </div>
      <script>
        (function() {
          var payload = ${JSON.stringify({ shipment: s, checkpoints: checkpoints })};
          function bootNexMap() {
            if (typeof window.initNexivanTelemetryMap === 'function') {
              window.initNexivanTelemetryMap('nex-interactive-telemetry-map', payload);
            } else {
              setTimeout(bootNexMap, 40);
            }
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootNexMap);
          } else {
            bootNexMap();
          }
          setTimeout(bootNexMap, 150);
          setTimeout(bootNexMap, 500);
        })();
      </script>

      <!-- Milestone Telemetry Timeline -->
      <div class="nex-timeline-section">
        <h3 class="nex-timeline-title">
          <i class="fas fa-history text-brand"></i> Real-Time Telemetry &amp; Milestone History
        </h3>
        <div class="nex-timeline-flow">
  `;

  if (checkpoints.length === 0) {
    html += `<p class="nex-no-checkpoints">Consignment has been registered in the dispatch database and is awaiting first milestone scan.</p>`;
  } else {
    const reversed = [...checkpoints].reverse();
    reversed.forEach((cp, i) => {
      const isLatest = i === 0;
      html += `
        <div class="nex-timeline-item ${isLatest ? 'latest' : ''}">
          <div class="nex-tl-bullet ${isLatest ? 'latest' : ''}"></div>
          <div class="nex-tl-content">
            <div class="nex-tl-header">
              <span class="nex-tl-location">${cp.location}</span>
              <span class="nex-tl-time">${formatDate(cp.time || cp.checkpoint_time)}</span>
            </div>
            <div class="nex-tl-status">${cp.status}</div>
            ${cp.description ? `<p class="nex-tl-desc">${cp.description}</p>` : ''}
          </div>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>

      <!-- Touch Action Buttons -->
      <div class="nex-track-actions">
        <button type="button" onclick="window.print()" class="nex-btn-primary">
          <i class="fas fa-print"></i> Print Official Waybill
        </button>
        <a href="/contacts" class="nex-btn-secondary">
          <i class="fas fa-headset"></i> Contact Dispatch Desk
        </a>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- PART 2: INDUSTRY-STANDARD AIR WAYBILL PRINT DOCUMENT (.nex-print-only) -->
    <!-- ===================================================================== -->
    <div class="nex-waybill-print-document nex-print-only">
      <div class="nex-awb-container">
        
        <!-- Header: Company Info + Official Barcode -->
        <div class="nex-awb-header">
          <div class="nex-awb-brand">
            <div class="nex-awb-logo-wrap">
              <img src="/assets/images/nexivan-logo.svg" alt="Nexivan Logistics" class="nex-awb-logo" loading="eager" fetchpriority="high" onerror="this.onerror=null; this.src='assets/images/nexivan-logo.svg';" />
            </div>
            <div class="nex-awb-title">OFFICIAL CONSIGNMENT TRACKING REPORT &amp; AIR WAYBILL (AWB)</div>
            <div class="nex-awb-meta">Global Freight Network &bull; Computerized Carrier Telemetry System</div>
            <div class="nex-awb-date">Printed: ${currentDateStr} &bull; Dispatch Station: Web Telemetry Operations</div>
          </div>
          <div class="nex-awb-barcode">
            <div class="nex-awb-barcode-wrap">${printBarcodeSvg}</div>
            <div class="nex-awb-ref">WAYBILL REF: <strong>${trackingNo}</strong></div>
          </div>
        </div>

        <!-- Movement Summary Ribbon -->
        <div class="nex-awb-ribbon">
          <div class="nex-awb-rib-item">
            <span class="nex-awb-lbl">Consignment No:</span>
            <span class="nex-awb-val mono">${trackingNo}</span>
          </div>
          <div class="nex-awb-rib-item">
            <span class="nex-awb-lbl">Origin:</span>
            <span class="nex-awb-val">${originCity}</span>
          </div>
          <div class="nex-awb-rib-item">
            <span class="nex-awb-lbl">Destination:</span>
            <span class="nex-awb-val">${destCity}</span>
          </div>
          <div class="nex-awb-rib-item">
            <span class="nex-awb-lbl">Current Status:</span>
            <span class="nex-awb-val badge">${(s.status || 'In Transit').toUpperCase()}</span>
          </div>
          <div class="nex-awb-rib-item">
            <span class="nex-awb-lbl">Transit Mode:</span>
            <span class="nex-awb-val">${transportMode}</span>
          </div>
        </div>

        <!-- Shipper & Consignee 2-Box Layout -->
        <div class="nex-awb-parties">
          <div class="nex-awb-party-box">
            <div class="nex-awb-party-title">1. SHIPPER / CONSIGNOR (ORIGIN)</div>
            <div class="nex-awb-party-name">${shipperName}</div>
            <div class="nex-awb-party-detail"><strong>Address:</strong> ${shipperAddress}</div>
            <div class="nex-awb-party-detail"><strong>Contact Phone:</strong> ${shipperPhone || 'N/A'} &nbsp;|&nbsp; <strong>Email:</strong> ${shipperEmail || 'N/A'}</div>
          </div>
          <div class="nex-awb-party-box">
            <div class="nex-awb-party-title">2. CONSIGNEE / RECEIVER (DESTINATION)</div>
            <div class="nex-awb-party-name">${receiverName}</div>
            <div class="nex-awb-party-detail"><strong>Delivery Address:</strong> ${receiverAddress}</div>
            <div class="nex-awb-party-detail"><strong>Contact Phone:</strong> ${receiverPhone || 'N/A'} &nbsp;|&nbsp; <strong>Email:</strong> ${receiverEmail || 'N/A'}</div>
          </div>
        </div>

        <!-- Consignment & Freight Specifications Table -->
        <div class="nex-awb-section-title">3. CONSIGNMENT &amp; FREIGHT SPECIFICATIONS</div>
        <table class="nex-awb-specs-table">
          <thead>
            <tr>
              <th>Product Description</th>
              <th>Transportation Mode</th>
              <th>Quantity</th>
              <th>Weight / Type</th>
              <th>Payment Mode</th>
              <th>Total Freight</th>
              <th>Pick Up Date / Time</th>
              <th>Expected Delivery (ETA)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-bold">${product}</td>
              <td>${transportMode}</td>
              <td>${quantity} Units / Pcs</td>
              <td>${weight} &bull; ${packageType}</td>
              <td><span class="nex-awb-pill">${paymentMode}</span></td>
              <td class="font-bold text-dark">${totalFreight}</td>
              <td>${formatOnlyDate(pickupDate)}<br><small>${pickupTime}</small></td>
              <td class="font-bold text-primary">${formatOnlyDate(etaDate)}</td>
            </tr>
          </tbody>
        </table>

        ${s.products && s.products.length > 0 ? `
          <div class="nex-awb-section-title">3B. ITEMIZED CARGO MANIFEST (${s.products.length} ${s.products.length === 1 ? 'ITEM' : 'ITEMS'})</div>
          <table class="nex-awb-specs-table" style="margin-bottom: 12px;">
            <thead>
              <tr>
                <th style="width: 6%;">#</th>
                <th style="width: 36%;">Product Description</th>
                <th style="width: 18%;">Package Type</th>
                <th style="width: 15%;">Dimensions</th>
                <th style="width: 15%;">Unit Weight</th>
                <th style="width: 10%; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${s.products.map((p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="font-bold">${p.product_name || p.product || 'Standard Cargo'}</td>
                  <td>${p.package_type || 'Package'}</td>
                  <td>${p.dimensions || 'N/A'}</td>
                  <td>${p.weight || 'N/A'}</td>
                  <td class="font-bold" style="text-align: right;">${p.quantity || 1}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <!-- Special Handling Instructions -->
        ${commentText ? `
          <div class="nex-awb-comment-box">
            <div class="nex-awb-comment-title">4. SPECIAL INSTRUCTIONS &amp; CONSIGNMENT REMARKS:</div>
            <div class="nex-awb-comment-text">${commentText}</div>
          </div>
        ` : ''}

        <!-- Milestone Audit Trail -->
        <div class="nex-awb-section-title">5. TRANSIT AUDIT TRAIL &amp; TELEMETRY LOG</div>
        <table class="nex-awb-milestones-table">
          <thead>
            <tr>
              <th style="width: 22%;">Date &amp; Time (UTC)</th>
              <th style="width: 28%;">Facility / Hub Location</th>
              <th style="width: 18%;">Milestone Status</th>
              <th style="width: 32%;">Telemetry Scan &amp; Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${checkpoints.length === 0 ? `
              <tr><td colspan="4" class="text-center" style="font-style: italic; color: #64748b; padding: 10px;">Consignment accepted at origin facility. Scheduled for first manifest scan.</td></tr>
            ` : [...checkpoints].reverse().map(cp => `
              <tr>
                <td>${formatDate(cp.time || cp.checkpoint_time)}</td>
                <td class="font-semibold">${cp.location}</td>
                <td><span class="nex-awb-status-pill">${cp.status}</span></td>
                <td>${cp.description || 'Status update verified and logged in dispatch system.'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Sign-Off & Official Stamp -->
        <div class="nex-awb-signoff">
          <div class="nex-awb-sign-box">
            <div class="nex-awb-sign-line"></div>
            <div class="nex-awb-sign-label">Authorized Carrier Dispatch Officer</div>
            <div class="nex-awb-sign-sub">Nexivan Logistics &bull; Telemetry Operations Desk</div>
          </div>
          <div class="nex-awb-stamp-box">
            <div class="nex-awb-stamp">
              <span>OFFICIAL VERIFICATION</span>
              <span>NEXIVAN TELEMETRY</span>
              <span>AUTHENTIC RECORD</span>
            </div>
          </div>
          <div class="nex-awb-sign-box">
            <div class="nex-awb-sign-line"></div>
            <div class="nex-awb-sign-label">Consignee Signature on Delivery</div>
            <div class="nex-awb-sign-sub">Date &amp; Time: ________________________</div>
          </div>
        </div>

        <!-- Legal Disclaimer -->
        <div class="nex-awb-legal">
          <p>This document constitutes an authentic computerized Air Waybill &amp; Consignment Tracking Report issued by the Nexivan Logistics Global Dispatch Network. Real-time satellite telemetry and status updates can be validated anytime at <strong>https://nexivanlogistics.com/track-shipment?tracking=${encodeURIComponent(trackingNo)}</strong>.</p>
        </div>
      </div>
    </div>
  `;

  return html;
}

function renderTrackingNotFoundHTML(trackingNumber, message) {
  return `
    <div class="nex-track-card nex-track-error nex-screen-only">
      <div class="nex-error-icon-box">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3 class="nex-error-title">Consignment Not Found</h3>
      <p class="nex-error-desc">
        ${message || `No consignment record was found matching tracking number "<strong>${trackingNumber}</strong>".`}
      </p>
      <div class="nex-error-tips-box">
        <strong>Tracking Guidance:</strong>
        <ul>
          <li>Verify your waybill reference for typos or missing digits.</li>
          <li>Ensure the consignment was entered using the complete code (e.g. NX-######).</li>
          <li>Need immediate dispatch verification? Contact our 24/7 team at <a href="/contacts">Contact Support</a>.</li>
        </ul>
      </div>
    </div>
  `;
}

module.exports = {
  renderTrackingSuccessHTML,
  renderTrackingNotFoundHTML,
};
