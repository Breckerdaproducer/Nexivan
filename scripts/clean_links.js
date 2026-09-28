const fs = require('fs');
const path = require('path');

const serviceSlugs = [
  'truck-freight',
  'air-freight',
  'ship-freight',
  'train-freight',
  'van-freight',
  'wagon-freight',
  'drone-freight',
  'transportation-services-in-los-angeles',
  'introduction-of-modern-logistics',
  'digital-communications-of-transport',
];

const categorySlugs = [
  'logistics',
  'transport',
  'transportation',
  'brand-guidelines',
  'creative-supply',
];

const blogSlugs = [
  '5-key-reasons-why-reliable-logistics-can-make-or-break-your-business',
  'how-logisku-ensures-on-time-delivery-every-time',
  'local-vs-global-shipping-which-one-suits-your-business',
];

function cleanHref(href, filePath) {
  if (!href) return href;
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#') ||
    href.startsWith('javascript:')
  ) {
    return href;
  }

  let [base, hash] = href.split('#');
  let [url, query] = base.split('?');
  let suffix = (query ? '?' + query : '') + (hash ? '#' + hash : '');

  if (!url.endsWith('.html')) {
    return href;
  }

  let cleanName = url.trim();
  while (cleanName.startsWith('../') || cleanName.startsWith('./') || cleanName.startsWith('/')) {
    cleanName = cleanName.replace(/^(\.\.\/|\.\/|\/)/, '');
  }

  // 1. Root pages
  if (cleanName === 'index.html') return '/' + suffix;
  if (cleanName === 'about-us.html' || cleanName === 'about.html') return '/about-us' + suffix;
  if (cleanName === 'services.html' || cleanName === 'service.html') return '/services' + suffix;
  if (cleanName === 'track-shipment.html') return '/track-shipment' + suffix;
  if (cleanName === 'contacts.html') return '/contacts' + suffix;

  // 2. Blog posts
  for (const b of blogSlugs) {
    if (cleanName === `${b}.html`) {
      return `/${b}` + suffix;
    }
  }

  // 3. Service pages
  for (const s of serviceSlugs) {
    if (cleanName === `service/${s}.html` || cleanName === `${s}.html`) {
      return `/service/${s}` + suffix;
    }
  }

  // 4. Category pages
  for (const c of categorySlugs) {
    if (cleanName === `category/${c}.html` || cleanName === `${c}.html`) {
      return `/category/${c}` + suffix;
    }
  }

  return href;
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'admin' || entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let replacedCount = 0;

      const newContent = content.replace(/href=(["'])([^"']+)\1/g, (match, quote, val) => {
        const cleaned = cleanHref(val, fullPath);
        if (cleaned !== val) {
          replacedCount++;
          return `href=${quote}${cleaned}${quote}`;
        }
        return match;
      });

      if (replacedCount > 0) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${replacedCount} links in: ${path.relative(dirPath, fullPath)}`);
      }
    }
  }
}

const targetDirs = [
  path.join(__dirname, '..', 'src', 'public'),
  'C:\\Users\\Brecker-da-Producer\\Desktop\\React\\site-cloner\\Nexivan Logistics',
];

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    console.log(`\nProcessing directory: ${dir}`);
    processDirectory(dir);
  }
}

console.log('\nAll HTML page links cleaned successfully!');
