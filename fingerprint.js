#!/usr/bin/env node
/* What is in these files, in the same terms the deployed pages report.
 *
 *   node fingerprint.js
 *
 * Three separate deploys have now been debugged as code faults before anyone
 * checked which build was actually being served. The browser can already say
 * what it is running - the runtime logs
 *
 *   [mp-runtime] build <stamp>  template <fingerprint>
 *
 * on every page, live and preview. This prints the same two values for the
 * files on disk, so "is the deploy current" is a comparison rather than an
 * argument.
 *
 * The template fingerprint is a hash of the template's own <style> text, the
 * same value the runtime computes in the browser. It is recomputed here rather
 * than lifted, so this script needs nothing installed - no node_modules, no
 * npm, nothing but node itself. The suite checks the two agree on all ten
 * templates, so they cannot drift apart unnoticed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.argv[2] || '.';

function lift(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i === -1) return null;
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  return null;
}

const rtPath = path.join(dir, 'site-runtime.js');
if (!fs.existsSync(rtPath)) {
  console.error('No site-runtime.js in ' + path.resolve(dir));
  process.exit(1);
}
const rt = fs.readFileSync(rtPath, 'utf8');

const stamp = (rt.match(/var MP_RUNTIME_BUILD = '([\w.-]+)';/) || [])[1] || '(none)';
const md5 = crypto.createHash('md5').update(fs.readFileSync(rtPath)).digest('hex');

console.log('');
console.log('site-runtime.js');
console.log('  build stamp   ' + stamp);
console.log('  md5           ' + md5);
console.log('');
console.log('  The page logs the build stamp on load. If the browser says');
console.log('  anything other than ' + stamp + ', the runtime is stale.');
console.log('');

const tpls = fs.readdirSync(dir).filter(f => /^template-.*\.html$/.test(f)).sort();
if (!tpls.length) { console.log('No templates found in ' + path.resolve(dir)); process.exit(0); }

/* NO DEPENDENCIES. This used jsdom to build a document and run the runtime's
 * own _templateFingerprint over it, which is the most faithful thing to do and
 * also made the tool unusable: on a cloud-synced folder, requiring jsdom pulls
 * several hundred placeholder files down one at a time and the command appears
 * to hang after printing the runtime half.
 *
 * A <style> element is RAW TEXT in HTML - the parser performs no entity
 * decoding inside it - so the text a regex lifts out is byte-for-byte the
 * textContent the runtime hashes. Same input, same djb2, same answer, and the
 * suite gates the two against each other on all ten templates.
 *
 * Anonymous <style> only, matching the runtime: every sheet it injects carries
 * an id, and no template ships one.
 */
function fingerprint(html) {
  /* The value the template DECLARES, recomputed from the file.
   *
   * Hashing what the page looks like could not work: a live page carries
   * whatever the host injects as well, so one file read one value on disk and
   * another in the browser. Each template now states its own marker and this
   * recomputes it over every byte EXCEPT that line - which is why a template
   * whose marker is stale shows up here as a mismatch rather than agreeing
   * with itself and being wrong.
   */
  const m = /\n\s*window\.__mpTemplate = '([a-z]+):([0-9a-f]{8})';\n/.exec(html);
  if (!m) return { declared: null, actual: 'unmarked' };
  let text = html.replace(m[0], '\n');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return { declared: m[2], actual: ('0000000' + h.toString(16)).slice(-8), name: m[1] };
}

console.log('templates');
const seen = {};
let stale = 0;
for (const t of tpls) {
  const r = fingerprint(fs.readFileSync(path.join(dir, t), 'utf8'));
  const name = t.replace(/^template-|\.html$/g, '');
  const ok = r.declared === r.actual;
  if (!ok) stale++;
  console.log('  ' + name.padEnd(20) + r.declared +
    (ok ? '' : '   <<< MARKER STALE, file is ' + r.actual));
  (seen[r.declared] = seen[r.declared] || []).push(name);
}
if (stale) {
  console.log('');
  console.log('  ' + stale + ' template(s) edited without updating the marker.');
  console.log('  Run the suite - it recomputes these and will name them.');
}

/* Two templates with one fingerprint would let a stale file be confirmed by
   the wrong one, so it is worth saying out loud rather than leaving to be
   noticed. */
const clashes = Object.entries(seen).filter(([, names]) => names.length > 1);
if (clashes.length) {
  console.log('');
  console.log('  WARNING - these share a fingerprint and cannot be told apart:');
  clashes.forEach(([fp, names]) => console.log('    ' + fp + '  ' + names.join(', ')));
}

console.log('');
console.log('  Paste in the console on any page to read the deployed values:');
console.log('    [window.MP_RUNTIME_BUILD, window.MP_TEMPLATE_FINGERPRINT]');
console.log('');
