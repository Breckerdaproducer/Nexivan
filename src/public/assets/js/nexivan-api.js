/**
 * Nexivan Logistics - Frontend API Integration
 * Connects frontend forms and search to Node.js / PostgreSQL backend (port 5000)
 * Handles:
 *  1. Consignment Tracking (track-shipment.html)
 *  2. Contact Form Submissions (contacts.html)
 *  3. Global Header Search (site-wide popup)
 */

(function () {
  'use strict';

  const API_CONFIG = {
    baseUrl: (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
      ? `${window.location.origin}/api`
      : 'http://localhost:5000/api',
    trackingEndpoint: '/track',
    contactEndpoint: '/contact',
    searchEndpoint: '/search',
    settingsEndpoint: '/settings',
  };

  // Helper: Format dates nicely
  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoStr;
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

  const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
  ];

  function generateBarcodeSVG(rawText, options) {
    options = options || {};
    const height = options.height || 48;
    const barWidth = options.barWidth || 2;
    const quietZone = options.quietZone !== undefined ? options.quietZone : 14;
    const showText = options.showText !== false;
    const textColor = options.textColor || '#0b1e36';

    const cleanText = String(rawText || 'NX-000000').toUpperCase().replace(/[^A-Z0-9\-\.\s\/$%+]/g, '');
    const codes = [104];
    let checkSum = 104;

    for (let i = 0; i < cleanText.length; i++) {
      const code = cleanText.charCodeAt(i) - 32;
      if (code >= 0 && code <= 95) {
        codes.push(code);
        checkSum += code * (i + 1);
      }
    }

    codes.push(checkSum % 103);
    codes.push(106);

    let fullPattern = '';
    for (let i = 0; i < codes.length; i++) {
      fullPattern += CODE128_PATTERNS[codes[i]] || '';
    }

    let totalUnits = 0;
    for (let i = 0; i < fullPattern.length; i++) {
      totalUnits += parseInt(fullPattern[i], 10);
    }

    const svgWidth = totalUnits * barWidth + quietZone * 2;
    const svgHeight = showText ? height + 26 : height;

    let x = quietZone;
    let rects = '';

    for (let i = 0; i < fullPattern.length; i++) {
      const w = parseInt(fullPattern[i], 10) * barWidth;
      const isBar = i % 2 === 0;
      if (isBar) {
        rects += '<rect x="' + x + '" y="0" width="' + w + '" height="' + height + '" fill="#0b1e36" />';
      }
      x += w;
    }

    let textSvg = '';
    if (showText) {
      textSvg = '<text x="' + (svgWidth / 2) + '" y="' + (height + 18) + '" font-family="\'Courier New\', Courier, monospace" font-size="13" font-weight="700" fill="' + textColor + '" text-anchor="middle" letter-spacing="2.5">* ' + cleanText + ' *</text>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" class="nex-barcode-svg" style="max-width: ' + Math.min(svgWidth, 340) + 'px; width: 100%; height: auto; display: block; margin: 0 auto;" aria-label="Barcode for ' + cleanText + '"><rect width="100%" height="100%" fill="#ffffff" rx="6"/>' + rects + textSvg + '</svg>';
  }

  // ==========================================================================
  // REAL-TIME TELEMETRY & TRANSIT CORRIDOR MAP (LEAFLET INTERACTIVE)
  // Origin: Warehouse Icon | Destination: Delivery Pin | In-Transit: Vehicle + Box On Top
  if (typeof window.initNexivanTelemetryMap !== 'function') {
    window.initNexivanTelemetryMap = function(containerId, data) {
    if (!data) return;
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    // Retry gracefully if Leaflet is still fetching from CDN
    if (typeof L === 'undefined') {
      setTimeout(function() {
        window.initNexivanTelemetryMap(containerId, data);
      }, 100);
      return;
    }

    // Clean up any existing map instance on this container to avoid Leaflet errors
    if (container._leaflet_id) {
      try {
        if (window._nexTelemetryMapInstance) {
          window._nexTelemetryMapInstance.remove();
          window._nexTelemetryMapInstance = null;
        }
      } catch (e) {}
      container._leaflet_id = null;
    }

    const s = data.shipment || data;
    const checkpoints = data.checkpoints || s.checkpoints || [];
    const originCity = (s.origin || (s.shipper && s.shipper.address) || s.shipper_address || 'Chicago, IL').trim();
    const destCity = (s.destination || (s.receiver && s.receiver.address) || s.receiver_address || 'Los Angeles, CA').trim();
    const receiverAddress = (s.receiver && s.receiver.address) || s.receiver_address || destCity;
    const receiverName = (s.receiver && s.receiver.name) || s.receiver_name || 'Valued Consignee';
    const shipperName = (s.shipper && s.shipper.name) || s.shipper_name || 'Dispatch Consignor';
    const trackingNo = s.trackingNumber || s.tracking_number || 'NX-000000';
    const status = (s.status || 'In Transit').trim();
    const statusLower = status.toLowerCase();
    const transportMode = s.transportMode || s.transport_mode || s.serviceType || s.service_type || 'Road Freight';
    const product = s.product || s.packageType || s.package_type || 'Commercial Cargo';
    const quantity = s.quantity || 1;

    let currentLoc = (s.current_location || s.currentLocation || '').trim();
    if (!currentLoc && checkpoints.length > 0) {
      const lastCp = checkpoints[checkpoints.length - 1];
      currentLoc = (lastCp.location || lastCp.checkpoint_location || '').trim();
    }
    if (!currentLoc) {
      currentLoc = originCity;
    }

    // Progress percentage
    let progress = typeof s.progressPercent === 'number' ? s.progressPercent : (typeof s.progress_percent === 'number' ? s.progress_percent : null);
    if (progress === null || isNaN(progress)) {
      if (statusLower.includes('delivered')) progress = 100;
      else if (statusLower.includes('out for delivery')) progress = 85;
      else if (statusLower.includes('transit') || statusLower.includes('facility') || statusLower.includes('hub')) progress = 60;
      else if (statusLower.includes('picked')) progress = 35;
      else if (statusLower.includes('order') || statusLower.includes('pending')) progress = 15;
      else progress = 50;
    }

    // Comprehensive global logistics hubs & US cities dictionary
    const CITY_COORDS = {
      'dallas': [32.7767, -96.7970],
      'miami': [25.7617, -80.1918],
      'atlanta': [33.7490, -84.3880],
      'chicago': [41.8781, -87.6298],
      'los angeles': [34.0522, -118.2437],
      'denver': [39.7392, -104.9903],
      'houston': [29.7604, -95.3698],
      'seattle': [47.6062, -122.3321],
      'new york': [40.7128, -74.0060],
      'newark': [40.7357, -74.1724],
      'san francisco': [37.7749, -122.4194],
      'oakland': [37.8044, -122.2712],
      'memphis': [35.1495, -90.0490],
      'louisville': [38.2527, -85.7585],
      'boston': [42.3601, -71.0589],
      'washington': [38.9072, -77.0369],
      'philadelphia': [39.9526, -75.1652],
      'phoenix': [33.4484, -112.0740],
      'detroit': [42.3314, -83.0458],
      'indianapolis': [39.7684, -86.1581],
      'charlotte': [35.2271, -80.8431],
      'nashville': [36.1627, -86.7816],
      'orlando': [28.5383, -81.3792],
      'tampa': [27.9506, -82.4572],
      'jacksonville': [30.3322, -81.6557],
      'minneapolis': [44.9778, -93.2650],
      'kansas city': [39.0997, -94.5786],
      'st. louis': [38.6270, -90.1994],
      'st louis': [38.6270, -90.1994],
      'new orleans': [29.9511, -90.0715],
      'portland': [45.5152, -122.6784],
      'salt lake city': [40.7608, -111.8910],
      'las vegas': [36.1699, -115.1398],
      'san diego': [32.7157, -117.1611],
      'austin': [30.2672, -97.7431],
      'san antonio': [29.4241, -98.4936],
      'cleveland': [41.4993, -81.6944],
      'columbus': [39.9612, -82.9988],
      'cincinnati': [39.1031, -84.5120],
      'pittsburgh': [40.4406, -79.9959],
      'baltimore': [39.2904, -76.6122],
      'oklahoma': [35.4676, -97.5164],
      'tulsa': [36.1540, -95.9928],
      'omaha': [41.2565, -95.9345],
      'albuquerque': [35.0844, -106.6504],
      'el paso': [31.7619, -106.4850],
      'sacramento': [38.5816, -121.4944],
      'san jose': [37.3382, -121.8863],
      'london': [51.5074, -0.1278],
      'frankfurt': [50.1109, 8.6821],
      'paris': [48.8566, 2.3522],
      'amsterdam': [52.3676, 4.9041],
      'rotterdam': [51.9244, 4.4777],
      'dubai': [25.2048, 55.2708],
      'singapore': [1.3521, 103.8198],
      'hong kong': [22.3193, 114.1694],
      'tokyo': [35.6762, 139.6503],
      'shanghai': [31.2304, 121.4737],
      'sydney': [-33.8688, 151.2093],
      'toronto': [43.6532, -79.3832],
      'vancouver': [49.2827, -123.1207],
      'mexico': [19.4326, -99.1332]
    };

    function resolveCoords(str, fallback) {
      if (!str) return fallback;
      const lower = str.toLowerCase();
      for (const [key, coords] of Object.entries(CITY_COORDS)) {
        if (lower.includes(key)) return coords;
      }
      return fallback;
    }

    const originCoords = resolveCoords(originCity, [41.8781, -87.6298]);
    const destCoords = resolveCoords(destCity, [34.0522, -118.2437]);

    let currentCoords;
    if (progress >= 100 || statusLower.includes('delivered')) {
      currentCoords = [destCoords[0], destCoords[1]];
    } else if (progress <= 10 || statusLower.includes('pending') || statusLower.includes('order')) {
      currentCoords = [originCoords[0], originCoords[1]];
    } else {
      const explicitMatch = resolveCoords(currentLoc, null);
      if (explicitMatch && (explicitMatch[0] !== originCoords[0] || explicitMatch[1] !== originCoords[1])) {
        currentCoords = explicitMatch;
      } else {
        const fraction = Math.max(0.15, Math.min(0.85, progress / 100));
        const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * fraction;
        const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * fraction;
        currentCoords = [lat, lng];
      }
    }

    // Vehicle transport icon helper
    function getModeIcon(m) {
      const s = (m || '').toLowerCase();
      if (s.includes('air') || s.includes('plane') || s.includes('flight')) return 'fa-plane';
      if (s.includes('ship') || s.includes('sea') || s.includes('ocean') || s.includes('marine')) return 'fa-ship';
      if (s.includes('train') || s.includes('rail')) return 'fa-train';
      if (s.includes('van') || s.includes('courier')) return 'fa-shuttle-van';
      if (s.includes('drone') || s.includes('copter')) return 'fa-helicopter';
      return 'fa-truck';
    }

    const vehicleIconClass = 'fas ' + getModeIcon(transportMode);

    // Initialize Leaflet Map with full mouse controls
    const map = L.map(container, {
      zoomControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      attributionControl: true
    });
    window._nexTelemetryMapInstance = map;

    // High quality Voyager / CartoDB logistics tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // 1. Origin Warehouse Pin Marker (Warehouse Icon)
    const originWarehouseHtml = `
      <div class="nex-leaflet-warehouse-marker" title="Origin Terminal: ${originCity}">
        <div class="pulse-ring-warehouse"></div>
        <div class="warehouse-circle">
          <i class="fas fa-warehouse"></i>
        </div>
        <div class="marker-pill-label">
          <i class="fas fa-warehouse" style="margin-right:3px;font-size:9px;"></i> Origin: ${originCity.split(',')[0]}
        </div>
      </div>
    `;
    const originIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: originWarehouseHtml,
      iconSize: [110, 65],
      iconAnchor: [55, 20],
      popupAnchor: [0, -22]
    });
    const originMarker = L.marker(originCoords, { icon: originIcon }).addTo(map);
    originMarker.bindPopup(`
      <div style="font-family:inherit;font-size:12px;line-height:1.45;min-width:180px;">
        <div style="font-weight:800;color:#0b1e36;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
          <i class="fas fa-warehouse" style="color:#f59e0b;"></i> Origin Dispatch Terminal
        </div>
        <div style="color:#1e293b;font-weight:600;">${originCity}</div>
        <div style="color:#64748b;font-size:11px;margin-top:2px;">Consignor: <strong>${shipperName}</strong></div>
      </div>
    `);

    // 2. Final Delivery Destination Pin Marker (Delivery Pin)
    const destPinHtml = `
      <div class="nex-leaflet-dest-marker" title="Delivery Destination: ${destCity}">
        <div class="pulse-ring-dest"></div>
        <div class="dest-circle">
          <i class="fas fa-map-marker-alt"></i>
        </div>
        <div class="marker-pill-label">
          <i class="fas fa-map-marker-alt" style="margin-right:3px;font-size:9px;"></i> Delivery: ${destCity.split(',')[0]}
        </div>
      </div>
    `;
    const destIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: destPinHtml,
      iconSize: [110, 65],
      iconAnchor: [55, 20],
      popupAnchor: [0, -22]
    });
    const destMarker = L.marker(destCoords, { icon: destIcon }).addTo(map);
    destMarker.bindPopup(`
      <div style="font-family:inherit;font-size:12px;line-height:1.45;min-width:180px;">
        <div style="font-weight:800;color:#059669;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
          <i class="fas fa-map-marker-alt" style="color:#10b981;"></i> Final Delivery Destination
        </div>
        <div style="color:#1e293b;font-weight:600;">${receiverAddress}</div>
        <div style="color:#64748b;font-size:11px;margin-top:2px;">Consignee: <strong>${receiverName}</strong></div>
      </div>
    `);

    // 3. Active Telemetry Vehicle Marker with Cargo Box on Top (Transit Path)
    const currentLocLabel = (currentLoc || 'In Transit').split(',')[0];
    const vehicleHtml = `
      <div class="nex-leaflet-vehicle-marker" title="${status}: ${currentLoc}">
        <div class="cargo-box-ontop">
          <i class="fas fa-box"></i> Cargo
        </div>
        <div class="vehicle-circle">
          <i class="${vehicleIconClass}"></i>
        </div>
        <div class="marker-pill-label">
          <i class="${vehicleIconClass}" style="margin-right:3px;font-size:9px;"></i> ${status}: ${currentLocLabel}
        </div>
        <div class="radar-ping-vehicle"></div>
      </div>
    `;
    const vehicleIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: vehicleHtml,
      iconSize: [140, 85],
      iconAnchor: [70, 42],
      popupAnchor: [0, -45]
    });
    const vehicleMarker = L.marker(currentCoords, { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
    vehicleMarker.bindPopup(`
      <div style="font-family:inherit;font-size:12px;line-height:1.45;min-width:200px;">
        <div style="font-weight:800;color:#0284c7;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
          <i class="${vehicleIconClass}"></i> Active Telemetry Position
        </div>
        <div style="color:#0b1e36;font-weight:700;margin:3px 0;">
          <i class="fas fa-box" style="color:#f59e0b;"></i> ${product} (${quantity} ${quantity === 1 ? 'unit' : 'units'})
        </div>
        <div style="color:#334155;font-size:11.5px;">Current Hub: <strong>${currentLoc}</strong></div>
        <div style="color:#0284c7;font-weight:700;font-size:11.5px;margin-top:3px;">
          Status: ${status} (${progress}%)
        </div>
      </div>
    `);

    // 4. Draw Traversed and Pending Route Paths linking the markers
    // Traversed line (Origin -> Current Goods Location)
    L.polyline([originCoords, currentCoords], {
      color: '#0284c7',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(map);

    // Pending line (Current Goods Location -> Delivery Destination)
    L.polyline([currentCoords, destCoords], {
      color: '#06b6d4',
      weight: 3.5,
      opacity: 0.85,
      dashArray: '6, 8',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(map);

    // Fit map view to cover all 3 locations
    const bounds = L.latLngBounds([originCoords, currentCoords, destCoords]);
    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 11
    });

    // Invalidate map size after rendering to ensure responsive full fit
    setTimeout(function() {
      try { map.invalidateSize(); } catch (e) {}
    }, 250);

    // Handle window resize dynamically
    window.addEventListener('resize', function() {
      try { map.invalidateSize(); } catch (e) {}
    });
  };
}

  // ==========================================================================
  // 1. CONSIGNMENT TRACKING
  // ==========================================================================
  function initTracking() {
    const trackForm = document.querySelector('form[name="wpcargo-track-form"], #nexivan-track-form, .wpcargo-track form');
    const trackInput = document.querySelector('input.input_track_num, input[name="wpcargo_tracking_number"], input[name="tracking"], #wpcargo_tracking_number');
    const submitBtn = document.querySelector('#submit_wpcargo, button[name="wpcargo-submit"], input[name="wpcargo-submit"]');

    // Container for results
    let resultContainer = document.getElementById('nexivan-tracking-result-box');
    if (!resultContainer) {
      resultContainer = document.createElement('div');
      resultContainer.id = 'nexivan-tracking-result-box';
      resultContainer.className = 'nexivan-tracking-results-wrap';
      const mainTrackDiv = document.querySelector('.wpcargo-track.wpcargo') || (trackForm ? trackForm.parentElement : null);
      if (mainTrackDiv) {
        mainTrackDiv.appendChild(resultContainer);
      }
    }

    // Helper to calculate absolute document top of an element
    function getElementDocTop(el) {
      let top = 0;
      let current = el;
      while (current) {
        top += current.offsetTop || 0;
        current = current.offsetParent;
      }
      return top;
    }

    // Scroll smoothly to tracking results helper
    function scrollToResults(smooth = true) {
      // 1. Unfocus active inputs so mobile keyboard closes and doesn't hijack scroll
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      const runScroll = () => {
        const container = document.getElementById('nexivan-tracking-result-box');
        if (!container) return;
        const target = container.querySelector('.nex-track-card') || container;
        if (!target) return;

        // Calculate absolute top
        let topY = 0;
        if (window.jQuery && typeof window.jQuery(target).offset === 'function') {
          const jOffset = window.jQuery(target).offset();
          if (jOffset && jOffset.top) topY = jOffset.top;
        }
        if (!topY || topY <= 0) {
          topY = getElementDocTop(target);
        }
        if (!topY || topY <= 0) {
          const rect = target.getBoundingClientRect();
          const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          topY = rect.top + scrollY;
        }

        const isMobile = window.innerWidth <= 640;
        const headerOffset = isMobile ? 60 : 85;
        const scrollDest = Math.max(0, Math.floor(topY - headerOffset));

        // Method 1: native scrollIntoView (respects CSS scroll-margin-top)
        try {
          target.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'start',
            inline: 'nearest'
          });
        } catch (e) {}

        // Method 2: window.scrollTo
        try {
          window.scrollTo({
            top: scrollDest,
            behavior: smooth ? 'smooth' : 'auto'
          });
        } catch (e) {
          window.scrollTo(0, scrollDest);
        }

        // Method 3: jQuery animate on html, body (bulletproof across iOS, Android, desktop)
        if (window.jQuery) {
          try {
            window.jQuery('html, body').stop(true, false).animate(
              { scrollTop: scrollDest },
              smooth ? 450 : 0
            );
          } catch (e) {}
        }
      };

      runScroll();
      setTimeout(runScroll, 120);
      setTimeout(runScroll, 350);
      setTimeout(runScroll, 750);
    }

    async function performTracking(trackingNumber) {
      if (!trackingNumber || !trackingNumber.trim()) return;
      const cleanNum = trackingNumber.trim().toUpperCase();

      if (trackInput) {
        trackInput.value = cleanNum;
        trackInput.blur();
      }
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      // Update URL so it can be refreshed or bookmarked
      if (typeof window !== 'undefined' && window.history && window.history.pushState) {
        const targetUrl = `/track-shipment?tracking=${encodeURIComponent(cleanNum)}`;
        if (window.location.pathname + window.location.search !== targetUrl) {
          window.history.pushState({ tracking: cleanNum }, '', targetUrl);
        }
      }

      // Show loader
      if (resultContainer) {
        resultContainer.innerHTML = `
          <div class="nex-track-card nex-track-loading" style="background:#fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; margin-top: 24px;">
            <div class="nex-spinner" style="width: 44px; height: 44px; border: 4px solid #e0f2fe; border-top-color: #0284c7; border-radius: 50%; animation: nexSpin 0.9s linear infinite; margin: 0 auto 16px;"></div>
            <p style="font-size: 16px; font-weight: 600; color: #0b1e36; margin: 0;">Querying real-time satellite & dispatch telemetry for <strong>${cleanNum}</strong>...</p>
          </div>
        `;
        scrollToResults(true);
      }

      try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.trackingEndpoint}/${encodeURIComponent(cleanNum)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          renderTrackingNotFound(cleanNum, data.message);
          return;
        }

        renderTrackingSuccess(data);
      } catch (error) {
        console.error('[Nexivan Tracking Error]', error);
        renderTrackingError(cleanNum);
      }
    }

    function renderTrackingNotFound(trackingNumber, message) {
      if (!resultContainer) return;
      resultContainer.innerHTML = `
        <div class="nex-track-card nex-track-error" style="box-shadow: 0 10px 30px -5px rgba(239, 68, 68, 0.15); border: 2px solid #fee2e2; border-radius: 16px; background: #ffffff; padding: 32px; margin-top: 24px; text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #ef4444; font-size: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 style="font-size: 22px; font-weight: 800; color: #0b1e36; margin: 0 0 8px;">Consignment Not Found</h3>
          <p style="font-size: 15px; color: #475569; max-width: 540px; margin: 0 auto 20px;">
            ${message || `No consignment record was found matching tracking number "<strong>${trackingNumber}</strong>".`}
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; max-width: 500px; margin: 0 auto; text-align: left; font-size: 13px; color: #475569;">
            <strong style="color: #0b1e36; display: block; margin-bottom: 6px;">Tracking Tips:</strong>
            <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
              <li>Check your waybill or consignment note for accuracy.</li>
              <li>Verify that the tracking code was entered correctly with no missing digits.</li>
              <li>For immediate assistance, call our 24/7 dispatch desk at <a href="/contacts" style="color:#0284c7; font-weight:bold;">Contact Us</a>.</li>
            </ul>
          </div>
        </div>
      `;
      scrollToResults(true);
    }

    function renderTrackingError(trackingNumber) {
      if (!resultContainer) return;
      resultContainer.innerHTML = `
        <div class="nex-track-card nex-track-error" style="box-shadow: 0 10px 30px -5px rgba(239, 68, 68, 0.15); border: 2px solid #fee2e2; border-radius: 16px; background: #ffffff; padding: 32px; margin-top: 24px; text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #ef4444; font-size: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <i class="fas fa-server"></i>
          </div>
          <h3 style="font-size: 22px; font-weight: 800; color: #0b1e36; margin: 0 0 8px;">Telemetry Connection Offline</h3>
          <p style="font-size: 15px; color: #475569; max-width: 500px; margin: 0 auto;">Unable to connect to the logistics dispatch database. Please ensure the backend server is operational.</p>
        </div>
      `;
      scrollToResults(true);
    }

    function renderTrackingSuccess(data) {
      const s = data.shipment;
      const checkpoints = data.checkpoints || [];

      // Determine step active states
      const statusLower = (s.status || '').toLowerCase();
      const steps = [
        { name: 'Order Placed', key: 'pending' },
        { name: 'Picked Up', key: 'picked up' },
        { name: 'In Transit', key: 'in transit' },
        { name: 'Out for Delivery', key: 'out for delivery' },
        { name: 'Delivered', key: 'delivered' },
      ];

      let activeStepIndex = 2; // Default to in transit
      if (statusLower.includes('picked')) activeStepIndex = 1;
      else if (statusLower.includes('transit') || statusLower.includes('facility') || statusLower.includes('hub')) activeStepIndex = 2;
      else if (statusLower.includes('out for delivery')) activeStepIndex = 3;
      else if (statusLower.includes('delivered')) activeStepIndex = 4;
      else if (statusLower.includes('order') || statusLower.includes('pending')) activeStepIndex = 0;

      // Badges
      let statusColor = '#0284c7';
      if (statusLower.includes('delivered')) statusColor = '#10b981';
      else if (statusLower.includes('out for delivery')) statusColor = '#f59e0b';
      else if (statusLower.includes('hold')) statusColor = '#ef4444';

      const progress = s.progressPercent || (function(st) {
        const m = { 'pending': 15, 'picked up': 35, 'in transit': 65, 'out for delivery': 85, 'delivered': 100, 'on hold': 50 };
        return m[(st || '').toLowerCase()] || 50;
      })(s.status);

      const trackingNo = s.trackingNumber || s.tracking_number || 'NX-000000';
      const originCity = s.origin || 'Origin Terminal';
      const destCity = s.destination || 'Destination Terminal';

      const receiverAddress = (s.receiver && s.receiver.address) || s.receiver_address || destCity || 'Los Angeles, CA';
      const receiverName = (s.receiver && s.receiver.name) || s.receiver_name || 'Valued Recipient';
      const receiverPhone = (s.receiver && s.receiver.phone) || s.receiver_phone || '';
      const receiverEmail = (s.receiver && s.receiver.email) || s.receiver_email || '';

      const shipperName = (s.shipper && s.shipper.name) || s.shipper_name || 'Commercial Consignor';
      const shipperAddress = (s.shipper && s.shipper.address) || s.shipper_address || originCity || 'Origin Hub';
      const shipperPhone = (s.shipper && s.shipper.phone) || s.shipper_phone || '';
      const shipperEmail = (s.shipper && s.shipper.email) || s.shipper_email || '';

      const encodedLocation = encodeURIComponent(receiverAddress.trim());
      const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodedLocation}&t=m&z=14&output=embed&iwloc=near`;
      const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

      // 9 Core Freight Specifications
      const product = s.product || s.packageType || s.package_type || 'Commercial Goods';
      const transportMode = s.transportMode || s.transport_mode || s.serviceType || s.service_type || 'Road Freight';
      const quantity = s.quantity || 1;
      const paymentMode = s.paymentMode || s.payment_mode || 'Prepaid';
      const totalFreight = s.totalFreight || s.total_freight || '$0.00';
      const pickupDate = s.pickupDate || s.pickup_date || s.shipmentDate || s.shipment_date;
      const pickupTime = s.pickupTime || s.pickup_time || '10:00 AM';
      const etaDate = s.expectedDeliveryDate || s.expected_delivery_date || s.estimatedDeliveryDate || s.estimated_delivery_date;
      const commentText = s.comment || s.notes || '';
      const weight = s.weight || '15 kg';
      const packageType = s.package_type || s.packageType || 'Standard Freight Parcel';
      const transportIcon = getTransportIcon(transportMode);
      const currentLoc = (s.current_location || s.currentLocation || (checkpoints.length > 0 ? (checkpoints[checkpoints.length - 1].location || checkpoints[checkpoints.length - 1].checkpoint_location) : '') || originCity).trim();
      const currentLocDisplay = currentLoc ? currentLoc.split(',')[0] : '';

      // Barcodes
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

      let html = `
        <!-- SCREEN & MOBILE TRACKING CARD -->
        <div class="nex-track-card nex-track-success-card nex-screen-only">
          
          <!-- Top Badges & Quick Action -->
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

      resultContainer.innerHTML = html;
      scrollToResults(true);

      // Initialize interactive Leaflet telemetry transit map
      try {
        if (typeof window.initNexivanTelemetryMap === 'function') {
          window.initNexivanTelemetryMap('nex-interactive-telemetry-map', data);
        }
      } catch (mapErr) {
        console.warn('[Nexivan Telemetry Map Init Error]', mapErr);
      }
    }

    // Detach any conflicting legacy handlers
    if (typeof window !== 'undefined' && window.jQuery) {
      try {
        if (trackForm) window.jQuery(trackForm).off('submit');
        if (submitBtn) window.jQuery(submitBtn).off('click');
      } catch (e) {}
    }

    // Intercept form submit
    if (trackForm) {
      trackForm.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const queryVal = trackInput ? trackInput.value : '';
        performTracking(queryVal);
        return false;
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const queryVal = trackInput ? trackInput.value : '';
        performTracking(queryVal);
        return false;
      });
    }

    if (trackInput) {
      trackInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          performTracking(this.value);
          return false;
        }
      });
    }

    // Expose global helper
    window.nexivanTrack = function (num) {
      if (!num) return;
      if (document.querySelector('form[name="wpcargo-track-form"], #nexivan-track-form')) {
        performTracking(num);
      } else {
        window.location.href = `/track-shipment?tracking=${encodeURIComponent(num)}`;
      }
    };

    // Check URL parameters for ?tracking=... or ?wpcargo_tracking_number=...
    const urlParams = new URLSearchParams(window.location.search);
    const trackingParam =
      urlParams.get('tracking') ||
      urlParams.get('wpcargo_tracking_number') ||
      urlParams.get('number') ||
      urlParams.get('num') ||
      urlParams.get('trk') ||
      urlParams.get('s') ||
      urlParams.get('q');

    if (trackingParam) {
      if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
        try { window.history.scrollRestoration = 'manual'; } catch (e) {}
      }

      if (trackInput) trackInput.value = trackingParam;
      // Only fetch if resultContainer doesn't already have pre-rendered card
      const hasPreRendered = resultContainer && resultContainer.querySelector('.nex-track-card');
      if (!hasPreRendered) {
        setTimeout(() => performTracking(trackingParam), 100);
      } else {
        // Pre-rendered server-side result: scroll down smoothly
        scrollToResults(true);
        window.addEventListener('load', () => scrollToResults(true));
        setTimeout(() => scrollToResults(true), 250);
        setTimeout(() => scrollToResults(true), 600);
        setTimeout(() => scrollToResults(true), 1200);
      }
    }
  }

  // ==========================================================================
  // 2. CONTACT FORM SUBMISSION
  // ==========================================================================
  function initContactForm() {
    const contactForm = document.getElementById('wpforms-form-15455') || document.querySelector('form.wpforms-form, form.nexivan-contact-form');
    if (!contactForm) return;

    // Detach any conflicting legacy jQuery listeners
    if (typeof window !== 'undefined' && window.jQuery) {
      try {
        window.jQuery(contactForm).off('submit');
        window.jQuery(contactForm).find('.wpforms-submit, button[type="submit"]').off('click');
      } catch (e) {}
    }

    // Find fields
    const firstNameInput = contactForm.querySelector('input[name="wpforms[fields][1][first]"], input[name="firstName"], #wpforms-15455-field_1');
    const lastNameInput = contactForm.querySelector('input[name="wpforms[fields][1][last]"], input[name="lastName"], #wpforms-15455-field_1-last');
    const phoneInput = contactForm.querySelector('input[name="wpforms[fields][2]"], input[name="phone"], #wpforms-15455-field_2');
    const emailInput = contactForm.querySelector('input[name="wpforms[fields][3]"], input[name="email"], #wpforms-15455-field_3');
    const messageInput = contactForm.querySelector('textarea[name="wpforms[fields][4]"], textarea[name="message"], #wpforms-15455-field_4');
    const submitBtn = contactForm.querySelector('button.wpforms-submit, button[type="submit"]');
    const spinnerImg = contactForm.querySelector('.wpforms-submit-spinner');

    // Create or find feedback banner container
    let banner = document.getElementById('nex-contact-alert-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nex-contact-alert-banner';
      contactForm.parentNode.insertBefore(banner, contactForm);
    }

    // Clear field errors on input
    [firstNameInput, lastNameInput, phoneInput, emailInput, messageInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          inp.style.borderColor = '';
          inp.style.boxShadow = '';
        });
      }
    });

    let isSubmitting = false;

    async function handleContactSubmit(e) {
      if (e) {
        e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }

      if (isSubmitting) return;

      if (spinnerImg) spinnerImg.style.display = 'none';

      const firstName = firstNameInput ? firstNameInput.value.trim() : '';
      const lastName = lastNameInput ? lastNameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';

      // Inline field validation without ugly window.alert
      let hasError = false;
      let firstInvalid = null;

      if (!firstName) {
        if (firstNameInput) { firstNameInput.style.borderColor = '#ef4444'; firstNameInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)'; }
        hasError = true;
        firstInvalid = firstInvalid || firstNameInput;
      }
      if (!lastName) {
        if (lastNameInput) { lastNameInput.style.borderColor = '#ef4444'; lastNameInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)'; }
        hasError = true;
        firstInvalid = firstInvalid || lastNameInput;
      }
      if (!email || !email.includes('@')) {
        if (emailInput) { emailInput.style.borderColor = '#ef4444'; emailInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)'; }
        hasError = true;
        firstInvalid = firstInvalid || emailInput;
      }
      if (!message || message.length < 2) {
        if (messageInput) { messageInput.style.borderColor = '#ef4444'; messageInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)'; }
        hasError = true;
        firstInvalid = firstInvalid || messageInput;
      }

      if (hasError) {
        banner.style.display = 'flex';
        banner.style.alignItems = 'flex-start';
        banner.style.gap = '14px';
        banner.style.padding = '18px 22px';
        banner.style.marginBottom = '24px';
        banner.style.borderRadius = '12px';
        banner.style.background = '#fef2f2';
        banner.style.border = '2px solid #ef4444';
        banner.style.boxShadow = '0 4px 12px rgba(239,68,68,0.12)';
        banner.innerHTML = `
          <i class="fas fa-exclamation-circle" style="font-size: 24px; color: #ef4444; margin-top: 2px;"></i>
          <div>
            <strong style="font-size: 16px; color: #991b1b; display: block; margin-bottom: 4px;">Required Fields Incomplete</strong>
            <p style="margin: 0; font-size: 14px; color: #b91c1c; line-height: 1.5;">Please fill out all mandatory fields (First Name, Last Name, Valid Email, and Question/Message).</p>
          </div>
        `;
        if (firstInvalid) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Button loading state
      isSubmitting = true;
      const origBtnHTML = submitBtn ? submitBtn.innerHTML : 'Submit';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;"><i class="fas fa-circle-notch fa-spin"></i> Sending Inquiry...</span>`;
      }

      try {
        const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.contactEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName, phone, email, message }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Clear form fields
          contactForm.reset();
          if (firstNameInput) firstNameInput.value = '';
          if (lastNameInput) lastNameInput.value = '';
          if (phoneInput) phoneInput.value = '';
          if (emailInput) emailInput.value = '';
          if (messageInput) messageInput.value = '';

          // Show prominent success notification
          banner.style.display = 'flex';
          banner.style.alignItems = 'flex-start';
          banner.style.gap = '14px';
          banner.style.padding = '22px';
          banner.style.marginBottom = '24px';
          banner.style.borderRadius = '12px';
          banner.style.background = '#ecfdf5';
          banner.style.border = '2px solid #10b981';
          banner.style.boxShadow = '0 6px 20px rgba(16,185,129,0.18)';
          banner.innerHTML = `
            <div style="width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: #d1fae5; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-check" style="font-size: 22px; color: #059669;"></i>
            </div>
            <div>
              <strong style="font-size: 18px; color: #065f46; display: block; margin-bottom: 4px;">Thank You, ${firstName}! Message Sent Successfully.</strong>
              <p style="margin: 0; font-size: 14px; color: #047857; line-height: 1.6;">${data.message || 'Your inquiry has been received. Our dedicated dispatch and freight support team will get back to you shortly.'}</p>
            </div>
          `;
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          banner.style.display = 'flex';
          banner.style.alignItems = 'flex-start';
          banner.style.gap = '14px';
          banner.style.padding = '18px 22px';
          banner.style.marginBottom = '24px';
          banner.style.borderRadius = '12px';
          banner.style.background = '#fef2f2';
          banner.style.border = '2px solid #ef4444';
          banner.style.boxShadow = '0 4px 12px rgba(239,68,68,0.12)';
          banner.innerHTML = `
            <i class="fas fa-exclamation-circle" style="font-size: 24px; color: #ef4444; margin-top: 2px;"></i>
            <div>
              <strong style="font-size: 16px; color: #991b1b; display: block; margin-bottom: 4px;">Submission Failed</strong>
              <p style="margin: 0; font-size: 14px; color: #b91c1c;">${data.message || 'Unable to submit your message. Please verify your entries and try again.'}</p>
            </div>
          `;
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (err) {
        console.error('[Nexivan Contact Submit Error]', err);
        banner.style.display = 'flex';
        banner.style.alignItems = 'flex-start';
        banner.style.gap = '14px';
        banner.style.padding = '18px 22px';
        banner.style.marginBottom = '24px';
        banner.style.borderRadius = '12px';
        banner.style.background = '#fef2f2';
        banner.style.border = '2px solid #ef4444';
        banner.innerHTML = `
          <i class="fas fa-server" style="font-size: 24px; color: #ef4444; margin-top: 2px;"></i>
          <div>
            <strong style="font-size: 16px; color: #991b1b; display: block; margin-bottom: 4px;">Server Communication Failed</strong>
            <p style="margin: 0; font-size: 14px; color: #b91c1c;">Unable to reach backend server on port 5000. Please ensure the server is active.</p>
          </div>
        `;
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } finally {
        isSubmitting = false;
        if (spinnerImg) spinnerImg.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHTML;
        }
      }
    }

    // Attach to both form submit and button click with capture phase to guarantee interception
    contactForm.addEventListener('submit', handleContactSubmit, true);
    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        handleContactSubmit(e);
      }, true);
    }
  }

  // ==========================================================================
  // 3. GLOBAL HEADER SEARCH & MODAL CONTROLLER
  // ==========================================================================
  function initHeaderSearch() {
    function getSearchPopup() {
      return (
        document.querySelector('.pxl-hidden-panel-popup.pxl-hidden-template-8565') ||
        document.querySelector('.pxl-hidden-panel-popup') ||
        document.querySelector('[class*="hidden-template-8565"]')
      );
    }

    function openSearchModal() {
      const popup = getSearchPopup();
      if (!popup) return;

      // Enhance logo if empty
      const logoLink = popup.querySelector('.pxl-logo a');
      if (logoLink && !logoLink.querySelector('img')) {
        logoLink.innerHTML = '<img src="/assets/images/Nexivan-logo.svg" alt="Nexivan Logistics" style="max-height: 42px; width: auto;"/>';
      }

      // Enhance placeholder
      const input = popup.querySelector('input.pxl-search-field, input[name="s"], input[type="text"]');
      if (input && (!input.placeholder || input.placeholder === 'Type Words Then Enter')) {
        input.setAttribute('placeholder', 'Search services, tracking number (e.g. TRK-...), or keywords...');
      }

      popup.classList.add('active');
      document.body.classList.add('body-overflow');

      if (input) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 120);
      }
    }

    function closeSearchModal() {
      const popups = document.querySelectorAll('.pxl-hidden-panel-popup, [class*="hidden-template-8565"]');
      popups.forEach((p) => p.classList.remove('active'));
      document.body.classList.remove('body-overflow');
      document.querySelectorAll('.nex-live-search-dropdown').forEach((d) => {
        d.style.display = 'none';
      });
    }

    // 1. Global Click Delegation to Open Popup
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest(
        '.pxl-anchor-button[data-target*="8565"], .pxl-anchor-button[data-target*="search"], [data-target*="8565"], [data-target*="search"], .pxl-anchor-button, a[href="#search"]'
      );
      if (trigger) {
        // Confirm it is a search trigger
        const isSearch =
          trigger.matches('[data-target*="8565"], [data-target*="search"]') ||
          trigger.querySelector('.fa-search, .fal.fa-search') ||
          e.target.closest('.fa-search, .fal.fa-search') ||
          (trigger.classList.contains('pxl-anchor-button') && !trigger.getAttribute('data-target')?.includes('menu'));
        if (isSearch) {
          e.preventDefault();
          e.stopPropagation();
          openSearchModal();
        }
      }
    }, true);

    // 2. Global Click Delegation to Close Popup
    document.addEventListener('click', function (e) {
      if (e.target.closest('.pxl-close-popup, .pxl-close, .pxl-popup--overlay, .pxl-popup--close')) {
        e.preventDefault();
        e.stopPropagation();
        closeSearchModal();
      }
    }, true);

    // 3. Escape Key to Dismiss
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        closeSearchModal();
      }
    });

    // 4. Form and Live Search Controllers for every search form (desktop & mobile)
    const searchForms = document.querySelectorAll(
      'form.pxl-search-form, form.search-form, .pxl-header-mobile-search form, .pxl-hidden-panel-popup form, form[role="search"]'
    );

    searchForms.forEach((form) => {
      // Skip the dedicated tracking form on track-shipment page
      if (form.id === 'nexivan-track-form' || form.getAttribute('name') === 'wpcargo-track-form' || form.closest('.wpcargo-track')) {
        return;
      }

      // Ensure form action points locally to services, never tracking or external domain
      try {
        form.setAttribute('action', '/services');
      } catch (e) {}

      const input = form.querySelector('input.pxl-search-field, input.search-field, input[name="s"], input[type="text"]');
      if (!input) return;

      // Dropdown container for live search results
      let dropdown = form.querySelector('.nex-live-search-dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'nex-live-search-dropdown';
        dropdown.style.display = 'none';
        form.style.position = 'relative';
        form.appendChild(dropdown);
      }

      let debounceTimer = null;
      let activeIndex = -1;

      async function doSearch(queryText) {
        if (!queryText || queryText.trim().length < 2) {
          dropdown.style.display = 'none';
          dropdown.innerHTML = '';
          activeIndex = -1;
          return;
        }

        const q = queryText.trim();
        dropdown.innerHTML = `
          <div class="nex-search-no-results">
            <i class="fal fa-spinner fa-spin pxl-mr-8"></i> Searching for "<strong>${escapeHtml(q)}</strong>"...
          </div>
        `;
        dropdown.style.display = 'block';

        try {
          const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.searchEndpoint}?q=${encodeURIComponent(q)}`);
          const data = await res.json();

          if (!data.success || data.total === 0) {
            dropdown.innerHTML = `
              <div class="nex-search-no-results">
                <i class="fal fa-search pxl-mr-8"></i> No results found for "<strong>${escapeHtml(q)}</strong>".<br/>
                <span style="display:inline-block; margin-top:8px; font-size:13px; color:#64748b;">
                  Try searching for <em>air freight</em>, <em>truck shipping</em>, <em>sea cargo</em>, or <em>contact</em>.
                </span>
              </div>
            `;
            dropdown.style.display = 'block';
            activeIndex = -1;
            return;
          }

          let itemsHtml = '';

          // 1. Freight Services
          if (data.services && data.services.length > 0) {
            itemsHtml += `<div class="nex-search-cat-title"><i class="fas fa-truck-moving pxl-mr-4"></i> Freight Services</div>`;
            data.services.forEach((srv) => {
              itemsHtml += `
                <a href="${srv.url}" class="nex-search-item" data-search-url="${srv.url}">
                  <div class="nex-si-icon"><i class="fas ${srv.icon || 'fa-truck'}"></i></div>
                  <div class="nex-si-info">
                    <div class="nex-si-title">${escapeHtml(srv.title)}</div>
                    <div class="nex-si-desc">${escapeHtml(srv.excerpt)}</div>
                  </div>
                  <span class="nex-si-badge badge-service">Service</span>
                </a>
              `;
            });
          }

          // 2. Core Pages & Insights
          if (data.pages && data.pages.length > 0) {
            itemsHtml += `<div class="nex-search-cat-title"><i class="fas fa-file-alt pxl-mr-4"></i> Pages &amp; Insights</div>`;
            data.pages.forEach((pg) => {
              itemsHtml += `
                <a href="${pg.url}" class="nex-search-item" data-search-url="${pg.url}">
                  <div class="nex-si-icon"><i class="fas ${pg.icon || 'fa-info-circle'}"></i></div>
                  <div class="nex-si-info">
                    <div class="nex-si-title">${escapeHtml(pg.title)}</div>
                    <div class="nex-si-desc">${escapeHtml(pg.excerpt)}</div>
                  </div>
                  <span class="nex-si-badge">${escapeHtml(pg.category)}</span>
                </a>
              `;
            });
          }

          // Footer hint
          itemsHtml += `
            <div class="nex-search-footer">
              <span>Press <strong>Enter</strong> to navigate &bull; <strong>Esc</strong> to close</span>
              <span>${data.total} result${data.total === 1 ? '' : 's'}</span>
            </div>
          `;

          dropdown.innerHTML = itemsHtml;
          dropdown.style.display = 'block';
          activeIndex = -1;
        } catch (err) {
          dropdown.innerHTML = `
            <div class="nex-search-no-results">
              <i class="fal fa-search pxl-mr-8"></i> No results found for "<strong>${escapeHtml(q)}</strong>".
            </div>
          `;
          dropdown.style.display = 'block';
        }
      }

      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      // Input typing with debounce
      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        const val = this.value;
        debounceTimer = setTimeout(() => doSearch(val), 200);
      });

      // Keyboard navigation (Arrow keys + Enter)
      input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.nex-search-item');
        if (!items || items.length === 0 || dropdown.style.display === 'none') {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSearchSubmit(e);
            return false;
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % items.length;
          updateActiveItem(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          updateActiveItem(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (activeIndex >= 0 && items[activeIndex]) {
            const href = items[activeIndex].getAttribute('href');
            if (href) {
              window.location.href = href;
              return false;
            }
          }
          handleSearchSubmit(e);
          return false;
        }
      });

      function updateActiveItem(items) {
        items.forEach((it, idx) => {
          if (idx === activeIndex) {
            it.classList.add('active');
            it.scrollIntoView({ block: 'nearest' });
          } else {
            it.classList.remove('active');
          }
        });
      }

      // Smart Submit handling - always stays on Nexivan Logistics
      async function handleSearchSubmit(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const q = (input.value || '').trim();
        if (!q) {
          input.focus();
          return false;
        }

        // 1. If an item is actively highlighted with arrow keys, go to it
        const items = dropdown.querySelectorAll('.nex-search-item');
        if (activeIndex >= 0 && items[activeIndex]) {
          const href = items[activeIndex].getAttribute('href');
          if (href) {
            window.location.href = href;
            return false;
          }
        }

        // 2. Explicit keyword match to common services and pages
        const lower = q.toLowerCase();
        if (lower === 'truck' || lower.includes('truck freight') || lower.includes('road')) {
          window.location.href = '/service/truck-freight';
          return false;
        }
        if (lower === 'air' || lower.includes('air freight') || lower.includes('plane') || lower.includes('flight')) {
          window.location.href = '/service/air-freight';
          return false;
        }
        if (lower === 'ship' || lower.includes('ocean') || lower.includes('sea freight') || lower.includes('vessel')) {
          window.location.href = '/service/ship-freight';
          return false;
        }
        if (lower === 'train' || lower.includes('rail')) {
          window.location.href = '/service/train-freight';
          return false;
        }
        if (lower === 'drone') {
          window.location.href = '/service/drone-freight';
          return false;
        }
        if (lower === 'van' || lower.includes('courier')) {
          window.location.href = '/service/van-freight';
          return false;
        }
        if (lower === 'wagon') {
          window.location.href = '/service/wagon-freight';
          return false;
        }
        if (lower.includes('contact') || lower.includes('support') || lower.includes('help') || lower.includes('phone') || lower.includes('email')) {
          window.location.href = '/contacts';
          return false;
        }
        if (lower === 'about' || lower.includes('about us') || lower.includes('company')) {
          window.location.href = '/about-us';
          return false;
        }
        if (lower === 'services' || lower.includes('our services')) {
          window.location.href = '/services';
          return false;
        }
        if (lower === 'track' || lower === 'tracking' || lower === 'trace' || lower.includes('track shipment')) {
          window.location.href = '/track-shipment';
          return false;
        }

        // 3. If there is at least one result in the dropdown, navigate to the first one
        if (items.length > 0) {
          const firstHref = items[0].getAttribute('href');
          if (firstHref) {
            window.location.href = firstHref;
            return false;
          }
        }

        // 4. Quick API check to navigate to first match
        try {
          const res = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.searchEndpoint}?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (data && data.success && data.results && data.results.length > 0) {
            window.location.href = data.results[0].url;
            return false;
          }
        } catch (err) {}

        // Fallback: Navigate to services overview
        window.location.href = '/services';
        return false;
      }

      form.addEventListener('submit', handleSearchSubmit, true);

      const submitBtn = form.querySelector('.pxl-search-submit, .search-submit, button[type="submit"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', handleSearchSubmit, true);
      }

      // Dismiss dropdown on outside click
      document.addEventListener('click', function (e) {
        if (!form.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    });

    // 5. Global Document-Level Fallback Interceptors
    // Guarantees no search form anywhere on the page can ever submit natively to an external site
    document.addEventListener('submit', function (e) {
      if (e.target.closest('#nexivan-track-form, .wpcargo-track, [name="wpcargo-track-form"]')) return;
      const searchForm = e.target.closest('form.pxl-search-form, form.search-form, form[role="search"], .pxl-header-mobile-search form');
      if (searchForm) {
        e.preventDefault();
        e.stopPropagation();
        const input = searchForm.querySelector('input.pxl-search-field, input.search-field, input[name="s"], input[type="text"]');
        const queryVal = input ? input.value.trim() : '';
        if (queryVal) {
          window.location.href = '/services';
        }
        return false;
      }
    }, true);
  }

  // ==========================================================================
  // 4. DYNAMIC COMPANY CONTACT & SETTINGS HYDRATION
  // ==========================================================================
  const SETTINGS_STORAGE_KEY = 'nexivan_company_settings';

  function applyCompanySettings(settings) {
    if (!settings) return;

    const email = (settings.email || '').trim();
    const phone = (settings.phone || '').trim();
    const whatsapp = (settings.whatsapp || '').trim();
    const whatsappRaw = (settings.whatsapp_raw || (whatsapp ? whatsapp.replace(/\D/g, '') : '')).trim();
    const address = (settings.address || '').trim();

    // 1. Update All mailto: Links and their display text
    if (email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
        link.setAttribute('href', `mailto:${email}`);
        const text = (link.innerText || link.textContent || '').trim();
        if (text.includes('@') || /info@/i.test(text) || /support@/i.test(text) || /contact@/i.test(text) || /equitrans/i.test(text) || /nexivan/i.test(text)) {
          link.textContent = email;
        }
      });

      // Data attributes & class-based targets
      document.querySelectorAll('[data-company-email], .company-email, .nex-company-email').forEach((el) => {
        if (el.tagName === 'A') el.setAttribute('href', `mailto:${email}`);
        el.textContent = email;
      });
    }

    // 2. Update All tel: Links and their display text
    if (phone) {
      const cleanPhoneDigits = phone.replace(/[^+\d]/g, '');
      document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
        link.setAttribute('href', `tel:${cleanPhoneDigits}`);
        const text = (link.innerText || link.textContent || '').trim();
        // If text contains digits or matches previous numbers
        if (/\d{3}/.test(text) || /\+1/.test(text) || /\(/.test(text)) {
          // If the link has an inner span (common in this WordPress theme)
          const textSpan = link.querySelector('.pxl-link--text') || link;
          textSpan.textContent = phone;
        }
      });

      // Data attributes & class-based targets
      document.querySelectorAll('[data-company-phone], .company-phone, .nex-company-phone').forEach((el) => {
        if (el.tagName === 'A') el.setAttribute('href', `tel:${cleanPhoneDigits}`);
        el.textContent = phone;
      });
    }

    // 3. Contacts Page Specific Cards (Call Center, WhatsApp, Our Email)
    document.querySelectorAll('.pxl-link-wrap, .elementor-widget-pxl_link').forEach((wrap) => {
      const titleEl = wrap.querySelector('.pxl-widget-title, h3, .pxl-item--title');
      if (!titleEl) return;
      const titleText = (titleEl.innerText || titleEl.textContent || '').toLowerCase();

      // A. WhatsApp Card on Contacts Page
      if (titleText.includes('whatsapp') && (whatsapp || whatsappRaw)) {
        const link = wrap.querySelector('a');
        const span = wrap.querySelector('.pxl-link--text, span') || link;
        const waUrl = whatsappRaw ? `https://wa.me/${whatsappRaw}` : `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
        if (link) {
          link.setAttribute('href', waUrl);
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
        if (span) {
          span.textContent = whatsapp || phone;
        }
      }

      // B. Call Center Card on Contacts Page
      if (titleText.includes('call') && phone) {
        const link = wrap.querySelector('a');
        const span = wrap.querySelector('.pxl-link--text, span') || link;
        const cleanPhoneDigits = phone.replace(/[^+\d]/g, '');
        if (link) {
          link.setAttribute('href', `tel:${cleanPhoneDigits}`);
        }
        if (span) {
          span.textContent = phone;
        }
      }

      // C. Our Email Card on Contacts Page
      if (titleText.includes('email') && email) {
        const link = wrap.querySelector('a');
        const span = wrap.querySelector('.pxl-link--text, span') || link;
        if (link) {
          link.setAttribute('href', `mailto:${email}`);
        }
        if (span) {
          span.textContent = email;
        }
      }
    });

    // 4. Update WhatsApp Links across the page
    if (whatsappRaw || whatsapp) {
      const targetWaRaw = whatsappRaw || whatsapp.replace(/\D/g, '');
      const waUrl = `https://wa.me/${targetWaRaw}`;

      document.querySelectorAll('a[href*="whatsapp.com"], a[href*="wa.me"]').forEach((link) => {
        link.setAttribute('href', waUrl);
        const text = (link.innerText || link.textContent || '').trim();
        if (/\d{3}/.test(text) || /\+1/.test(text)) {
          link.textContent = whatsapp;
        }
      });

      // Data attributes & class-based targets
      document.querySelectorAll('[data-company-whatsapp], .company-whatsapp, .nex-company-whatsapp').forEach((el) => {
        if (el.tagName === 'A') el.setAttribute('href', waUrl);
        el.textContent = whatsapp;
      });
    }

    // 5. Update Address
    if (address) {
      document.querySelectorAll('[data-company-address], .company-address, .nex-company-address').forEach((el) => {
        el.textContent = address;
      });
    }

    // 6. Universal text-node replacer for any loose static text anywhere in document.body
    if (typeof document !== 'undefined' && document.body) {
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          // Avoid touching script and style tags
          if (node.parentElement && (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE')) {
            continue;
          }
          const val = node.nodeValue;
          if (!val) continue;
          let changed = false;
          let newVal = val;

          // Replace phone strings
          if (phone && (newVal.includes('+1 (915) 217-3598') || newVal.includes('+1 (339) 224-7522') || newVal.includes('(339) 224-7522'))) {
            newVal = newVal
              .replace(/\+1\s*\(915\)\s*217-3598/g, phone)
              .replace(/\+1\s*\(339\)\s*224-7522/g, phone)
              .replace(/\(339\)\s*224-7522/g, phone);
            changed = true;
          }

          // Replace email strings
          if (email && (newVal.includes('info@nexivanlogistics.com') || newVal.includes('info@Equitranslogistics.com'))) {
            newVal = newVal
              .replace(/info@nexivanlogistics\.com/gi, email)
              .replace(/info@Equitranslogistics\.com/gi, email);
            changed = true;
          }

          if (changed) {
            node.nodeValue = newVal;
          }
        }
      } catch (err) {}
    }

    // 7. Chaty Floating Widget Hydration & Interception
    hydrateChatyWidget(settings);
  }

  function hydrateChatyWidget(settings) {
    if (!settings) return;

    const email = (settings.email || '').trim();
    const whatsapp = (settings.whatsapp || '').trim();
    const whatsappRaw = (settings.whatsapp_raw || (whatsapp ? whatsapp.replace(/\D/g, '') : '')).trim();

    // 1. Update window.chaty_settings if present
    if (typeof window !== 'undefined' && window.chaty_settings && Array.isArray(window.chaty_settings.chaty_widgets)) {
      window.chaty_settings.chaty_widgets.forEach((widget) => {
        if (widget && Array.isArray(widget.channels)) {
          widget.channels.forEach((ch) => {
            if (ch.channel === 'Whatsapp' && whatsappRaw) {
              ch.value = whatsappRaw;
              ch.url = `https://web.whatsapp.com/send?phone=${whatsappRaw}`;
            } else if (ch.channel === 'Email' && email) {
              ch.value = email;
              ch.url = `mailto:${email}`;
            }
          });
        }
      });
    }

    // 2. Update rendered DOM anchors created by Chaty
    if (whatsappRaw) {
      const waUrl = `https://wa.me/${whatsappRaw}`;
      document.querySelectorAll('.chaty-channel-Whatsapp a, a.chaty-channel-Whatsapp, .chaty-channel-whatsapp a, [data-channel="Whatsapp"] a, [data-channel="whatsapp"] a, .chaty-whatsapp a').forEach((a) => {
        a.setAttribute('href', waUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
    }

    if (email) {
      document.querySelectorAll('.chaty-channel-Email a, a.chaty-channel-Email, .chaty-channel-email a, [data-channel="Email"] a, [data-channel="email"] a, .chaty-email a').forEach((a) => {
        a.setAttribute('href', `mailto:${email}`);
      });
    }
  }

  async function initCompanySettings() {
    // 0. Server-Injected window.__NEXIVAN_SETTINGS__ (instant 0ms execution)
    if (typeof window !== 'undefined' && window.__NEXIVAN_SETTINGS__) {
      applyCompanySettings(window.__NEXIVAN_SETTINGS__);
    }

    // 1. Instant Synchronous Hydration from Local Storage (0ms delay)
    try {
      const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        applyCompanySettings(parsed);
      }
    } catch (e) {}

    // 2. Fetch Fresh Settings from API
    try {
      const apiUrl = `${API_CONFIG.baseUrl}${API_CONFIG.settingsEndpoint || '/settings'}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          applyCompanySettings(data.settings);
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data.settings));
          } catch (e) {}
        }
      }
    } catch (err) {
      // Graceful network fallback
    }

    // 3. Keep Chaty Floating Widget updated when Chaty finishes async rendering
    let attempts = 0;
    const chatyInterval = setInterval(() => {
      attempts++;
      try {
        const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (cached) {
          const s = JSON.parse(cached);
          hydrateChatyWidget(s);
        }
      } catch (e) {}
      if (attempts >= 10) clearInterval(chatyInterval);
    }, 500);

    // 4. Global click delegation fallback for WhatsApp to guarantee opening the current number
    document.addEventListener('click', function (e) {
      const waTarget = e.target.closest('.chaty-channel-Whatsapp, [data-channel="Whatsapp"], [data-channel="whatsapp"], a[href*="whatsapp.com"], a[href*="wa.me"]');
      if (waTarget) {
        try {
          const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
          if (cached) {
            const s = JSON.parse(cached);
            const raw = s.whatsapp_raw || (s.whatsapp ? s.whatsapp.replace(/\D/g, '') : '');
            if (raw) {
              const currentHref = waTarget.getAttribute('href') || '';
              if (!currentHref.includes(raw)) {
                e.preventDefault();
                e.stopPropagation();
                window.open(`https://wa.me/${raw}`, '_blank', 'noopener,noreferrer');
              }
            }
          }
        } catch (err) {}
      }
    }, true);
  }

  // Initialize all components once DOM is loaded
  function init() {
    initCompanySettings();
    initTracking();
    initContactForm();
    initHeaderSearch();
  }

  // Run settings immediately if DOM is ready or partially ready
  if (typeof document !== 'undefined' && document.body) {
    try {
      const earlyCached = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (earlyCached) applyCompanySettings(JSON.parse(earlyCached));
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
