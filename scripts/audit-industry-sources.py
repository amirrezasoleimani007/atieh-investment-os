"""Compare published narrative and embedded chart values with the five supplied decks.
Usage: python scripts/audit-industry-sources.py /path/to/source/decks
"""
import hashlib,json,sys
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'public/data/industry-markets.json').read_text())
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart'}
for m in data:
 p=Path(sys.argv[1])/m['source']['file']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==m['source']['sha256'],p.name+' changed'
 with ZipFile(p) as z:
  slide=E.fromstring(z.read('ppt/slides/slide1.xml'))
  paras=[''.join(t.text or '' for t in q.findall('.//a:t',ns)) for q in slide.findall('.//a:p',ns)]
  paras=[t for t in paras if t and t!='1'][1:]
  assert paras==[p['text'] for p in m['paragraphs']],m['id']+' narrative mismatch'
  if m['id']=='welded':
   r=E.fromstring(z.read('ppt/charts/chart1.xml'))
   vals=[[float(v.text) for v in s.findall('./c:val/c:numRef/c:numCache/c:pt/c:v',ns)] for s in r.findall('.//c:ser',ns)]
   assert vals==[[2705,1755,280],[310]],vals
 print(m['id'],len(paras),'paragraphs match exactly')
print('PASS: five sources match; welded chart values verified against embedded chart cache')
