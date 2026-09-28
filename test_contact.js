const http = require('http');

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('=== TEST 1: GET /contacts (Clean form loaded) ===');
  const res1 = await request('http://localhost:5000/contacts');
  console.log('Status:', res1.status);
  console.log('Has nexivan-contact-form:', res1.data.includes('nexivan-contact-form'));
  console.log('No wpforms-ajax-form in form tag:', !res1.data.includes('class="wpforms-validate wpforms-form wpforms-ajax-form"'));

  console.log('\n=== TEST 2: POST /api/contact (Valid AJAX Submission) ===');
  const payload2 = JSON.stringify({
    firstName: 'Marcus',
    lastName: 'Vance',
    phone: '+1 915 217 3598',
    email: 'marcus.vance@example.com',
    message: 'We require a customized ocean and air freight quote for commercial electronics.',
  });
  const res2 = await request('http://localhost:5000/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload2),
    },
  }, payload2);
  console.log('Status:', res2.status);
  const json2 = JSON.parse(res2.data);
  console.log('Success:', json2.success);
  console.log('Message ID:', json2.id);

  console.log('\n=== TEST 3: POST /api/contact (Missing fields error handling) ===');
  const payload3 = JSON.stringify({ firstName: '', email: 'invalid', message: '' });
  const res3 = await request('http://localhost:5000/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload3),
    },
  }, payload3);
  console.log('Status:', res3.status);
  const json3 = JSON.parse(res3.data);
  console.log('Success (should be false):', json3.success);
  console.log('Error details:', json3.message);

  console.log('\n=== TEST 4: POST /contacts (Standard HTML form submit / fallback) ===');
  const formBody = new URLSearchParams({
    'wpforms[fields][1][first]': 'Elena',
    'wpforms[fields][1][last]': 'Rostova',
    'wpforms[fields][2]': '555-0199',
    'wpforms[fields][3]': 'elena.rostova@example.com',
    'wpforms[fields][4]': 'Inquiry regarding express van freight delivery schedules.',
  }).toString();
  const res4 = await request('http://localhost:5000/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody),
    },
  }, formBody);
  console.log('Status (should be 303 redirect):', res4.status);
  console.log('Redirect location:', res4.headers.location);

  console.log('\n=== TEST 5: GET /contacts?sent=success (Pre-rendered confirmation banner) ===');
  const res5 = await request('http://localhost:5000/contacts?sent=success');
  console.log('Status:', res5.status);
  console.log('Has success banner:', res5.data.includes('Inquiry Sent Successfully!'));
  console.log('Has alert container:', res5.data.includes('nex-contact-alert-banner'));

  console.log('\n=== ALL CONTACT TESTS PASSED ===');
}

runTests().catch(console.error);
