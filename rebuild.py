"""从人工校对结构重建数据、整章SVG与离线页面。"""
import subprocess
import sys
from pathlib import Path
root=Path(__file__).resolve().parent
for filename in ['build_data.py','build_chapters.py','export_chapters.py','bundle.py']:
    subprocess.run([sys.executable,str(root/filename)],cwd=root,check=True)
legacy=root/'逐节导图大纲.txt'
if legacy.exists():
    backup=root.parent/'tmp/initial-section-exports'
    backup.mkdir(exist_ok=True)
    legacy.replace(backup/legacy.name)
