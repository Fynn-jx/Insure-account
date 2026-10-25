"""更新资源指纹并打包可直接双击打开的HTML。"""
from pathlib import Path
import hashlib,re
ROOT=Path(__file__).resolve().parent
p=ROOT/'index.html';text=p.read_text()
for file,attr in [('style.css','href'),('data/course.js','src'),('study-core.js','src'),('study-features.js','src'),('app.js','src')]:
    stamp=hashlib.sha256((ROOT/file).read_bytes()).hexdigest()[:10]
    text=re.sub(rf'{attr}="{re.escape(file)}(?:\?v=[^"]*)?"',f'{attr}="{file}?v={stamp}"',text)
p.write_text(text)
standalone=re.sub(r'<link rel="stylesheet" href="style.css[^\"]*">',lambda m:'<style>'+(ROOT/'style.css').read_text()+'</style>',text)
for file in ['data/course.js','study-core.js','study-features.js','app.js']:
    standalone=re.sub(rf'<script src="{re.escape(file)}[^\"]*"></script>',lambda m,f=file:'<script>'+(ROOT/f).read_text().replace('</script','<\\/script')+'</script>',standalone)
(ROOT/'打开复习系统.html').write_text(standalone)
print('已更新资源指纹及离线入口。')
