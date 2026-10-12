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
 * The template fingerprint is a hash of the template's own <style> text,
 * computed by the SAME function the runtime uses - lifted out of
 * site-runtime.js rather than reimplemented, so the two cannot drift.
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

/* jsdom is only needed for the templates. Without it the runtime half above
   still prints, which is the half most often in question. */
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) {}

const tpls = fs.readdirSync(dir).filter(f => /^template-.*\.html$/.test(f)).sort();
if (!tpls.length) { console.log('No templates found in ' + path.resolve(dir)); process.exit(0); }

if (!JSDOM) {
  console.log('templates: jsdom not installed, so these cannot be fingerprinted.');
  console.log('  npm install jsdom');
  process.exit(0);
}

const fpSrc = lift(rt, '_templateFingerprint');
if (!fpSrc) {
  console.error('site-runtime.js has no _templateFingerprint - is it the current build?');
  process.exit(1);
}

console.log('templates');
const seen = {};
for (const t of tpls) {
  const doc = new JSDOM(fs.readFileSync(path.join(dir, t), 'utf8')).window.document;
  const fp = new Function('document', fpSrc + '\nreturn _templateFingerprint;')(doc)();
  const name = t.replace(/^template-|\.html$/g, '');
  console.log('  ' + name.padEnd(20) + fp);
  (seen[fp] = seen[fp] || []).push(name);
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
