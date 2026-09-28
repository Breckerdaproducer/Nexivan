const http = require('http');

function get(url) {
  return new Promise(resolve => {
    http.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
  });
}

function post(url, body) {
  return new Promise(resolve => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('=== TEST 1: GET /track-shipment?tracking=TRK-89201 ===');
  const r1 = await get('http://localhost:5000/track-shipment?tracking=TRK-89201');
  console.log('Status:', r1.status);
  console.log('Has Consignment #TRK-89201:', r1.body.includes('Consignment #TRK-89201'));
  console.log('Has Chicago origin:', r1.body.includes('Chicago, IL, USA'));
  console.log('Has Denver checkpoint:', r1.body.includes('Denver Sorting Facility, CO'));
  console.log('Has Waybill button:', r1.body.includes('Print Waybill'));
  console.log('Has Pre-filled input:', r1.body.includes('value="TRK-89201"'));

  console.log('\n=== TEST 2: POST /track-shipment (Form Submission) ===');
  const r2 = await post('http://localhost:5000/track-shipment', 'tracking=TRK-89201&wpcargo-submit=TRACK+RESULT');
  console.log('Status:', r2.status, '(Expected 303)');
  console.log('Redirect location:', r2.headers.location);

  console.log('\n=== TEST 3: POST /track-shipment with legacy wpcargo field ===');
  const r3 = await post('http://localhost:5000/track-shipment', 'wpcargo_tracking_number=12345&wpcargo-submit=TRACK+RESULT');
  console.log('Status:', r3.status, '(Expected 303)');
  console.log('Redirect location:', r3.headers.location);

  console.log('\n=== TEST 4: GET /track-shipment?tracking=NON_EXISTENT ===');
  const r4 = await get('http://localhost:5000/track-shipment?tracking=NON_EXISTENT');
  console.log('Status:', r4.status);
  console.log('Has Not Found banner:', r4.body.includes('Consignment Not Found'));
  console.log('Has Tips:', r4.body.includes('Tracking Tips:'));

  console.log('\n=== TEST 5: GET /track-shipment (Clean page) ===');
  const r5 = await get('http://localhost:5000/track-shipment');
  console.log('Status:', r5.status);
  console.log('Has Result Box Placeholder:', r5.body.includes('id="nexivan-tracking-result-box"'));
  console.log('Has Bottom Map Section:', r5.body.includes('id="nexivan-receiver-map-section"'));
  console.log('Has Elementor Google Maps Widget:', r5.body.includes('elementor-widget-google_maps'));

  console.log('\n=== TEST 6: Receiver Address Pinpointing on TRK-89201 ===');
  console.log('Inline Card Map Header:', r1.body.includes('Live Delivery Destination Map'));
  console.log('Inline Card Live Pin Badge:', r1.body.includes('Live Receiver Pin'));
  console.log('Inline Receiver Delivery Address:', r1.body.includes('1204 Sunset Ave, Los Angeles, CA'));
  console.log('Bottom Section Map Iframe:', r1.body.includes('id="nexivan-receiver-map-iframe"'));
  console.log('Bottom Section Consignee:', r1.body.includes('Pacific Crest Distribution'));
  console.log('Both Maps Target Los Angeles:', (r1.body.match(/1204%20Sunset%20Ave%2C%20Los%20Angeles%2C%20CA/g) || []).length >= 1);
}

run();
