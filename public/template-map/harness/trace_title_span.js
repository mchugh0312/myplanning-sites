/* Trace: a font applied to a WHOLE events box reaches the titles but not the
   body lines. Runs the runtime's own markStructure and a template's own
   _mpTitle on the same input and prints what each block becomes.

   Usage: node trace_title_span.js [TEMPLATE_DIR] [template-id]
   Expected today: the "detail" line has lost its opening <span>. */
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', '..');
const tid = process.argv[3] || 'whimsicalromance';
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
}
const rt = fs.readFileSync(path.join(dir, 'site-runtime.js'), 'utf8');
const tp = fs.readFileSync(path.join(dir, 'template-' + tid + '.html'), 'utf8');
const code =
  "var _text = function (h) { return String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim(); };\n" +
  "var _VOID = /^(br|img|hr|input|source|wbr)$/i;\n" +
  ['_wrapsWhole', '_unwrap', 'markBlock', '_openTags', 'markStructure'].map(n => grab(rt, n)).join('\n') + '\n' +
  grab(tp, '_mpTitle') + '\nreturn { markStructure, _mpTitle };';
const { markStructure, _mpTitle } = new Function(code)();
const F = 'font-family:&quot;Courier New&quot;';
const input = `<span style="${F}">The Ceremony<br>4pm, The Chapel<br><br>The Reception<br>7pm, The Barn</span>`;
const marked = markStructure(input);
console.log('INPUT   ', input);
console.log('RUNTIME ', marked);
marked.split(/<br\s*\/?>\s*<br\s*\/?>/i).forEach((part, i) => {
  const m = _mpTitle(part);
  const detail = m ? part.replace(m[0], '').replace(/^<br\s*\/?>\s*/i, '') : part;
  console.log(`\nblock ${i + 1}`);
  console.log('  stripped as title line:', m && m[0]);
  console.log('  title  :', m && m[1]);
  console.log('  detail :', detail, /^<span/i.test(detail.trim()) ? '(font kept)' : '(FONT LOST: opening span went with the title)');
});
