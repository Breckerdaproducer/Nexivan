/**
 * Nexivan Logistics - Live Telemetry Transit Map Engine v5.0.0
 * Realistic Vector Vehicle SVGs & Classic Solid Palette (White BG, Bold Black Text, Primary Accents)
 *
 * Real SVG Assets:
 *  - Origin: Realistic Logistics Fulfillment Warehouse SVG (/assets/images/map/warehouse.svg)
 *  - Destination: Realistic 3D Delivery Destination Pin SVG (/assets/images/map/delivery-pin.svg)
 *  - Vehicle: Realistic Cargo Aircraft (/assets/images/map/plane.svg), Freight Semi-Truck (/assets/images/map/truck.svg),
 *             Container Ship (/assets/images/map/ship.svg), Delivery Van (/assets/images/map/van.svg)
 *  - Cargo: Realistic 3D Cardboard Freight Box on top (/assets/images/map/cargo-box.svg)
 *  - Corridor: Smooth Geodesic Great-Circle Bézier curved route with luminous halo & animated telemetry pulse
 *  - Popups: 100% Solid White cards with pure black text (#000000) and Nexivan primary blue (#0284c7)
 */

(function () {
  'use strict';

  // Comprehensive logistics hubs & city coordinates dictionary
  const LOGISTICS_COORDS = {
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

  const STATE_COORDS = {
    'tx': [31.9686, -99.9018],
    'fl': [27.6648, -81.5158],
    'ga': [32.1656, -82.9001],
    'ca': [36.7783, -119.4179],
    'il': [40.6331, -89.3985],
    'ny': [40.7128, -74.0060],
    'wa': [47.7511, -120.7401],
    'co': [39.5501, -105.7821],
    'nc': [35.7596, -79.0193],
    'tn': [35.5175, -86.5804],
    'oh': [40.4173, -82.9071],
    'pa': [41.2033, -77.1945],
    'az': [34.0489, -111.0937],
    'mi': [44.3148, -85.6024],
    'nv': [38.8026, -116.4194],
    'or': [43.8041, -120.5542]
  };

  function resolveCoordinates(text, fallback) {
    if (!text || typeof text !== 'string') return fallback;
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

    for (const [city, coords] of Object.entries(LOGISTICS_COORDS)) {
      if (clean.includes(city)) return coords;
    }

    const words = clean.split(/\s+/);
    for (const word of words) {
      if (STATE_COORDS[word]) return STATE_COORDS[word];
    }

    return fallback;
  }

  function getVehicleSvgInfo(mode) {
    const m = (mode || '').toLowerCase();
    if (m.includes('air') || m.includes('plane') || m.includes('flight') || m.includes('cargo flight')) {
      return { svg: '/assets/images/map/plane.svg', type: 'plane', label: 'Cargo Flight' };
    }
    if (m.includes('ship') || m.includes('sea') || m.includes('ocean') || m.includes('maritime') || m.includes('vessel')) {
      return { svg: '/assets/images/map/ship.svg', type: 'ship', label: 'Container Vessel' };
    }
    if (m.includes('van') || m.includes('courier') || m.includes('express')) {
      return { svg: '/assets/images/map/van.svg', type: 'van', label: 'Express Van' };
    }
    return { svg: '/assets/images/map/truck.svg', type: 'truck', label: 'Freight Truck' };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Geodesic Bézier Curved Navigation Corridor Generator
   */
  function generateCurvedPath(p1, p2, bendSign = 1, numPoints = 28) {
    const lat1 = p1[0], lng1 = p1[1];
    const lat2 = p2[0], lng2 = p2[1];
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 0.001) return [p1, p2];

    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const len = Math.max(dist, 0.0001);
    const nx = -dLat / len;
    const ny = dLng / len;

    const curvature = Math.min(Math.max(dist * 0.14, 0.45), 3.2) * bendSign;
    const ctrlLat = midLat + (Math.abs(dLng) / len) * curvature * (lat1 >= 0 ? 1 : -1) + (nx * curvature * 0.22);
    const ctrlLng = midLng - (ny * curvature * 0.32);

    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const invT = 1 - t;
      const lat = invT * invT * lat1 + 2 * invT * t * ctrlLat + t * t * lat2;
      const lng = invT * invT * lng1 + 2 * invT * t * ctrlLng + t * t * lng2;
      points.push([lat, lng]);
    }
    return points;
  }

  /**
   * Calculate Geographic Bearing / Tangent Heading
   */
  function calculateBearing(p1, p2) {
    const lat1 = (p1[0] * Math.PI) / 180;
    const lon1 = (p1[1] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lon2 = (p2[1] * Math.PI) / 180;
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  /**
   * Self-Inject Classic Map CSS Rules
   * Real Vehicle SVGs + Solid White Card Backgrounds + Bold Black Text (#000) + Nexivan Blue (#0284c7)
   */
  function ensureMapStylesInjected() {
    let style = document.getElementById('nex-telemetry-engine-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'nex-telemetry-engine-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      .nex-leaflet-marker-wrap {
        background: transparent !important;
        border: none !important;
      }

      /* =========================================================
         1. LEAFLET POPUP CONTAINERS: SOLID WHITE BG + PRIMARY BORDER
         ========================================================= */
      .leaflet-popup-content-wrapper {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        border-radius: 10px !important;
        border: 2px solid #0284c7 !important; /* Nexivan Primary Blue */
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24), 0 4px 10px rgba(0, 0, 0, 0.12) !important;
        padding: 0 !important;
        overflow: hidden !important;
        opacity: 1 !important;
      }

      .leaflet-popup-tip {
        background: #ffffff !important;
        background-color: #ffffff !important;
        border: 1px solid #0284c7 !important;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
        opacity: 1 !important;
      }

      .leaflet-popup-content {
        margin: 0 !important;
        line-height: 1.45 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        opacity: 1 !important;
      }

      .leaflet-container a.leaflet-popup-close-button {
        top: 8px !important;
        right: 8px !important;
        color: #000000 !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        background: #f1f5f9 !important;
        background-color: #f1f5f9 !important;
        border: 1px solid #cbd5e1 !important;
        transition: all 0.2s ease !important;
        text-decoration: none !important;
        z-index: 20 !important;
      }
      .leaflet-container a.leaflet-popup-close-button:hover {
        background: #0284c7 !important;
        color: #ffffff !important;
        border-color: #0284c7 !important;
      }

      /* Card Inside Popup: Solid White BG, Black Text, Primary Accents */
      .nex-map-popup-card {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        min-width: 250px;
        max-width: 320px;
        font-family: inherit;
        font-size: 12px;
        border-radius: 8px;
        overflow: hidden;
        opacity: 1 !important;
        box-sizing: border-box;
      }

      .popup-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #ffffff !important;
        background-color: #ffffff !important;
        border-bottom: 2px solid #0284c7;
      }
      .popup-header.vehicle { border-bottom: 2px solid #0284c7; }
      .popup-header.origin { border-bottom: 2px solid #d97706; }
      .popup-header.dest { border-bottom: 2px solid #059669; }

      .popup-header-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
      .popup-header-icon img {
        width: 26px;
        height: 26px;
        object-fit: contain;
      }

      .popup-header-title {
        font-weight: 800;
        font-size: 13px;
        line-height: 1.25;
        color: #000000 !important; /* PURE BLACK TEXT */
      }
      .popup-header-subtitle {
        font-size: 10.5px;
        color: #0284c7 !important; /* PRIMARY COLOR ACCENT */
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 1px;
      }

      .popup-body {
        padding: 12px 14px;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
      }

      .popup-product-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      }
      .popup-product-row .product-icon {
        width: 22px;
        height: 22px;
        object-fit: contain;
        margin-top: 1px;
        flex-shrink: 0;
      }
      .popup-product-row .product-name {
        font-weight: 800;
        color: #000000 !important; /* PURE BLACK TEXT */
        font-size: 12px;
        line-height: 1.35;
      }
      .popup-product-row .product-qty {
        font-size: 10.5px;
        color: #4b5563 !important;
        font-weight: 600;
        margin-top: 2px;
      }

      .popup-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 8px 0;
      }

      .popup-detail-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11.5px;
        margin-bottom: 6px;
      }
      .popup-detail-row:last-child {
        margin-bottom: 0;
      }
      .popup-detail-row .detail-label {
        color: #374151 !important;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }
      .popup-detail-row .detail-val {
        color: #000000 !important; /* PURE BLACK TEXT */
        font-weight: 800;
        text-align: right;
        word-break: break-word;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 5px;
        font-size: 10.5px;
        font-weight: 800;
      }
      .status-badge.vehicle {
        background: #f0f9ff !important;
        color: #0284c7 !important;
        border: 1.5px solid #0284c7 !important;
      }
      .status-badge.dest {
        background: #ecfdf5 !important;
        color: #059669 !important;
        border: 1.5px solid #059669 !important;
      }

      /* =========================================================
         2. CLASSIC PIN PILL BADGES: SOLID WHITE BG + BLACK TEXT + PRIMARY BORDER
         ========================================================= */
      .nex-pin-badge {
        position: absolute;
        top: 64px;
        left: 50%;
        transform: translateX(-50%);
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important; /* PURE BLACK TEXT */
        padding: 3px 10px !important;
        border-radius: 6px !important;
        font-size: 10.5px !important;
        font-weight: 800 !important;
        white-space: nowrap !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22) !important;
        z-index: 6 !important;
        opacity: 1 !important;
        border: 2px solid #0284c7 !important;
      }
      .nex-pin-badge.origin {
        border-color: #d97706 !important;
        color: #000000 !important;
      }
      .nex-pin-badge.dest {
        border-color: #059669 !important;
        color: #000000 !important;
      }
      .nex-pin-badge.vehicle {
        border-color: #0284c7 !important;
        color: #000000 !important;
      }

      .badge-pip {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }
      .badge-pip.origin {
        background: #d97706 !important;
        box-shadow: 0 0 5px #d97706;
      }
      .badge-pip.dest {
        background: #059669 !important;
        box-shadow: 0 0 5px #059669;
      }
      .badge-pip.vehicle {
        background: #0284c7 !important;
        box-shadow: 0 0 5px #0284c7;
        animation: nexPipPulse 1.4s infinite ease-in-out;
      }

      /* =========================================================
         3. REALISTIC SVG MARKERS ANATOMY
         ========================================================= */
      .nex-leaflet-svg-pin {
        position: relative;
        width: 140px;
        height: 100px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
      }

      /* Realistic Warehouse SVG container */
      .nex-warehouse-svg-box {
        position: relative;
        z-index: 5;
        transition: transform 0.2s ease;
      }
      .nex-warehouse-svg-box img {
        width: 54px;
        height: 44px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
      }
      .nex-leaflet-svg-pin:hover .nex-warehouse-svg-box {
        transform: scale(1.1);
      }

      /* Realistic Delivery Pin SVG container */
      .nex-dest-svg-box {
        position: relative;
        z-index: 5;
        transition: transform 0.2s ease;
      }
      .nex-dest-svg-box img {
        width: 44px;
        height: 55px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
      }
      .nex-leaflet-svg-pin:hover .nex-dest-svg-box {
        transform: scale(1.1);
      }

      /* 3D Tapered Ground Needles for Origin */
      .nex-svg-needle {
        width: 12px;
        height: 14px;
        margin-top: -3px;
        clip-path: polygon(0 0, 100% 0, 50% 100%);
        z-index: 4;
        position: relative;
      }
      .nex-svg-needle.origin {
        background: linear-gradient(to right, #fbbf24 0%, #f59e0b 50%, #b45309 100%);
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
      }

      /* Ground Anchors & Radar Rings */
      .nex-ground-anchor {
        position: absolute;
        top: 55px;
        left: 50%;
        transform: translateX(-50%);
        width: 38px;
        height: 38px;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nex-ground-shadow {
        position: absolute;
        width: 24px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(ellipse, rgba(15, 23, 42, 0.5) 0%, transparent 75%);
      }
      .nex-ground-radar {
        position: absolute;
        width: 28px;
        height: 28px;
        border-radius: 50%;
      }
      .nex-ground-radar.origin {
        border: 2px solid rgba(245, 158, 11, 0.85);
        animation: nexRadarPingOrigin 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
      }
      .nex-ground-radar.dest {
        border: 2px solid rgba(16, 185, 129, 0.85);
        animation: nexRadarPingDest 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite 0.7s;
      }
      .nex-ground-radar.vehicle {
        border: 2px solid rgba(2, 132, 199, 0.85);
        animation: nexRadarPingVehicle 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
      }

      /* =========================================================
         4. REALISTIC VEHICLE PIN WITH 3D CARGO BOX ON TOP
         ========================================================= */
      .nex-leaflet-vehicle-pin {
        position: relative;
        width: 140px;
        height: 110px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
      }

      /* Real 3D Cargo Box on top */
      .nex-cargo-box-top {
        position: relative;
        z-index: 7;
        margin-bottom: -5px;
        animation: nexCargoHover 2.5s ease-in-out infinite;
        transition: transform 0.2s ease;
      }
      .nex-cargo-box-top img {
        width: 36px;
        height: 30px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
      }

      /* Real Vehicle SVG image */
      .nex-real-vehicle-box {
        position: relative;
        z-index: 5;
        transition: transform 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nex-real-vehicle-box img {
        width: 62px;
        height: 38px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.35));
      }
      .nex-leaflet-vehicle-pin:hover .nex-real-vehicle-box {
        transform: scale(1.12);
      }

      .nex-vehicle-ground-anchor {
        position: absolute;
        top: 68px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 40px;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nex-vehicle-badge {
        top: 74px;
      }

      /* =========================================================
         5. PINNED DESTINATION ADDRESS BADGE: SOLID WHITE BG + BLACK TEXT
         ========================================================= */
      .nex-receiver-map-badge {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: #ffffff !important;
        background-color: #ffffff !important;
        opacity: 1 !important;
        border: 2px solid #e5e7eb !important;
        border-left: 5px solid #0284c7 !important;
        border-radius: 8px !important;
        padding: 10px 14px !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18) !important;
        z-index: 500 !important;
        max-width: 290px;
        pointer-events: auto;
      }
      .nex-map-pin-title {
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #0284c7 !important;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .nex-map-pin-address {
        font-size: 12.5px;
        font-weight: 800;
        color: #000000 !important;
        line-height: 1.35;
        margin-bottom: 3px;
      }
      .nex-map-pin-recipient {
        font-size: 11px;
        color: #374151 !important;
        font-weight: 600;
      }
      .nex-map-pin-recipient strong {
        color: #000000 !important;
      }

      /* =========================================================
         6. CURVED ROUTE ANIMATIONS & WAYPOINTS
         ========================================================= */
      .nex-route-halo-traversed,
      .nex-route-core-traversed,
      .nex-route-flow-traversed,
      .nex-route-halo-pending,
      .nex-route-core-pending {
        pointer-events: none !important;
      }
      .nex-route-flow-traversed {
        animation: nexRouteFlowTraversed 1.8s linear infinite !important;
      }
      @keyframes nexRouteFlowTraversed {
        from {
          stroke-dashoffset: 44;
        }
        to {
          stroke-dashoffset: 0;
        }
      }

      .nex-route-core-pending {
        animation: nexRouteFlowPending 2.4s linear infinite !important;
      }
      @keyframes nexRouteFlowPending {
        from {
          stroke-dashoffset: 28;
        }
        to {
          stroke-dashoffset: 0;
        }
      }

      /* =========================================================
         7. MAP CONTAINER INTERACTION & CURSOR
         ========================================================= */
      .nex-map-container,
      .leaflet-container {
        cursor: grab !important;
      }
      .nex-map-container:active,
      .leaflet-container:active,
      .leaflet-container.leaflet-drag-target,
      .leaflet-dragging .leaflet-container {
        cursor: grabbing !important;
      }

      /* Custom Recenter Control Button */
      .nex-leaflet-control-recenter {
        background: #ffffff !important;
        border: 2px solid rgba(0, 0, 0, 0.2) !important;
        border-radius: 4px !important;
        box-shadow: 0 1px 5px rgba(0,0,0,0.4) !important;
        overflow: hidden !important;
      }
      .nex-recenter-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        background-color: #ffffff !important;
        color: #0284c7 !important;
        text-align: center !important;
        cursor: pointer !important;
        text-decoration: none !important;
        transition: background-color 0.15s ease, color 0.15s ease !important;
      }
      .nex-recenter-btn:hover {
        background-color: #f0f9ff !important;
        color: #0369a1 !important;
      }

      .nex-waypoint-beacon {
        position: relative;
        width: 16px;
        height: 16px;
        pointer-events: none;
      }
      .nex-waypoint-beacon .waypoint-core {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 6px;
        height: 6px;
        background: #38bdf8;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 6px #38bdf8;
      }
      .nex-waypoint-beacon .waypoint-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1.5px solid rgba(56, 189, 248, 0.65);
        transform: translate(-50%, -50%);
        animation: nexRadarPingVehicle 2.2s infinite cubic-bezier(0, 0.2, 0.8, 1);
      }
      .nex-waypoint-beacon.pending .waypoint-core {
        background: #06b6d4;
        box-shadow: 0 0 6px #06b6d4;
      }
      .nex-waypoint-beacon.pending .waypoint-pulse {
        border-color: rgba(6, 182, 212, 0.65);
      }

      @keyframes nexRadarPingOrigin {
        0% { transform: scale(0.4); opacity: 0.95; }
        100% { transform: scale(2.0); opacity: 0; }
      }
      @keyframes nexRadarPingDest {
        0% { transform: scale(0.4); opacity: 0.95; }
        100% { transform: scale(2.0); opacity: 0; }
      }
      @keyframes nexRadarPingVehicle {
        0% { transform: scale(0.4); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      @keyframes nexCargoHover {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      @keyframes nexPipPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.75); }
      }
    `;
  }

  /**
   * Main Interactive Map Bootstrapper
   */
  window.initNexivanTelemetryMap = function (containerId, data) {
    if (!data) return;

    if (typeof L === 'undefined') {
      setTimeout(function () {
        window.initNexivanTelemetryMap(containerId, data);
      }, 60);
      return;
    }

    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    // Self-inject CSS styles
    ensureMapStylesInjected();

    // Reset existing map instance to avoid Leaflet "Map container is already initialized"
    if (container._leaflet_id) {
      try {
        if (container._nexMapInstance) {
          container._nexMapInstance.remove();
          container._nexMapInstance = null;
        }
      } catch (e) {}
      container._leaflet_id = null;
    }

    const s = data.shipment || data;
    const checkpoints = data.checkpoints || s.checkpoints || [];

    const originCity = (s.origin || (s.shipper && s.shipper.address) || s.shipper_address || 'Chicago, IL, USA').trim();
    const destCity = (s.destination || (s.receiver && s.receiver.address) || s.receiver_address || 'Los Angeles, CA, USA').trim();
    const receiverAddress = (s.receiver && s.receiver.address) || s.receiver_address || destCity;
    const receiverName = (s.receiver && s.receiver.name) || s.receiver_name || 'Valued Consignee';
    const shipperName = (s.shipper && s.shipper.name) || s.shipper_name || 'Dispatch Consignor';
    const trackingNo = s.trackingNumber || s.tracking_number || 'NX-000000';
    const status = (s.status || 'In Transit').trim();
    const statusLower = status.toLowerCase();
    const transportMode = s.transportMode || s.transport_mode || s.serviceType || s.service_type || 'Road Freight';
    const product = s.product || s.packageType || s.package_type || 'Commercial Cargo';
    const quantity = s.quantity || 1;

    let currentLoc = (s.currentLocation || s.current_location || '').trim();
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

    // Determine Coordinates
    const originCoords = resolveCoordinates(originCity, [41.8781, -87.6298]);
    const destCoords = resolveCoordinates(destCity, [34.0522, -118.2437]);

    let currentCoords;
    if (progress >= 100 || statusLower.includes('delivered')) {
      currentCoords = [destCoords[0], destCoords[1]];
    } else if (progress <= 10 || statusLower.includes('pending') || statusLower.includes('order')) {
      currentCoords = [originCoords[0], originCoords[1]];
    } else {
      const explicitMatch = resolveCoordinates(currentLoc, null);
      if (explicitMatch && (explicitMatch[0] !== originCoords[0] || explicitMatch[1] !== originCoords[1])) {
        currentCoords = explicitMatch;
      } else {
        const fraction = Math.max(0.18, Math.min(0.82, progress / 100));
        const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * fraction;
        const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * fraction;
        currentCoords = [lat, lng];
      }
    }

    const vehicleSvg = getVehicleSvgInfo(transportMode);

    // Make sure container has dimensions
    container.style.height = container.style.height || '420px';
    container.style.width = '100%';
    container.style.position = 'relative';

    // Initialize Map with full mouse and touch controls enabled
    const map = L.map(container, {
      center: currentCoords,
      zoom: 5,
      zoomControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      attributionControl: true
    });
    container._nexMapInstance = map;
    window._nexTelemetryMapInstance = map;

    // OpenStreetMap tile layer with CartoDB fallback
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    osmLayer.on('tileerror', function () {
      if (!map._cartoFallbackAdded) {
        map._cartoFallbackAdded = true;
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);
      }
    });

    // 1. GENERATE REALISTIC CURVED GEODESIC NAVIGATION CORRIDORS
    const traversedCurve = generateCurvedPath(originCoords, currentCoords, 1, 26);
    const pendingCurve = generateCurvedPath(currentCoords, destCoords, 1, 26);

    // Draw Traversed Route (Origin -> Current Location) with interactive: false so mouse drag is never blocked
    L.polyline(traversedCurve, {
      color: '#0284c7',
      weight: 12,
      opacity: 0.22,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'nex-route-halo-traversed',
      interactive: false
    }).addTo(map);

    L.polyline(traversedCurve, {
      color: '#0284c7',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'nex-route-core-traversed',
      interactive: false
    }).addTo(map);

    L.polyline(traversedCurve, {
      color: '#38bdf8',
      weight: 2.5,
      opacity: 0.95,
      dashArray: '8, 14',
      lineCap: 'round',
      lineJoin: 'round',
      className: 'nex-route-flow-traversed',
      interactive: false
    }).addTo(map);

    // Draw Scheduled Route (Current Location -> Delivery Destination)
    if (progress < 100 && !statusLower.includes('delivered')) {
      L.polyline(pendingCurve, {
        color: '#06b6d4',
        weight: 8,
        opacity: 0.16,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'nex-route-halo-pending',
        interactive: false
      }).addTo(map);

      L.polyline(pendingCurve, {
        color: '#0891b2',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '6, 8',
        lineCap: 'round',
        lineJoin: 'round',
        className: 'nex-route-core-pending',
        interactive: false
      }).addTo(map);
    }

    // Navigation Waypoint Beacons along curves
    if (traversedCurve.length >= 12) {
      const wp1 = traversedCurve[Math.floor(traversedCurve.length * 0.5)];
      const wpHtml = `
        <div class="nex-waypoint-beacon" title="Navigation Corridor Fix">
          <div class="waypoint-pulse"></div>
          <div class="waypoint-core"></div>
        </div>
      `;
      L.marker(wp1, {
        icon: L.divIcon({ className: 'nex-leaflet-marker-wrap', html: wpHtml, iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false
      }).addTo(map);
    }
    if (pendingCurve.length >= 12 && progress < 100 && !statusLower.includes('delivered')) {
      const wp2 = pendingCurve[Math.floor(pendingCurve.length * 0.5)];
      const wp2Html = `
        <div class="nex-waypoint-beacon pending" title="Scheduled Transit Waypoint">
          <div class="waypoint-pulse"></div>
          <div class="waypoint-core"></div>
        </div>
      `;
      L.marker(wp2, {
        icon: L.divIcon({ className: 'nex-leaflet-marker-wrap', html: wp2Html, iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false
      }).addTo(map);
    }

    // 2. ORIGIN LOCATION: REALISTIC LOGISTICS WAREHOUSE SVG PIN
    const originShort = originCity.split(',')[0];
    const originHtml = `
      <div class="nex-leaflet-svg-pin" title="Origin Hub: ${escapeHtml(originCity)}">
        <div class="nex-warehouse-svg-box">
          <img src="/assets/images/map/warehouse.svg" alt="Origin Warehouse" />
        </div>
        <div class="nex-svg-needle origin"></div>
        <div class="nex-ground-anchor">
          <div class="nex-ground-shadow"></div>
          <div class="nex-ground-radar origin"></div>
        </div>
        <div class="nex-pin-badge origin">
          <span class="badge-pip origin"></span>
          <span>Origin: ${escapeHtml(originShort)}</span>
        </div>
      </div>
    `;
    const originIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: originHtml,
      iconSize: [140, 100],
      iconAnchor: [70, 56],
      popupAnchor: [0, -58]
    });
    const originMarker = L.marker(originCoords, { icon: originIcon }).addTo(map);
    originMarker.bindPopup(`
      <div class="nex-map-popup-card">
        <div class="popup-header origin">
          <div class="popup-header-icon">
            <img src="/assets/images/map/warehouse.svg" alt="Warehouse" />
          </div>
          <div>
            <div class="popup-header-title">Origin Dispatch Terminal</div>
            <div class="popup-header-subtitle"><i class="fas fa-building"></i> Logistics Fulfillment Center</div>
          </div>
        </div>
        <div class="popup-body">
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-city" style="color:#d97706;"></i> Origin Hub:</span>
            <span class="detail-val"><strong>${escapeHtml(originCity)}</strong></span>
          </div>
          <div class="popup-divider"></div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-user-tag" style="color:#d97706;"></i> Shipper / Consignor:</span>
            <span class="detail-val"><strong>${escapeHtml(shipperName)}</strong></span>
          </div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-barcode" style="color:#0284c7;"></i> AWB Waybill:</span>
            <span class="detail-val" style="color: #0284c7; font-weight: 800;">${escapeHtml(trackingNo)}</span>
          </div>
        </div>
      </div>
    `, {
      className: 'nex-custom-popup',
      closeButton: true,
      autoPan: true
    });

    // 3. DELIVERY LOCATION: REALISTIC 3D DESTINATION PIN SVG
    const destShort = destCity.split(',')[0];
    const destHtml = `
      <div class="nex-leaflet-svg-pin" title="Final Delivery: ${escapeHtml(destCity)}">
        <div class="nex-dest-svg-box">
          <img src="/assets/images/map/delivery-pin.svg" alt="Delivery Destination" />
        </div>
        <div class="nex-ground-anchor" style="top: 52px;">
          <div class="nex-ground-shadow"></div>
          <div class="nex-ground-radar dest"></div>
        </div>
        <div class="nex-pin-badge dest" style="top: 60px;">
          <span class="badge-pip dest"></span>
          <span>Delivery: ${escapeHtml(destShort)}</span>
        </div>
      </div>
    `;
    const destIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: destHtml,
      iconSize: [140, 100],
      iconAnchor: [70, 53],
      popupAnchor: [0, -56]
    });
    const destMarker = L.marker(destCoords, { icon: destIcon }).addTo(map);
    destMarker.bindPopup(`
      <div class="nex-map-popup-card">
        <div class="popup-header dest">
          <div class="popup-header-icon">
            <img src="/assets/images/map/delivery-pin.svg" alt="Delivery" />
          </div>
          <div>
            <div class="popup-header-title">Final Delivery Destination</div>
            <div class="popup-header-subtitle"><i class="fas fa-home"></i> Consignee Receipt Address</div>
          </div>
        </div>
        <div class="popup-body">
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-location-arrow" style="color:#059669;"></i> Delivery Address:</span>
            <span class="detail-val"><strong>${escapeHtml(receiverAddress)}</strong></span>
          </div>
          <div class="popup-divider"></div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-user-check" style="color:#059669;"></i> Consignee Name:</span>
            <span class="detail-val"><strong>${escapeHtml(receiverName)}</strong></span>
          </div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-shield-alt" style="color:#0284c7;"></i> Transit Milestone:</span>
            <span class="status-badge dest">Destination Scheduled</span>
          </div>
        </div>
      </div>
    `, {
      className: 'nex-custom-popup',
      closeButton: true,
      autoPan: true
    });

    // 4. CURRENT LOCATION: REALISTIC VEHICLE SVG WITH 3D CARGO BOX ON TOP
    let heading = 90;
    if (traversedCurve.length >= 2) {
      const pPrev = traversedCurve[traversedCurve.length - 2];
      heading = calculateBearing(pPrev, currentCoords);
    } else if (pendingCurve.length >= 2) {
      heading = calculateBearing(currentCoords, pendingCurve[1]);
    }

    let vehicleTransform = '';
    if (vehicleSvg.type === 'plane') {
      // Rotate aircraft along flight corridor heading
      const planeRotation = Math.round(heading);
      vehicleTransform = `transform: rotate(${planeRotation}deg);`;
    } else {
      // Flip truck/ship/van horizontally if moving West
      if (heading > 180 && heading < 360) {
        vehicleTransform = 'transform: scaleX(-1);';
      }
    }

    const currentShort = (currentLoc || 'In Transit').split(',')[0];
    const vehicleHtml = `
      <div class="nex-leaflet-vehicle-pin" title="${escapeHtml(status)}: ${escapeHtml(currentLoc)}">
        <!-- REAL 3D CARGO BOX ON TOP -->
        <div class="nex-cargo-box-top">
          <img src="/assets/images/map/cargo-box.svg" alt="Cargo Package" />
        </div>
        <!-- REAL VEHICLE SVG -->
        <div class="nex-real-vehicle-box" style="${vehicleTransform}">
          <img src="${vehicleSvg.svg}" alt="${vehicleSvg.label}" />
        </div>
        <!-- GROUND ANCHOR & RADAR -->
        <div class="nex-vehicle-ground-anchor">
          <div class="nex-ground-shadow"></div>
          <div class="nex-ground-radar vehicle"></div>
        </div>
        <!-- CLASSIC SOLID BADGE (WHITE BG, BOLD BLACK TEXT, PRIMARY BLUE BORDER) -->
        <div class="nex-pin-badge vehicle nex-vehicle-badge">
          <span class="badge-pip vehicle"></span>
          <span>${escapeHtml(status)}: ${escapeHtml(currentShort)}</span>
        </div>
      </div>
    `;
    const vehicleIcon = L.divIcon({
      className: 'nex-leaflet-marker-wrap',
      html: vehicleHtml,
      iconSize: [140, 110],
      iconAnchor: [70, 70],
      popupAnchor: [0, -74]
    });
    const vehicleMarker = L.marker(currentCoords, { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
    
    // CLASSIC SOLID POPUP CARD: WHITE BG, BOLD BLACK TEXT, PRIMARY BLUE ACCENTS
    vehicleMarker.bindPopup(`
      <div class="nex-map-popup-card">
        <div class="popup-header vehicle">
          <div class="popup-header-icon">
            <img src="${vehicleSvg.svg}" alt="${vehicleSvg.label}" />
          </div>
          <div>
            <div class="popup-header-title">Active Telemetry Position</div>
            <div class="popup-header-subtitle"><i class="fas fa-satellite-dish"></i> Live GPS Corridor Track</div>
          </div>
        </div>
        <div class="popup-body">
          <div class="popup-product-row">
            <img src="/assets/images/map/cargo-box.svg" alt="Cargo" class="product-icon" />
            <div class="product-info">
              <div class="product-name">${escapeHtml(product)}</div>
              <div class="product-qty">${quantity} ${quantity === 1 ? 'unit' : 'units'} • ${escapeHtml(transportMode)}</div>
            </div>
          </div>
          <div class="popup-divider"></div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-map-pin" style="color:#0284c7;"></i> Current Location:</span>
            <span class="detail-val"><strong>${escapeHtml(currentLoc)}</strong></span>
          </div>
          <div class="popup-detail-row">
            <span class="detail-label"><i class="fas fa-tachometer-alt" style="color:#0284c7;"></i> Dispatch Status:</span>
            <span class="status-badge vehicle">${escapeHtml(status)} (${progress}%)</span>
          </div>
        </div>
      </div>
    `, {
      className: 'nex-custom-popup',
      closeButton: true,
      autoPan: true
    });

    // Fit map view to cover the whole navigation corridor initially
    const allRoutePoints = traversedCurve.concat(pendingCurve);
    const bounds = L.latLngBounds(allRoutePoints);
    if (bounds.isValid()) {
      try {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10
        });
      } catch (e) {}
    }

    // Add Recenter / Reset View Control in top-right
    try {
      const RecenterControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
          const container = L.DomUtil.create('div', 'leaflet-bar nex-leaflet-control-recenter');
          const btn = L.DomUtil.create('a', 'nex-recenter-btn', container);
          btn.href = '#';
          btn.title = 'Center on full transit corridor';
          btn.setAttribute('role', 'button');
          btn.setAttribute('aria-label', 'Center on full transit corridor');
          btn.innerHTML = '<i class="fas fa-compress-arrows-alt" style="font-size:13px;color:#0284c7;line-height:30px;"></i>';
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.on(btn, 'click', function (e) {
            L.DomEvent.preventDefault(e);
            if (bounds.isValid()) {
              map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 10, duration: 0.75 });
            }
          });
          return container;
        }
      });
      map.addControl(new RecenterControl());
    } catch (e) {}

    // InvalidateSize cycle for flawless rendering on all screens without hijacking user pan/zoom
    const refreshMap = function () {
      try {
        map.invalidateSize(false);
      } catch (e) {}
    };

    setTimeout(refreshMap, 150);
    setTimeout(refreshMap, 450);

    window.addEventListener('resize', refreshMap);
  };
})();
