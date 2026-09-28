// Code 128 (Subtype B) Barcode SVG Generator
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

function generateBarcodeSVG(rawText, options = {}) {
  const height = options.height || 54;
  const barWidth = options.barWidth || 2;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 14;
  const showText = options.showText !== false;
  const textColor = options.textColor || '#0b1e36';

  const cleanText = String(rawText || 'NX-000000').toUpperCase().replace(/[^A-Z0-9\-\.\s\/$%+]/g, '');
  const codes = [104]; // Code 128B start
  let checkSum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checkSum += code * (i + 1);
    }
  }

  codes.push(checkSum % 103);
  codes.push(106); // Stop code

  let fullPattern = '';
  for (const c of codes) {
    fullPattern += CODE128_PATTERNS[c] || '';
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
      rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#0b1e36" />`;
    }
    x += w;
  }

  let textSvg = '';
  if (showText) {
    textSvg = `<text x="${svgWidth / 2}" y="${height + 18}" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="2.5">* ${cleanText} *</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="nex-barcode-svg" style="max-width: ${Math.min(svgWidth, 340)}px; width: 100%; height: auto; display: block; margin: 0 auto;" aria-label="Barcode for ${cleanText}"><rect width="100%" height="100%" fill="#ffffff" rx="6"/>${rects}${textSvg}</svg>`;
}

module.exports = {
  generateBarcodeSVG,
  CODE128_PATTERNS,
};
