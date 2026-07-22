const fs = require('fs');
const required = ['index.html','styles.css','script.js','api/lead.js','api/booking.js','robots.txt','sitemap.xml'];
let ok = true;
for (const file of required) {
  if (!fs.existsSync(file)) { console.error(`Missing ${file}`); ok = false; }
}
const html = fs.readFileSync('index.html','utf8');
for (const needle of ['RESET MCR','Barber','Recovery','Stalybridge','application/ld+json']) {
  if (!html.includes(needle)) { console.error(`Missing SEO/content marker: ${needle}`); ok = false; }
}
if (!ok) process.exit(1);
console.log('RESET MCR site checks passed.');
