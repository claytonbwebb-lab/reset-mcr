const fs = require('fs');
const required = ['public/index.html','public/styles-v2.css','public/script.js','public/robots.txt','public/sitemap.xml'];
let ok = true;
for (const file of required) {
  if (!fs.existsSync(file)) { console.error(`Missing ${file}`); ok = false; }
}
const html = fs.readFileSync('public/index.html','utf8');
for (const needle of ['RESET MCR','Barber','Stalybridge','application/ld+json','BarberShop']) {
  if (!html.includes(needle)) { console.error(`Missing SEO/content marker: ${needle}`); ok = false; }
}
if (!ok) process.exit(1);
console.log('RESET MCR site checks passed.');
