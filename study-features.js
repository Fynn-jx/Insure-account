window.installStudyFeatures = function(app) {
  'use strict';
  const K=window.StudyCore,$=app.$,esc=app.esc;
  const PERSONAL_KEY='insurance-personal-v1',HISTORY_KEY='insurance-edit-history-v1',QUIZ_KEY='insurance-quiz-v1';
  const empty=()=>({version:1,edits:{},additions:[]});
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  let saved=true,quizSaved=true,personal=empty(),history=read(HISTORY_KEY,[]),sessions=read(QUIZ_KEY,{}),quiz=null,editing=null,bankURL=null,svgURL=null;
  if(!Array.isArray(history))history=[];
  if(!sessions||typeof sessions!=='object'||Array.isArray(sessions))sessions={};
  function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  try{personal=K.validatePersonal(read(PERSONAL_KEY,empty()),app.base);}catch{app.toast('本地编辑记录无法读取，原始导图仍可使用。');}
  app.setTrees(K.applyPersonal(app.base,personal));
  function status(){return saved?'已保存在当前浏览器':'保存失败：请导出备份，本次修改仅在当前页面有效';}
  function personalStatus(){const el=$('personalStatus');if(el)el.textContent=`${Object.keys(personal.edits).length} 个节点修改 · ${personal.additions.length} 个新增 · ${status()}`;}
  function saveSession(){if(quiz){sessions[quiz.chapterId]=quiz;sessions[quiz.chapterId+'@'+(quiz.difficulty||'basic')]=quiz;quizSaved=store(QUIZ_KEY,sessions);}}
  function changePersonal(next,message,record=true){
    const validated=K.validatePersonal(next,app.base),trees=K.applyPersonal(app.base,validated);
    if(record){history.push(K.clone(personal));history=history.slice(-20);}
    personal=validated;saved=store(PERSONAL_KEY,personal);store(HISTORY_KEY,history);
    sessions=Object.fromEntries(Object.entries(sessions).filter(([id,q])=>{const ch=trees.find(c=>c.id===q?.chapterId);return ch&&K.validQuiz(q,ch);}));quiz=null;store(QUIZ_KEY,sessions);
    const selected=app.selected();app.setTrees(trees);app.refresh(selected);personalStatus();
    app.toast(saved?message:'修改已应用，但浏览器保存失败，请立即导出备份。');
  }
  function isPractice(){return app.mode()==='practice';}
  function makeQuiz(){
    const chapter=app.chapter();quiz=K.createQuiz(chapter,{scopeId:$('quizScope').value||chapter.id,difficulty:$('quizDifficulty').value});
    updateDifficulty();
    quiz.wordOrder=K.shuffled(K.wordBank(quiz).map(w=>w.term));saveSession();
  }
  function updateDifficulty(){const level=K.LEVELS[$('quizDifficulty').value]||K.LEVELS.basic;let label=level.count+'空';if(quiz){const actual=quiz.questions.length;if(quiz.retry)label=actual+'个错题';else if(actual!==level.count)label=quiz.version===1?actual+'空（原进度）':actual+'/'+level.count+'空';}$('quizTarget').textContent=label;$('difficultyHint').textContent=level.description;}
  function navigate(){
    const chapter=app.chapter();
    $('quizScope').innerHTML=`<option value="${chapter.id}">本章全部小节</option>`+chapter.children.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('');
    const cached=sessions[chapter.id];quiz=K.validQuiz(cached,chapter)?cached:null;
    if(quiz){$('quizScope').value=quiz.scopeId;$('quizDifficulty').value=quiz.difficulty||'basic';}
    updateDifficulty();
    if(isPractice()&&!quiz)makeQuiz();
    personalStatus();
  }
  function modeChanged(){
    const active=isPractice();$('workspace').classList.toggle('is-practicing',active);$('practiceControls').hidden=!active;$('practicePanel').hidden=!active;
    $('keyOnly').disabled=active;$('sourceBtn').hidden=active;$('editToolbar').hidden=active;$('search').disabled=active;$('exportBtn').hidden=active;
    $('mapHelp').textContent=active?'点击带编号的空位，再点击词库填入。':'拖动或缩放查看 · 点词条回查原页 · 点圆点收起';
    if(active){app.clearFilter();app.closePanel();if(!quiz)makeQuiz();}
    personalStatus();
  }
  function grade(id){return quiz?.checked?K.checkQuiz(quiz).results.find(r=>r.id===id)?.status||'empty':'';}
  function practiceLayout(n,ctx){
    if(!isPractice()||!quiz)return null;
    const ranges=K.maskRanges(n.content,quiz,n.id);if(!ranges.length)return null;
    return K.layoutMasked(n.content,ranges,n.width-6,t=>ctx.measureText(t).width,r=>{
      if(!r.questionId)return '···';const q=quiz.questions.find(q=>q.id===r.questionId);
      return quiz.revealed?q.term:quiz.answers[q.id]||String(q.number).padStart(2,'0');
    });
  }
  function renderPracticeNode(n,top,fontFamily,ctx){
    if(!n.practiceLines)return null;
    const parts=[];
    n.practiceLines.forEach((line,lineNo)=>{
      let x=n.x;const y=top+lineNo*(n.font+3);
      for(const run of line.runs){
        if(run.kind==='text')parts.push(`<text class="node-text" x="${x}" y="${y}" font-family='${fontFamily}' font-size="${n.font}" font-weight="${n.weight}">${esc(run.text)}</text>`);
        else if(run.range.questionId){
          const q=quiz.questions.find(q=>q.id===run.range.questionId),value=quiz.revealed?q.term:quiz.answers[q.id]||'',state=grade(q.id);
          parts.push(`<g class="quiz-blank ${quiz.active===q.id?'active':''} ${state} ${quiz.revealed?'revealed':''}" data-blank="${q.id}" tabindex="0" role="button" aria-label="第${q.number}空${value?'，已填'+esc(value):'，未填'}"><title>第${q.number}空${value?'：'+esc(value):'，点击选择'}</title><rect x="${x}" y="${y-n.font-1}" width="${run.width}" height="${n.font+5}" rx="3"/><text x="${x+run.width/2}" y="${y-1}" text-anchor="middle" font-family='${fontFamily}' font-size="${n.font}" font-weight="${n.weight}">${esc(run.value)}</text></g>`);
        }else parts.push(`<g class="related-mask" aria-label="已隐藏关联词条"><rect x="${x}" y="${y-n.font}" width="${run.width}" height="${n.font+3}" rx="2"/><text x="${x+run.width/2}" y="${y-1}" text-anchor="middle" font-size="11">···</text></g>`);
        x+=run.width;
      }
    });return parts.join('');
  }
  function maskedText(n){let text=K.content(n);for(const r of K.maskRanges(text,quiz,n.id).slice().reverse())text=text.slice(0,r.start)+(r.questionId?'待填空位':'…')+text.slice(r.end);return text;}
  function focusActive(){
    if(!isPractice()||!quiz?.active)return;
    const q=quiz.questions.find(q=>q.id===quiz.active);if(!q)return;
    app.revealNode(q.nodeId);
    const blank=$('mapSizer').querySelector(`[data-blank="${q.id}"]`);if(!blank)return;
    const box=blank.getBBox(),v=$('mapView'),scale=app.scale();
    v.scrollTop=Math.max(0,box.y*scale-v.clientHeight/2);v.scrollLeft=Math.max(0,box.x*scale-v.clientWidth*.35);
  }
  function selectBlank(id){if(!quiz?.questions.some(q=>q.id===id))return;quiz.active=id;saveSession();app.render();focusActive();}
  function nodeClick(id){if(!isPractice())return false;const q=quiz?.questions.find(q=>q.nodeId===id);if(q)selectBlank(q.id);else app.toast('点击编号空位作答；查看原文可切回思维导图。');return true;}
  function renderPanel(){
    personalStatus();if(!isPractice()||!quiz)return;updateDifficulty();
    const total=quiz.questions.length,filled=Object.keys(quiz.answers).length;
    $('quizProgress').textContent=`${filled} / ${total} 已填`;
    $('quizEmpty').hidden=total>0;$('quizBody').hidden=total===0;
    if(!total){$('quizEmpty').textContent='这个范围暂无可用挖空词，可选择本章，或在节点编辑中设置关键词。';return;}
    const current=quiz.questions.find(q=>q.id===quiz.active)||quiz.questions[0];quiz.active=current.id;
    $('activeBlank').textContent=`当前：第 ${current.number} 空`;
    $('quizNumbers').innerHTML=quiz.questions.map(q=>`<button data-select-blank="${q.id}" class="${q.id===quiz.active?'active':''} ${grade(q.id)} ${quiz.answers[q.id]?'filled':''}" aria-label="定位第${q.number}空" aria-pressed="${q.id===quiz.active}">${String(q.number).padStart(2,'0')}</button>`).join('');
    const words=K.wordBank(quiz),order=quiz.wordOrder||words.map(w=>w.term);words.sort((a,b)=>order.indexOf(a.term)-order.indexOf(b.term));
    const advanced=K.difficulty(quiz).reuseWords;
    $('wordBank').innerHTML=words.map(w=>`<button data-word="${esc(w.term)}" ${(!advanced&&w.remaining<=0)||quiz.revealed?'disabled':''} title="${advanced?'点击填入当前空位':'剩余'+w.remaining+'次'}">${esc(w.term)}${!advanced&&w.count>1?`<small>×${w.remaining}</small>`:''}</button>`).join('');
    const activeNumber=$('quizNumbers').querySelector('.active');if(activeNumber)$('quizNumbers').scrollLeft=Math.max(0,activeNumber.offsetLeft-$('quizNumbers').clientWidth/2+activeNumber.clientWidth/2);
    $('clearBlank').disabled=!quiz.answers[quiz.active]||quiz.revealed;
    $('checkQuiz').disabled=!K.canCheck(quiz);$('revealQuiz').disabled=!quiz.checked||quiz.revealed;
    const result=K.checkQuiz(quiz);$('retryWrong').hidden=!quiz.checked||(!result.wrong&&!result.empty);$('retryWrong').textContent=result.wrong?'重练错题':'重练未填';
    const summary=$('quizMessage');summary.className='quiz-message';
    if(quiz.checked){summary.classList.add('graded');summary.textContent=`正确 ${result.correct}/${result.total} · 错误 ${result.wrong} · 未填 ${result.empty}${quiz.revealed?' · 已显示答案':''}${quiz.version!==1&&quiz.firstAttempt?' · 首次 '+quiz.firstAttempt.correct+'/'+quiz.firstAttempt.total:''} ${K.roundStatus(quiz)}`;}
    else summary.textContent=(K.difficulty(quiz).requireComplete?'强化需全部填完后检查。':'先点空位，再点词库。')+(advanced?'词库含干扰项，词条可重复使用。':'填入后自动定位下一空。')+(total<quiz.count?'当前范围仅可出'+total+'空，可选本章练满'+quiz.count+'空。':'');
    if(!quizSaved)summary.textContent+=' 本轮进度未能保存，关闭页面后可能丢失。';
  }
  $('wordBank').addEventListener('click',e=>{const b=e.target.closest('[data-word]');if(!b)return;try{K.assignWord(quiz,quiz.active,b.dataset.word);const next=quiz.questions.find(q=>!quiz.answers[q.id]);if(next)quiz.active=next.id;saveSession();app.render();focusActive();}catch(err){app.toast(err.message);}});
  $('quizNumbers').addEventListener('click',e=>{const b=e.target.closest('[data-select-blank]');if(b)selectBlank(b.dataset.selectBlank);});
  $('clearBlank').addEventListener('click',()=>{delete quiz.answers[quiz.active];if(K.difficulty(quiz).reuseWords)quiz.checked=false;saveSession();app.render();focusActive();});
  $('checkQuiz').addEventListener('click',()=>{try{K.submitQuiz(quiz);}catch(err){app.toast(err.message);return;}saveSession();app.render();const first=K.checkQuiz(quiz).results.find(q=>q.status!=='correct');if(first)selectBlank(first.id);});
  $('revealQuiz').addEventListener('click',()=>{quiz.revealed=true;saveSession();app.render();focusActive();});
  $('retryWrong').addEventListener('click',()=>{quiz=K.retryWrong(quiz);quiz.wordOrder=K.shuffled(K.wordBank(quiz).map(w=>w.term));saveSession();app.render();focusActive();});
  $('resetQuiz').addEventListener('click',()=>{quiz.answers={};quiz.checked=false;quiz.revealed=false;quiz.active=quiz.questions[0]?.id||null;saveSession();app.render();focusActive();});
  function fresh(){makeQuiz();app.render();app.fitWidth();focusActive();}
  $('newQuiz').addEventListener('click',fresh);$('quizScope').addEventListener('change',fresh);
  $('quizDifficulty').addEventListener('change',()=>{const level=$('quizDifficulty').value,scope=$('quizScope').value;saveSession();const cached=sessions[app.chapter().id+'@'+level];if(K.validQuiz(cached,app.chapter())&&cached.scopeId===scope){quiz=cached;updateDifficulty();saveSession();app.render();focusActive();}else fresh();});
  function detailsActions(n){const root=n.id.startsWith('chapter');return `<div class="node-edit-actions"><button data-edit-node="${n.id}">修改${root?'章节说明':'内容'}</button><button data-add-node="${n.id}">＋ 新增${root?'小节内内容':'子节点'}</button>${n.origin==='personal'?'<span>个人补充</span>':n.personallyEdited?'<span>已编辑</span>':''}</div>`;}
  function openEditor(kind,id){
    if(isPractice()){app.toast('请先切回思维导图，再编辑内容。');return;}
    let node=app.nodes().get(id)||app.chapter().children[0];if(kind==='add'&&node.id.startsWith('chapter'))node=app.chapter().children[0];
    editing={kind,id:node.id};const locked=kind==='edit'&&(node.id.startsWith('chapter')||/^c\d+s\d+$/.test(node.id));
    $('editorHeading').textContent=kind==='add'?'新增导图内容':'修改导图内容';
    $('editorContext').textContent=kind==='add'?`在“${node.label||node.title}”下增加子节点`:`位置：${app.trail(node).join(' / ')||'章节说明'}`;
    $('editorParentRow').hidden=kind!=='add';
    $('editorParent').innerHTML=K.flatten([app.chapter()]).filter(x=>!x.node.id.startsWith('chapter')).map(x=>`<option value="${x.node.id}">${esc((x.section&&x.section!==x.node?x.section.label+' / ':'')+(x.node.label||x.node.title))}</option>`).join('');
    $('editorParent').value=node.id;
    $('editorLabel').value=kind==='add'?'':node.label||node.title;$('editorLabel').readOnly=locked;
    $('editorLocked').hidden=!locked;$('editorNote').value=kind==='add'?'':node.note&&node.note!==node.label?node.note:'';
    $('editorKey').checked=kind==='add'?false:!!node.key;
    $('editorPractice').checked=kind==='add'?true:node.practiceEnabled!==false;
    $('editorTerm').value=kind==='add'?'':node.practiceTerm||'';
    $('editorPracticeFields').hidden=locked;$('editorError').textContent='';$('editorDialog').showModal();
  }
  $('detailContent').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-node]'),add=e.target.closest('[data-add-node]');if(edit)openEditor('edit',edit.dataset.editNode);if(add)openEditor('add',add.dataset.addNode);});
  $('addContent').addEventListener('click',()=>openEditor('add',app.selected()||app.chapter().children[0].id));
  $('closeEditor').addEventListener('click',()=>$('editorDialog').close());$('cancelEditor').addEventListener('click',()=>$('editorDialog').close());
  $('editorForm').addEventListener('submit',e=>{
    e.preventDefault();if(!$('editorForm').reportValidity())return;
    const value={label:$('editorLabel').value.trim(),note:$('editorNote').value.trim(),key:$('editorKey').checked,practiceEnabled:$('editorPractice').checked,practiceTerm:$('editorTerm').value.trim()};
    if(value.practiceTerm&&!K.content(value).includes(value.practiceTerm)){$('editorError').textContent='挖空词必须出现在标题或说明中，请修改后再保存。';return;}
    const next=K.clone(personal);let target=editing.id;
    if(editing.kind==='add'){const uuid=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);target='user-'+uuid;next.additions.push({id:target,parentId:$('editorParent').value,...value});}
    else if(next.additions.some(n=>n.id===editing.id))Object.assign(next.additions.find(n=>n.id===editing.id),value);
    else next.edits[editing.id]=value;
    try{changePersonal(next,editing.kind==='add'?'已新增内容，并保存到当前浏览器。':'内容已更新，并保存到当前浏览器。');$('editorDialog').close();app.showNode(target);app.focusNode(target);}catch(err){$('editorError').textContent=err.message;}
  });
  function prepareBackup(){
    if(bankURL)URL.revokeObjectURL(bankURL);
    bankURL=URL.createObjectURL(new Blob([JSON.stringify({format:'insurance-study-personal',exportedAt:new Date().toISOString(),personal},null,2)],{type:'application/json'}));
    $('backupDownload').href=bankURL;$('backupDownload').download='保险会计学-个人编辑备份.json';
  }
  function openManager(){personalStatus();$('undoEdit').disabled=!history.length;$('importError').textContent='';prepareBackup();$('personalDialog').showModal();}
  $('manageEdits').addEventListener('click',openManager);$('closePersonal').addEventListener('click',()=>$('personalDialog').close());
  $('undoEdit').addEventListener('click',()=>{if(!history.length)return;const previous=history[history.length-1];try{K.validatePersonal(previous,app.base);history.pop();changePersonal(previous,'已撤销上一次内容编辑。',false);$('undoEdit').disabled=!history.length;prepareBackup();}catch(err){$('importError').textContent=err.message;}});
  $('importBackup').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('备份文件超过8MB。');const data=JSON.parse(await file.text());if(data.format!=='insurance-study-personal')throw Error('请选择本系统导出的个人编辑JSON备份。');changePersonal(data.personal,'已导入个人编辑备份，可撤销本次导入。');prepareBackup();$('undoEdit').disabled=!history.length;$('importError').textContent='导入成功。';}catch(err){$('importError').textContent=err.message;}finally{e.target.value='';}});
  $('exportBtn').addEventListener('click',()=>{
    if(svgURL)URL.revokeObjectURL(svgURL);const old=app.dimensions();const text=app.exportSVG();app.restoreDimensions(old);
    svgURL=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));$('exportBtn').href=svgURL;$('exportBtn').download=(app.chapter().title||'保险会计学导图')+'.svg';
  });
  return {navigate,modeChanged,isPractice,practiceLayout,renderPracticeNode,maskedText,focusActive,selectBlank,nodeClick,renderPanel,detailsActions};
};
