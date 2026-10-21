const fs = require('fs');
const path = require('path');
const https = require('https');

const OUI_URL = 'https://raw.githubusercontent.com/silverwind/oui-data/master/index.json';
const OUTPUT_PATH = path.join(__dirname, '..', 'server', 'mac-vendors.json');

console.log('Downloading OUI Database...');

https.get(OUI_URL, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to download: HTTP ${res.statusCode}`);
    process.exit(1);
  }

  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Downloaded ${data.length} bytes. Processing...`);
    const json = JSON.parse(data);
    const map = {};
    
    for (const [key, value] of Object.entries(json)) {
      // Key is like "000000"
      // Value is multiline string like "XEROX CORPORATION\nM/S 105-50C..."
      const name = value.split('\n')[0].trim();
      const formattedMac = `${key.substring(0,2)}:${key.substring(2,4)}:${key.substring(4,6)}`;
      map[formattedMac.toUpperCase()] = name;
    }
    
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(map, null, 2));
    console.log(`Successfully extracted ${Object.keys(map).length} MAC vendors.`);
    console.log(`Saved to ${OUTPUT_PATH}`);
  });
}).on('error', (err) => {
  console.error(`Error downloading: ${err.message}`);
});
