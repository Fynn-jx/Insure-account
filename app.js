(() => {
  'use strict';
  let C = window.COURSE;
  const BASE = C.chapterMaps;
  let features = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const all = new Map(), sectionFor = new Map(), parentFor = new Map();
  function index(n, sec, parent = null) {
    all.set(n.id, n); sectionFor.set(n.id, sec); if (parent) parentFor.set(n.id, parent);
    (n.children || []).forEach(c => index(c, sec, n));
  }
  C.chapterMaps.forEach(s => index(s, s));
  const safeLoad = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const safeSave = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  let current = 0, mode = 'map', scale = .9, selected = null, collapsed = new Set();
  let dim = {width:1100, height:700}, keyOnly = false;
  const favorites = new Set(safeLoad('insurance-chapter-favorites', []));
  const opened = new Set([1]);
  const sec = () => C.chapterMaps[current];
  let toastTimer;
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 2300); }
  function renderCatalog() {
    $('courseCount').textContent = `${C.chapters.length}章 · ${C.sections.length}节`;
    $('catalog').innerHTML = C.chapters.map((title, i) => `<div class="chapter-group ${opened.has(i+1)?'open':''}"><button class="chapter-toggle ${sec().chapter===i+1?'current-chapter':''}" data-chapter="${i+1}" aria-expanded="${opened.has(i+1)}"><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span class="chapter-name">${esc(title)}</span><span class="chevron">⌄</span></button><div class="chapter-sections">${C.sections.filter(s => s.chapter===i+1).map(s => `<button class="section-link ${selected===s.id?'active':''}" data-section="${s.id}"><span class="section-index">${String(s.number).padStart(2,'0')}</span><span>${esc(s.title)}</span></button>`).join('')}</div></div>`).join('');
  }
  $('catalog').addEventListener('click', e => {
    const chapter = e.target.closest('[data-chapter]');
    if (chapter) { go('chapter'+chapter.dataset.chapter); return; }
    const target = e.target.closest('[data-section]'); if (target) { const sn=C.sections.find(s=>s.id===target.dataset.section);go('chapter'+sn.chapter,sn.id); }
  });
  function updateFavorite() { $('favoriteBtn').textContent = favorites.has(sec().id)?'★ 已标记':'☆ 待复习'; $('favoriteBtn').setAttribute('aria-pressed', favorites.has(sec().id)); }
  $('favoriteBtn').addEventListener('click', () => { favorites.has(sec().id)?favorites.delete(sec().id):favorites.add(sec().id); safeSave('insurance-chapter-favorites',[...favorites]); updateFavorite(); renderCatalog(); toast(favorites.has(sec().id)?'已标记，稍后再复习这一章':'已取消待复习标记'); });
  function focusNode(id) {
    const el=$('mapSizer').querySelector(`[data-id="${id}"]`);if(!el)return;
    const v=$('mapView');v.scrollTop=Math.max(0,Number(el.dataset.y)*scale-v.clientHeight/2);v.scrollLeft=Math.max(0,Number(el.dataset.x)*scale-35);
  }
  function go(id, nodeId = null, revealDetail=false) {
    const oldSection=C.sections.find(s=>s.id===id);if(oldSection){nodeId=nodeId||oldSection.id;id='chapter'+oldSection.chapter;}
    const next = C.chapterMaps.findIndex(s => s.id===id); if (next < 0) return;
    current=next;selected=nodeId||sec().children[0].id;collapsed=new Set();opened.clear();opened.add(sec().chapter);
    $('breadcrumb').textContent='课件原章目 / 第'+sec().chapter+'章';
    $('sectionNo').textContent=`CHAPTER ${String(sec().chapter).padStart(2,'0')} · ${sec().children.length} 个原课件小节`;
    $('sectionTitle').textContent=sec().title;
    $('sectionRoute').textContent=`整合课件 P${sec().start}—${sec().end} · `+(sec().handPages.length?`手写稿第 ${sec().handPages.join('、')} 页为底稿，结合课件补全`:'依课件原小节及顺序整理');
    $('sectionPosition').textContent=`${current+1} / ${C.chapterMaps.length}`;
    $('prevBtn').disabled=current===0;$('nextBtn').disabled=current===C.chapterMaps.length-1;
    $('exportBtn').href=`导图导出/${String(sec().chapter).padStart(2,'0')} ${C.chapters[sec().chapter-1]}.svg`;
    closePanel();selected=nodeId||sec().children[0].id;renderCatalog();updateFavorite();features?.navigate();render();fitWidth();focusNode(selected);if(mode==='practice')features.focusActive();
    $('outlineView').scrollTop=0;document.body.classList.remove('nav-open');safeSave('insurance-map-last',sec().id);
    try{history.replaceState(null,'',`#${sec().id}`);}catch{}
    if(revealDetail&&nodeId){if(keyOnly&&!hasKey(all.get(nodeId))){keyOnly=false;$('keyOnly').checked=false;render();}showNode(nodeId);focusNode(nodeId);}
  }
  $('prevBtn').addEventListener('click',()=>current>0&&go(C.chapterMaps[current-1].id));
  $('nextBtn').addEventListener('click',()=>current<C.chapterMaps.length-1&&go(C.chapterMaps[current+1].id));
  function switchMode(next) { mode=next;safeSave('insurance-study-mode',next);features?.modeChanged(); document.querySelectorAll('[data-mode]').forEach(b => {const active=b.dataset.mode===mode; b.classList.toggle('active',active); b.setAttribute('aria-selected',active);}); $('mapView').hidden=mode!=='map'&&mode!=='practice'; $('outlineView').hidden=mode!=='outline'; $('linksView').hidden=mode!=='links'; $('zoomControl').hidden=mode!=='map'&&mode!=='practice'; $('expandBtn').hidden=mode!=='map'&&mode!=='practice';render();if(mode==='practice')features.focusActive(); }
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
  
  $('keyOnly').addEventListener('change', e => { keyOnly=e.target.checked; collapsed.clear(); render(); fitWidth(); });
  $('expandBtn').addEventListener('click', () => { collapsed.clear(); render(); fitWidth(); toast('已展开整章全部分支'); });
  const hasKey = n => !!n && (n.key || (n.children||[]).some(hasKey));
  function visibleTree(n) { if (keyOnly && !hasKey(n)) return null; return {...n,children:collapsed.has(n.id)?[]:(n.children||[]).map(visibleTree).filter(Boolean),wasCollapsed:collapsed.has(n.id)}; }
  function countTree(n) { return 1 + (n.children||[]).reduce((t,c) => t+countTree(c),0); }
  function countKeys(n) { return Number(!!n.key)+(n.children||[]).reduce((t,c)=>t+countKeys(c),0); }
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
  const fontFamily = '"Kaiti SC","STKaiti","KaiTi","PingFang SC",sans-serif';
  function wrap(text, width, size, weight) {
    ctx.font=`${weight} ${size}px ${fontFamily}`;
    const lines=[]; let line='';
    for (const ch of String(text)) { if (ch==='\n') { lines.push(line);line='';continue; } if (line && ctx.measureText(line+ch).width > width) {lines.push(line);line=ch;} else line+=ch; }
    if (line) lines.push(line); return lines.length?lines:[''];
  }
  function layout(root,exportMode=false) {
    const nodes=[],edges=[];let maxRight=0;
    
    function size(n,depth){
      n.children=n.children||[];
      n.depth=depth;n.font=depth===0?23:depth===1?18:depth===2?15:14;n.weight=depth<3?600:400;n.width=depth===0?80:depth===1?180:n.children.length?210:440;
      const label=n.label||n.title;const note=n.note&&n.note!==label?n.note:'';
      n.content=label+(note?'：'+note:'');ctx.font=`${n.weight} ${n.font}px ${fontFamily}`;n.practiceLines=!exportMode?features?.practiceLayout(n,ctx):null;n.lines=n.practiceLines?n.practiceLines.map(line=>line.runs.map(r=>r.text).join('')):wrap(n.content,n.width-6,n.font,n.weight);n.width=Math.max(48,...(n.practiceLines?n.practiceLines.map(line=>line.width+8):n.lines.map(line=>ctx.measureText(line).width+8)));n.selfHeight=n.lines.length*(n.font+3)+5;
      n.children.forEach(c=>size(c,depth+1));
      const gap=depth===0?24:depth===1?10:4;
      n.totalHeight=n.children.length?Math.max(n.selfHeight,n.children.reduce((sum,c)=>sum+c.totalHeight,0)+Math.max(0,n.children.length-1)*gap):n.selfHeight;n.gap=gap;
    }
    size(root,0);
    function position(n,top,x){n.x=x;n.y=top+n.totalHeight/2;nodes.push(n);maxRight=Math.max(maxRight,n.x+n.width+20);const total=n.children.reduce((sum,c)=>sum+c.totalHeight,0)+Math.max(0,n.children.length-1)*n.gap;let at=top+(n.totalHeight-total)/2;for(const c of n.children){position(c,at,n.x+n.width+(n.depth===0?45:32));edges.push([n,c]);at+=c.totalHeight+n.gap;}}
    position(root,24,22);return{nodes,edges,width:maxRight+25,height:root.totalHeight+60};
  }
  function svgMarkup(tree,exportMode=false){
    const l=layout(tree,exportMode);dim={width:l.width,height:l.height};
    const paths=l.edges.map(([a,b])=>{const sx=a.x+a.width+8,tx=b.x-10,mx=sx+(tx-sx)*.36;return `<path class="map-edge ${a.depth<2?'main-edge':''}" d="M ${sx} ${a.y} L ${mx} ${b.y} L ${tx} ${b.y}"/>`;}).join('');
    const nodes=l.nodes.map(n=>{
      const practice=!exportMode&&features?.isPractice();
      const top=n.y-n.selfHeight/2+n.font+3;let remaining=(n.label||n.title).length;
      const markers=n.key&&!practice?n.lines.map((line,i)=>{const part=line.slice(0,Math.max(0,remaining));remaining-=line.length;if(!part)return '';ctx.font=`${n.weight} ${n.font}px ${fontFamily}`;return `<rect class="marker" x="${n.x-2}" y="${top+i*(n.font+3)-n.font*.64}" width="${ctx.measureText(part).width+5}" height="${n.font*.85}" rx="1"/>`;}).join(''):'';
      const painted=practice?features.renderPracticeNode(n,top,fontFamily,ctx):null;
      const safeText=practice?features.maskedText(n):n.content;
      const text=n.lines.map((line,i)=>`<tspan x="${n.x}" y="${top+i*(n.font+3)}">${esc(line)}</tspan>`).join('');
      const original=all.get(n.id),hasChildren=!!original.children?.length;
      const dot=hasChildren&&!exportMode?`<g data-collapse="${n.id}" tabindex="0" role="button" aria-label="${n.wasCollapsed?'展开':'收起'}${esc(practice?safeText:n.label||n.title)}"><circle class="collapse-dot" cx="${n.x+n.width+7}" cy="${n.y}" r="5.5"/><text class="collapse-symbol" text-anchor="middle" x="${n.x+n.width+7}" y="${n.y+3.3}">${n.wasCollapsed?'+':'−'}</text></g>`:'';
      return `<g class="map-node ${n.depth===0?'root':n.depth<3?'branch':'leaf'} ${selected===n.id?'selected':''}" data-id="${n.id}" data-x="${n.x}" data-y="${n.y}" ${exportMode?'':`tabindex="0" role="button" aria-label="${esc(practice?safeText:n.label||n.title)}，${practice?'复习节点':'查看课件依据'}"`}><title>${esc(safeText)}</title><rect class="hit-area" x="${n.x-5}" y="${n.y-n.selfHeight/2}" width="${n.width+10}" height="${n.selfHeight}" rx="3"/>${markers}${painted||`<text class="node-text" font-family='${fontFamily}' font-size="${n.font}" font-weight="${n.weight}">${text}</text>`}${dot}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}" height="${l.height}" viewBox="0 0 ${l.width} ${l.height}" role="group" aria-label="${esc(sec().title)}整章思维导图"><style>.map-edge{fill:none;stroke:#414938;stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round}.main-edge{stroke:#313b2b;stroke-width:1.4}.node-text{fill:#2f382a}.root .node-text{fill:#927715}.marker{fill:#ead05c;opacity:.65}.hit-area{fill:transparent}</style><rect width="100%" height="100%" fill="#fdfcf8"/>${paths}${nodes}</svg>`;
  }
  function renderMap() {
    const tree=visibleTree(sec());
    if(!tree){$('mapSizer').innerHTML='<div class="link-empty">本章暂无单独标记的重点，请取消“只看重点”查看完整结构。</div>';return;}
    $('mapSizer').innerHTML=svgMarkup(tree); applyScale();
  }
  function applyScale(){const svg=$('mapSizer').querySelector('svg');if(!svg)return;svg.style.width=`${dim.width*scale}px`;svg.style.height=`${dim.height*scale}px`;$('mapSizer').style.width=`${dim.width*scale}px`;$('mapSizer').style.height=`${dim.height*scale}px`;$('zoomLabel').textContent=`${Math.round(scale*100)}%`;}
  function setScale(value,center=true){const old=scale;scale=Math.min(2,Math.max(.3,value));const v=$('mapView'),cx=v.scrollLeft+v.clientWidth/2,cy=v.scrollTop+v.clientHeight/2;applyScale();if(center){v.scrollLeft=cx*scale/old-v.clientWidth/2;v.scrollTop=cy*scale/old-v.clientHeight/2;}}
  function fitWidth(){if(mode==='map'||mode==='practice')setScale(Math.min(1,Math.max(.85,($('mapView').clientWidth-35)/dim.width)),false);}
  $('zoomIn').addEventListener('click',()=>setScale(scale+.1));$('zoomOut').addEventListener('click',()=>setScale(scale-.1));
  $('fitBtn').addEventListener('click',()=>{setScale(Math.min(1,($('mapView').clientWidth-25)/dim.width,($('mapView').clientHeight-65)/dim.height),false);$('mapView').scrollLeft=0;$('mapView').scrollTop=0;});
  $('mapSizer').addEventListener('click',e=>{const blank=e.target.closest('[data-blank]');if(blank){features.selectBlank(blank.dataset.blank);return;}const toggle=e.target.closest('[data-collapse]');if(toggle){const id=toggle.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return;}const n=e.target.closest('[data-id]');if(n)showNode(n.dataset.id);});
  $('mapSizer').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const blank=e.target.closest('[data-blank]');if(blank){features.selectBlank(blank.dataset.blank);return;}const toggle=e.target.closest('[data-collapse]');if(toggle){const id=toggle.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return;}const n=e.target.closest('[data-id]');if(n)showNode(n.dataset.id);}});
  let drag=null;
  $('mapView').addEventListener('pointerdown',e=>{if(e.target.closest('[data-id]')||e.button!==0||e.pointerType==='touch')return;drag={x:e.clientX,y:e.clientY,left:$('mapView').scrollLeft,top:$('mapView').scrollTop};$('mapView').setPointerCapture(e.pointerId);$('mapView').classList.add('dragging');});
  $('mapView').addEventListener('pointermove',e=>{if(!drag)return;$('mapView').scrollLeft=drag.left-(e.clientX-drag.x);$('mapView').scrollTop=drag.top-(e.clientY-drag.y);});
  const endDrag=()=>{drag=null;$('mapView').classList.remove('dragging');};$('mapView').addEventListener('pointerup',endDrag);$('mapView').addEventListener('pointercancel',endDrag);
  $('mapView').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setScale(scale+(e.deltaY<0?.06:-.06));}},{passive:false});
  function renderOutline(){const tree=visibleTree(sec());function item(n){return `<li><button class="outline-node ${n.key?'key':''}" data-detail="${n.id}">${esc(n.label||n.title)}</button>${!n.children?.length&&n.pages?.length?`<span class="outline-pages">P${n.pages[0]}${n.pages.length>1?'等':''}</span>`:''}${n.note&&n.note!==n.label?`<div class="outline-note">${esc(n.note)}</div>`:''}${n.children?.length?`<ul>${n.children.map(item).join('')}</ul>`:''}</li>`;}$('outlineView').innerHTML=tree?`<ul>${tree.children.map(item).join('')}</ul>`:'<p class="link-empty">本章暂无单独标记的重点。</p>';}
  $('outlineView').addEventListener('click',e=>{const t=e.target.closest('[data-detail]');if(t)showNode(t.dataset.detail);});
  function renderLinks(){let links=C.links.filter(l=>l.source===sec().id||l.target===sec().id);if(!links.length){$('linksView').innerHTML='<p class="link-empty">本节可结合本章其他小节复习。课程串联仅标出明确的跨节关系；本节的内部结构请查看思维导图。</p>';return;}$('linksView').innerHTML='<p class="links-intro">从当前这一节，回看前面的依据，接上后面的应用。点击卡片可跳到对应导图。</p>'+links.map(l=>{const a=all.get(l.source),b=all.get(l.target);return `<article class="relation-card"><div class="relation-label">${esc(l.label)} →</div>${[a,b].map(s=>`<button data-go="${s.id}" class="${s.id===sec().id?'current':''}"><small>第${s.chapter}章 · 第${s.number}节</small>${esc(s.title)}</button>`).join('')}</article>`;}).join('');}
  $('linksView').addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t)go(t.dataset.go);});
  function render(){if(mode==='map'||mode==='practice')renderMap();else if(mode==='outline')renderOutline();else renderLinks();$('mapStats').textContent=`本章 ${sec().children.length} 节 · ${countTree(sec())-1} 个节点 · ${mode==='practice'?'按原图位置挖空':'正文直接显示'}`;features?.renderPanel();}
  function trail(n){const parts=[];let p=parentFor.get(n.id);while(p){parts.unshift(p.title||p.label);p=parentFor.get(p.id);}return parts;}
  function openSource(pages,initial){const unique=[...new Set(pages)].filter(p=>C.slides[String(p)]);const first=initial||unique[0];$('sourcePages').innerHTML=unique.map(p=>`<button class="page-chip ${p===first?'active':''}" data-page="${p}">${p}</button>`).join('');displaySource(first);}
  function displaySource(page){const s=C.slides[String(page)];if(!s)return;document.querySelectorAll('.page-chip').forEach(c=>c.classList.toggle('active',Number(c.dataset.page)===page));$('sourceBody').innerHTML=`<div class="source-page-title"><span>整合课件 · 第${page}页</span><a href="sources/课件整合版.pdf#page=${page}" target="_blank" rel="noopener">打开课件原页 ↗</a></div>${s.text?`<div class="source-text">${esc(s.text)}</div>`:'<div class="source-image-note">这一页主要是公式、表格或案例图片。请打开课件原页查看完整内容。</div>'}<div class="source-text-note">上方为课件可提取文字。公式、图片表格及未提取出的内容请以课件原页为准。</div>`;}
  function handReference(n){let ref=n;while(ref&&!ref.handPages?.length)ref=parentFor.get(ref.id);if(!ref?.handPages?.length)return '';return `<div class="hand-reference">手写底稿 ${ref.handPages.map(p=>`<a href="sources/handwritten-${p}.jpg" target="_blank" rel="noopener">第${p}页 ↗</a>`).join(' · ')}</div>`;}
  function showNode(id){if(features?.nodeClick(id))return;const n=all.get(id);if(!n)return;selected=id;$('detailPanel').hidden=false;document.body.classList.add('panel-open');const pages=n.pages?.length?n.pages:Array.from({length:sec().end-sec().start+1},(_,i)=>sec().start+i);$('detailContent').innerHTML=`<div class="detail-trail">${esc(trail(n).join(' / ')||C.chapters[sec().chapter-1])}</div>${n.key?'<div class="detail-key">黄色重点 · 建议尝试回忆</div>':''}<h2>${esc(n.label||n.title)}</h2>${features?.detailsActions(n)||''}<div class="detail-note">${esc(n.note||(n.children?.length?'正文已直接展示在导图中，下面用于核对原始资料。':n.label||n.route))}</div>${handReference(n)}<div class="source-heading">${n.origin==='personal'?'个人补充 · 关联课件仅供回查':'课件依据 · 点击页码切换'}</div><div class="page-chips" id="sourcePages"></div><div id="sourceBody"></div>`;openSource(pages);$('detailPanel').scrollTop=0;if(mode==='map')renderMap();}
  $('detailContent').addEventListener('click',e=>{const p=e.target.closest('[data-page]');if(p)displaySource(Number(p.dataset.page));});
  function closePanel(){$('detailPanel').hidden=true;document.body.classList.remove('panel-open');selected=null;}
  $('closePanel').addEventListener('click',()=>{closePanel();if(mode==='map')renderMap();});
  $('sourceBtn').addEventListener('click',()=>showNode(sec().id));
  let searchTimer;
  function search(){const q=$('search').value.trim().toLowerCase();if(!q){$('searchResults').hidden=true;return;}const hits=[...all.values()].filter(n=>!n.title&&(n.label+' '+(n.note||'')).toLowerCase().includes(q));$('searchResults').hidden=false;$('searchResults').innerHTML=`<div class="search-count">${hits.length} 个相关词条${hits.length>60?'，显示前60个':''}</div>`+hits.slice(0,60).map(n=>{const s=sectionFor.get(n.id);return `<button class="search-result" data-hit="${n.id}">${esc(n.label)}<small>第${s.chapter}章 · ${esc(s.title)}</small></button>`;}).join('');}
  $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,120);});
  $('searchResults').addEventListener('click',e=>{const t=e.target.closest('[data-hit]');if(!t)return;const s=sectionFor.get(t.dataset.hit);$('searchResults').hidden=true;go(s.id,t.dataset.hit,true);});
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')&&!e.target.closest('.search-results'))$('searchResults').hidden=true;});
  $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
  $('menuBtn').addEventListener('click',()=>document.body.classList.toggle('nav-open'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('searchResults').hidden=true;document.body.classList.remove('nav-open');if(!$('detailPanel').hidden){closePanel();if(mode==='map')renderMap();}}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('editorDialog').open&&!$('personalDialog').open&&!e.ctrlKey&&!e.metaKey){e.preventDefault();$('search').focus();}});
  window.addEventListener('resize',()=>{if(mode==='map'||mode==='practice')applyScale();});
  features = window.installStudyFeatures({
    $,esc,base:BASE,toast,chapter:sec,nodes:()=>all,parentFor,trail,mode:()=>mode,selected:()=>selected,scale:()=>scale,
    setTrees(trees){C={...C,chapterMaps:trees,sections:trees.flatMap(c=>c.children)};all.clear();parentFor.clear();sectionFor.clear();trees.forEach(c=>index(c,c));},
    refresh(id){go(sec().id,all.has(id)?id:sec().children[0].id);},render,fitWidth,focusNode,showNode,closePanel,
    clearFilter(){keyOnly=false;$('keyOnly').checked=false;},
    revealNode(id){let n=all.get(id);while(n){collapsed.delete(n.id);n=parentFor.get(n.id);}renderMap();},
    dimensions:()=>({...dim}),restoreDimensions(value){dim=value;},exportSVG(){return svgMarkup(JSON.parse(JSON.stringify(sec())),true);}
  });
  const initial=location.hash.slice(1)||safeLoad('insurance-map-last',C.chapterMaps[0].id);go(C.chapterMaps.some(s=>s.id===initial)||C.sections.some(s=>s.id===initial)?initial:C.chapterMaps[0].id);
  const rememberedMode=safeLoad('insurance-study-mode','map');if(['practice','outline'].includes(rememberedMode))switchMode(rememberedMode);
})();
