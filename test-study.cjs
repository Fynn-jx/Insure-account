const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const K=require('./study-core.js');
const base=JSON.parse(fs.readFileSync(__dirname+'/data/course.json','utf8')).chapterMaps;
const empty=()=>({version:1,edits:{},additions:[]});
const rng=()=>.31;

test('八章均可出题，题目来自原小节且保留图谱结构',()=>{
  const before=JSON.stringify(base);
  for(const chapter of base){
    const q=K.createQuiz(chapter,{count:10,random:rng});
    assert.ok(q.questions.length>0);
    assert.ok(q.questions.length<=10);
    assert.equal(new Set(q.questions.map(q=>q.nodeId)).size,q.questions.length);
    assert.ok(K.validQuiz(q,chapter));
    for(const s of chapter.children){const one=K.createQuiz(chapter,{scopeId:s.id,count:20,strategy:'all',random:rng});assert.ok(one.questions.every(q=>q.sectionId===s.id));}
  }
  assert.equal(JSON.stringify(base),before);
});
test('答案检查区分正确、错误、未填；错题重练只包含未掌握的空位',()=>{
  const q=K.createQuiz(base[2],{random:rng});
  assert.equal(K.checkQuiz(q).empty,q.questions.length);
  K.assignWord(q,q.questions[0].id,q.questions[0].term);
  const wrong=q.questions.find(x=>x.term!==q.questions[1].term&&x.id!==q.questions[0].id);
  if(wrong){K.assignWord(q,q.questions[1].id,wrong.term);assert.equal(K.checkQuiz(q).wrong,1);}
  assert.equal(K.checkQuiz(q).correct,1);
  const retry=K.retryWrong(q);
  assert.ok(!retry.questions.some(x=>x.id===q.questions[0].id));
  assert.deepEqual(retry.answers,{});
  for(const item of retry.questions)K.assignWord(retry,item.id,item.term);
  assert.equal(K.checkQuiz(retry).correct,retry.questions.length);
});
test('重复词条按次数分配，不能超用，清除后重新可用',()=>{
  const q={questions:[{id:'a',term:'合同服务边际'},{id:'b',term:'合同服务边际'},{id:'c',term:'履约现金流量'}],answers:{}};
  K.assignWord(q,'a','合同服务边际');K.assignWord(q,'b','合同服务边际');
  assert.equal(K.wordBank(q).find(w=>w.term==='合同服务边际').remaining,0);
  assert.throws(()=>K.assignWord(q,'c','合同服务边际'));
  delete q.answers.a;assert.equal(K.wordBank(q).find(w=>w.term==='合同服务边际').remaining,1);
});
test('目标词与较长词重叠时，目标空位仍然出现；重复答案全部隐藏',()=>{
  const q={questions:[{id:'x',nodeId:'x',term:'保险服务收入'},{id:'y',nodeId:'y',term:'保险服务收入确认'}]};
  const text='保险服务收入确认，应按保险服务收入计算';
  const ranges=K.maskRanges(text,q,'x');
  assert.equal(ranges.filter(r=>r.questionId==='x').length,1);
  assert.equal(ranges.filter(r=>text.slice(r.start,r.end)==='保险服务收入').length,2);
});
test('长词条不跨行拆开；空框容纳完整答案，即使填入的词比预期更长',()=>{
  const text='计量使用非金融风险调整完成',ranges=[{start:4,end:11,questionId:'q1'}];
  const expected='非金融风险调整',answer='保险获取现金流量资产';
  const lines=K.layoutMasked(text,ranges,70,s=>[...s].length*14,()=>answer);
  const blanks=lines.flatMap(l=>l.runs).filter(r=>r.kind==='mask');
  assert.equal(blanks.length,1);assert.equal(blanks[0].text,expected);assert.equal(blanks[0].value,answer);
  assert.ok(blanks[0].width>=answer.length*14+12);
  assert.ok(lines.every(l=>l.width===l.runs.reduce((sum,r)=>sum+r.width,0)));
  assert.ok(!blanks[0].value.includes('…'));
});
test('自动词库不把利润分配的序号当作答案',()=>{
  const n={label:'第一：弥补以前年度亏损',note:'',key:true};assert.notEqual(K.termFor(n),'第一');
  assert.equal(K.termFor({label:'划分看实质',note:'不以合同期限长短作为唯一标准。'}),'合同期限');
});
test('个人编辑、新增子节点与备份往返不改变8章32节，原始数据不被改写',()=>{
  const before=JSON.stringify(base),node=K.flatten(base).find(x=>!x.node.children?.length).node;
  const p=empty();p.edits[node.id]={label:node.label,note:'个人说明：以履约现金流量理解这一点。',key:true,practiceTerm:'履约现金流量'};
  p.additions.push({id:'user-12345678',parentId:node.id,label:'个人例子',note:'保险风险需要从保单持有人转移。',practiceTerm:'保险风险',key:true});
  const roundTrip=JSON.parse(JSON.stringify(K.validatePersonal(p,base)));
  const trees=K.applyPersonal(base,roundTrip),all=K.flatten(trees);
  assert.equal(trees.length,8);assert.equal(trees.reduce((n,c)=>n+c.children.length,0),32);
  assert.equal(all.find(x=>x.node.id==='user-12345678').parent.id,node.id);
  assert.equal(all.find(x=>x.node.id===node.id).node.note,p.edits[node.id].note);
  assert.equal(JSON.stringify(base),before);
});
test('无效关键词、循环层级、改写原章节目次的备份会被拒绝',()=>{
  const p=empty();p.additions=[{id:'user-12345678',parentId:'user-87654321',label:'一',note:''},{id:'user-87654321',parentId:'user-12345678',label:'二',note:''}];assert.throws(()=>K.validatePersonal(p,base));
  const bad=empty();bad.edits[base[0].id]={label:'新章节',note:''};assert.throws(()=>K.validatePersonal(bad,base));
  const badTerm=empty();badTerm.additions=[{id:'user-12345678',parentId:base[0].children[0].id,label:'个人例子',note:'说明',practiceTerm:'不存在的词'}];assert.throws(()=>K.validatePersonal(badTerm,base));
});
test('八章的三档梯度均能出满10／20／25空，进阶包含更多条件并有干扰词',()=>{
  for(const chapter of base)for(const [level,cfg] of Object.entries(K.LEVELS)){
    const quiz=K.createQuiz(chapter,{difficulty:level,random:rng});
    assert.equal(quiz.questions.length,cfg.count,chapter.title+level);
    assert.ok(K.validQuiz(quiz,chapter));
    assert.equal(new Set(quiz.questions.map(q=>q.id)).size,cfg.count);
    const owners=new Map();for(const q of quiz.questions){const group=owners.get(q.nodeId)||[];assert.ok(!group.some(a=>q.start<a.end&&q.end>a.start));group.push(q);owners.set(q.nodeId,group);}
    for(const [nodeId,questions] of owners){const node=K.flatten([chapter]).find(x=>x.node.id===nodeId).node;const ranges=K.maskRanges(K.content(node),quiz,nodeId);for(const q of questions)assert.equal(ranges.filter(r=>r.questionId===q.id).length,1);}
    if(level==='basic')assert.equal(quiz.distractors.length,0);
    else{assert.ok(quiz.distractors.length>=3);assert.ok(quiz.questions.filter(q=>q.detail||q.kind!=='concept').length>=10);}
  }
});
test('进阶干扰词可选且词条可复用，不会因剩余次数暴露答案',()=>{
  const quiz=K.createQuiz(base[0],{difficulty:'advanced',random:rng});const decoy=quiz.distractors[0];assert.ok(decoy);
  for(const q of quiz.questions)K.assignWord(quiz,q.id,decoy);
  assert.equal(K.checkQuiz(quiz).correct,0);assert.ok(K.validQuiz(quiz,base[0]));
});
test('强化必须全部完成才能提交，重复订正与错题轮不会刷成首次达标',()=>{
  const quiz=K.createQuiz(base[2],{difficulty:'mastery',random:rng});assert.equal(K.canCheck(quiz),false);assert.throws(()=>K.submitQuiz(quiz));
  for(const q of quiz.questions)K.assignWord(quiz,q.id,q.term);
  K.assignWord(quiz,quiz.questions[0].id,quiz.distractors[0]);K.submitQuiz(quiz);assert.equal(quiz.firstAttempt.correct,24);
  K.assignWord(quiz,quiz.questions[0].id,quiz.questions[0].term);assert.equal(quiz.checked,false);K.submitQuiz(quiz);
  assert.equal(quiz.firstAttempt.correct,24);assert.ok(!K.roundStatus(quiz).includes('本轮达标'));
  const perfect=K.createQuiz(base[2],{difficulty:'mastery',random:rng});for(const q of perfect.questions)K.assignWord(perfect,q.id,q.term);K.submitQuiz(perfect);assert.ok(K.roundStatus(perfect).includes('首次全对'));
  const retry=K.retryWrong(quiz);retry.firstAttempt={correct:25,total:25,empty:0};assert.ok(!K.roundStatus(retry).includes('本轮达标'));
});
test('小节内容不足目标空数时不复制填充，也不计为整章达标',()=>{
  const section=base[0].children[0],quiz=K.createQuiz(base[0],{difficulty:'mastery',scopeId:section.id,random:rng});
  assert.ok(quiz.questions.every(q=>q.sectionId===section.id));assert.ok(quiz.questions.length<=25);assert.equal(new Set(quiz.questions.map(q=>q.id)).size,quiz.questions.length);
});
