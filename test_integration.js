const http = require('http');

async function testUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'],
          length: data.length,
          preview: data.substring(0, 120).replace(/\s+/g, ' ')
        });
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function runTests() {
  console.log('Testing endpoints on http://localhost:5000 ...\n');
  const urls = [
    'http://localhost:5000/',
    'http://localhost:5000/index.html',
    'http://localhost:5000/track-shipment',
    'http://localhost:5000/track-shipment.html',
    'http://localhost:5000/contacts',
    'http://localhost:5000/contacts.html',
    'http://localhost:5000/about-us',
    'http://localhost:5000/services',
    'http://localhost:5000/service/truck-freight',
    'http://localhost:5000/service/truck-freight.html',
    'http://localhost:5000/category/logistics',
    'http://localhost:5000/admin',
    'http://localhost:5000/api/health',
    'http://localhost:5000/api/track/TRK-89201',
    'http://localhost:5000/api/search?q=air',
    'http://localhost:5000/assets/js/nexivan-api.js',
    'http://localhost:5000/assets/css/sky-sea-theme.css',
  ];

  for (const u of urls) {
    const res = await testUrl(u);
    const pass = res.status >= 200 && res.status < 400;
    console.log(`${pass ? '✅' : '❌'} [${res.status || 'ERR'}] ${u}`);
    if (res.error) console.log(`   Error: ${res.error}`);
  }
}

runTests();
