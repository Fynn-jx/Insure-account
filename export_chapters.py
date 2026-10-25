"""按原有8个大章节导出密排SVG，小节保留在章内。"""
import copy, html, json, unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DATA=json.loads((ROOT/'data/course.json').read_text())
OUT=ROOT/'导图导出';OUT.mkdir(exist_ok=True)
ARCHIVE=ROOT.parent/'tmp/initial-section-exports';ARCHIVE.mkdir(exist_ok=True)
for old in OUT.glob('*-*.svg'):old.rename(ARCHIVE/old.name)

def width(text,size):
    return sum(size*(1 if unicodedata.east_asian_width(c) in ('W','F') else .64) for c in text)
def wrap(text,limit,size):
    lines=[];line=''
    for ch in text:
        if ch=='\n' or line and width(line+ch,size)>limit:
            lines.append(line);line=''
        if ch!='\n':line+=ch
    if line:lines.append(line)
    return lines or ['']

def render(chapter):
    tree=copy.deepcopy(chapter);nodes=[];edges=[]
    def measure(n,depth):
        n['depth']=depth;n['font']=23 if depth==0 else 18 if depth==1 else 15 if depth==2 else 14
        label=n.get('label',n.get('title',''));note=n.get('note','');n['content']=label+('：'+note if note and note!=label else '')
        limit=80 if depth==0 else 180 if depth==1 else 210 if n.get('children') else 440
        n['lines']=wrap(n['content'],limit-8,n['font']);n['width']=max(48,max(width(line,n['font']) for line in n['lines'])+10)
        n['own']=len(n['lines'])*(n['font']+3)+5
        for c in n.get('children',[]):measure(c,depth+1)
        n['gap']=24 if depth==0 else 10 if depth==1 else 4
        children=n.get('children',[])
        n['height']=max(n['own'],sum(c['height'] for c in children)+max(0,len(children)-1)*n['gap'])
    measure(tree,0)
    def place(n,top,x):
        n['x']=x;n['y']=top+n['height']/2;nodes.append(n)
        children=n.get('children',[]);total=sum(c['height'] for c in children)+max(0,len(children)-1)*n['gap'];at=top+(n['height']-total)/2
        for c in children:
            place(c,at,x+n['width']+(45 if n['depth']==0 else 32));edges.append((n,c));at+=c['height']+n['gap']
    place(tree,105,22)
    w=max(n['x']+n['width'] for n in nodes)+40;h=tree['height']+165;esc=html.escape
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
      '<style>text{font-family:"Kaiti SC","STKaiti","KaiTi","PingFang SC",sans-serif;fill:#303a2c}.edge{fill:none;stroke:#424b37;stroke-width:1.1;stroke-linejoin:round;stroke-linecap:round}</style>',
      '<rect width="100%" height="100%" fill="#fdfcf8"/>',
      f'<text x="22" y="31" font-size="24" font-weight="600">{esc(chapter["title"])}</text>',
      f'<text x="22" y="58" font-size="11" fill="#869178">保持课件原章、节、目顺序 · 本章{len(chapter["children"])}节 · 课件P{chapter["start"]}—{chapter["end"]}</text>']
    if chapter['handPages']:parts.append(f'<text x="22" y="80" font-size="11" fill="#869178">手写底稿：第{"、".join(map(str,chapter["handPages"]))}页；经识别、对照原图和课件校对，补全未覆盖内容。</text>')
    for a,b in edges:
        sx=a['x']+a['width']+7;tx=b['x']-9;mx=sx+(tx-sx)*.36
        parts.append(f'<path class="edge" d="M {sx} {a["y"]} L {mx} {b["y"]} L {tx} {b["y"]}"/>')
    for n in nodes:
        x=n['x'];y=n['y']-n['own']/2+n['font']+3;left=len(n.get('label',n.get('title','')))
        for i,line in enumerate(n['lines']):
            part=line[:max(0,left)];left-=len(line)
            if n.get('key') and part:parts.append(f'<rect x="{x-2}" y="{y+i*(n["font"]+3)-n["font"]*.64}" width="{width(part,n["font"])+5}" height="{n["font"]*.85}" fill="#ead05c" opacity=".65"/>')
            parts.append(f'<text x="{x}" y="{y+i*(n["font"]+3)}" font-size="{n["font"]}" font-weight="{600 if n["depth"]<3 else 400}">{esc(line)}</text>')
    parts.append(f'<text x="22" y="{h-20}" font-size="10" fill="#97a087">黄色为重点；公式、图片表格与案例条件可回查系统内课件原页。</text></svg>')
    return '\n'.join(parts),w,h

links=[];stats=[]
for chapter in DATA['chapterMaps']:
    name=f'{chapter["chapter"]:02d} {DATA["chapters"][chapter["chapter"]-1]}.svg'
    svg,w,h=render(chapter);(OUT/name).write_text(svg)
    links.append(f'<li><a href="{html.escape(name,quote=True)}">{html.escape(chapter["title"])}</a><small>{len(chapter["children"])}个原课件小节</small></li>')
    stats.append({'chapter':chapter['chapter'],'width':round(w),'height':round(h)})
(OUT/'全部导图.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>保险会计学 · 8章完整导图</title><style>body{max-width:850px;margin:40px auto;padding:0 25px;background:#fbfaf5;color:#36432e;font-family:sans-serif}h1{font-size:25px}p,li{font-size:14px;line-height:2}a{color:#536d42}li{margin:15px 0}small{display:block;color:#8a947c;font-size:11px}</style><h1>保险会计学 · 按章完整导图</h1><p>8章、32节，保留原课件结构和顺序。前3章以6页手写稿为底稿校对和补全。正文、条件、公式直接显示；点击章节可缩放阅读或保存SVG。</p><ol>'+''.join(links)+'</ol></html>')
print(json.dumps(stats,ensure_ascii=False))
