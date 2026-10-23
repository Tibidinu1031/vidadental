import {readFileSync, existsSync, readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('index.html', 'utf8');
const files = ['index.html','admin.html',...readdirSync('assets').filter(name => /\.(js|css|json)$/.test(name)).map(name => 'assets/' + name)];
for (const file of files) assert.ok(!/[\u2013\u2014]/.test(readFileSync(file, 'utf8')), 'Long dash found: ' + file);
for (const [, path] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!/^(https?:|mailto:|tel:)/.test(path)) assert.ok(existsSync(path), 'Missing file: ' + path);
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs');
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), 'Broken anchor: ' + id);
const reviews = JSON.parse(readFileSync('assets/reviews.json', 'utf8'));
assert.equal(reviews.length, 10); assert.ok(reviews.every(row => row.rating === 5 && row.id && existsSync(row.image)));
assert.deepEqual(JSON.parse(readFileSync('assets/reviews-data.js', 'utf8').replace(/^window\.VIDA_REVIEWS\s*=\s*/, '').replace(/;\s*$/, '')), reviews);
assert.ok(html.includes('Rating de 5/5 dupa 350+ review-uri in Google Maps'));
assert.ok(html.includes('tel:+40745166956') && html.includes('tel:+40722581034'));
console.log('Verified: assets, anchors, 10 sourced reviews, both phones and no long dashes.');
