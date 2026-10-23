import os as _os
TEMPLATE_DIR = _os.environ.get('TEMPLATE_DIR', _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..', '..')))
MAP_OUT = _os.environ.get('MAP_OUT', _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'out'))
HERE = _os.path.dirname(_os.path.abspath(__file__))
PORT = int(_os.environ.get('MAP_PORT', '8765'))
_os.makedirs(MAP_OUT, exist_ok=True)
import re, json, glob, os, tinycss2
from bs4 import BeautifulSoup

def rules_from(nodes, media=None, out=None):
    out = [] if out is None else out
    for n in nodes:
        if n.type == 'qualified-rule':
            sel = tinycss2.serialize(n.prelude).strip()
            decls = [d for d in tinycss2.parse_declaration_list(n.content, skip_whitespace=True, skip_comments=True) if d.type=='declaration']
            out.append({'sel': re.sub(r'\s+',' ',sel), 'media': media,
                        'decls': [(d.lower_name, tinycss2.serialize(d.value).strip(), d.important) for d in decls]})
        elif n.type == 'at-rule' and n.lower_at_keyword in ('media','supports') and n.content:
            m = tinycss2.serialize(n.prelude).strip()
            inner = tinycss2.parse_rule_list(n.content, skip_whitespace=True, skip_comments=True)
            rules_from(inner, (media+' & ' if media else '')+m, out)
    return out

def load(path):
    html = open(path, encoding='utf-8').read()
    soup = BeautifulSoup(html, 'html.parser')
    css = '\n'.join(s.get_text() for s in soup.find_all('style'))
    rules = rules_from(tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True))
    scripts = '\n'.join(s.get_text() for s in soup.find_all('script'))
    return html, soup, rules, scripts

if __name__ == '__main__':
    for p in sorted(glob.glob(_os.path.join(TEMPLATE_DIR, 'template-*.html'))):
        html, soup, rules, scripts = load(p)
        print(os.path.basename(p), len(rules), 'rules', len(scripts), 'js chars')
