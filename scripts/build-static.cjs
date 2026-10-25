const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const entries = [
  'index.html',
  'style.css',
  'app.js',
  'study-core.js',
  'study-features.js',
  'data/course.js',
  'sources/课件整合版.pdf',
  '导图导出',
  '手写稿识别校对与补全.txt',
  '按章导图完整大纲.txt',
  '使用说明.txt',
  '打开复习系统.html'
];

// Only these learning resources are published; authoring scripts and raw OCR are excluded.
for (const entry of entries) {
  if (!fs.existsSync(path.join(root, entry))) throw new Error(`缺少上线文件：${entry}`);
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const entry of entries) {
  const destination = path.join(output, entry);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(root, entry), destination, { recursive: true });
}
console.log('静态站点已生成到 public/，包括导图、挖空复习、离线入口与原页资料。');
