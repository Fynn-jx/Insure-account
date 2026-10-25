(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const content = n => (n.label || n.title || '') + (n.note && n.note !== (n.label || n.title) ? '：' + n.note : '');
  const normalize = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').trim();
  function flatten(roots) {
    const out=[];
    function visit(n,parent=null,chapter=null,section=null) {
      if(n.id.startsWith('chapter')) chapter=n;
      if(/^c\d+s\d+$/.test(n.id)) section=n;
      out.push({node:n,parent,chapter,section});
      (n.children||[]).forEach(c=>visit(c,n,chapter,section));
    }
    roots.forEach(n=>visit(n));return out;
  }
  function validatePersonal(raw, base) {
    if(!raw || raw.version!==1 || !raw.edits || typeof raw.edits!=='object' || Array.isArray(raw.edits) || !Array.isArray(raw.additions)) throw Error('不是有效的导图编辑备份。');
    const baseNodes=new Map(flatten(base).map(x=>[x.node.id,x.node]));
    const ids=new Set(baseNodes.keys()), additions=[], edits=Object.create(null);
    if(raw.additions.length>5000 || Object.keys(raw.edits).length>10000) throw Error('备份内容过多，请分批导入。');
    function fields(v) {
      if(!v || typeof v.label!=='string' || !v.label.trim() || v.label.length>500 || typeof v.note!=='string' || v.note.length>6000) throw Error('节点标题或说明格式不正确。');
      if(v.practiceTerm!=null && (typeof v.practiceTerm!=='string'||v.practiceTerm.length>150)) throw Error('挖空词格式不正确。');
      const o={label:v.label.trim(),note:v.note.trim(),key:!!v.key,practiceEnabled:v.practiceEnabled!==false,practiceTerm:(v.practiceTerm||'').trim()};
      if(o.practiceTerm&&!content(o).includes(o.practiceTerm)) throw Error('挖空词必须出现在该节点的标题或说明中。');
      return o;
    }
    for(const n of raw.additions){
      if(!n || typeof n.id!=='string' || !/^user-[a-z0-9-]{8,80}$/.test(n.id) || ids.has(n.id) || typeof n.parentId!=='string') throw Error('新增节点编号有误或重复。');
      ids.add(n.id);additions.push({id:n.id,parentId:n.parentId,...fields(n)});
    }
    const added=new Map(additions.map(n=>[n.id,n]));
    for(const n of additions){
      let p=n.parentId;const seen=new Set([n.id]);let depth=0;
      while(added.has(p)){if(seen.has(p)||++depth>20)throw Error('节点不能形成循环或过深的层级。');seen.add(p);p=added.get(p).parentId;}
      if(!baseNodes.has(p)||p.startsWith('chapter')) throw Error('新增内容必须附在现有小节或知识节点下。');
    }
    for(const [id,v] of Object.entries(raw.edits)){
      if(!ids.has(id))throw Error('备份含有无法对应的节点。');
      const f=fields(v), original=baseNodes.get(id);
      if(original && (original.id.startsWith('chapter')||/^c\d+s\d+$/.test(id)) && f.label!==(original.label||original.title)) throw Error('原有章、节标题须保持不变，请在说明或子节点中补充。');
      edits[id]=f;
    }
    return {version:1,edits,additions};
  }
  function applyPersonal(base, raw) {
    const p=validatePersonal(raw,base), trees=clone(base), nodes=new Map(flatten(trees).map(x=>[x.node.id,x.node]));
    const pending=p.additions.slice();
    while(pending.length){
      const i=pending.findIndex(n=>nodes.has(n.parentId));if(i<0)throw Error('新增节点缺少上级。');
      const a=pending.splice(i,1)[0], parent=nodes.get(a.parentId);
      const pages=/^c\d+s\d+$/.test(parent.id)&&Number.isInteger(parent.start)&&Number.isInteger(parent.end)?Array.from({length:parent.end-parent.start+1},(_,i)=>parent.start+i):parent.pages||[];
      const n={...a,origin:'personal',pages:clone(pages),children:[]};delete n.parentId;
      (parent.children||(parent.children=[])).push(n);nodes.set(n.id,n);
    }
    for(const [id,edit] of Object.entries(p.edits)){Object.assign(nodes.get(id),edit,{personallyEdited:true});}
    return trees;
  }
  const TERMS = [
    '保险获取现金流量资产','分保摊回未到期责任资产','分保摊回已发生赔款资产','未到期责任负债','已发生赔款负债',
    '非金融风险调整','保险获取现金流量','合同服务边际','履约现金流量','保险服务收入','保险服务费用','保险服务业绩',
    '分出保费的分摊','摊回保险服务费用','保险财务费用','保险财务收入','其他综合收益','保费分配法','浮动收费法','通用模型',
    '重大保险风险','保险风险','金融风险','合同边界','投资成分','实际资本','最低资本','认可资产','认可负债','偿付能力',
    '预期信用损失','信用减值损失','实际利率法','摊余成本','公允价值','长期股权投资','投资性房地产','权益法','成本法',
    '保费准备金','利润准备金','一般风险准备','所有者权益','法定盈余公积','净投资收益','总投资收益','综合投资收益',
    '投资收益','留存收益','保单质押贷款','持续经营','准备金','再保险净费用','所有者投入资本','向所有者分配利润',
    '履约进展','超额承保利润','权益变动','净利润','利润总额','营业利润','现金净流入','现金净流出','保险合同组合','保险合同组',
    '相似风险','统一管理','资金运动','投资者','债权人','通用财务会计','合同期限','可比性','结合观','分离观','IFRS 17','IFRS 4',
    'GAAP','SAP','GMM','PAA','VFA','FVOCI','FVTPL','CSM','SPPI','ECL'
  ].sort((a,b)=>b.length-a.length);
  function termFor(n) {
    if(n.practiceEnabled===false)return null;
    const text=content(n);
    if(n.practiceTerm) return text.includes(n.practiceTerm)?n.practiceTerm:null;
    if(n.children?.length)return null;
    const label=n.label||n.title||'';
    let t=TERMS.find(w=>label.includes(w));
    if(t)return t;
    const short=label.replace(/^[一二三四五六七八九十\d]+[、.．]\s*/,'').replace(/^第[一二三四五六七八九十\d]+[：:]\s*/,'').split(/[：:]/)[0].trim();
    if(short.length>=2&&short.length<=24&&!/看实质|特殊方法的目的|其他比较维度|回查|见第|见书|案例|完整分录|原课件|具体计算|明确区分时|条件一|条件二|第一步|第二步|第三步/.test(short)&&!/[＝=＋+÷×→]/.test(short))return short;
    return TERMS.find(w=>text.includes(w))||null;
  }
  function candidatePool(chapter, scopeId, strategy='key') {
    return flatten([chapter]).filter(x=>!x.node.id.startsWith('chapter')&&!/^c\d+s\d+$/.test(x.node.id))
      .filter(x=>!scopeId||scopeId===chapter.id||x.section?.id===scopeId)
      .filter(x=>strategy!=='key'||x.node.key||x.node.practiceTerm)
      .map(x=>({nodeId:x.node.id,sectionId:x.section?.id||'',term:termFor(x.node)})).filter(x=>x.term);
  }
  function shuffled(array, random=Math.random) {const a=array.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const LEVELS={
    basic:{name:'基础',count:10,perNode:1,detailShare:0,distractorShare:0,reuseWords:false,requireComplete:false,passRate:.9,description:'核心概念 · 次数提示 · 首次填全且正确率≥90%达标'},
    advanced:{name:'进阶',count:20,perNode:2,detailShare:.6,distractorShare:.25,reuseWords:true,requireComplete:false,passRate:.9,description:'条件与公式 · 同类干扰词 · 无次数提示 · 首次填全且正确率≥90%达标'},
    mastery:{name:'强化',count:25,perNode:3,detailShare:.76,distractorShare:.45,reuseWords:true,requireComplete:true,passRate:1,description:'细节与多空关系 · 更多干扰词 · 填完统一检查 · 首次全对达标'}
  };
  const DETAIL_TERMS=[
    '无偏的概率加权平均值','保险责任单元','货币时间价值','现金流量特征','实质性权利和义务','实质性义务','重大额外金额','商业实质',
    '条款调整权','保障的连续性','经济实质','不确定性','重大保险风险','非高度关联','高度关联','单独计量','单独获益','同时失效',
    '初始确认','后续计量','未来服务','当期服务','过去服务','未赚利润','首日亏损','现金净流入','现金净流出','不超过一年','一年以上',
    '当期损益','其他综合收益','留存收益','不得转回','不得撤销','不可撤销','先转回亏损','计入损益','冲减服务费用','终止确认',
    '公允价值模式','成本模式','实际利率','摊余成本','账面余额','账面价值','账面净资产','可辨认净资产','净变现价值',
    '共同控制','重大影响','持续经营假设','准清算观念','收取合同现金流量','出售金融资产','预期信用损失',
    '死亡风险','疾病风险','失效风险','费用风险','一般运营风险','置信水平法','条件尾部期望法','自下而上法','自上而下法',
    '法定盈余公积','一般风险准备','超额承保利润','可明确区分','不可明确区分','权责发生制','概率加权平均值',
    '净利得','净成本','不履约风险','比例再保险','非比例再保险','保费净额','分保比例','孰晚','孰早','最早时点','较晚的时点',
    '资本性支出','收益性支出','偿付性支出','专属费用','共同费用','直接归属','维持费用','获取费用','费用分摊结转',
    '销售、核保和承保','销售、核保、承保','保费经验调整','保险合同负债','金融资产','精算','系统合理',
    ...TERMS
  ].filter((t,i,a)=>a.indexOf(t)===i).sort((a,b)=>b.length-a.length);
  function difficulty(quiz){return LEVELS[quiz?.difficulty]||LEVELS.basic;}
  function levelCandidates(chapter,scopeId,level='basic'){
    const pool=[];
    for(const row of flatten([chapter])){
      const n=row.node;if(n.id.startsWith('chapter')||/^c\d+s\d+$/.test(n.id)||n.practiceEnabled===false)continue;
      if(scopeId&&scopeId!==chapter.id&&row.section?.id!==scopeId)continue;
      if(n.children?.length&&!n.practiceTerm&&!n.note)continue;
      const text=content(n),label=n.label||n.title||'',labelLength=label.length,seen=new Map();
      function add(term,start,kind,score){
        if(!term||start<0||!text.startsWith(term,start)||term.length>150)return;
        const q={nodeId:n.id,sectionId:row.section?.id||'',term,start,end:start+term.length,kind,detail:start>=labelLength+1,score:score+(n.key?3:0)+(n.practiceTerm===term?6:0)},old=seen.get(term);
        if(old){if(q.detail&&!old.detail||q.score>old.score)Object.assign(old,q);return;}
        seen.set(term,q);pool.push(q);
      }
      const main=termFor(n),mainKind=level==='basic'?'concept':/[＝=＋+÷×－−]/.test(text)?'formula':/条件|不得|不应|仅|至少|超过|低于|高于|先|相同|一致|确认|摊销|分配|偿还|归属/.test(label)?'condition':'concept';
      if(main)add(main,text.indexOf(main),mainKind,n.key||n.practiceTerm?10:3);
      if(level==='basic')continue;
      if(/回查|完整分录|见书|原页|具体计算及图表/.test(label)&&!n.practiceTerm)continue;
      for(const term of DETAIL_TERMS){
        const inNote=text.indexOf(term,labelLength+1),start=inNote>=0?inNote:text.indexOf(term);
        if(start<0)continue;
        const rule=/服务|确认|转回|撤销|亏损|关联|实质|计量|控制|影响|风险|单独|失效|利润|单元|现金流|损益|权益/.test(term);
        const kind=/[＝=＋+÷×－−]/.test(text)?'formula':rule?'condition':'concept';
        add(term,start,kind,(start>labelLength?10:3)+(rule?3:0));
      }
      if(/比例|计提|期限|责任期|年度|年份|曲线|超过|低于|不超过|准备金|历史|沿革|利率/.test(text)){
        for(const m of text.matchAll(/[0-9０-９]+(?:\.[0-9]+)?[％%](?:[—～~至-][0-9０-９]+(?:\.[0-9]+)?[％%])?|(?:不超过)?[一二三四五六七八九十0-9]+(?:[—～~至-][0-9]+)?年(?:以上|以内|以下)?/g))add(m[0],m.index,'number',12);
      }
    }
    return pool;
  }
  function selectCandidates(pool,chapter,count,level,random){
    const config=LEVELS[level],chosen=[],used=new Map(),order=new Map(flatten([chapter]).map((x,i)=>[x.node.id,i]));
    const ranked=shuffled(pool,random).map(q=>({...q,tie:random()})).sort((a,b)=>b.score-a.score||a.tie-b.tie);
    function fits(q){const same=used.get(q.nodeId)||[];return same.length<config.perNode&&chosen.filter(x=>x.term===q.term).length<2&&!same.some(x=>q.start<x.end&&q.end>x.start);}
    function take(candidates,target){
      const groups=new Map();for(const q of candidates){const g=groups.get(q.sectionId)||[];g.push(q);groups.set(q.sectionId,g);}
      let progress=true;while(chosen.length<target&&progress){progress=false;for(const group of groups.values()){
        while(group.length){const q=group.shift();if(chosen.some(x=>x.nodeId===q.nodeId&&x.start===q.start)||!fits(q))continue;
          if(q.kind==='number'&&chosen.filter(x=>x.kind==='number').length>=Math.ceil(count*.2))continue;
          chosen.push(q);const same=used.get(q.nodeId)||[];same.push(q);used.set(q.nodeId,same);progress=true;break;
        }if(chosen.length>=target)break;
      }}
    }
    if(level!=='basic')take(ranked.filter(q=>q.detail||q.kind==='condition'||q.kind==='formula'),Math.round(count*config.detailShare));
    take(ranked.filter(q=>q.kind==='concept'),count);
    take(ranked,count);
    return chosen.sort((a,b)=>order.get(a.nodeId)-order.get(b.nodeId)||a.start-b.start);
  }
  function createQuiz(chapter, {scopeId=chapter.id,count,strategy='key',difficulty:level,random=Math.random}={}) {
    level=LEVELS[level]?level:'basic';const config=LEVELS[level];count=count||config.count;
    const pool=levelCandidates(chapter,scopeId,level);
    if(level==='basic'&&strategy==='all')pool.forEach(q=>q.score=3);
    const chosen=selectCandidates(pool,chapter,count,level,random);
    const questions=chosen.map((q,i)=>({...q,id:q.nodeId+'::'+q.start,number:i+1}));
    const answers=new Set(questions.map(q=>q.term));
    const confusables=[['GAAP','SAP'],['保险风险','金融风险'],['公允价值','摊余成本','账面价值','账面余额'],['成本法','权益法'],['保险服务收入','保险服务费用','保险财务收入','保险财务费用'],['合同服务边际','非金融风险调整','履约现金流量'],['未来服务','当期服务','过去服务'],['保费准备金','利润准备金','一般风险准备'],['当期损益','其他综合收益','留存收益'],['净利得','净成本'],['资本性支出','收益性支出','偿付性支出'],['专属费用','共同费用']];
    const chapterText=flatten([chapter]).map(x=>content(x.node)).join(' '),related=new Set(confusables.filter(group=>group.some(t=>answers.has(t))).flat());
    const options=shuffled([...new Set([...pool.map(q=>q.term),...related])].filter(t=>!answers.has(t)&&t.length<=30&&chapterText.includes(t)),random);
    options.sort((a,b)=>Number(related.has(b))-Number(related.has(a)));
    const distractors=level==='basic'?[]:options.slice(0,Math.ceil(answers.size*config.distractorShare));
    return {version:2,difficulty:level,chapterId:chapter.id,scopeId,count,strategy,questions,distractors,answers:{},active:questions[0]?.id||null,checked:false,revealed:false,attempts:0,firstAttempt:null};
  }
  function checkQuiz(quiz) {
    const results=quiz.questions.map(q=>({id:q.id,number:q.number,status:!quiz.answers[q.id]?'empty':normalize(quiz.answers[q.id])===normalize(q.term)?'correct':'wrong'}));
    return {results,total:results.length,correct:results.filter(x=>x.status==='correct').length,wrong:results.filter(x=>x.status==='wrong').length,empty:results.filter(x=>x.status==='empty').length};
  }
  function wordBank(quiz) {
    const words=new Map();for(const q of quiz.questions)words.set(q.term,(words.get(q.term)||0)+1);
    for(const term of quiz.distractors||[])if(!words.has(term))words.set(term,0);
    return [...words].map(([term,count])=>({term,count,remaining:count-Object.values(quiz.answers).filter(a=>a===term).length}));
  }
  function assignWord(quiz,id,term) {
    if(quiz.revealed)throw Error('答案已显示，请重练或换一组后作答。');
    if(!quiz.questions.some(q=>q.id===id))throw Error('请先选择一个空位。');
    if(!wordBank(quiz).some(w=>w.term===term&&(difficulty(quiz).reuseWords||w.remaining>0||quiz.answers[id]===term)))throw Error('该词条已用完，可先清除或替换已有答案。');
    quiz.answers[id]=term;if(difficulty(quiz).reuseWords)quiz.checked=false;return quiz;
  }
  function canCheck(quiz){return !!quiz.questions.length&&!quiz.revealed&&(!difficulty(quiz).requireComplete||quiz.questions.every(q=>!!quiz.answers[q.id]));}
  function submitQuiz(quiz){
    if(!canCheck(quiz))throw Error('强化练习需要全部填完后统一检查。');
    const result=checkQuiz(quiz);quiz.attempts=(quiz.attempts||0)+1;if(!quiz.firstAttempt)quiz.firstAttempt={correct:result.correct,total:result.total,empty:result.empty};quiz.checked=true;return result;
  }
  function roundStatus(quiz){
    const first=quiz.firstAttempt;if(!first)return '';
    if(quiz.version===1)return '旧版进度已保留；换一组后使用新的难度规则。';
    if(quiz.retry)return '错题巩固轮；换一组后再检验整档掌握。';
    const config=difficulty(quiz),full=first.total>=config.count,passed=first.empty===0&&first.correct/first.total>=config.passRate;
    if(!full)return '本轮为小范围练习，建议选本章完成整档题量。';
    if(passed)return config===LEVELS.mastery?'强化首次全对，本轮达标。':`${config.name}首次达标，可尝试下一难度。`;
    return '已记录首次成绩；订正后建议换一组检验。';
  }
  function retryWrong(quiz) {
    const result=checkQuiz(quiz), ids=new Set(result.results.filter(x=>x.status!=='correct').map(x=>x.id));
    return {...quiz,questions:quiz.questions.filter(q=>ids.has(q.id)).map((q,i)=>({...q,number:i+1})),answers:{},active:quiz.questions.find(q=>ids.has(q.id))?.id||null,checked:false,revealed:false,attempts:0,firstAttempt:null,retry:true};
  }
  function validQuiz(quiz,chapter) {
    if(!quiz||![1,2].includes(quiz.version)||quiz.chapterId!==chapter.id||!Array.isArray(quiz.questions)||!quiz.questions.length||quiz.questions.length>50||!quiz.answers||typeof quiz.answers!=='object')return false;
    const nodes=new Map(flatten([chapter]).map(x=>[x.node.id,x.node]));const seen=new Set();
    for(const q of quiz.questions){if(!q||seen.has(q.id)||typeof q.term!=='string'||!q.term||!nodes.has(q.nodeId)||!content(nodes.get(q.nodeId)).includes(q.term))return false;if(quiz.version===1&&q.id!==q.nodeId)return false;if(quiz.version===2&&(!Number.isInteger(q.start)||q.start<0||q.id!==q.nodeId+'::'+q.start||!content(nodes.get(q.nodeId)).startsWith(q.term,q.start)))return false;seen.add(q.id);}
    if(quiz.version===2&&(!LEVELS[quiz.difficulty]||!Array.isArray(quiz.distractors)||!quiz.distractors.every(t=>typeof t==='string'&&t.length<=80)))return false;
    const bank=wordBank({...quiz,answers:{}});return Object.entries(quiz.answers).every(([id,value])=>seen.has(id)&&bank.some(w=>w.term===value))&&(difficulty(quiz).reuseWords||wordBank(quiz).every(w=>w.remaining>=0));
  }
  function maskRanges(text,quiz,nodeId) {
    if(!quiz)return [];
    const terms=[...new Set(quiz.questions.map(q=>q.term))].sort((a,b)=>b.length-a.length), candidates=[];
    const own=quiz.questions.filter(q=>q.nodeId===nodeId);
    for(const q of own){const at=Number.isInteger(q.start)?q.start:text.indexOf(q.term);if(at>=0&&text.startsWith(q.term,at)&&!candidates.some(r=>at<r.end&&at+q.term.length>r.start))candidates.push({start:at,end:at+q.term.length,questionId:q.id});}
    for(const term of terms){let from=0;while(from<text.length){const start=text.indexOf(term,from);if(start<0)break;const end=start+term.length;if(!candidates.some(r=>start<r.end&&end>r.start))candidates.push({start,end,questionId:null});from=end;}}
    return candidates.sort((a,b)=>a.start-b.start);
  }
  function layoutMasked(text,ranges,maxWidth,measure,valueForRange) {
    const lines=[];let line={runs:[],width:0};
    const flush=()=>{if(line.runs.length)lines.push(line);line={runs:[],width:0};};
    function plain(char){
      if(char==='\n'){flush();return;}
      let last=line.runs[line.runs.length-1],delta=last?.kind==='text'?measure(last.text+char)-last.width:measure(char);
      if(line.runs.length&&line.width+delta>maxWidth){flush();last=null;delta=measure(char);}
      if(last?.kind==='text'){last.text+=char;last.width+=delta;}else line.runs.push({kind:'text',text:char,width:delta});
      line.width+=delta;
    }
    let at=0;
    for(const range of ranges){
      for(const char of text.slice(at,range.start))plain(char);
      const source=text.slice(range.start,range.end),value=valueForRange(range),padding=range.questionId?12:4;
      const width=Math.max(measure(source),measure(value))+padding;
      if(line.runs.length&&line.width+width>maxWidth)flush();
      line.runs.push({kind:'mask',range,text:source,value,width});line.width+=width;at=range.end;
    }
    for(const char of text.slice(at))plain(char);flush();return lines;
  }
  return {clone,content,normalize,flatten,validatePersonal,applyPersonal,termFor,candidatePool,LEVELS,difficulty,levelCandidates,createQuiz,checkQuiz,wordBank,assignWord,canCheck,submitQuiz,roundStatus,retryWrong,validQuiz,maskRanges,layoutMasked,shuffled};
});
