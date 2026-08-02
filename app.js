(function(){
"use strict";
const CH = window.CHAPTERS || [];
const QZ = window.QUESTIONS || {};
const DECKS = window.CARDS || {};
const KEY = "glx.v1";

/* ---------------- storage ---------------- */
function load(){ try{return JSON.parse(localStorage.getItem(KEY))||{ch:{}};}catch(e){return {ch:{}};} }
function save(s){ localStorage.setItem(KEY, JSON.stringify(s)); }
let store = load();
function chRec(id){ if(!store.ch[id]) store.ch[id]={studySec:0,visits:0,attempts:[],lastVisit:0}; if(!store.ch[id].wrong) store.ch[id].wrong=[]; return store.ch[id]; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i];a[i]=a[j];a[j]=t; } return a; }

/* ---------------- helpers ---------------- */
const $ = (s,r=document)=>r.querySelector(s);
const main = $("#main");
function fmtTime(sec){
  sec=Math.round(sec||0);
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  if(h) return h+"时"+m+"分";
  if(m) return m+"分"+s+"秒";
  return s+"秒";
}
function fmtDate(ts){ const d=new Date(ts); const p=n=>String(n).padStart(2,"0");
  return (d.getMonth()+1)+"/"+d.getDate()+" "+p(d.getHours())+":"+p(d.getMinutes()); }
function esc(t){return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(t){return esc(t).replace(/"/g,"&quot;");}
function lessonCount(id){ return chQuestions(id).length; }
function bestScore(id){ const a=(store.ch[id]||{}).attempts||[]; if(!a.length) return null;
  return Math.max(...a.map(x=>x.correct/x.total)); }
function isDone(id){ const r=store.ch[id]; if(!r) return false;
  const hasQ=lessonCount(id)>0; if(hasQ) return (r.attempts||[]).some(a=>a.correct/a.total>=0.6);
  return r.studySec>=120; }

/* color markers inside lesson html */
function decorate(html){
  return html
   .replace(/(例[：:])/g,'<span class="ex">$1</span>')
   .replace(/(注意[：:]?)/g,'<span class="warn">$1</span>')
   .replace(/(误[：:])/g,'<span class="err">$1</span>')
   .replace(/(核心规则[：:]?)/g,'<span style="color:var(--blue)">$1</span>');
}

/* ---------------- study timer ---------------- */
let timer = {id:null, type:null, chId:null, dKey:null, start:0, acc:0};
function startTimer(chId){
  stopTimer();
  timer.type='chapter'; timer.chId=chId; timer.start=Date.now();
  const rec=chRec(chId); rec.visits++; rec.lastVisit=Date.now(); save(store);
  timer.id=setInterval(()=>{
    if(document.hidden) return;
    const now=Date.now(); const dt=(now-timer.start)/1000; timer.start=now;
    chRec(timer.chId).studySec += dt;
    const el=$("#live-timer"); if(el) el.textContent=fmtTime(chRec(timer.chId).studySec);
    timer._tick=(timer._tick||0)+1;
    if(timer._tick%10===0) save(store);
  },1000);
}
function startDailyTimer(dKey){
  stopTimer();
  timer.type='daily'; timer.dKey=dKey; timer.start=Date.now();
  const saved=dstore.days[dKey];
  const acc=(saved&&saved.studySec)?saved.studySec:0;
  timer.id=setInterval(()=>{
    if(document.hidden) return;
    const now=Date.now(); const dt=(now-timer.start)/1000; timer.start=now;
    const el=$("#live-timer"); if(el) el.textContent=fmtTime(acc+dt);
  },1000);
}
function flushTimer(){
  if(timer.type==='chapter'&&timer.chId){
    if(!document.hidden){ const now=Date.now(); chRec(timer.chId).studySec+=(now-timer.start)/1000; timer.start=now; }
  }
}
function stopTimer(){ if(timer.id){ flushTimer(); clearInterval(timer.id); save(store);} timer.id=null; timer.chId=null; }
document.addEventListener("visibilitychange",()=>{ if(document.hidden) flushTimer(); else timer.start=Date.now(); });
window.addEventListener("beforeunload",()=>{ stopTimer(); });

/* ---------------- sidebar nav ---------------- */
function buildNav(){
  const nav=$("#chapter-nav"); nav.innerHTML="";
  const groups={};
  CH.forEach(c=>{ (groups[c.part]=groups[c.part]||[]).push(c); });
  Object.keys(groups).forEach(part=>{
    const ph=document.createElement("div"); ph.className="nav-part";
    ph.textContent = part==="导读"?"导读":(part==="附录 (Appendix)"?"附录速查":part.replace(/\s*\(.*\)/,""));
    nav.appendChild(ph);
    groups[part].forEach(c=>{
      const it=document.createElement("div"); it.className="nav-item"; it.dataset.id=c.id;
      const done=isDone(c.id);
      it.innerHTML=`<span class="nav-num">${c.num||""}</span><span class="nav-tt">${shortTitle(c.title)}</span><span class="nav-dot ${done?'done':''}">${done?'✓':'·'}</span>`;
      it.onclick=()=>go(c.id);
      nav.appendChild(it);
    });
  });
}
function shortTitle(t){ return t.replace(/\s*\(.*?\)\s*/g,"").trim()||t; }
function highlightNav(id){ document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.id===id)); }

/* ---------------- routing ---------------- */
function go(id){ stopTimer(); location.hash="#/ch/"+id; }
function goHome(){ stopTimer(); location.hash="#/home"; }
window.addEventListener("hashchange",route);
function route(){
  const h=location.hash||"#/home";
  closeSidebar();
  if(h.startsWith("#/game")){ renderGame(); return; }
  if(h.startsWith("#/exam/full")){ renderExamSetup("full"); return; }
  if(h.startsWith("#/exam/simple")){ renderExamSetup("simple"); return; }
  if(h.startsWith("#/vocab/ielts-topic/plan/")){ const parts=h.split("/"); renderVocabIeltsTopicPlan(decodeURIComponent(parts[4])); return; }
  if(h.startsWith("#/vocab/ielts-topic/spell/")){ const parts=h.split("/"); renderVocabIeltsTopicSpell(decodeURIComponent(parts[4])); return; }
  if(h.startsWith("#/vocab/ielts-topic/")){ const parts=h.split("/"); renderVocabIeltsTopicStudy(decodeURIComponent(parts[3])); return; }
  if(h.startsWith("#/vocab/topic/")){ const parts=h.split("/"); openIeltsTopic(decodeURIComponent(parts[3])); return; }
  if(h.startsWith("#/vocab/ielts-topic")){ renderVocabIeltsTopic(); return; }
  if(h.startsWith("#/vocab/overview/")){ renderVocabOverview(decodeURIComponent(h.split("/")[3])); return; }
  if(h.startsWith("#/vocab/search")){ renderVocabSearch(); return; }
  if(h.startsWith("#/vocab/books")){ const parts=h.split("/"); renderWordbookBrowse(parts[3]?decodeURIComponent(parts[3]):null, parts[4]?decodeURIComponent(parts[4]):null); return; }
  if(h.startsWith("#/vocab/book-export/")){ const parts=h.split("/"); const id=decodeURIComponent(parts[3]); wbEnsureLoaded(id, s=>renderWordbookExport(s)); return; }
  if(h.startsWith("#/vocab/book/")){ const parts=h.split("/"); openWordbook(decodeURIComponent(parts[3])); return; }
  if(h.startsWith("#/vocab/study")){ renderVocabStudy(); return; }
  if(h.startsWith("#/vocab/review")){ renderVocabReview(); return; }
  if(h.startsWith("#/vocab/more")){ renderVocabMore(); return; }
  if(h.startsWith("#/vocab/records")){ const parts=h.split("/"); renderVocabRecords(parts[3]?decodeURIComponent(parts[3]):null); return; }
  if(h.startsWith("#/vocab/home")){ renderVocabHome(); return; }
  if(h.startsWith("#/vocab")){ renderVocabPicker(); return; }
  if(h.startsWith("#/daily/")){ const p=h.split("/"); if(p.length>=5){ renderDailyDay(decodeURIComponent(p[2]),decodeURIComponent(p[3]),decodeURIComponent(p[4])); return; } }
  if(h.startsWith("#/daily")){ const p=h.split("/"); renderDailyHome(p[2]?decodeURIComponent(p[2]):null); return; }
  if(h.startsWith("#/ch/")){ const id=h.slice(5); const c=CH.find(x=>x.id===id); if(c){renderChapter(c); return;} }
  renderHome();
}

/* ---------------- dashboard ---------------- */
function renderHome(){
  stopTimer(); highlightNav(null); hideNoteFab();
  let totalStudy=0, attempts=0, doneCnt=0, scoreSum=0, scoreN=0;
  CH.forEach(c=>{ const r=store.ch[c.id]; if(r){ totalStudy+=r.studySec||0; attempts+=(r.attempts||[]).length;}
    if(isDone(c.id)) doneCnt++;
    const b=bestScore(c.id); if(b!=null){scoreSum+=b;scoreN++;} });
  const avg = scoreN? Math.round(scoreSum/scoreN*100):0;
  const lessons = CH.filter(c=>c.type!=='appendix'&&c.type!=='intro').length;

  let html=`<section class="hero">
    <h1>跟Jimmy学英语 · 学习中心</h1>
    <div class="en">English with Jimmy</div>
    <p>集 <b>语法精讲 · 单词背诵 · 入学测试</b> 于一体的英语自学工具：系统讲解 词法 · 时态语态 · 复合句与非谓语，配套练习、抽认卡与闯关挑战；内置 考研 / 雅思 / 阅读近义词辨析 三大词库与入学测试卷。学习进度、笔记与成绩自动保存在本机，随时回顾。</p>
    <div class="hero-main-btns">
      <button class="hero-cta" data-nav="game">🎮 开始语法闯关挑战</button>
      <button class="hero-cta vocab-btn" data-nav="vocab">📖 单词背诵</button>
      <button class="hero-cta daily-btn" data-nav="daily">📅 每日一练</button>
    </div>
    <div class="hero-exam-btns">
      <button class="hero-cta exam-btn full" data-nav="exam-full">📝 完整版入学测试</button>
      <button class="hero-cta exam-btn simple" data-nav="exam-simple">📋 简化版入学测试</button>
    </div>
  </section>
  <div class="stats">
    <div class="stat"><span class="ico">📚</span><div class="num">${doneCnt}<small style="font-size:15px;color:var(--muted)">/${CH.length}</small></div><div class="lab">已完成章节</div></div>
    <div class="stat"><span class="ico">⏱️</span><div class="num">${fmtTime(totalStudy)}</div><div class="lab">累计学习时长</div></div>
    <div class="stat"><span class="ico">✍️</span><div class="num">${attempts}</div><div class="lab">练习提交次数</div></div>
    <div class="stat"><span class="ico">🎯</span><div class="num">${avg}%</div><div class="lab">平均最佳正确率</div></div>
  </div>
  ${vocabDashHTML()}
  ${dailyDashHTML()}
  <div class="qr-promo">
    <div class="qr-text">
      <h3>📚 想要更多学习资料或课程咨询？</h3>
      <p>扫码添加微信，获取一对一英语学习规划</p>
    </div>
    <img class="qr-img" src="QRcode.png" alt="课程咨询二维码" onclick="this.classList.toggle('zoomed')">
  </div>`;

  const groups={};
  CH.forEach(c=>{ (groups[c.part]=groups[c.part]||[]).push(c); });
  Object.keys(groups).forEach(part=>{
    html+=`<div class="part-block"><div class="part-head">${esc(part)}</div><div class="card-grid">`;
    groups[part].forEach(c=>{ html+=cardHTML(c); });
    html+=`</div></div>`;
  });
  main.innerHTML=html;
  main.querySelectorAll(".ch-card").forEach(el=>el.onclick=()=>go(el.dataset.id));
  main.querySelectorAll('[data-nav="game"]').forEach(b=>b.onclick=()=>{location.hash="#/game";});
  main.querySelectorAll('[data-nav="vocab"]').forEach(b=>b.onclick=()=>{location.hash="#/vocab";});
  main.querySelectorAll('[data-nav="daily"]').forEach(b=>b.onclick=()=>{location.hash="#/daily";});
  main.querySelectorAll(".vdash-card[data-set]").forEach(b=>b.onclick=()=>{ const st=vSetStats(vsetById(b.dataset.set)); selectVocabSet(b.dataset.set); location.hash = st.todoToday>0 ? "#/vocab/study" : "#/vocab/home"; });
  main.querySelectorAll(".vdash-card[data-dexam]").forEach(b=>b.onclick=()=>{ location.hash="#/daily/"+encodeURIComponent(b.dataset.dexam); });
  main.querySelectorAll('[data-nav="exam-full"]').forEach(b=>b.onclick=()=>{location.hash="#/exam/full";});
  main.querySelectorAll('[data-nav="exam-simple"]').forEach(b=>b.onclick=()=>{location.hash="#/exam/simple";});
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function cardHTML(c){
  const r=store.ch[c.id]||{};
  const qn=lessonCount(c.id);
  const best=bestScore(c.id);
  const done=isDone(c.id);
  const study=r.studySec||0;
  const prog = done?100:(study>0||(r.attempts||[]).length? Math.min(90, Math.round((study/ (c.minutes*60))*100)+ ((r.attempts||[]).length?30:0)):0);
  return `<div class="ch-card lv-${c.level}" data-id="${c.id}">
    <div class="bar"></div>
    <div class="cnum">${esc(c.num||(c.type==='appendix'?'附录':''))}</div>
    <div class="ctitle">${esc(shortTitle(c.title))}</div>
    <div class="ch-meta">
      <span class="badge lv">${c.level}</span>
      <span class="badge time">⏱ 约${c.minutes}分钟</span>
      ${qn?`<span class="badge ghost">${qn}题</span>`:``}
      ${best!=null?`<span class="badge score">最佳 ${Math.round(best*100)}%</span>`:``}
      ${done?`<span class="badge done">✓ 已完成</span>`:``}
    </div>
    <div class="mini-bar"><i style="width:${prog}%"></i></div>
    <div class="ch-foot"><span>${study?('已学 '+fmtTime(study)):'尚未开始'}</span><span>${r.lastVisit?fmtDate(r.lastVisit):'—'}</span></div>
  </div>`;
}

/* ---------------- chapter view ---------------- */
let curTab="lesson";
function renderChapter(c, tab){
  highlightNav(c.id);
  curTab = tab || "lesson";
  const qn=lessonCount(c.id);
  const r=chRec(c.id);
  main.innerHTML=`
   <div class="ch-hero lv-${c.level}">
     <div class="timer-pill"><span class="dot"></span>本次学习 <span id="live-timer">${fmtTime(r.studySec)}</span></div>
     <div class="kicker">${esc(c.part)} ${c.num?'· '+c.num:''}</div>
     <h1>${esc(c.title)}</h1>
     <div class="hmeta">
       <div><b>${c.level}</b><span>难度等级</span></div>
       <div><b>约 ${c.minutes} 分钟</b><span>建议学习时长</span></div>
       <div><b>${qn||'—'}</b><span>配套练习题</span></div>
       <div><b>${fmtTime(r.studySec)}</b><span>累计已学</span></div>
     </div>
     <button class="ch-pdf-btn" id="ch-pdf-btn" title="导出本章为 PDF">📄 导出 PDF</button>
   </div>
   <div class="tabs">
     <div class="tab" data-tab="lesson">📖 知识讲解</div>
     <div class="tab" data-tab="quiz">📝 巩固练习${qn?`<span class="pill">${qn}</span>`:''}</div>
     ${DECKS[c.id]?`<div class="tab" data-tab="cards">🃏 抽认卡<span class="pill">${DECKS[c.id].cards.length}</span></div>`:''}
     <div class="tab" data-tab="records">📈 学习记录</div>
   </div>
   <div id="tab-body"></div>`;
  main.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{curTab=t.dataset.tab;paintTabs();renderTabBody(c);});
  const pdfBtn=$("#ch-pdf-btn");
  if(pdfBtn) pdfBtn.onclick=()=>exportChapterPDF(c);
  paintTabs(); renderTabBody(c);
  startTimer(c.id);
  buildNav(); highlightNav(c.id); // refresh done dots
  curAnnChId=c.id; showNoteFab();
  window.scrollTo(0,0);
}
function paintTabs(){ document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===curTab)); }

function renderTabBody(c){
  const body=$("#tab-body");
  curLessonEl=null;
  if(curTab==="lesson"){
    const isIPA = c.title.indexOf("音标")>=0;
    body.innerHTML=`<article class="lesson">${isIPA?ipaTip():""}${decorate(c.html)||'<p class="empty">本章节为速查参考内容。</p>'}</article>`;
    if(isIPA) enhancePhonetics(body);
    setupAnnotations(c, body);
  }else if(curTab==="quiz"){
    renderQuiz(c, body);
  }else if(curTab==="cards"){
    renderCards(c, body);
  }else{
    renderRecords(c, body);
  }
}

/* ---------------- difficulty levels ---------------- */
const LV_ORDER=["入门","进阶","复习"];
const LV_INFO={
  "入门":{d:"识记与基础",c:"var(--blue)"},
  "进阶":{d:"应用与提升",c:"var(--teal)"},
  "复习":{d:"综合与拓展",c:"var(--purple)"}
};
function chQuestions(id){
  const o=QZ[id]; if(!o) return [];
  if(Array.isArray(o)) return o.map(q=>Object.assign({level:""},q));
  let out=[]; LV_ORDER.forEach(l=>(o[l]||[]).forEach(q=>out.push(Object.assign({level:l},q)))); return out;
}

/* ---------------- quiz engine ---------------- */
let quizState=null;
function levelDivider(level, n){
  if(!level) return "";
  const info=LV_INFO[level]||{d:"",c:"var(--blue)"};
  return `<div class="lv-divider" style="--lc:${info.c}"><span class="lv-name">${level}</span><span class="lv-desc">${info.d}</span><span class="lv-n">${n} 题</span></div>`;
}
function renderQuiz(c, body, subset){
  const all=chQuestions(c.id);
  const isWrong=!!(subset&&subset.length);
  let qs, origIdx;
  if(isWrong){ origIdx=subset.filter(i=>all[i]); qs=origIdx.map(i=>all[i]); }
  else { qs=all; origIdx=all.map((_,i)=>i); }
  if(!qs.length){ body.innerHTML=`<div class="quiz-intro"><div><h3>本章暂无配套练习</h3><p>这是参考/速查类章节，可在"知识讲解"中查阅。</p></div></div>`; return; }
  quizState={chId:c.id, qs, origIdx, subset:isWrong?subset:null, answers:new Array(qs.length).fill(null), graded:false, start:Date.now()};
  const cnt={}; qs.forEach(q=>cnt[q.level]=(cnt[q.level]||0)+1);
  let listHTML="", prev=null;
  qs.forEach((q,i)=>{ if(!isWrong && q.level!==prev){ listHTML+=levelDivider(q.level, cnt[q.level]); prev=q.level; } listHTML+=qHTML(q,i); });
  let h=`<div class="quiz-intro"><div><h3>${esc(shortTitle(c.title))} · ${isWrong?'错题重做':'巩固练习'}</h3>
      <p>${isWrong?`本组为你之前做错的 <b>${qs.length}</b> 题，全部答对即可从错题本移除。`:`共 <b>${qs.length}</b> 题，分 <b>入门 / 进阶 / 复习</b> 三个难度，约 <b>20 分钟</b>完成。作答后点击"提交批改"查看答案与解析，成绩自动保存。`}</p></div>
      <button class="btn primary" id="submit-quiz">提交批改</button></div>
      <div id="q-list">${listHTML}</div>
      <div class="quiz-actions">
        <button class="btn primary" id="submit-quiz2">提交批改</button>
        <button class="btn ghost" id="reset-quiz">重做本组</button>
      </div>`;
  body.innerHTML=h;
  bindQuiz(body,c);
}
function qHTML(q,i){
  const tname={mc:"单选",fill:"填空",tf:"判断",translate:"汉译英"}[q.t];
  let inner="";
  if(q.t==="mc"){
    inner=`<div class="opts">`+q.opts.map((o,j)=>
      `<label class="opt" data-i="${i}" data-j="${j}"><input type="radio" name="q${i}" value="${j}"><span class="key">${String.fromCharCode(65+j)}.</span><span class="otxt">${esc(o)}</span><span class="mark"></span></label>`).join("")+`</div>`;
  }else if(q.t==="tf"){
    inner=`<div class="tf-opts">
      <label class="opt" data-i="${i}" data-j="T"><input type="radio" name="q${i}" value="T"><span>✔ 正确</span><span class="mark"></span></label>
      <label class="opt" data-i="${i}" data-j="F"><input type="radio" name="q${i}" value="F"><span>✘ 错误</span><span class="mark"></span></label></div>`;
  }else if(q.t==="translate"){
    inner=`<div class="fill-in"><textarea class="tr-input" data-i="${i}" rows="2" placeholder="在此写出英文翻译（主观题，提交后对照参考答案）…"></textarea></div>`;
  }else{
    inner=`<div class="fill-in"><input type="text" data-i="${i}" placeholder="在此输入答案…" autocomplete="off"></div>`;
  }
  const tcls = q.t==="translate" ? " subj" : "";
  return `<div class="q-card" id="qc${i}">
    <div class="q-head"><span class="q-idx">${i+1}</span><span class="q-type${tcls}">${tname}</span><span class="q-text">${esc(q.q)}</span></div>
    ${inner}
    <div class="explain" id="ex${i}"></div></div>`;
}
function bindQuiz(body,c){
  body.querySelectorAll(".opt").forEach(o=>{
    o.onclick=()=>{ if(quizState.graded) return;
      const i=+o.dataset.i;
      body.querySelectorAll(`.opt[data-i="${i}"]`).forEach(x=>x.classList.remove("sel"));
      o.classList.add("sel"); o.querySelector("input").checked=true;
      quizState.answers[i]= o.dataset.j; };
  });
  body.querySelectorAll(".fill-in input").forEach(inp=>{
    inp.oninput=()=>{ quizState.answers[+inp.dataset.i]=inp.value; };
  });
  body.querySelectorAll(".tr-input").forEach(t=>{
    t.oninput=()=>{ quizState.answers[+t.dataset.i]=t.value; };
  });
  const submit=()=>gradeQuiz(c, body);
  $("#submit-quiz").onclick=submit; $("#submit-quiz2").onclick=submit;
  $("#reset-quiz").onclick=()=>renderQuiz(c,body, quizState&&quizState.subset);
}
function normalize(s){ return String(s==null?"":s).toLowerCase().trim()
  .replace(/[；;，,、\/]+/g," ").replace(/\s+/g," ").replace(/[.。!！?？'"]/g,"").trim(); }
function checkAnswer(q,ans){
  if(ans==null||ans==="") return false;
  if(q.t==="mc") return (+ans)===q.a;
  if(q.t==="tf") return (ans==="T")===(q.a===true);
  // fill
  const u=normalize(ans);
  return (q.a||[]).some(acc=>normalize(acc)===u);
}
function gradeQuiz(c, body){
  if(quizState.graded) return;
  quizState.graded=true;
  const qs=quizState.qs; let correct=0, objTotal=0; const byLv={};
  qs.forEach((q,i)=>{
    if(q.t==="translate"){
      const card=$("#qc"+i); card.classList.add("graded","ref");
      const inp=body.querySelector(`.tr-input[data-i="${i}"]`); if(inp) inp.disabled=true;
      const ex=$("#ex"+i); ex.classList.add("show");
      ex.innerHTML=`<span class="ans">📝 参考答案：${esc((q.a||[]).join("  /  "))}</span>${q.ex?`<br>${esc(q.ex)}`:''}`;
      return;
    }
    const ok=checkAnswer(q, quizState.answers[i]);
    objTotal++;
    if(ok) correct++;
    const oi=quizState.origIdx?quizState.origIdx[i]:null;
    if(oi!=null){ const w=chRec(c.id).wrong; const wi=w.indexOf(oi);
      if(ok){ if(wi>=0) w.splice(wi,1); } else if(wi<0){ w.push(oi); } }
    if(q.level){ const b=byLv[q.level]=byLv[q.level]||[0,0]; b[1]++; if(ok) b[0]++; }
    const card=$("#qc"+i); card.classList.add("graded", ok?"ok":"no");
    if(q.t==="mc"){
      body.querySelectorAll(`.opt[data-i="${i}"]`).forEach(o=>{
        const j=+o.dataset.j; const m=o.querySelector(".mark");
        if(j===q.a){o.classList.add("correct"); m.textContent="✓";}
        if(String(j)===String(quizState.answers[i]) && j!==q.a){o.classList.add("wrong"); m.textContent="✗";}
        o.querySelector("input").disabled=true;
      });
    }else if(q.t==="tf"){
      body.querySelectorAll(`.opt[data-i="${i}"]`).forEach(o=>{
        const correctJ=q.a?"T":"F"; const m=o.querySelector(".mark");
        if(o.dataset.j===correctJ){o.classList.add("correct"); m.textContent="✓";}
        if(o.dataset.j===quizState.answers[i] && o.dataset.j!==correctJ){o.classList.add("wrong"); m.textContent="✗";}
        o.querySelector("input").disabled=true;
      });
    }else{
      const inp=body.querySelector(`.fill-in input[data-i="${i}"]`); inp.disabled=true;
      inp.style.borderColor= ok? "var(--green)":"var(--red)";
      inp.style.background= ok? "#eafaf0":"#fdeeee";
    }
    const ans = q.t==="mc"? (String.fromCharCode(65+q.a)+". "+q.opts[q.a]) : q.t==="tf"? (q.a?"正确":"错误") : (q.a||[]).join(" / ");
    const ex=$("#ex"+i); ex.classList.add("show");
    ex.innerHTML=`<span class="ans">✔ 参考答案：${esc(ans)}</span><br>${esc(q.ex||"")}`;
  });
  const total=objTotal, timeSec=Math.round((Date.now()-quizState.start)/1000);
  const trN=qs.length-objTotal;
  const rec=chRec(c.id); rec.attempts.push({date:Date.now(),correct,total,timeSec}); save(store);
  // banner
  const pct=total?Math.round(correct/total*100):0;
  const cls = pct>=80?"good":pct>=60?"mid":"low";
  const msg = pct>=80?"太棒了，掌握得很扎实！":pct>=60?"不错，继续巩固薄弱点。":"再回顾一遍讲解，然后重做一次吧！";
  const lvTxt=LV_ORDER.filter(l=>byLv[l]).map(l=>`${l} ${byLv[l][0]}/${byLv[l][1]}`).join(" ｜ ");
  const banner=document.createElement("div");
  banner.className="result-banner "+cls;
  banner.innerHTML=`<div class="big">${pct}%</div><div class="rtxt"><b>客观题答对 ${correct} / ${total} 题</b><div>用时 ${fmtTime(timeSec)} · ${msg}${trN?` · 另含 ${trN} 道汉译英已给出参考答案`:''}</div>${lvTxt?`<div class="lv-break">${lvTxt}</div>`:''}</div>`;
  $("#q-list").parentNode.insertBefore(banner,$("#q-list"));
  $("#submit-quiz").disabled=true; $("#submit-quiz2").disabled=true;
  banner.scrollIntoView({behavior:"smooth",block:"center"});
  toast("成绩已保存到本机 ✓");
  buildNav(); highlightNav(c.id);
}

/* ---------------- records ---------------- */
function renderRecords(c, body){
  const r=store.ch[c.id]||{attempts:[],studySec:0,visits:0};
  const att=(r.attempts||[]).slice().reverse();
  let rows = att.length? att.map(a=>`<tr><td>${fmtDate(a.date)}</td><td class="sc" style="color:${a.correct/a.total>=0.8?'var(--green)':a.correct/a.total>=0.6?'var(--blue)':'var(--red)'}">${Math.round(a.correct/a.total*100)}%</td><td>${a.correct}/${a.total}</td><td>${fmtTime(a.timeSec)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">还没有练习记录，去"巩固练习"试试吧。</td></tr>`;
  const best=bestScore(c.id);
  const allQ=chQuestions(c.id);
  const wrong=(r.wrong||[]).filter(i=>allQ[i]);
  let wrongHTML;
  if(wrong.length){
    wrongHTML=`<div class="wrong-box"><div class="wb-head"><h4>📕 错题本 <span class="wb-cnt">${wrong.length}</span></h4>
      <button class="btn primary sm" id="redo-wrong">🔁 重做错题</button></div>
      <div class="wb-list">`+wrong.map(i=>{ const q=allQ[i];
        const ans=q.t==="mc"?(String.fromCharCode(65+q.a)+". "+q.opts[q.a]):q.t==="tf"?(q.a?"正确":"错误"):(q.a||[]).join(" / ");
        const tn={mc:"单选",tf:"判断",fill:"填空"}[q.t]||"题";
        return `<div class="wb-item"><div class="wb-q"><span class="wb-type">${tn}</span><span>${esc(q.q)}</span></div>
          <div class="wb-a">✔ 参考答案：${esc(ans)}</div>${q.ex?`<div class="wb-ex">${esc(q.ex)}</div>`:''}</div>`;
      }).join("")+`</div></div>`;
  } else {
    wrongHTML=`<div class="wrong-box empty-wb">✅ 暂无错题。在"巩固练习"或"闯关挑战"中做错的题会自动收集到这里，方便集中复习。</div>`;
  }
  body.innerHTML=`
   <div class="rec-grid">
     <div class="rec-card"><div class="rt">⏱️ 学习时长</div>
       <div class="rec-row"><span>本章累计</span><b>${fmtTime(r.studySec)}</b></div>
       <div class="rec-row"><span>访问次数</span><b>${r.visits||0} 次</b></div>
       <div class="rec-row"><span>最近学习</span><b>${r.lastVisit?fmtDate(r.lastVisit):'—'}</b></div>
     </div>
     <div class="rec-card"><div class="rt">🎯 练习成绩</div>
       <div class="rec-row"><span>自测练习次数</span><b>${att.length} 次</b></div>
       <div class="rec-row"><span>最佳正确率</span><b style="color:var(--green)">${best!=null?Math.round(best*100)+'%':'—'}</b></div>
       <div class="rec-row"><span>完成状态</span><b>${isDone(c.id)?'✓ 已完成':'进行中'}</b></div>
     </div>
   </div>
   ${wrongHTML}
   <div class="hist"><h4>练习历史记录</h4>
     <table><thead><tr><th>时间</th><th>正确率</th><th>得分</th><th>用时</th></tr></thead><tbody>${rows}</tbody></table>
   </div>`;
  const rw=$("#redo-wrong"); if(rw) rw.onclick=()=>{ curTab="quiz"; paintTabs(); renderQuiz(c, $("#tab-body"), (chRec(c.id).wrong||[]).slice()); };
}

/* ---------------- phonetics audio (Web Speech API) ---------------- */
let _enVoice=null, _warned=false;
function pickVoice(){
  if(!('speechSynthesis' in window)) return null;
  const vs=speechSynthesis.getVoices()||[];
  // prefer a British English voice, then any English voice; never a non-English one
  _enVoice = vs.find(v=>/en[-_]GB/i.test(v.lang))
          || vs.find(v=>/en[-_]US/i.test(v.lang))
          || vs.find(v=>/^en\b/i.test(v.lang) || /^en[-_]/i.test(v.lang))
          || vs.find(v=>/english/i.test(v.name||""))
          || null;
  return _enVoice;
}
function hasEnglishVoice(){ return !!(_enVoice||pickVoice()); }
if('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged=function(){ pickVoice(); updateIpaNotice(); if(typeof onVoicesReady==="function") onVoicesReady(); }; }
// ---- 用户可选发音语音（男声/女声自由切换）----
const VOICE_KEY="glx.voice";
let _userVoiceName=null; try{ _userVoiceName=localStorage.getItem(VOICE_KEY); }catch(e){}
let onVoicesReady=null;
// 朗读语速（0.5~1.3，本机保存），默认 0.7
const RATE_KEY="glx.rate";
let _rate=0.85; try{ const r=parseFloat(localStorage.getItem(RATE_KEY)); if(r>=0.4&&r<=1.6) _rate=r; }catch(e){}
function setRate(r){ _rate=Math.max(0.4,Math.min(1.6,r)); try{ localStorage.setItem(RATE_KEY,String(_rate)); }catch(e){} }
// 可用英文语音列表
function enVoices(){
  if(!('speechSynthesis' in window)) return [];
  return (speechSynthesis.getVoices()||[]).filter(v=>/(^|[-_ ])en([-_]|$)/i.test(v.lang||"")||/english/i.test(v.name||""));
}
function voiceKey(v){ return v?(v.voiceURI||v.name):""; }
// 当前使用的语音：优先用户所选，否则自动挑选
function currentVoice(){
  const vs=enVoices();
  if(_userVoiceName){ const m=vs.find(v=>voiceKey(v)===_userVoiceName); if(m) return m; }
  return _enVoice||pickVoice();
}
function setUserVoice(name){ _userVoiceName=name||null; try{ name?localStorage.setItem(VOICE_KEY,name):localStorage.removeItem(VOICE_KEY); }catch(e){} }
// 粗略判断男声/女声（按语音名称关键词）
function voiceGender(v){
  const n=(v&&v.name||"").toLowerCase();
  if(/female|woman|zira|hazel|susan|linda|heera|catherine|samantha|victoria|fiona|tessa|karen|moira|serena|allison|\bava\b|joanna|salli|kimberly|\bamy\b|emma|\bnicole\b/.test(n)) return "female";
  if(/\bmale\b|\bman\b|david|mark|george|\bjames\b|daniel|richard|\bguy\b|ryan|\bfred\b|\btom\b|\balex\b|brian|arthur|oliver|william|matthew|justin|joey/.test(n)) return "male";
  return "";
}
function speak(text){
  if(!('speechSynthesis' in window)){ toast("当前浏览器不支持语音朗读"); return; }
  const v=currentVoice();
  if(!v && !_warned){ _warned=true;
    toast("⚠ 系统未安装英文语音，发音可能不准。请安装英文(English)语音包后刷新"); }
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=_rate; u.pitch=1;
    if(v){ u.voice=v; u.lang=v.lang; } else { u.lang="en-GB"; }
    speechSynthesis.speak(u);
  }catch(e){ toast("朗读失败，请检查系统语音支持"); }
}
function firstWord(s){ return (s||"").split(/[,，;；]/)[0].replace(/[（(].*?[)）]/g,"").trim(); }
function flash(btn){ btn.classList.add("playing"); setTimeout(()=>btn.classList.remove("playing"),700); }
function ipaNoticeHTML(){
  if(hasEnglishVoice())
    return '🔊 点击<b>示例单词</b>即可收听该单词的英文发音，体会对应音标的读音。';
  return '⚠ <b style="color:var(--red)">未检测到系统英文语音</b>，点击示例单词会用中文语音引擎朗读，<b>发音不准确</b>。请安装英文语音后刷新本页：'
   +'<br><span style="font-size:12.5px;color:#7a5a20">Windows：设置 → 时间和语言 → 语言和区域 → 添加语言「English (United States/United Kingdom)」→ 选该语言「语言选项」→ 下载「语音 (Speech)」；安装后关闭并重新打开浏览器。建议使用 Chrome / Edge。</span>';
}
function ipaTip(){
  if(!('speechSynthesis' in window))
    return '<div class="ipa-tip" style="border-left-color:var(--red)"><span style="color:var(--red)">当前浏览器不支持语音朗读，建议使用 Chrome / Edge 打开。</span></div>';
  return '<div class="ipa-tip" id="ipa-notice">'+ipaNoticeHTML()+'</div>';
}
function updateIpaNotice(){ const el=document.getElementById('ipa-notice'); if(el){ el.innerHTML=ipaNoticeHTML(); el.style.borderLeftColor = hasEnglishVoice()?'':'var(--red)'; } }
function enhancePhonetics(body){
  body.querySelectorAll("table.gt tr").forEach(tr=>{
    const cells=[].slice.call(tr.children);
    cells.forEach((td,ci)=>{
      if(td.tagName==="TH") return;
      const t=td.textContent.trim();
      if(t.indexOf("/")>=0) return; // IPA symbol cell -> no audio
      if(/[A-Za-z]/.test(t) && t.indexOf("发音")<0){
        // example-word cell -> make each word clickable
        const html = t.split(/(,|，)/).map(seg=>{
          if(seg==="," || seg==="，") return seg+" ";
          const w=seg.trim(); if(!w) return seg;
          return `<span class="ipa-word" data-w="${esc(w)}">${esc(w)}</span>`;
        }).join("");
        td.innerHTML=html;
        td.querySelectorAll(".ipa-word").forEach(sp=>{
          sp.onclick=e=>{ e.stopPropagation(); speak(sp.dataset.w); };
        });
      }
    });
  });
}

/* ---------------- misc ---------------- */
let toastT;
function toast(msg){ let t=$("#toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);}
  t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),2200); }
function openSidebar(){ $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); }
function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }
function isNarrow(){ return window.matchMedia("(max-width:860px)").matches; }
function toggleNav(){
  if(isNarrow()){ const open=$("#sidebar").classList.toggle("open"); $("#scrim").classList.toggle("show",open); }
  else { document.body.classList.toggle("nav-hidden"); saveUI(); }
}

/* ---- UI preferences: font size · sidebar · clock ---- */
const UIKEY="glx.ui";
let ui={}; try{ ui=JSON.parse(localStorage.getItem(UIKEY))||{}; }catch(e){ ui={}; }
function saveUI(){ try{ localStorage.setItem(UIKEY, JSON.stringify({fz:ui.fz||1, navHidden:document.body.classList.contains("nav-hidden"), sidebarW:ui.sidebarW||300})); }catch(e){} }
function applyFont(v){ ui.fz=v; document.documentElement.style.setProperty("--fz", v);
  document.querySelectorAll("#fs-seg button").forEach(b=>b.classList.toggle("on", parseFloat(b.dataset.fs)===v)); saveUI(); }
function updateClock(){ const el=$("#clock"); if(!el) return; const d=new Date(), p=n=>String(n).padStart(2,"0"), wk=["日","一","二","三","四","五","六"];
  el.textContent=`${d.getMonth()+1}月${d.getDate()}日 周${wk[d.getDay()]}　${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }

$("#menu-toggle").onclick=toggleNav;
$("#scrim").onclick=closeSidebar;
{ const sbtn=$("#settings-btn"), panel=$("#settings-panel");
  if(sbtn&&panel){ sbtn.onclick=e=>{ e.stopPropagation(); panel.classList.toggle("show"); };
    document.addEventListener("click",e=>{ if(panel.classList.contains("show")&&!panel.contains(e.target)&&e.target!==sbtn) panel.classList.remove("show"); }); }
  const fseg=$("#fs-seg"); if(fseg) fseg.querySelectorAll("button").forEach(b=>b.onclick=()=>applyFont(parseFloat(b.dataset.fs)));
}
applyFont(ui.fz||1);
if(ui.navHidden && !isNarrow()) document.body.classList.add("nav-hidden");
// Sidebar resize
function applySidebarW(w){ document.documentElement.style.setProperty("--sidebar-w",w+"px"); }
applySidebarW(ui.sidebarW||300);
{ const handle=$("#sidebar-resize"); if(handle){
  let dragging=false, startX, startW;
  handle.addEventListener("mousedown",e=>{
    dragging=true; startX=e.clientX; startW=parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w"));
    handle.classList.add("dragging");
    document.body.style.userSelect="none";
    e.preventDefault();
  });
  document.addEventListener("mousemove",e=>{
    if(!dragging) return;
    const w=Math.max(200,Math.min(500,startW+e.clientX-startX));
    applySidebarW(w);
  });
  document.addEventListener("mouseup",()=>{
    if(!dragging) return;
    dragging=false;
    handle.classList.remove("dragging");
    document.body.style.userSelect="";
    ui.sidebarW=parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w"));
    saveUI();
  });
}}
updateClock(); setInterval(updateClock,1000);
document.querySelectorAll('[data-nav="home"]').forEach(b=>b.onclick=goHome);
document.querySelectorAll('[data-nav="game"]').forEach(b=>b.onclick=()=>{ location.hash="#/game"; });
document.querySelectorAll('[data-nav="vocab"]').forEach(b=>b.onclick=()=>{ location.hash="#/vocab"; });
document.querySelectorAll('[data-nav="daily"]').forEach(b=>b.onclick=()=>{ location.hash="#/daily"; });
{ const sb=$("#search-btn"); if(sb) sb.onclick=openSearch; }
$("#reset-btn").onclick=()=>{ if(confirm("确定清除本机所有学习记录、用时、成绩、笔记与高亮吗？此操作不可撤销。")){ store={ch:{}}; save(store); buildNav(); toast("学习记录已重置"); route(); } };

/* ============================ GLOBAL SEARCH ============================ */
let _searchIdx=null;
function buildSearchIndex(){
  if(_searchIdx) return _searchIdx;
  _searchIdx=CH.map(c=>{
    const text=(c.html||"").replace(/<[^>]+>/g," ").replace(/&[a-z#0-9]+;/gi," ").replace(/\s+/g," ").trim();
    const qtext=chQuestions(c.id).map(q=>q.q+" "+(q.opts?q.opts.join(" "):"")+" "+(q.ex||"")).join(" ");
    const full=text+"  "+qtext;
    return {id:c.id, title:c.title, part:c.part, text:full, low:(c.title+" "+full).toLowerCase()};
  });
  return _searchIdx;
}
function snippet(text,q){
  const low=text.toLowerCase(), i=low.indexOf(q.toLowerCase());
  let seg, pre="", post="";
  if(i<0){ seg=text.slice(0,90); post="…"; }
  else { const s=Math.max(0,i-34), e=Math.min(text.length,i+q.length+56); seg=text.slice(s,e); pre=s>0?"…":""; post=e<text.length?"…":""; }
  const re=new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");
  return pre+esc(seg).replace(re,'<mark>$1</mark>')+post;
}
function openSearch(){
  let ov=$("#search-ov");
  if(!ov){
    ov=document.createElement("div"); ov.id="search-ov"; ov.className="search-ov";
    ov.innerHTML=`<div class="search-box"><div class="search-bar"><span class="si">🔍</span>
      <input id="search-input" placeholder="搜索语法点 / 例句 / 题目（如 虚拟语气、present perfect、倒装）" autocomplete="off">
      <button id="search-close" title="关闭">✕</button></div>
      <div id="search-results" class="search-results"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click",e=>{ if(e.target===ov) closeSearch(); });
    $("#search-close").onclick=closeSearch;
    const inp=$("#search-input");
    inp.addEventListener("input",()=>doSearch(inp.value));
    inp.addEventListener("keydown",e=>{ if(e.key==="Escape") closeSearch(); });
  }
  ov.classList.add("show"); const inp=$("#search-input"); inp.value=""; doSearch(""); setTimeout(()=>inp.focus(),50);
}
function closeSearch(){ const ov=$("#search-ov"); if(ov) ov.classList.remove("show"); }
function doSearch(q){
  const box=$("#search-results"); q=(q||"").trim();
  if(q.length<1){ box.innerHTML=`<div class="search-hint">输入关键词开始搜索，支持中英文。已收录全部 ${CH.length} 章讲解与题目。</div>`; return; }
  const idx=buildSearchIndex(), ql=q.toLowerCase();
  const hits=idx.filter(c=>c.low.indexOf(ql)>=0).slice(0,40);
  if(!hits.length){ box.innerHTML=`<div class="search-hint">没有找到与 “${esc(q)}” 相关的内容，换个关键词试试。</div>`; return; }
  box.innerHTML=`<div class="search-cnt">找到 ${hits.length} 个相关章节</div>`+hits.map(c=>
    `<div class="search-hit" data-id="${c.id}"><div class="sh-title">${esc(shortTitle(c.title))}<span class="sh-part">${esc(c.part)}</span></div><div class="sh-snip">${snippet(c.text,q)}</div></div>`).join("");
  box.querySelectorAll(".search-hit").forEach(h=>h.onclick=()=>{ closeSearch(); go(h.dataset.id); });
}

/* ============================ FLASHCARDS ============================ */
function cardKnown(deckId){ store.cards=store.cards||{}; if(!store.cards[deckId]) store.cards[deckId]={known:[]}; return store.cards[deckId]; }
let FC=null;
function renderCards(c, body){
  const deck=DECKS[c.id];
  if(!deck){ body.innerHTML='<p class="empty">本章暂无抽认卡。</p>'; return; }
  FC={deck, chId:c.id, order:[], i:0, flipped:false, onlyUnknown:false};
  fcRebuild(); fcRender(body);
}
function fcRebuild(){
  const kn=cardKnown(FC.chId).known;
  let idxs=FC.deck.cards.map((_,i)=>i);
  if(FC.onlyUnknown) idxs=idxs.filter(i=>kn.indexOf(i)<0);
  FC.order=shuffle(idxs); FC.i=0; FC.flipped=false;
}
function fcRender(body){
  const kn=cardKnown(FC.chId).known;
  const total=FC.deck.cards.length, learned=kn.length;
  if(!FC.order.length){
    body.innerHTML=`<div class="fc-wrap"><div class="fc-done">🎉 ${FC.onlyUnknown?'没有「没记住」的卡片了，全部掌握！':'这一组卡片都标记为「记住了」！'}<br>
      <button class="btn ghost" id="fc-reset">↺ 重新学习全部</button></div></div>`;
    $("#fc-reset").onclick=()=>{ cardKnown(FC.chId).known=[]; save(store); FC.onlyUnknown=false; fcRebuild(); fcRender(body); };
    return;
  }
  const ci=FC.order[FC.i], card=FC.deck.cards[ci], isKnown=kn.indexOf(ci)>=0;
  body.innerHTML=`<div class="fc-wrap">
    <div class="fc-top">
      <div class="fc-prog">第 ${FC.i+1} / ${FC.order.length} 张　·　已掌握 ${learned} / ${total}</div>
      <label class="fc-toggle"><input type="checkbox" id="fc-only" ${FC.onlyUnknown?'checked':''}> 只看没记住的</label>
    </div>
    <div class="fc-progbar"><i style="width:${total?learned/total*100:0}%"></i></div>
    <div class="fc-card ${FC.flipped?'flip':''} ${isKnown?'known':''}" id="fc-card">
      <div class="fc-inner">
        <div class="fc-face fc-front">${isKnown?'<div class="fc-badge">✓ 已掌握</div>':''}<div class="fc-hint">英文 · 点击翻面看释义</div><div class="fc-en">${esc(card.f)}</div></div>
        <div class="fc-face fc-back"><div class="fc-zh">${esc(card.b)}</div>${card.e?`<div class="fc-ex">${esc(card.e)}</div>`:''}</div>
      </div>
    </div>
    <div class="fc-rate"><button class="btn fc-no" id="fc-no">🔁 没记住</button><button class="btn fc-yes" id="fc-yes">✅ 记住了</button></div>
    <div class="fc-nav"><button id="fc-prev">‹ 上一张</button><button id="fc-flip">↺ 翻面</button><button id="fc-shuffle">🔀 打乱</button><button id="fc-next">下一张 ›</button></div>
  </div>`;
  const flip=()=>{ FC.flipped=!FC.flipped; const el=$("#fc-card"); if(el) el.classList.toggle("flip"); };
  $("#fc-card").onclick=flip;
  $("#fc-flip").onclick=e=>{ e.stopPropagation(); flip(); };
  $("#fc-prev").onclick=()=>{ FC.i=(FC.i-1+FC.order.length)%FC.order.length; FC.flipped=false; fcRender(body); };
  $("#fc-next").onclick=()=>fcNext(body);
  $("#fc-shuffle").onclick=()=>{ FC.order=shuffle(FC.order); FC.i=0; FC.flipped=false; fcRender(body); };
  $("#fc-only").onchange=e=>{ FC.onlyUnknown=e.target.checked; fcRebuild(); fcRender(body); };
  $("#fc-yes").onclick=()=>{ const k=cardKnown(FC.chId); if(k.known.indexOf(ci)<0)k.known.push(ci); save(store); fcAfterRate(body); };
  $("#fc-no").onclick=()=>{ const k=cardKnown(FC.chId); const p=k.known.indexOf(ci); if(p>=0)k.known.splice(p,1); save(store); fcAfterRate(body); };
}
function fcAfterRate(body){ if(FC.onlyUnknown){ const cur=FC.order[FC.i]; FC.order.splice(FC.i,1); if(FC.i>=FC.order.length) FC.i=0; FC.flipped=false; fcRender(body); } else fcNext(body); }
function fcNext(body){ FC.i=(FC.i+1)%FC.order.length; FC.flipped=false; fcRender(body); }

/* ============================ GAME ============================ */
const GAME_KEY="glx.game";
function gameStats(){ try{return JSON.parse(localStorage.getItem(GAME_KEY))||{best:0,bestCombo:0,plays:0};}catch(e){return {best:0,bestCombo:0,plays:0};} }
function saveGameStats(g){ try{localStorage.setItem(GAME_KEY,JSON.stringify(g));}catch(e){} }
function objChapters(){ return CH.filter(c=> chQuestions(c.id).some(q=>q.t==="mc"||q.t==="tf")); }
function chTitleOf(id){ const c=CH.find(x=>x.id===id); return c?esc(shortTitle(c.title)):""; }
function allWrong(){ const out=[]; CH.forEach(c=>{ const r=store.ch[c.id]; if(!r||!r.wrong||!r.wrong.length) return; const qs=chQuestions(c.id); r.wrong.forEach(idx=>{ const q=qs[idx]; if(q) out.push({chId:c.id,idx,q}); }); }); return out; }
let gwOpen=false;

let gameCfg={chaps:null, level:"all", count:15, timed:true, sound:true};
let GS=null;
const QTIME=12000;

function renderGame(){ stopTimer(); highlightNav(null); hideNoteFab(); renderGameSetup(); }
function renderGameSetup(){
  const chs=objChapters(), g=gameStats();
  const wrongItems=allWrong(), gwGameCount=wrongItems.filter(it=>it.q.t==="mc"||it.q.t==="tf").length;
  if(!gameCfg.chaps) gameCfg.chaps=chs.map(c=>c.id);
  gameCfg.chaps=gameCfg.chaps.filter(id=>chs.some(c=>c.id===id));
  const groups={}; chs.forEach(c=>(groups[c.part]=groups[c.part]||[]).push(c));
  let chapHTML="";
  Object.keys(groups).forEach(part=>{
    chapHTML+=`<div class="gset-part">${esc(part)}</div><div class="gset-chips">`+
      groups[part].map(c=>`<label class="gchip ${gameCfg.chaps.indexOf(c.id)>=0?'on':''}" data-id="${c.id}">${esc(shortTitle(c.title))}</label>`).join("")+`</div>`;
  });
  const seg=(id,arr,cur,attr)=>`<div class="seg" id="${id}">`+arr.map(x=>`<button class="${String(cur)===String(x[0])?'on':''}" data-v="${x[0]}">${x[1]}</button>`).join("")+`</div>`;
  main.innerHTML=`<section class="game-setup">
    <div class="gs-hero"><div class="gs-emoji">🎮</div><h1>语法闯关挑战</h1>
      <p>连击得分 · 限时抢答 · 越快越准分越高！答错的题会自动进入对应章节的「错题本」。</p>
      <div class="gs-best"><span>🏆 最高分 <b>${g.best}</b></span><span>🔥 最高连击 <b>${g.bestCombo}</b></span><span>🎯 已挑战 <b>${g.plays}</b> 次</span></div>
    </div>
    ${(()=>{
      if(!wrongItems.length) return `<div class="gs-wrong empty"><div class="gw-head"><span>📕 错题回顾</span><b>0 题</b></div><p class="gw-hint">暂无错题。在闯关或练习中做错的题会自动收集到这里，方便集中复习与重练。</p></div>`;
      let detail="";
      if(gwOpen){ const byCh={}; wrongItems.forEach(it=>{(byCh[it.chId]=byCh[it.chId]||[]).push(it);});
        CH.forEach(c=>{ const arr=byCh[c.id]; if(!arr) return;
          detail+=`<div class="gw-chap">${esc(shortTitle(c.title))} · ${arr.length} 题</div>`;
          arr.forEach(it=>{ const q=it.q, ans=q.t==="mc"?(String.fromCharCode(65+q.a)+". "+q.opts[q.a]):q.t==="tf"?(q.a?"正确":"错误"):(q.a||[]).join(" / ");
            detail+=`<div class="gw-item"><div class="gw-q"><span class="gw-type">${ {mc:"单选",tf:"判断",fill:"填空"}[q.t]||"题"}</span>${esc(q.q)}</div><div class="gw-a">✔ ${esc(ans)}</div>${q.ex?`<div class="gw-ex">${esc(q.ex)}</div>`:""}<button class="gw-ok" data-ch="${it.chId}" data-idx="${it.idx}">✓ 已掌握</button></div>`; }); });
      }
      return `<div class="gs-wrong"><div class="gw-head"><span>📕 错题回顾</span><b>${wrongItems.length} 题</b></div>
        <div class="gw-actions"><button id="gw-start" class="gw-btn primary" ${gwGameCount?"":"disabled"} title="${gwGameCount?"":"仅含填空题，无法闯关"}">🔁 错题闯关（${gwGameCount}）</button>
        <button id="gw-list" class="gw-btn">${gwOpen?"▲ 收起":"📋 查看错题"}</button></div>
        <div class="gw-detail ${gwOpen?"show":""}">${detail}</div></div>`;
    })()}
    <div class="gs-panel">
      <div class="gs-row"><div class="gs-lab">题量</div>${seg("seg-count",[[10,10],[15,15],[20,20],[30,30]],gameCfg.count)}</div>
      <div class="gs-row"><div class="gs-lab">难度</div>${seg("seg-level",[["all","全部"],["入门","入门"],["进阶","进阶"],["复习","复习"]],gameCfg.level)}</div>
      <div class="gs-row"><div class="gs-lab">限时</div>${seg("seg-timed",[[1,"⏱ 开"],[0,"∞ 关"]],gameCfg.timed?1:0)}</div>
      <div class="gs-row"><div class="gs-lab">音效</div>${seg("seg-sound",[[1,"🔊 开"],[0,"🔇 关"]],gameCfg.sound?1:0)}</div>
    </div>
    <div class="gs-chapters">
      <div class="gs-chead"><span>考察章节（已选 <b id="chap-cnt">${gameCfg.chaps.length}</b>/${chs.length}）</span>
        <span class="gs-quick"><button id="q-all">全选</button><button id="q-none">清空</button><button id="q-inv">反选</button></span></div>
      ${chapHTML}
    </div>
    <button class="gs-start" id="gs-start">开始挑战 →</button>
    ${(()=>{ const hist=g.history||[]; if(!hist.length) return "";
      return `<div class="gs-history"><div class="gs-chead"><span>🏅 挑战记录（最近 ${Math.min(hist.length,10)} 次）</span><button id="g-clearhist">清空记录</button></div>
        <table class="ghist"><thead><tr><th>时间</th><th>得分</th><th>正确率</th><th>连击</th><th>用时</th></tr></thead><tbody>`+
        hist.slice(0,10).map(h=>`<tr><td>${fmtDate(h.date)}</td><td class="gh-score">${h.score}</td><td>${h.total?Math.round(h.correct/h.total*100):0}%</td><td>🔥${h.maxCombo}</td><td>${fmtTime(h.time)}</td></tr>`).join("")+
        `</tbody></table></div>`; })()}
  </section>`;
  const bindSeg=(id,fn)=>{ main.querySelectorAll("#"+id+" button").forEach(b=>b.onclick=()=>{ main.querySelectorAll("#"+id+" button").forEach(x=>x.classList.remove("on")); b.classList.add("on"); fn(b.dataset.v); }); };
  bindSeg("seg-count",v=>gameCfg.count=+v);
  bindSeg("seg-level",v=>gameCfg.level=v);
  bindSeg("seg-timed",v=>gameCfg.timed=v==="1");
  bindSeg("seg-sound",v=>gameCfg.sound=v==="1");
  main.querySelectorAll(".gchip").forEach(ch=>{ ch.onclick=e=>{ e.preventDefault(); const id=ch.dataset.id, k=gameCfg.chaps.indexOf(id);
    if(k>=0){ gameCfg.chaps.splice(k,1); ch.classList.remove("on"); } else { gameCfg.chaps.push(id); ch.classList.add("on"); }
    $("#chap-cnt").textContent=gameCfg.chaps.length; }; });
  $("#q-all").onclick=()=>{ gameCfg.chaps=chs.map(c=>c.id); renderGameSetup(); };
  $("#q-none").onclick=()=>{ gameCfg.chaps=[]; renderGameSetup(); };
  $("#q-inv").onclick=()=>{ const cur=new Set(gameCfg.chaps); gameCfg.chaps=chs.map(c=>c.id).filter(id=>!cur.has(id)); renderGameSetup(); };
  $("#gs-start").onclick=startGame;
  { const ch=$("#g-clearhist"); if(ch) ch.onclick=()=>{ if(confirm("清空所有挑战记录？")){ const gg=gameStats(); gg.history=[]; saveGameStats(gg); renderGameSetup(); } }; }
  { const gs=$("#gw-start"); if(gs) gs.onclick=startWrongGame;
    const gl=$("#gw-list"); if(gl) gl.onclick=()=>{ gwOpen=!gwOpen; renderGameSetup(); };
    main.querySelectorAll(".gw-ok").forEach(b=>b.onclick=()=>{ const w=chRec(b.dataset.ch).wrong, i=w.indexOf(+b.dataset.idx); if(i>=0){ w.splice(i,1); save(store); } renderGameSetup(); }); }
  window.scrollTo(0,0);
}
function startWrongGame(){
  const pool=allWrong().filter(p=>p.q.t==="mc"||p.q.t==="tf");
  if(!pool.length){ toast("没有可闯关的错题（填空题不计入）"); return; }
  GS={list:shuffle(pool),i:0,score:0,combo:0,maxCombo:0,lives:3,correct:0,answered:0,start:Date.now(),timer:null,locked:false,tStart:0,wrongMode:true};
  if(gameCfg.sound) initAudio();
  renderGamePlay();
}
function startGame(){
  const pool=[];
  (gameCfg.chaps||[]).forEach(id=>chQuestions(id).forEach((q,idx)=>{
    if((q.t==="mc"||q.t==="tf")&&(gameCfg.level==="all"||q.level===gameCfg.level)) pool.push({chId:id,idx,q});
  }));
  if(pool.length<1){ toast("所选范围没有可用题目，请调整设置"); return; }
  const picked=shuffle(pool).slice(0,Math.min(gameCfg.count,pool.length));
  GS={list:picked,i:0,score:0,combo:0,maxCombo:0,lives:3,correct:0,answered:0,start:Date.now(),timer:null,locked:false,tStart:0};
  if(gameCfg.sound) initAudio();
  renderGamePlay();
}
function gameOptsHTML(q){
  if(q.t==="mc") return q.opts.map((o,j)=>`<button class="g-opt" data-v="${j}"><span class="gk">${String.fromCharCode(65+j)}</span><span class="gt">${esc(o)}</span></button>`).join("");
  return `<button class="g-opt tf" data-v="T">✔ 正确</button><button class="g-opt tf" data-v="F">✘ 错误</button>`;
}
function renderGamePlay(){
  const q=GS.list[GS.i], total=GS.list.length;
  main.innerHTML=`<section class="game-play">
    <div class="g-hud">
      <button class="g-quit" id="g-quit" title="退出">✕</button>
      <div class="g-score">⭐ <b id="g-score">${GS.score}</b></div>
      ${GS.wrongMode?`<div class="g-mode">📕 错题回顾</div>`:`<div class="g-lives" id="g-lives">${"❤️".repeat(Math.max(0,GS.lives))+"🖤".repeat(Math.max(0,3-GS.lives))}</div>`}
      <div class="g-combo ${GS.combo>=2?'show':''}" id="g-combo">🔥 <b>${GS.combo}</b> 连击</div>
    </div>
    <div class="g-progress"><i style="width:${GS.i/total*100}%"></i></div>
    <div class="g-meta"><span>第 ${GS.i+1} / ${total} 题</span><span class="g-chip">${ {mc:"单选",tf:"判断"}[q.q.t] } · ${chTitleOf(q.chId)}</span></div>
    ${gameCfg.timed?`<div class="g-timer"><i id="g-timebar"></i></div>`:""}
    <div class="g-card" id="g-card">
      <div class="g-qtext">${esc(q.q.q)}</div>
      <div class="g-opts" id="g-opts">${gameOptsHTML(q.q)}</div>
    </div>
    <div class="g-fx" id="g-fx"></div>
  </section>`;
  $("#g-quit").onclick=()=>{ stopGameTimer(); if(confirm("结束本次挑战并返回设置？")) renderGameSetup(); else if(gameCfg.timed) startQTimer(); };
  main.querySelectorAll("#g-opts .g-opt").forEach(o=>o.onclick=()=>answerGame(o,false));
  GS.locked=false;
  if(gameCfg.timed) startQTimer();
  window.scrollTo(0,0);
}
function startQTimer(){
  stopGameTimer(); const bar=$("#g-timebar"); if(!bar) return;
  GS.tStart=Date.now(); bar.style.transition="none"; bar.style.width="100%"; void bar.offsetWidth;
  bar.style.transition="width "+QTIME+"ms linear"; bar.style.width="0%";
  GS.timer=setTimeout(()=>{ if(!GS.locked) answerGame(null,true); },QTIME);
}
function stopGameTimer(){ if(GS&&GS.timer){ clearTimeout(GS.timer); GS.timer=null; } }
function answerGame(optEl,timeout){
  if(!GS||GS.locked) return; GS.locked=true; stopGameTimer();
  const q=GS.list[GS.i], qq=q.q;
  const chosen=timeout?null:optEl.dataset.v;
  let ok=false;
  if(!timeout){ ok = qq.t==="mc" ? (+chosen)===qq.a : (chosen==="T")===(qq.a===true); }
  GS.answered++;
  const correctV = qq.t==="mc"?String(qq.a):(qq.a?"T":"F");
  main.querySelectorAll("#g-opts .g-opt").forEach(o=>{ o.classList.add("done");
    if(o.dataset.v===correctV) o.classList.add("right");
    if(optEl&&o===optEl&&!ok) o.classList.add("wrong"); });
  const remain=gameCfg.timed?Math.max(0,1-(Date.now()-GS.tStart)/QTIME):0.5;
  if(ok){
    GS.combo++; GS.maxCombo=Math.max(GS.maxCombo,GS.combo); GS.correct++;
    const gain=Math.round(10*(1+Math.min(GS.combo-1,9)*0.5)*(gameCfg.timed?(1+remain):1.2));
    GS.score+=gain; const sc=$("#g-score"); if(sc) sc.textContent=GS.score;
    floatGain(gain); bumpCombo(); burst(true); if(gameCfg.sound) sndCorrect(GS.combo);
    if(GS.wrongMode){ const w=chRec(q.chId).wrong, wi=w.indexOf(q.idx); if(wi>=0){ w.splice(wi,1); save(store); } }
  } else {
    GS.combo=0; if(!GS.wrongMode){ GS.lives--; updLives(); } const cd=$("#g-card"); if(cd) cd.classList.add("shake");
    const ce=$("#g-combo"); if(ce) ce.classList.remove("show");
    burst(false); if(gameCfg.sound) sndWrong();
    const rec=chRec(q.chId); if(rec.wrong.indexOf(q.idx)<0){ rec.wrong.push(q.idx); save(store); }
  }
  const fx=$("#g-fx"); if(fx&&qq.ex) fx.insertAdjacentHTML("beforeend",`<div class="g-ex ${ok?'ok':'no'}">${ok?'✓':'✗'} ${esc(qq.ex)}</div>`);
  setTimeout(()=>{ if(GS.lives<=0){ endGame(true); return; } GS.i++; if(GS.i>=GS.list.length){ endGame(false); return; } renderGamePlay(); }, ok?780:1550);
}
function updLives(){ const el=$("#g-lives"); if(el) el.innerHTML="❤️".repeat(Math.max(0,GS.lives))+"🖤".repeat(Math.max(0,3-GS.lives)); }
function bumpCombo(){ const el=$("#g-combo"); if(!el) return; el.classList.add("show"); const b=el.querySelector("b"); if(b)b.textContent=GS.combo;
  el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  if(GS.combo>0&&GS.combo%5===0) comboMilestone(GS.combo); }
function floatGain(g){ const fx=$("#g-fx"); if(!fx) return; const d=document.createElement("div"); d.className="g-gain"; d.textContent="+"+g; fx.appendChild(d); setTimeout(()=>d.remove(),900); }
function comboMilestone(n){ const fx=$("#g-fx"); if(!fx) return; const d=document.createElement("div"); d.className="g-milestone";
  const m={5:"🔥 连击 x5！手感火热",10:"⚡ 连击 x10！势不可挡",15:"💎 连击 x15！语法高手",20:"👑 连击 x20！封神"};
  d.textContent=m[n]||("🔥 连击 x"+n+"！"); fx.appendChild(d); setTimeout(()=>d.remove(),1150); }
function burst(good){ const fx=$("#g-fx"); if(!fx) return; const cols=good?["#22c55e","#16a34a","#4ade80","#facc15","#38bdf8"]:["#ef4444","#f87171"]; const n=good?16:6;
  for(let i=0;i<n;i++){ const p=document.createElement("div"); p.className="particle"; p.style.background=cols[i%cols.length];
    const a=Math.random()*Math.PI*2, d=40+Math.random()*70; p.style.setProperty("--dx",Math.cos(a)*d+"px"); p.style.setProperty("--dy",(Math.sin(a)*d-30)+"px");
    fx.appendChild(p); setTimeout(()=>p.remove(),820); } }
function endGame(dead){
  stopGameTimer();
  const time=Math.round((Date.now()-GS.start)/1000);
  const g=gameStats(); g.plays++; const newBest=GS.score>g.best; if(newBest)g.best=GS.score; if(GS.maxCombo>g.bestCombo)g.bestCombo=GS.maxCombo;
  g.history=g.history||[];
  g.history.unshift({date:Date.now(),score:GS.score,correct:GS.correct,total:GS.list.length,maxCombo:GS.maxCombo,time,dead,level:GS.wrongMode?"错题":gameCfg.level,chaps:(gameCfg.chaps||[]).length});
  if(g.history.length>20) g.history.length=20;
  saveGameStats(g);
  buildNav();
  const ratio=GS.list.length?GS.correct/GS.list.length:0, accPct=Math.round(ratio*100), miss=GS.list.length-GS.correct;
  let grade,gcls,gmsg;
  if(dead){ grade="💀"; gcls="d"; gmsg="生命耗尽！回顾讲解后再战。"; }
  else if(ratio>=0.95){ grade="S"; gcls="s"; gmsg="完美表现，语法宗师！"; }
  else if(ratio>=0.8){ grade="A"; gcls="a"; gmsg="非常出色，再创新高！"; }
  else if(ratio>=0.6){ grade="B"; gcls="b"; gmsg="不错，继续巩固薄弱点。"; }
  else { grade="C"; gcls="c"; gmsg="多回顾讲解，下次会更好！"; }
  main.innerHTML=`<section class="game-over">
    <div class="go-grade gr-${gcls}">${grade}</div>
    <h1>${dead?"挑战结束":"挑战完成"}</h1><p class="go-msg">${gmsg}</p>
    ${newBest&&GS.score>0?`<div class="go-newbest">🎉 新纪录！本次得分 ${GS.score}</div>`:""}
    <div class="go-stats">
      <div><b>${GS.score}</b><span>总得分</span></div>
      <div><b>${GS.correct}/${GS.list.length}</b><span>答对</span></div>
      <div><b>${accPct}%</b><span>正确率</span></div>
      <div><b>${GS.maxCombo}</b><span>最高连击</span></div>
      <div><b>${fmtTime(time)}</b><span>用时</span></div>
    </div>
    ${GS.wrongMode
      ? `<div class="go-note good">✅ 本次复习答对 ${GS.correct} 题，已从错题本移除；错题本还剩 ${allWrong().length} 题。</div>`
      : (miss>0?`<div class="go-note">📌 ${miss} 道错题已加入对应章节「学习记录 → 错题本」，记得复习。</div>`:`<div class="go-note good">🌟 全部答对，太强了！</div>`)}
    <div class="go-actions"><button class="btn primary" id="go-again">🔁 再来一局</button><button class="btn ghost" id="go-set">⚙️ 调整设置</button><button class="btn ghost" id="go-home">🏠 返回首页</button></div>
  </section>`;
  if(gameCfg.sound){ if(ratio>=0.8&&!dead) sndFanfare(); else sndDone(); }
  $("#go-again").onclick=GS.wrongMode?startWrongGame:startGame; $("#go-set").onclick=renderGameSetup; $("#go-home").onclick=goHome;
  window.scrollTo(0,0);
}
/* WebAudio juice (no external files) */
let AC=null;
function initAudio(){ try{ if(!AC) AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==="suspended") AC.resume(); }catch(e){ AC=null; } }
function beep(freq,dur,type,vol,when){ if(!AC) return; const t=AC.currentTime+(when||0); const o=AC.createOscillator(),g=AC.createGain();
  o.type=type||"sine"; o.frequency.value=freq; o.connect(g); g.connect(AC.destination);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.15,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.03); }
function sndCorrect(combo){ initAudio(); const base=520+Math.min(combo,12)*38; beep(base,0.12,"triangle",0.17,0); beep(base*1.5,0.12,"triangle",0.13,0.08); }
function sndWrong(){ initAudio(); beep(180,0.18,"square",0.15,0); beep(120,0.2,"square",0.13,0.1); }
function sndDone(){ initAudio(); [440,330].forEach((f,i)=>beep(f,0.2,"sine",0.14,i*0.13)); }
function sndFanfare(){ initAudio(); [523,659,784,1047].forEach((f,i)=>beep(f,0.16,"triangle",0.16,i*0.11)); }

/* ============================ HIGHLIGHTS & NOTES ============================ */
let curAnnChId=null, curLessonEl=null, pendingSel=null, annInited=false, _saveT=null;
function debSave(){ clearTimeout(_saveT); _saveT=setTimeout(()=>save(store),400); }
function ann(id){ store.ann=store.ann||{}; if(!store.ann[id]) store.ann[id]={note:"",hls:[]}; if(!store.ann[id].hls) store.ann[id].hls=[]; return store.ann[id]; }

function textOffset(root,node,off){ let n=0; const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); let c; while((c=w.nextNode())){ if(c===node) return n+off; n+=c.nodeValue.length; } return n+off; }
function wrapRange(root,start,end,cls,id){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); let n=0,node,segs=[];
  while((node=w.nextNode())){ const len=node.nodeValue.length,ns=n,ne=n+len;
    if(ne>start&&ns<end) segs.push({node,s:Math.max(start,ns)-ns,e:Math.min(end,ne)-ns});
    n=ne; if(n>=end) break; }
  segs.reverse().forEach(seg=>{ try{ const r=document.createRange(); r.setStart(seg.node,seg.s); r.setEnd(seg.node,seg.e);
    const sp=document.createElement("span"); sp.className=cls; sp.dataset.id=id; r.surroundContents(sp); }catch(e){} });
}
function applyHighlights(id,el){
  const a=ann(id);
  a.hls.slice().sort((x,y)=>x.start-y.start).forEach(h=>wrapRange(el,h.start,h.end,"hl hl-"+(h.color||"y")+(h.note?" has-note":""),h.id));
  el.querySelectorAll(".hl[data-id]").forEach(sp=>{ const h=a.hls.find(x=>x.id===sp.dataset.id); if(h&&h.note) sp.title="📝 "+h.note; });
}
function setupAnnotations(c,body){
  const el=body.querySelector(".lesson"); if(!el) return;
  curLessonEl=el; curAnnChId=c.id;
  applyHighlights(c.id,el);
  el.addEventListener("mouseup",onSelMouseUp);
  el.addEventListener("click",onHlClick);
}
function onSelMouseUp(e){
  if(e.target.closest&&e.target.closest(".hl")) return;
  const sel=window.getSelection(); if(!sel||!sel.rangeCount){ hideHlBar(); return; }
  const r=sel.getRangeAt(0);
  if(r.collapsed||!curLessonEl.contains(r.commonAncestorContainer)){ hideHlBar(); return; }
  let start=textOffset(curLessonEl,r.startContainer,r.startOffset), end=textOffset(curLessonEl,r.endContainer,r.endOffset);
  if(Math.abs(end-start)<1){ hideHlBar(); return; }
  pendingSel={start:Math.min(start,end),end:Math.max(start,end),text:r.toString()};
  showHlBar(r.getBoundingClientRect());
}
function ensureAnnUI(){
  if(annInited) return; annInited=true;
  const bar=document.createElement("div"); bar.id="hl-bar"; bar.className="hl-bar";
  bar.innerHTML=`<button class="sw sw-y" data-c="y" title="黄"></button><button class="sw sw-g" data-c="g" title="绿"></button><button class="sw sw-p" data-c="p" title="粉"></button><button class="sw sw-b" data-c="b" title="蓝"></button><span class="hb-sep"></span><button class="hb-act" data-act="note" title="高亮并加批注">📝</button>`;
  document.body.appendChild(bar); bar.addEventListener("mousedown",e=>e.preventDefault());
  bar.querySelectorAll(".sw").forEach(b=>b.onclick=()=>makeHighlight(b.dataset.c,false));
  bar.querySelector('[data-act="note"]').onclick=()=>makeHighlight("y",true);
  const ep=document.createElement("div"); ep.id="hl-edit"; ep.className="hl-edit"; document.body.appendChild(ep); ep.addEventListener("mousedown",e=>{ if(e.target.tagName!=="TEXTAREA") e.preventDefault(); });
  const fab=document.createElement("button"); fab.id="note-fab"; fab.className="note-fab"; fab.innerHTML="🖊️ 笔记"; document.body.appendChild(fab); fab.onclick=toggleDrawer;
  const dr=document.createElement("div"); dr.id="note-drawer"; dr.className="note-drawer";
  dr.innerHTML=`<div class="nd-head"><span>📝 笔记与高亮</span><button id="nd-close">✕</button></div><div class="nd-title" id="nd-title"></div><textarea id="nd-text" placeholder="在此记录本章笔记…（自动保存）"></textarea><div class="nd-sub">本章高亮 · <span id="nd-hln">0</span> 处</div><div id="nd-hls" class="nd-hls"></div>`;
  document.body.appendChild(dr);
  $("#nd-close").onclick=()=>dr.classList.remove("show");
  $("#nd-text").addEventListener("input",e=>{ if(curAnnChId){ ann(curAnnChId).note=e.target.value; debSave(); } });
  document.addEventListener("mousedown",e=>{ if(!e.target.closest("#hl-bar")) hideHlBar(); if(!e.target.closest(".hl-edit")&&!e.target.closest(".hl")) hideHlEdit(); });
  document.addEventListener("scroll",()=>{ hideHlBar(); hideHlEdit(); },true);
}
function showHlBar(rect){ ensureAnnUI(); const bar=$("#hl-bar"); bar.style.display="flex";
  const bw=bar.offsetWidth||196, bh=bar.offsetHeight||40;
  let left=rect.left+rect.width/2-bw/2, top=rect.top-bh-8;
  left=Math.max(8,Math.min(left,window.innerWidth-bw-8)); if(top<58) top=rect.bottom+8;
  bar.style.left=left+"px"; bar.style.top=top+"px"; bar.classList.add("show"); }
function hideHlBar(){ const bar=$("#hl-bar"); if(bar){ bar.classList.remove("show"); bar.style.display="none"; } }
function makeHighlight(color,withNote){
  if(!pendingSel||!curLessonEl){ hideHlBar(); return; }
  const a=ann(curAnnChId); const h={id:"h"+Date.now().toString(36)+Math.floor(Math.random()*1e3),start:pendingSel.start,end:pendingSel.end,color,text:pendingSel.text.replace(/\s+/g," ").trim().slice(0,140),note:""};
  a.hls.push(h); wrapRange(curLessonEl,h.start,h.end,"hl hl-"+color,h.id);
  window.getSelection().removeAllRanges(); pendingSel=null; hideHlBar(); save(store); refreshDrawer();
  if(withNote){ const sp=curLessonEl.querySelector('.hl[data-id="'+h.id+'"]'); openHlEditFor(h.id,sp,true); }
}
function onHlClick(e){ const sp=e.target.closest(".hl"); if(!sp) return; e.stopPropagation(); openHlEditFor(sp.dataset.id,sp,false); }
function openHlEditFor(id,sp,focusNote){
  ensureAnnUI(); const a=ann(curAnnChId); const h=a.hls.find(x=>x.id===id); if(!h) return;
  const ep=$("#hl-edit");
  ep.innerHTML=`<div class="he-colors">${["y","g","p","b"].map(c=>`<button class="sw sw-${c} ${h.color===c?'on':''}" data-c="${c}"></button>`).join("")}<button class="he-del" title="删除高亮">🗑</button></div><textarea class="he-note" placeholder="写批注…（自动保存）">${esc(h.note||"")}</textarea>`;
  ep.style.display="block";
  const rect=sp?sp.getBoundingClientRect():{left:80,bottom:120}; const ew=ep.offsetWidth||240;
  let left=Math.max(8,Math.min(rect.left,window.innerWidth-ew-8)), top=(rect.bottom||120)+8;
  if(top>window.innerHeight-160) top=Math.max(58,(rect.top||120)-170);
  ep.style.left=left+"px"; ep.style.top=top+"px"; ep.classList.add("show");
  ep.querySelectorAll(".sw").forEach(b=>b.onclick=()=>{ h.color=b.dataset.c; if(curLessonEl) curLessonEl.querySelectorAll('.hl[data-id="'+id+'"]').forEach(x=>x.className="hl hl-"+h.color+(h.note?" has-note":"")); save(store); ep.querySelectorAll(".sw").forEach(s=>s.classList.toggle("on",s.dataset.c===h.color)); refreshDrawer(); });
  ep.querySelector(".he-del").onclick=()=>{ a.hls=a.hls.filter(x=>x.id!==id); save(store); hideHlEdit(); rerenderLesson(); refreshDrawer(); };
  const ta=ep.querySelector(".he-note");
  ta.addEventListener("input",()=>{ h.note=ta.value; debSave(); if(curLessonEl) curLessonEl.querySelectorAll('.hl[data-id="'+id+'"]').forEach(x=>{ x.title=h.note?("📝 "+h.note):""; x.classList.toggle("has-note",!!h.note); }); refreshDrawer(); });
  if(focusNote) setTimeout(()=>ta.focus(),40);
}
function hideHlEdit(){ const ep=$("#hl-edit"); if(ep){ ep.classList.remove("show"); ep.style.display="none"; } }
function rerenderLesson(){ const c=CH.find(x=>x.id===curAnnChId); if(c&&curTab==="lesson") renderTabBody(c); }
function toggleDrawer(){ ensureAnnUI(); const dr=$("#note-drawer"); const show=!dr.classList.contains("show"); dr.classList.toggle("show",show); if(show) refreshDrawer(); }
function refreshDrawer(){
  const dr=$("#note-drawer"); if(!dr||!curAnnChId) return;
  const c=CH.find(x=>x.id===curAnnChId); const a=ann(curAnnChId);
  $("#nd-title").textContent=c?shortTitle(c.title):"";
  const ta=$("#nd-text"); if(document.activeElement!==ta) ta.value=a.note||"";
  $("#nd-hln").textContent=a.hls.length;
  $("#nd-hls").innerHTML = a.hls.length ? a.hls.slice().sort((x,y)=>x.start-y.start).map(h=>
    `<div class="nd-hl" data-id="${h.id}"><span class="ndh-dot hl-${h.color}"></span><div class="ndh-body"><div class="ndh-text">${esc(h.text)}</div>${h.note?`<div class="ndh-note">📝 ${esc(h.note)}</div>`:""}</div><button class="ndh-del" title="删除">✕</button></div>`).join("")
    : `<div class="nd-empty">在「知识讲解」中选中文字，即可高亮并添加批注。</div>`;
  $("#nd-hls").querySelectorAll(".nd-hl").forEach(row=>{
    row.querySelector(".ndh-body").onclick=()=>{ const sp=curLessonEl&&curLessonEl.querySelector('.hl[data-id="'+row.dataset.id+'"]'); if(sp){ sp.scrollIntoView({behavior:"smooth",block:"center"}); sp.classList.add("flash"); setTimeout(()=>sp.classList.remove("flash"),1200); } else toast("切到「知识讲解」标签可定位高亮"); };
    row.querySelector(".ndh-del").onclick=()=>{ const a2=ann(curAnnChId); a2.hls=a2.hls.filter(x=>x.id!==row.dataset.id); save(store); rerenderLesson(); refreshDrawer(); };
  });
}
function showNoteFab(){ ensureAnnUI(); const f=$("#note-fab"); if(f) f.style.display="inline-flex"; refreshDrawer(); }
function hideNoteFab(){ const f=$("#note-fab"); if(f) f.style.display="none"; const d=$("#note-drawer"); if(d) d.classList.remove("show"); hideHlBar(); hideHlEdit(); }

/* ============================ ONBOARDING TUTORIAL ============================ */
const ONBOARD_KEY="glx.onboard";
const TUT=[
  {i:"👋",t:"欢迎使用",b:"欢迎来到 <b>《跟Jimmy学英语》</b>！集 <b>语法精讲 · 单词背诵 · 入学测试</b> 于一体的英语自学工具，所有进度与笔记都<b>保存在本机</b>，无需登录。<br><br>💡 建议把链接<b>复制到浏览器</b>打开使用，<b>不要直接在微信里打开</b>（微信内部分功能与 PDF 导出会受限）。<br><br>下面用 1 分钟带你认识全部功能 👇"},
  {i:"📊",t:"首页总览",b:"首页顶部是<b>学习数据</b>（已完成章节、累计用时、平均正确率）与 <b>📖 单词背诵进度仪表盘</b>——各词库进度、今日待背一目了然，点卡片即可直接开背。<br><br>下方按模块排列<b>章节卡片</b>（词法 · 时态语态 · 从句与非谓语 · 附录），点击进入学习。"},
  {i:"📖",t:"四个学习标签",b:"每个章节内有：<br>• <b>知识讲解</b>：系统讲解 + 表格 + 易错点<br>• <b>巩固练习</b>：入门/进阶/复习三档，<b>自动批改</b>并给解析<br>• <b>抽认卡</b>：固定搭配/动词等翻卡记忆<br>• <b>学习记录</b>：用时、成绩与错题本"},
  {i:"📕",t:"错题本",b:"在练习或闯关中<b>做错的题会自动收进</b>「学习记录 → 错题本」。<br><br>点 <b>🔁 重做错题</b> 只练错题，全部答对后自动移除——专治薄弱点。"},
  {i:"🎮",t:"闯关挑战",b:"侧边栏 <b>🎮 闯关挑战</b>：<b>连击得分</b>、限时抢答，越快越准分越高！<br><br>可<b>自选章节</b>或综合练习，结束有评级与<b>挑战记录</b>，错题同样进错题本。"},
  {i:"📚",t:"单词背诵",b:"首页或侧边栏 <b>📖 单词背诵</b>，内置三大词库：<br>• <b>考研词汇</b>　• <b>雅思词汇</b>　• <b>阅读近义词辨析</b><br><br>按<b>艾宾浩斯遗忘曲线</b>智能安排复习，可自定每日新词量；答错自动进<b>错词本</b>；每个词库进度<b>独立保存</b>，还能导出背诵记录 PDF。"},
  {i:"🔁",t:"近义词辨析",b:"「<b>阅读近义词辨析</b>」是特别的题型：给出一个单词，在 <b>3 个选项中选出它的近义词</b>。<br><br><b>不管答对答错都会给出答案</b>——高亮正确词，并展示共同含义与整组同义词，专为积累阅读替换词而设计。"},
  {i:"📝",t:"入学测试",b:"首页 <b>📝 完整版 / 📋 简化版入学测试</b>：模拟真实测试卷，填写信息后作答，<b>客观题自动批改</b>。<br><br>完成后可<b>导出 PDF</b>，方便打印或发给老师查阅。"},
  {i:"🖊️",t:"高亮与笔记",b:"在「知识讲解」里<b>选中文字</b>，即可用四种颜色<b>高亮</b>并添加<b>批注</b>。<br><br>右下角 <b>🖊️ 笔记</b> 按钮可写本章笔记。高亮和笔记都会<b>自动保存</b>，刷新不丢。"},
  {i:"🔍",t:"全文搜索",b:"侧边栏 <b>🔍 搜索语法点</b>，支持<b>中英文</b>检索所有讲解与题目（如「虚拟语气」「present perfect」），点击结果直达对应章节。"},
  {i:"⚙️",t:"顶栏设置",b:"顶栏可以：<br>• <b>☰</b> 隐藏 / 显示左侧目录<br>• <b>⚙</b> 调整<b>字体大小</b>（小→特大）<br>• 查看<b>系统时间</b><br><br>设置都会被记住。"},
  {i:"✅",t:"开始学习吧！",b:"以上就是全部功能～<br><br>随时点击顶栏 <b>⚙ → 「重看新手教程」</b> 可再次查看本引导。<br><br>祝学习愉快！ <b>— By Jimmy</b>"}
];
let tutStep=0;
function ensureTutUI(){
  if($("#tut-ov")) return;
  const o=document.createElement("div"); o.id="tut-ov"; o.className="tut-ov";
  o.innerHTML=`<div class="tut-card"><button class="tut-skip" id="tut-skip">跳过</button>
    <div class="tut-icon" id="tut-icon"></div><div class="tut-title" id="tut-title"></div>
    <div class="tut-body" id="tut-body"></div><div class="tut-dots" id="tut-dots"></div>
    <div class="tut-nav"><button id="tut-prev">上一步</button><button id="tut-next" class="primary">下一步 →</button></div></div>`;
  document.body.appendChild(o);
  $("#tut-skip").onclick=()=>closeTutorial(true);
  $("#tut-prev").onclick=()=>{ if(tutStep>0){ tutStep--; renderTut(); } };
  $("#tut-next").onclick=()=>{ if(tutStep<TUT.length-1){ tutStep++; renderTut(); } else closeTutorial(true); };
}
function renderTut(){ const s=TUT[tutStep];
  $("#tut-icon").textContent=s.i; $("#tut-title").textContent=s.t; $("#tut-body").innerHTML=s.b;
  $("#tut-dots").innerHTML=TUT.map((_,i)=>`<span class="${i===tutStep?'on':''}"></span>`).join("");
  $("#tut-prev").style.visibility=tutStep===0?"hidden":"visible";
  $("#tut-next").textContent=tutStep===TUT.length-1?"开始学习 ✓":"下一步 →";
}
function openTutorial(){ ensureTutUI(); tutStep=0; renderTut(); $("#tut-ov").classList.add("show"); }
function closeTutorial(done){ const o=$("#tut-ov"); if(o) o.classList.remove("show"); if(done){ try{ localStorage.setItem(ONBOARD_KEY,"1"); }catch(e){} } }

/* ============================ ENTRANCE EXAM ============================ */
const EXAM_KEY = "glx.exam";
function examStore(){ try{return JSON.parse(localStorage.getItem(EXAM_KEY))||{full:[],simple:[]};}catch(e){return {full:[],simple:[]};} }
function saveExams(s){ try{localStorage.setItem(EXAM_KEY,JSON.stringify(s));}catch(e){} }

let examState=null; // {type, parts, answers:[partIdx][qIdx], graded, start, studentName, studentPhone, studentSchool, studentGrade}

function renderExamSetup(type){
  stopTimer(); highlightNav(null); hideNoteFab();
  const exam = window.EXAMS[type];
  if(!exam){ goHome(); return; }
  main.innerHTML=`<section class="exam-setup">
    <div class="exam-hero">
      <h1>${esc(exam.name)}</h1>
      <p class="exam-sub">请在开始前填写以下信息，作答完毕后可自动批改客观题并导出为 PDF</p>
    </div>
    <div class="exam-form">
      <div class="ef-row">
        <label>姓名 <input id="ef-name" placeholder="你的姓名"></label>
        <label>电话 <input id="ef-phone" placeholder="手机号（选填）"></label>
      </div>
      <div class="ef-row">
        <label>学校 <input id="ef-school" placeholder="所在学校"></label>
        <label>年级 <input id="ef-grade" placeholder="年级"></label>
      </div>
    </div>
    <div class="exam-preview">
      <div class="ep-head">试卷结构预览</div>
      ${exam.parts.map((p,i)=>`<div class="ep-part">
        <span class="ep-idx">Part ${i+1}</span>
        <span class="ep-title">${esc(p.title)}</span>
        <span class="ep-info">${p.subjective?'✍️ 主观题':'🤖 自动批改'} · ${esc(p.subtitle)}</span>
      </div>`).join("")}
    </div>
    <div class="exam-actions">
      <button class="btn primary" id="exam-start">开始答题 →</button>
      <button class="btn ghost" id="exam-back">← 返回首页</button>
    </div>
    ${(()=>{
      const es=examStore();
      const allRecs=(es.full||[]).concat(es.simple||[]).sort((a,b)=>b.date-a.date);
      if(!allRecs.length) return "";
      return `<div class="exam-history">
        <div class="eh-head">📋 历史记录（${allRecs.length} 次）</div>
        <div class="eh-list">${allRecs.map((r)=>{
          const rt=r.type==="full"?"完整版":"简化版";
          const pct=r.maxObj?Math.round(r.score/r.maxObj*100):0;
          const listByType=es[r.type]||[];
          const idx=listByType.findIndex(x=>x.date===r.date);
          return `<div class="eh-item" id="eh-${r.date}">
            <span class="eh-date">${fmtDate(r.date)}</span>
            <span class="eh-type ${r.type}">${rt}</span>
            <span class="eh-name">${esc(r.name||"")}</span>
            <span class="eh-score">${r.score}/${r.maxObj} 分 · ${pct}%</span>
            <span class="eh-time">⏱ ${fmtTime(r.timeSec||0)}</span>
            <button class="eh-view" data-idx="${idx}" data-type="${r.type}">📄 查看并导出</button>
          </div>`;
        }).join("")}</div>
        <button class="btn ghost" id="eh-clear" style="margin-top:8px">🗑 清空记录</button>
      </div>`;
    })()}
  </section>`;
  $("#exam-start").onclick=()=>{
    const sname=$("#ef-name").value.trim()||"未填写";
    examState={type, parts:exam.parts.map(p=>({...p})), answers:exam.parts.map(p=>p.items.map(()=>null)), graded:false, start:Date.now(), studentName:sname, studentPhone:$("#ef-phone").value.trim(), studentSchool:$("#ef-school").value.trim(), studentGrade:$("#ef-grade").value.trim()};
    renderExam();
  };
  $("#exam-back").onclick=goHome;
  // History buttons
  main.querySelectorAll(".eh-view").forEach(b=>{
    b.onclick=()=>{ viewExamRecord(b.dataset.type, +b.dataset.idx); };
  });
  const ehc=$("#eh-clear");
  if(ehc) ehc.onclick=()=>{ if(confirm("确定清空所有入学测试记录？")){ saveExams({full:[],simple:[]}); renderExamSetup(type); } };
  window.scrollTo(0,0);
}

function renderExam(){
  if(!examState) return goHome();
  hideNoteFab();
  const exam=window.EXAMS[examState.type];
  let html=`<section class="exam-paper" id="exam-paper">
    <div class="exam-header">
      <h1>${esc(exam.name)}</h1>
      <div class="exam-info-bar">
        <span>姓名：<b>${esc(examState.studentName)}</b></span>
        <span>电话：<b>${esc(examState.studentPhone||"未填写")}</b></span>
        <span>学校：<b>${esc(examState.studentSchool||"未填写")}</b></span>
        <span>年级：<b>${esc(examState.studentGrade||"未填写")}</b></span>
      </div>
      <div class="exam-timer" id="exam-timer">⏱ ${fmtTime(0)}</div>
    </div>`;

  examState.parts.forEach((p,pi)=>{
    html+=`<div class="exam-part" id="exam-part-${pi}">
      <div class="exp-head">
        <span class="exp-num">Part ${pi+1}</span>
        <div class="exp-titles">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.subtitle)}</p>
        </div>
        ${p.subjective?`<span class="exp-badge subj">✍️ 主观题</span>`:`<span class="exp-badge obj">🤖 自动批改</span>`}
      </div>`;

    p.items.forEach((q,qi)=>{
      if(p.type==="vocab"){
        html+=`<div class="exam-q vocab" id="eq-${pi}-${qi}">
          <span class="eq-idx">${qi+1}</span>
          <span class="eq-dir">${q.dir==="en→zh"?"英→中":"中→英"}</span>
          <span class="eq-word">${esc(q.q)}</span>
          <input type="text" class="eq-inp" data-pi="${pi}" data-qi="${qi}" placeholder="写下对应${q.dir==='en→zh'?'中文':'英文'}…" autocomplete="off">
        </div>`;
      }else if(p.type==="mcq"){
        html+=`<div class="exam-q mcq" id="eq-${pi}-${qi}">
          <div class="eq-stem"><span class="eq-idx">${qi+1}</span><span class="eq-qtext">${q.q}</span></div>
          <div class="eq-opts">${q.opts.map((o,j)=>`<label class="eq-opt" data-pi="${pi}" data-qi="${qi}" data-v="${j}"><input type="radio" name="emcq-${pi}-${qi}" value="${j}"><span class="eq-key">${String.fromCharCode(65+j)}.</span><span>${esc(o)}</span></label>`).join("")}</div>
        </div>`;
      }else if(p.type==="verb"){
        html+=`<div class="exam-q fill" id="eq-${pi}-${qi}">
          <span class="eq-idx">${qi+1}</span>
          <span class="eq-qtext fill-text">${esc(q.q)}</span>
          <input type="text" class="eq-inp" data-pi="${pi}" data-qi="${qi}" placeholder="填写动词正确形式…" autocomplete="off">
        </div>`;
      }else if(p.type==="trans"){
        html+=`<div class="exam-q trans" id="eq-${pi}-${qi}">
          <span class="eq-idx">${qi+1}</span>
          <div class="eq-trans-body">
            <div class="eq-zh">${esc(q.q)}</div>
            <textarea class="eq-ta" data-pi="${pi}" data-qi="${qi}" rows="2" placeholder="在此写出英文翻译…"></textarea>
            <div class="eq-ref" id="eq-ref-${pi}-${qi}"></div>
          </div>
        </div>`;
      }else if(p.type==="clause"){
        html+=`<div class="exam-q clause" id="eq-${pi}-${qi}">
          <span class="eq-idx">${qi+1}</span>
          <div class="eq-clause-body">
            <div class="eq-sentence">${esc(q.q)}</div>
            <div class="eq-cfields">
              <div class="eq-cf"><label>从句类型与划线</label><input type="text" class="eq-inp" data-pi="${pi}" data-qi="${qi}" data-field="clause" placeholder="指出从句类型，可描述位置…"></div>
              <div class="eq-cf"><label>中文翻译</label><input type="text" class="eq-inp" data-pi="${pi}" data-qi="${qi}" data-field="trans" placeholder="翻译句子…"></div>
            </div>
            <div class="eq-ref" id="eq-ref-${pi}-${qi}"></div>
          </div>
        </div>`;
      }
    });
    html+=`</div>`;
  });

  html+=`<div class="exam-submit-bar">
    <button class="btn primary" id="exam-submit">📝 提交批改</button>
    <button class="btn ghost" id="exam-reset">↺ 清空重做</button>
    <button class="btn ghost" id="exam-quit">← 返回首页</button>
  </div></section>`;

  main.innerHTML=html;
  bindExam();
  // Timer
  examState._timerInt=setInterval(()=>{
    const el=$("#exam-timer");
    if(el) el.textContent="⏱ "+fmtTime(Math.round((Date.now()-examState.start)/1000));
  },1000);
  window.scrollTo(0,0);
}

function bindExam(){
  if(!examState||examState.graded) return;
  // Vocab & verb fill inputs
  main.querySelectorAll(".eq-inp").forEach(inp=>{
    inp.oninput=()=>{
      const pi=+inp.dataset.pi, qi=+inp.dataset.qi;
      if(!examState.answers[pi]) examState.answers[pi]=[];
      if(inp.dataset.field==="clause"||inp.dataset.field==="trans"){
        if(!examState.answers[pi][qi]) examState.answers[pi][qi]={};
        examState.answers[pi][qi][inp.dataset.field]=inp.value;
      }else{
        examState.answers[pi][qi]=inp.value;
      }
    };
  });
  // Textareas
  main.querySelectorAll(".eq-ta").forEach(ta=>{
    ta.oninput=()=>{
      const pi=+ta.dataset.pi, qi=+ta.dataset.qi;
      if(!examState.answers[pi]) examState.answers[pi]=[];
      examState.answers[pi][qi]=ta.value;
    };
  });
  // MCQ radio
  main.querySelectorAll(".eq-opt").forEach(opt=>{
    opt.onclick=()=>{
      const pi=+opt.dataset.pi, qi=+opt.dataset.qi, v=opt.dataset.v;
      if(!examState.answers[pi]) examState.answers[pi]=[];
      examState.answers[pi][qi]=v;
    };
  });
  // Buttons
  $("#exam-submit").onclick=gradeExam;
  $("#exam-reset").onclick=()=>{ if(confirm("确定清空所有已填写内容？")){ examState.answers=examState.parts.map(p=>p.items.map(()=>null)); renderExam(); } };
  $("#exam-quit").onclick=()=>{ if(confirm("确定退出？已填写内容将丢失。")){ if(examState._timerInt) clearInterval(examState._timerInt); examState=null; goHome(); } };
}

function normalizeAns(s){ return String(s==null?"":s).toLowerCase().trim().replace(/[；;，,、\\/·]+/g," ").replace(/\\s+/g," ").replace(/[.。!！?？'"]/g,"").trim(); }
function normalizeVocab(s){ var t=normalizeAns(s); t=t.replace(/的$/,"").trim(); return t; }

function gradeExam(){
  if(!examState||examState.graded) return;
  examState.graded=true;
  if(examState._timerInt){ clearInterval(examState._timerInt); examState._timerInt=null; }
  const timeSec=Math.round((Date.now()-examState.start)/1000);

  let totalObj=0, correctObj=0;
  const partResults=[];

  examState.parts.forEach((p,pi)=>{
    let pCorrect=0, pTotal=0;
    p.items.forEach((q,qi)=>{
      const ans=examState.answers[pi]?examState.answers[pi][qi]:null;
      const card=$("#eq-"+pi+"-"+qi);
      if(!card) return;

      if(p.type==="vocab"){
        pTotal++; totalObj++;
        const ok=q.a.some(a=>normalizeVocab(ans)===normalizeVocab(a));
        if(ok){ pCorrect++; correctObj++; }
        card.classList.add("graded",ok?"ok":"no");
        const ref=card.querySelector(".eq-ref")||document.createElement("div");
        ref.className="eq-ref show";
        ref.innerHTML=ok?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 参考答案：'+esc(q.a.join(" / "))+'</span>';
        if(ok) ref.innerHTML+='<span class="ans-ref"> （答案：'+esc(q.a.join(" / "))+'）</span>';
        if(!card.querySelector(".eq-ref")) card.appendChild(ref);
      }else if(p.type==="mcq"){
        pTotal++; totalObj++;
        const ok=ans!==null&&(+ans)===q.a;
        if(ok){ pCorrect++; correctObj++; }
        card.classList.add("graded",ok?"ok":"no");
        card.querySelectorAll(".eq-opt").forEach(o=>{
          o.classList.add("done");
          if(+o.dataset.v===q.a) o.classList.add("correct");
          if(+o.dataset.v===+ans&&+ans!==q.a) o.classList.add("wrong");
          o.querySelector("input").disabled=true;
        });
        const ref=card.querySelector(".eq-ref")||document.createElement("div");
        ref.className="eq-ref show";
        ref.innerHTML=ok?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 正确答案：'+String.fromCharCode(65+q.a)+". "+esc(q.opts[q.a])+'</span>';
        if(!card.querySelector(".eq-ref")) card.appendChild(ref);
      }else if(p.type==="verb"){
        pTotal++; totalObj++;
        const corrects=q.multi?q.a:q.a;
        let ok=false;
        if(q.multi){
          // Multi-blank: split answer by spaces, check all non-empty
          const parts=String(ans||"").split(/[\\s,，、]+/).filter(Boolean);
          ok=parts.length===q.a.length && q.a.every((a,i)=>normalizeAns(parts[i])===normalizeAns(a));
        }else{
          ok=q.a.some(a=>normalizeAns(ans)===normalizeAns(a));
        }
        if(ok){ pCorrect++; correctObj++; }
        card.classList.add("graded",ok?"ok":"no");
        const inp=card.querySelector(".eq-inp"); if(inp) inp.disabled=true;
        const ref=card.querySelector(".eq-ref")||document.createElement("div");
        ref.className="eq-ref show";
        ref.innerHTML=ok?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 参考答案：'+esc(q.a.join("  |  "))+'</span>';
        if(!card.querySelector(".eq-ref")) card.appendChild(ref);
      }else if(p.type==="trans"){
        card.classList.add("graded","ref");
        const ta=card.querySelector(".eq-ta"); if(ta) ta.disabled=true;
        const ref=$("#eq-ref-"+pi+"-"+qi);
        if(ref){ ref.className="eq-ref show"; ref.innerHTML='<span class="ans-ref">📝 参考答案：</span>'+esc(q.ref); }
      }else if(p.type==="clause"){
        card.classList.add("graded","ref");
        card.querySelectorAll(".eq-inp").forEach(i=>i.disabled=true);
        const ref=$("#eq-ref-"+pi+"-"+qi);
        if(ref){ ref.className="eq-ref show";
          ref.innerHTML='<span class="ans-ref">📝 从句分析：</span>'+esc(q.refClause)+'<br><span class="ans-ref">📝 参考翻译：</span>'+esc(q.refTrans); }
      }
    });
    partResults.push({correct:pCorrect,total:pTotal,obj:pTotal>0});
  });

  // Calculate score
  let totalScore=0, maxScore=0;
  examState.parts.forEach((p,pi)=>{
    const pr=partResults[pi];
    if(p.subjective){
      // Subjective parts get full points for now (user self-grades)
      maxScore+=p.items.length*p.pointEach;
    }else{
      maxScore+=p.items.length*p.pointEach;
      totalScore+=pr.correct*p.pointEach;
    }
  });
  // Actually for subjective we don't auto-score, so just show objective
  const objMax=examState.parts.filter(p=>!p.subjective).reduce((s,p)=>s+p.items.length*p.pointEach,0);
  const subMax=examState.parts.filter(p=>p.subjective).reduce((s,p)=>s+p.items.length*p.pointEach,0);

  const pct=objMax?Math.round(totalScore/objMax*100):0;
  const cls=pct>=80?"good":pct>=50?"mid":"low";
  const msg=pct>=80?"基础扎实，表现优秀！":pct>=50?"不错，继续努力！":"建议从基础语法开始系统学习。";

  // Score banner
  const banner=document.createElement("div");
  banner.className="exam-result "+cls;
  // Build per-part breakdown
  let partRows="";
  examState.parts.forEach((p,pi)=>{
    const pr=partResults[pi];
    if(p.subjective){
      partRows+=`<tr><td>Part ${pi+1} ${esc(p.title.replace(/Part \d+\s*/,''))}</td><td class="er-subj">✍️ 主观题</td><td>${p.items.length*p.pointEach} 分</td></tr>`;
    }else{
      const got=pr.correct*p.pointEach;
      const max=p.items.length*p.pointEach;
      partRows+=`<tr><td>Part ${pi+1} ${esc(p.title.replace(/Part \d+\s*/,''))}</td><td class="${got===max?'er-full':got>0?'er-part':'er-zero'}">${pr.correct}/${p.items.length} 对</td><td><b>${got}</b> / ${max} 分</td></tr>`;
    }
  });
  banner.innerHTML=`<div class="er-big">${totalScore}<small> / ${objMax} 分</small></div>
    <div class="er-txt"><b>客观题得分 · 正确率 ${pct}%</b>
    <div>用时 ${fmtTime(timeSec)} · ${msg}</div>
    <table class="er-breakdown"><tbody>${partRows}</tbody></table>
    <div class="er-note">主观题共 ${subMax} 分（翻译 + 从句分析）已显示参考答案，请自行对照评分。</div>
    </div>`;
  const paper=$("#exam-paper");
  if(paper) paper.insertBefore(banner,paper.firstChild.nextSibling);

  // Disable all inputs
  main.querySelectorAll(".eq-inp, .eq-ta, .eq-opt input").forEach(el=>el.disabled=true);
  main.querySelectorAll(".eq-opt").forEach(o=>o.style.pointerEvents="none");

  // Save full snapshot for history
  const es=examStore();
  const snapshot={
    date:Date.now(), name:examState.studentName, phone:examState.studentPhone,
    school:examState.studentSchool, grade:examState.studentGrade,
    score:totalScore, maxObj:objMax, subMax, timeSec, pct, type:examState.type,
    answers:examState.answers, partResults:partResults.map(pr=>({correct:pr.correct,total:pr.total}))
  };
  es[examState.type].push(snapshot);
  if(es[examState.type].length>20) es[examState.type].length=20;
  saveExams(es);

  // Show export button
  const bar=document.createElement("div");
  bar.className="exam-submit-bar";
  bar.innerHTML=`<button class="btn teal" id="exam-pdf">📄 导出为 PDF</button>
    <button class="btn ghost" id="exam-retry">🔁 重新作答</button>
    <button class="btn ghost" id="exam-home">🏠 返回首页</button>`;
  paper.appendChild(bar);
  const examType=examState.type;
  $("#exam-pdf").onclick=exportExamPDF;
  $("#exam-retry").onclick=()=>{ examState=null; renderExamSetup(examType); };
  $("#exam-home").onclick=goHome;
  // Replace old bar
  const oldBar=main.querySelector(".exam-submit-bar:not(:last-child)");
  if(oldBar) oldBar.remove();

  banner.scrollIntoView({behavior:"smooth",block:"center"});
  toast("批改完成，正在生成 PDF…");
  setTimeout(()=>exportExamPDF(), 600);
}

function viewExamRecord(type, idx){
  const es=examStore();
  const list=es[type]||[];
  if(idx<0||idx>=list.length){ toast("记录不存在"); return; }
  const snap=list[idx];
  const exam=window.EXAMS[type];
  if(!exam){ return; }
  // Reconstruct exam state
  examState={
    type, parts:exam.parts.map(p=>({...p})),
    answers:snap.answers||exam.parts.map(p=>p.items.map(()=>null)),
    graded:true, start:snap.date-snap.timeSec*1000,
    studentName:snap.name||"", studentPhone:snap.phone||"",
    studentSchool:snap.school||"", studentGrade:snap.grade||""
  };
  renderExam();
  // After render, inject grading results
  setTimeout(()=>{
    if(!examState) return;
    const timeSec=snap.timeSec||0;
    // Show score banner
    const pct=snap.pct||(snap.maxObj?Math.round(snap.score/snap.maxObj*100):0);
    const cls=pct>=80?"good":pct>=50?"mid":"low";
    const msg=pct>=80?"基础扎实，表现优秀！":pct>=50?"不错，继续努力！":"建议从基础语法开始系统学习。";
    let partRows="";
    exam.parts.forEach((p,pi)=>{
      const pr=(snap.partResults||[])[pi]||{correct:0,total:p.items.length};
      if(p.subjective){
        partRows+=`<tr><td>Part ${pi+1} ${esc(p.title.replace(/Part \\d+\\s*/,''))}</td><td class="er-subj">✍️ 主观题</td><td>${p.items.length*p.pointEach} 分</td></tr>`;
      }else{
        const got=pr.correct*p.pointEach;
        const max=p.items.length*p.pointEach;
        partRows+=`<tr><td>Part ${pi+1} ${esc(p.title.replace(/Part \\d+\\s*/,''))}</td><td class="${got===max?'er-full':got>0?'er-part':'er-zero'}">${pr.correct}/${p.items.length} 对</td><td><b>${got}</b> / ${max} 分</td></tr>`;
      }
    });
    const subMax=exam.parts.filter(p=>p.subjective).reduce((s,p)=>s+p.items.length*p.pointEach,0);
    const objMax=exam.parts.filter(p=>!p.subjective).reduce((s,p)=>s+p.items.length*p.pointEach,0);
    const banner=document.createElement("div");
    banner.className="exam-result "+cls;
    banner.innerHTML=`<div class="er-big">${snap.score}<small> / ${objMax} 分</small></div>
      <div class="er-txt"><b>客观题得分 · 正确率 ${pct}%</b>
      <div>用时 ${fmtTime(timeSec)} · ${msg} · ${fmtDate(snap.date)}</div>
      <table class="er-breakdown"><tbody>${partRows}</tbody></table>
      <div class="er-note">主观题共 ${subMax} 分 · 历史记录回看</div>
      </div>`;
    const paper=$("#exam-paper");
    if(paper) paper.insertBefore(banner,paper.firstChild.nextSibling);
    // Grade UI on questions
    exam.parts.forEach((p,pi)=>{
      p.items.forEach((q,qi)=>{
        const ans=snap.answers[pi]?snap.answers[pi][qi]:null;
        const card=$("#eq-"+pi+"-"+qi);
        if(!card) return;
        if(p.subjective){
          card.classList.add("graded","ref");
          card.querySelectorAll(".eq-inp,.eq-ta").forEach(el=>el.disabled=true);
          const ref=$("#eq-ref-"+pi+"-"+qi);
          if(ref){ ref.className="eq-ref show";
            if(p.type==="trans") ref.innerHTML='<span class="ans-ref">📝 参考答案：</span>'+esc(q.ref||"");
            else ref.innerHTML='<span class="ans-ref">📝 从句分析：</span>'+esc(q.refClause||"")+'<br><span class="ans-ref">📝 参考翻译：</span>'+esc(q.refTrans||""); }
        }else{
          const ok=(snap.partResults[pi]&&snap.partResults[pi].correct>0)?true:false; // approximate
          card.classList.add("graded","no");
          if(p.type==="vocab"){
            card.classList.add(ans!==null&&q.a.some(a=>normalizeVocab(ans)===normalizeVocab(a))?"ok":"no");
            card.querySelector(".eq-inp").disabled=true;
            const ref=card.querySelector(".eq-ref")||document.createElement("div");
            ref.className="eq-ref show";
            const isOk=ans!==null&&q.a.some(a=>normalizeVocab(ans)===normalizeVocab(a));
            ref.innerHTML=isOk?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 参考答案：'+esc(q.a.join(" / "))+'</span>';
            if(isOk) ref.innerHTML+='<span class="ans-ref"> （答案：'+esc(q.a.join(" / "))+'）</span>';
            if(!card.querySelector(".eq-ref")) card.appendChild(ref);
          }else if(p.type==="mcq"){
            card.classList.add(ans!==null&&(+ans)===q.a?"ok":"no");
            card.querySelectorAll(".eq-opt").forEach(o=>{
              o.classList.add("done");
              if(+o.dataset.v===q.a) o.classList.add("correct");
              if(+o.dataset.v===+ans&&+ans!==q.a) o.classList.add("wrong");
              o.querySelector("input").disabled=true;
            });
            const mref=card.querySelector(".eq-ref")||document.createElement("div");
            mref.className="eq-ref show";
            const mcqOk=ans!==null&&(+ans)===q.a;
            mref.innerHTML=mcqOk?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 正确答案：'+String.fromCharCode(65+q.a)+". "+esc(q.opts[q.a])+'</span>';
            if(!card.querySelector(".eq-ref")) card.appendChild(mref);
          }else if(p.type==="verb"){
            const verbOk=ans!==null&&q.a.some(a=>normalizeAns(ans)===normalizeAns(a));
            card.classList.add(verbOk?"ok":"no");
            card.querySelector(".eq-inp").disabled=true;
            const vref=card.querySelector(".eq-ref")||document.createElement("div");
            vref.className="eq-ref show";
            vref.innerHTML=verbOk?'<span class="ans-ok">✓ 正确</span>':'<span class="ans-no">✗ 参考答案：'+esc(q.a.join("  |  "))+'</span>';
            if(verbOk) vref.innerHTML+='<span class="ans-ref"> （答案：'+esc(q.a.join("  |  "))+'）</span>';
            if(!card.querySelector(".eq-ref")) card.appendChild(vref);
          }
        }
      });
    });
    // Bind export button
    const bar=document.createElement("div");
    bar.className="exam-submit-bar";
    bar.innerHTML=`<button class="btn teal" id="exam-pdf2">📄 导出为 PDF</button>
      <button class="btn ghost" id="exam-back2">← 返回</button>`;
    const paper2=$("#exam-paper");
    if(paper2) paper2.appendChild(bar);
    $("#exam-pdf2").onclick=exportExamPDF;
    $("#exam-back2").onclick=()=>renderExamSetup(type);
    // Also hide the old buttons from renderExam
    const oldBar=main.querySelector(".exam-submit-bar");
    if(oldBar) oldBar.style.display="none";
    const oldTimer=$("#exam-timer");
    if(oldTimer) oldTimer.textContent="⏱ "+fmtTime(timeSec);
  },100);
}

// PDF export: browser native print for real text PDF (desktop/mobile),
// html2canvas image overlay for WeChat (can't trigger print-to-PDF).
let _pdfExportTarget=null;
let _pdfChapterData=null;

function doExportPDF(origTitle){
  ensurePrintElems();
  const isWX=/MicroMessenger/i.test(navigator.userAgent);

  if(isWX){
    // WeChat: in-app browser can't print → capture as high-res image
    if(typeof html2canvas==="undefined"){ toast("库未加载，请刷新页面"); return; }
    toast("正在生成高清图片…");
    const el=document.getElementById("main");
    if(!el){ toast("生成失败"); return; }
    const dpr=window.devicePixelRatio||2;
    let scale=Math.min(4,Math.max(2.5,dpr*2));
    const w=el.scrollWidth||el.offsetWidth||800, h=el.scrollHeight||el.offsetHeight||1000;
    while(scale>1&&((w*scale>12000)||(h*scale>12000)||(w*scale*h*scale>24000000))) scale-=0.25;
    scale=Math.max(1,+scale.toFixed(2));
    html2canvas(el,{scale,useCORS:true,logging:false,backgroundColor:"#ffffff"}).then(canvas=>{
      showImageOverlayWeChat(canvas, document.title);
      document.title=origTitle;
      toast("长按图片保存到相册 ✓");
      const inj=$("#print-notes-inject"); if(inj) inj.remove();
    }).catch(e=>{
      console.error(e);
      toast("生成失败，请截屏保存");
    });
    return;
  }

  // Non-WeChat: browser native print → true text PDF, no images, no blur
  toast("正在准备打印…");
  const style=document.createElement("style");
  style.id="pdf-print-style";
  style.textContent=`@media print{
    body{background:#fff!important}
    #sidebar,#topbar,#brand-badge,#note-fab,#hl-bar,#hl-edit,.note-drawer,#scrim,#browser-tip,
    .exam-submit-bar,.ch-pdf-btn,.timer-pill,#live-timer,.tabs,.dl-actions,.voc-switch,
    .tb-nav-btn,.topbar-nav,.wb-export-ctrl{display:none!important}
    ${_pdfExportTarget==="wordbook"?".wb-export-unit{break-before:page} .wb-export-unit:first-child{break-before:auto} .wbx-table{width:100%;border-collapse:collapse} .wbx-table th,.wbx-table td{border:1px solid #ccc;padding:4px 8px;font-size:12px;text-align:left} .wbx-doc-title{font-size:18px;font-weight:700;margin:0 0 10px}":""}
    body.has-tip #topbar,body.has-tip #sidebar{top:0!important}
    #app{padding:0!important;margin:0!important;display:block!important}
    #main{padding:16px 20px!important;max-width:100%!important}
    .exam-paper,.ch-hero{box-shadow:none!important;border-radius:0!important}
    .exam-q.graded,.lesson,.q-card,.ch-hero,.exam-paper .eq-card,.result-banner,.dl-q,.dl-sec{break-inside:avoid}
    .print-header{display:block!important}
    ${_pdfExportTarget==="exam"?".print-footer,#print-footer{display:none!important}":".print-footer{display:flex!important}"}
    .print-notes{display:block!important}
  }@media screen{#pdf-print-style{display:none}}`;
  document.head.appendChild(style);
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{
      document.title=origTitle;
      try{document.head.removeChild(style);}catch(e){}
      const inj=$("#print-notes-inject"); if(inj) inj.remove();
    },2000);
  },300);
}

function exportExamPDF(){
  const origTitle=document.title;
  const exam=window.EXAMS[examState?examState.type:"full"];
  document.title=(exam?exam.name:"入学测试卷")+" - 青山沃思";
  _pdfExportTarget="exam";
  doExportPDF(origTitle);
}

function exportChapterPDF(c){
  const origTitle=document.title;
  document.title=shortTitle(c.title)+" - 青山沃思语法";
  _pdfExportTarget="chapter";
  _pdfChapterData=c;
  // Inject notes
  const notes=store.ann&&store.ann[c.id]?store.ann[c.id].note||"":"";
  const existNote=$("#print-notes-inject");
  if(existNote) existNote.remove();
  if(notes){
    const nd=document.createElement("div");
    nd.id="print-notes-inject";
    nd.className="print-notes";
    nd.innerHTML=`<div class="print-notes"><h4>📝 本章笔记</h4><p>${esc(notes)}</p></div>`;
    const tabBody=$("#tab-body");
    if(tabBody) tabBody.insertBefore(nd, tabBody.firstChild);
  }
  doExportPDF(origTitle);
}

// WeChat fallback: show the captured page as a single high-res image in a
// full-screen overlay. WeChat supports long-press-to-save on <img>, and the
// image keeps full resolution so pinch-zoom and saved copies stay sharp.
function showImageOverlayWeChat(canvas, filename){
  let dataURL;
  // PNG is lossless — keeps small fonts and table lines crisp.
  try{ dataURL=canvas.toDataURL("image/png"); }
  catch(e){ toast("生成失败，请截屏保存"); return; }
  const old=document.getElementById("wx-pdf-overlay"); if(old) old.remove();
  const ov=document.createElement("div");
  ov.id="wx-pdf-overlay";
  ov.innerHTML=`
    <div class="wx-pdf-bar">
      <span class="wx-pdf-tip">长按图片保存到相册（已生成最高清晰度）</span>
      <button class="wx-pdf-close" type="button" aria-label="关闭">✕ 关闭</button>
    </div>
    <div class="wx-pdf-scroll"><img class="wx-pdf-img" src="${dataURL}" alt="${esc(filename)}"></div>`;
  document.body.appendChild(ov);
  document.body.style.overflow="hidden";
  const close=()=>{ ov.remove(); document.body.style.overflow=""; };
  ov.querySelector(".wx-pdf-close").addEventListener("click",close);
}

function ensurePrintElems(){
  const m=document.getElementById("main");
  if(!m) return;
  if(!document.getElementById("print-header")){
    const hd=document.createElement("div");
    hd.id="print-header";
    hd.className="print-header";
    hd.innerHTML='<span>青山沃思</span>';
    m.insertBefore(hd, m.firstChild);
  }
  if(!document.getElementById("print-footer")){
    const ft=document.createElement("div");
    ft.id="print-footer";
    ft.className="print-footer";
    ft.innerHTML='<img src="Jimmy\'s logo.png" alt="Jimmy" class="pf-logo">';
    m.appendChild(ft);
  }
}

/* ============================ 单词背诵 (Vocabulary · 艾宾浩斯 SRS) ============================ */
// 可选词库：每个词库独立记录进度（计划 / 错词本 / 记录互不影响）
const VOCAB_SETS = [
  { id:"kaoyan", name:"考研词汇", sub:"考研核心词汇", words: window.VOCAB || [] },
  { id:"ielts",  name:"雅思词汇", sub:"雅思高频词汇", words: window.VOCAB_IELTS || [] },
  { id:"syn",    name:"阅读近义词辨析", sub:"超高频同义词替换", words: window.VOCAB_SYN || [], mode:"synonym", unit:"组" },
  { id:"suffix", name:"名词后缀", sub:"高频名词后缀 · 含义辨析", words: window.VOCAB_SUFFIX || [], mode:"suffix", unit:"个" },
];
function vsetById(id){ return WB_LOADED[id] || VOCAB_SETS.find(s=>s.id===id) || VOCAB_SETS[0]; }
function vUnit(id){ return vsetById(id||curSetId).unit || "词"; }

/* ---------- 词书（idictation 词书库，懒加载） ---------- */
const WB_CAT = (window.WB_CATALOG && window.WB_CATALOG.categories) || [];
const WB_LOADED = {};              // setId("wb:<id>") -> 动态词库对象（含 words / raw）
function wbSetId(id){ return "wb:"+id; }
// 在目录中查找某词书的元信息（含所属分类/教材）
function wbFindMeta(id){
  for(const c of WB_CAT){ for(const s of (c.scenes||[])){ for(const b of (s.books||[])){
    if(String(b.id)===String(id)) return Object.assign({category:c.name, scene:s.name}, b);
  } } }
  return null;
}
function isWbSet(id){ const s=vsetById(id||curSetId); return !!(s && s.kind==="wb"); }
function vSetKind(id){ const s=vsetById(id||curSetId); return (s&&s.kind)||"core"; }
// 词库主页「切换/返回」按钮的目标（词书→词书库；雅思话题→话题列表；核心词库→词库选择）
function vBackHash(){ const k=vSetKind(); return k==="wb"?"#/vocab/books":k==="it"?"#/vocab/ielts-topic":"#/vocab"; }
// 词书库分类快速入口：雅思/托福/高中/四级 置顶，其余按分类细分（教材/其他加分类前缀去重）
function wbQuickEntries(){
  const priority=[
    {label:"雅思", cat:"留学", scene:"雅思"},
    {label:"托福", cat:"留学", scene:"托福"},
    {label:"高中", cat:"高中"},
    {label:"四级", cat:"大学", scene:"四级"},
  ];
  const seen={}; priority.forEach(p=>{ seen[p.cat+"|"+(p.scene||"")]=1; });
  const rest=[];
  ["大学","留学","初中","高中"].forEach(catName=>{
    const c=WB_CAT.find(x=>x.name===catName); if(!c) return;
    (c.scenes||[]).forEach(s=>{
      const key=catName+"|"+s.name; if(seen[key]) return; seen[key]=1;
      const ambiguous = (catName==="初中"||catName==="高中"||s.name==="其他");
      rest.push({label:(ambiguous?catName+s.name:s.name), cat:catName, scene:s.name});
    });
  });
  return priority.map(p=>Object.assign({pri:true},p)).concat(rest);
}
// 首页内联筛选：某分类/细分下的词书列表 HTML（不跳转）
function wbQuickResultsHTML(cat, scene){
  const c=WB_CAT.find(x=>x.name===cat); if(!c) return "";
  const scenes = scene ? (c.scenes||[]).filter(s=>s.name===scene) : (c.scenes||[]);
  if(!scenes.length) return "";
  return scenes.map(s=>`<div class="wb-scene" data-scene="${esc(s.name)}">
    <div class="wb-scene-h"><span>${esc(cat)} · ${esc(s.name)}</span><span class="wb-scene-n">${s.books.length} 本</span></div>
    <div class="wb-books">${s.books.map(b=>{
      const p=vall.sets[wbSetId(b.id)]; const learned=p?(p.cursor||0):0;
      const badge=learned>0?`<span class="wb-b-prog">已学 ${learned}/${b.words}</span>`:`<span class="wb-b-new">${b.words} 词</span>`;
      return `<button class="wb-book" data-id="${esc(String(b.id))}"><span class="wb-b-name">${esc(b.name)}</span><span class="wb-b-meta">${b.chapters?b.chapters+' 单元 · ':''}${badge}</span></button>`;
    }).join("")}</div>
  </div>`).join("");
}
// 当前词库对应的原始词条（词书含例句/英文释义），非词书返回 null
function vRawEntry(idx){ const s=vsetById(curSetId); return (s && s.raw && s.raw[idx]) || null; }

/* ---------- 背诵考查形式（看词选义 / 听音选义 / 听写 / 默写） ---------- */
const V_MODES = [
  { k:"choice",    label:"看词选义", desc:"看单词，选中文释义" },
  { k:"revchoice", label:"看义选词", desc:"看中文释义，选出对应单词" },
  { k:"audio",     label:"听音选义", desc:"听发音，选出对应单词" },
  { k:"dictation", label:"听写",     desc:"听发音，拼写单词" },
  { k:"spell",     label:"默写",     desc:"看中文释义，拼写单词" },
];
// 近义词/后缀等特殊词库保留各自专用玩法，不启用四模式切换
function vSupportsModes(){ const m=vsetById(curSetId).mode; return m!=="synonym" && m!=="suffix"; }
function vStdMode(){ return vSupportsModes() ? (vstore.smode||"choice") : "choice"; }
function vModeLabel(k){ const m=V_MODES.find(x=>x.k===k); return m?m.label:"看词选义"; }
// 背诵中随时切换考查形式：卡片顶栏的下拉，改后立即以新形式重绘当前词
function vModeSwitchHTML(){
  if(!vSupportsModes()) return "";
  const cur=(vsess&&vsess.studyMode)||vStdMode();
  return `<select class="vc-mode-sel" id="vc-mode-sel" title="切换考查形式">`+
    V_MODES.map(m=>`<option value="${m.k}"${m.k===cur?" selected":""}>${esc(m.label)}</option>`).join("")+`</select>`;
}
// 背诵卡片顶栏「回到学习」按钮：回到本轮学习模式浏览词汇
function vLearnBtnHTML(){
  return (vsess && vsess.origQueue && vSupportsModes()) ? '<button class="vc-back-learn" id="vc-back-learn" title="回到学习模式浏览本轮词汇">📖 回到学习模式</button>' : "";
}
function vBindModeSwitch(){
  const sel=document.getElementById("vc-mode-sel");
  if(sel) sel.onchange=()=>{
    const m=sel.value;
    vstore.smode=m; vsave();
    if(vsess){ vsess.studyMode=m; vsess.cur=null; vAccumTime&&(vsess.cardShownAt=null); vocabCard(); }
  };
  const lb=document.getElementById("vc-back-learn");
  if(lb) lb.onclick=()=>{ if(vsess&&vsess.origQueue) renderVocabLearn(vsess.origQueue.slice(), vsess.mode); };
}
// 拼写归一化：小写、去除非字母（保留空格与连字符）以做宽松比对
function vNormWord(s){ return (s||"").toLowerCase().replace(/[^a-z\s-]/g,"").replace(/\s+/g," ").trim(); }
function vSpellMatch(input, word){
  const got=vNormWord(input);
  const variants=[];
  (word||"").split("/").forEach(v=>variants.push(vNormWord(v)));
  variants.push(vNormWord(word));
  return variants.filter(Boolean).indexOf(got)>=0;
}
// 单词背诵首页：发音语音选择（男声/女声自由切换）
function vvRateRowHTML(){
  return `<div class="vv-rate-row">
    <span class="vv-rate-lab">🐢 语速</span>
    <input type="range" id="vv-rate" class="vv-rate" min="0.5" max="1.3" step="0.05" value="${_rate}">
    <span class="vv-rate-val" id="vv-rate-val">${_rate.toFixed(2)}×</span> 🐇
    <button class="vv-test" id="vv-test">🔊 试听</button>
  </div>`;
}
function vocabVoiceHTML(){
  if(!('speechSynthesis' in window)) return `<div class="voc-voice"><div class="vv-head">🔊 单词发音语音</div><div class="vv-tip">当前浏览器不支持语音朗读。</div></div>`;
  const vs=enVoices(), cur=currentVoice(), curKey=voiceKey(cur);
  if(!vs.length){
    return `<div class="voc-voice"><div class="vv-head">🔊 单词发音 · 语速</div>
      ${vvRateRowHTML()}
      <div class="vv-tip" id="vv-loading">正在加载系统语音…（若长时间无语音，请在系统设置中安装英文（English）语音包后刷新本页）</div></div>`;
  }
  const male=vs.find(v=>voiceGender(v)==="male"), female=vs.find(v=>voiceGender(v)==="female");
  const opts=vs.map(v=>{ const g=voiceGender(v); return `<option value="${esc(voiceKey(v))}"${voiceKey(v)===curKey?" selected":""}>${esc(v.name)}（${esc(v.lang)}）${g==="male"?" · 男声":g==="female"?" · 女声":""}</option>`; }).join("");
  return `<div class="voc-voice">
    <div class="vv-head">🔊 单词发音语音 <span class="vv-sub">选择喜欢的男声 / 女声，并调整语速；背单词、例句朗读都用它</span></div>
    <div class="vv-row">
      ${male?`<button class="vv-quick${curKey===voiceKey(male)?" on":""}" data-voice="${esc(voiceKey(male))}">👨 男声</button>`:""}
      ${female?`<button class="vv-quick${curKey===voiceKey(female)?" on":""}" data-voice="${esc(voiceKey(female))}">👩 女声</button>`:""}
      <select class="vv-sel" id="vv-sel" title="全部可用英文语音">${opts}</select>
    </div>
    ${vvRateRowHTML()}
    <div class="vv-tip">共 ${vs.length} 个英文语音可用${vs.length<2?"（如需更多男女声，请在系统设置中安装更多英文语音包后刷新）":""}</div>
  </div>`;
}
function vocabVoicePreview(){ try{ speak("Hello! This is your pronunciation voice."); }catch(e){} }
function bindVocabVoice(){
  const sel=$("#vv-sel");
  if(sel) sel.onchange=()=>{ setUserVoice(sel.value); refreshVoiceQuick(); vocabVoicePreview(); };
  main.querySelectorAll(".vv-quick").forEach(b=>b.onclick=()=>{ setUserVoice(b.dataset.voice); const s=$("#vv-sel"); if(s) s.value=b.dataset.voice; refreshVoiceQuick(); vocabVoicePreview(); });
  const t=$("#vv-test"); if(t) t.onclick=()=>vocabVoicePreview();
  const rate=$("#vv-rate"); if(rate){ rate.oninput=()=>{ setRate(parseFloat(rate.value)); const lb=$("#vv-rate-val"); if(lb) lb.textContent=(_rate).toFixed(2)+"×"; }; rate.onchange=()=>vocabVoicePreview(); }
  // 语音异步加载：就绪后刷新本区块
  if(!enVoices().length && ('speechSynthesis' in window)){
    onVoicesReady=function(){ onVoicesReady=null; const host=main.querySelector(".voc-voice"); if(host){ const w=document.createElement("div"); w.innerHTML=vocabVoiceHTML(); host.replaceWith(w.firstElementChild); bindVocabVoice(); } };
  }
}
function refreshVoiceQuick(){ const cur=voiceKey(currentVoice()); main.querySelectorAll(".vv-quick").forEach(b=>b.classList.toggle("on", b.dataset.voice===cur)); }

// 跨所有词库（含词书）的累计学习/掌握/错词统计（用于单词背诵首页总览）
function vAggregateStats(){
  const t=vToday(); let learned=0,mastered=0,wrong=0,due=0,activeSets=0;
  for(const id in vall.sets){
    const p=vall.sets[id]; if(!p) continue;
    learned += p.cursor||0;
    for(const k in (p.srs||{})){ const r=p.srs[k]; if(r&&r.mastered) mastered++; if(r&&!r.mastered&&r.due&&r.due<=t) due++; }
    wrong += (p.wrong||[]).length;
    if((p.cursor||0)>0 || p.plan) activeSets++;
  }
  return {learned,mastered,wrong,due,activeSets};
}
// 单个进度对象的分项统计
function vProgStats(p){
  const t=vToday(); let mastered=0,due=0;
  for(const k in (p.srs||{})){ const r=p.srs[k]; if(!r) continue; if(r.mastered) mastered++; else if(r.due&&r.due<=t) due++; }
  return {learned:p.cursor||0, mastered, due, wrong:(p.wrong||[]).length};
}
// 解析任意 setId 的显示名（核心词库 / 词书）
function vSetName(id){
  if(id.indexOf("wb:")===0){ const m=wbFindMeta(id.slice(3)); if(m) return m.name; const r=(vall.recent||[]).find(x=>wbSetId(x.id)===id); return r?r.name:id; }
  if(id.indexOf("it:")===0){ const t=(typeof itGetTopic==="function")&&itGetTopic(id.slice(3)); return t?((t.emoji?t.emoji+" ":"")+t.name+" · 雅思话题"):id; }
  const s=VOCAB_SETS.find(x=>x.id===id); return s?s.name:id;
}
// 选中某词库（词书/话题则先加载）后跳转到指定页面（hash 已相同则直接重绘，避免点不动）
function vGoSet(id, hash){
  const nav=()=>{ if(location.hash===hash) route(); else location.hash=hash; };
  if(id.indexOf("wb:")===0){
    wbEnsureLoaded(id.slice(3), s=>{ wbRecordRecent(s.book); selectVocabSet(s.id); nav(); });
  } else if(id.indexOf("it:")===0){
    const s=itEnsureLoaded(id.slice(3)); if(!s){ toast("话题未找到"); return; } selectVocabSet(s.id); nav();
  } else { selectVocabSet(id); nav(); }
}
// 首页四项统计点击后的分词库明细
const V_OVERVIEW = {
  learned:  {title:"📚 累计已学 · 各词库", go:"#/vocab/records", enter:"查看背诵记录", unit:"词",   field:"learned"},
  mastered: {title:"✅ 已掌握 · 各词库",   go:"#/vocab/records", enter:"查看背诵记录", unit:"词",   field:"mastered"},
  due:      {title:"🔁 今日待复习 · 各词库", go:"#/vocab/home",    enter:"继续背诵",     unit:"待复习", field:"due"},
  wrong:    {title:"📕 错词本 · 各词库",    go:"#/vocab/review",  enter:"复习错词",     unit:"错词",   field:"wrong"},
};
function renderVocabOverview(metric){
  stopTimer(); highlightNav(null); hideNoteFab();
  const cfg=V_OVERVIEW[metric]||V_OVERVIEW.learned;
  const rows=[];
  for(const id in vall.sets){ const p=vall.sets[id]; if(!p) continue; const st=vProgStats(p); const val=st[cfg.field]; if(val>0) rows.push({id, name:vSetName(id), val, st}); }
  rows.sort((a,b)=>b.val-a.val);
  if(!rows.length){
    main.innerHTML=`<section class="voc-hero"><button class="voc-switch" onclick="location.hash='#/vocab'">⇄ 返回</button>
      <h1>${cfg.title}</h1><div class="voc-sub">暂无记录</div></section>`;
    return;
  }
  if(rows.length===1){ vGoSet(rows[0].id, cfg.go); return; }   // 只有一个词库时直接进入
  main.innerHTML=`<section class="voc-hero"><button class="voc-switch" onclick="location.hash='#/vocab'">⇄ 返回</button>
    <h1>${cfg.title}</h1><div class="voc-sub">点任意词库${cfg.enter}</div></section>
    <div class="vov-list">${rows.map(r=>`<button class="vov-row" data-id="${esc(r.id)}">
      <span class="vov-row-name">${esc(r.name)}</span>
      <span class="vov-row-meta">已学 ${r.st.learned} · 掌握 ${r.st.mastered} · 待复习 ${r.st.due} · 错词 ${r.st.wrong}</span>
      <span class="vov-row-val">${r.val}<i>${cfg.unit}</i> →</span>
    </button>`).join("")}</div>`;
  main.querySelectorAll(".vov-row").forEach(b=>b.onclick=()=>vGoSet(b.dataset.id, cfg.go));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
const VKEY = "glx.vocab";
const EBB = [1,2,4,7,15,30];   // 艾宾浩斯复习间隔(天)：首次记忆后第1/2/4/7/15/30天复习
function blankProg(){ return { plan:null, srs:{}, cursor:0, wrong:[], hist:{}, last:null }; }
// 读取全部词库进度；兼容旧版（单一考研词库）的存储格式
function vloadAll(){
  let raw=null; try{ raw=JSON.parse(localStorage.getItem(VKEY)); }catch(e){ raw=null; }
  if(!raw || typeof raw!=="object") return { current:VOCAB_SETS[0].id, sets:{} };
  if(raw.sets) return raw;                                    // 新版格式
  return { current:"kaoyan", sets:{ kaoyan:raw } };           // 旧版 → 迁移到考研词库
}
let vall = vloadAll();
if(!vall.sets) vall.sets={};
function ensureSet(id){
  const p = vall.sets[id] || (vall.sets[id]=blankProg());
  if(!p.srs) p.srs={}; if(!p.wrong) p.wrong=[]; if(!p.hist) p.hist={};
  return p;
}
let curSetId = VOCAB_SETS.some(s=>s.id===vall.current) ? vall.current : VOCAB_SETS[0].id;
let VOC = vsetById(curSetId).words;       // 当前词库的单词数组 [[word,ipa,def],...]
let vstore = ensureSet(curSetId);         // 当前词库的进度
function vsave(){ vall.current=curSetId; try{ localStorage.setItem(VKEY, JSON.stringify(vall)); }catch(e){} }
// 切换当前词库（同时切换单词数组与进度）
function selectVocabSet(id){
  curSetId = vsetById(id).id;
  VOC = vsetById(curSetId).words;
  vstore = ensureSet(curSetId);
  vall.current = curSetId; vsave();
}
// 指定词库的已掌握数（用于词库选择页统计）
function vMasteredCountFor(p){ let n=0; for(const k in (p&&p.srs||{})){ if(p.srs[k].mastered) n++; } return n; }
function vToday(){ const d=new Date(),p=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
function vAddDays(str,n){ const a=str.split("-").map(Number),dt=new Date(a[0],a[1]-1,a[2]); dt.setDate(dt.getDate()+n); const p=x=>String(x).padStart(2,"0"); return dt.getFullYear()+"-"+p(dt.getMonth()+1)+"-"+p(dt.getDate()); }
function vHist(t){ if(!vstore.hist[t]) vstore.hist[t]={neu:0,rev:0,wrong:0,done:0,sec:0}; const h=vstore.hist[t]; if(h.sec==null) h.sec=0; return h; }
// 累计背诵用时（当前词库，秒）
function vTotalSec(){ let s=0; for(const d in vstore.hist){ s+=vstore.hist[d].sec||0; } return s; }
function vMasteredCount(){ let n=0; for(const k in vstore.srs){ if(vstore.srs[k].mastered) n++; } return n; }
function vStreak(){ let n=0,t=vToday(); if(!(vstore.hist[t]&&vstore.hist[t].done>0)) t=vAddDays(t,-1); while(vstore.hist[t]&&vstore.hist[t].done>0){ n++; t=vAddDays(t,-1); } return n; }
function vAddWrong(idx){ if(vstore.wrong.indexOf(idx)<0) vstore.wrong.push(idx); }
function vRemoveWrong(idx){ const i=vstore.wrong.indexOf(idx); if(i>=0) vstore.wrong.splice(i,1); }

// 评分并按艾宾浩斯曲线安排下次复习；known=认识 / 不认识
function vGrade(idx, known){
  const t=vToday(), wasNew=!vstore.srs[idx], r=vstore.srs[idx]||{st:0,wrong:0};
  if(known){
    r.st=(r.st||0)+1;
    if(r.st>EBB.length){ r.mastered=true; r.due=null; }
    else { r.mastered=false; r.due=vAddDays(t,EBB[r.st-1]); }
  } else {
    r.st=1; r.mastered=false; r.due=vAddDays(t,EBB[0]); r.wrong=(r.wrong||0)+1;
    vAddWrong(idx); vHist(t).wrong++;
  }
  vstore.srs[idx]=r;
  if(wasNew){ r.day=t; vstore.cursor++; vHist(t).neu++; } else { vHist(t).rev++; }
  vHist(t).done++; vstore.last=t; vsave();
}

// 今日队列：新词(受每日上限约束) + 到期复习词
function vTodayQueue(){
  const t=vToday(), plan=vstore.plan; if(!plan) return {neu:[],rev:[]};
  const remNew=Math.max(0, plan.dailyNew - vHist(t).neu), neu=[];
  for(let i=vstore.cursor;i<plan.order.length && neu.length<remNew;i++){ const idx=plan.order[i]; if(!vstore.srs[idx]) neu.push(idx); }
  const rev=[];
  for(const k in vstore.srs){ const r=vstore.srs[k]; if(!r.mastered && r.due && r.due<=t) rev.push(+k); }
  return {neu, rev};
}

// 某词库的进度概览（独立于当前选中词库，供首页仪表盘使用）
function vSetStats(s){
  const p=vall.sets[s.id]||blankProg();
  const total=s.words.length, learned=p.cursor||0, mastered=vMasteredCountFor(p), wrong=(p.wrong||[]).length;
  const t=vToday();
  let due=0;
  for(const k in (p.srs||{})){ const r=p.srs[k]; if(r&&!r.mastered&&r.due&&r.due<=t) due++; }
  let newRem=0;
  if(p.plan){
    const todayNeu=(p.hist&&p.hist[t]&&p.hist[t].neu)||0;
    let want=Math.max(0,(p.plan.dailyNew||0)-todayNeu), avail=0;
    const order=p.plan.order||[];
    for(let i=p.cursor;i<order.length && avail<want;i++){ if(!p.srs[order[i]]) avail++; }
    newRem=Math.min(want,avail);
  }
  return {total,learned,mastered,wrong,due,newRem,todoToday:due+newRem,hasPlan:!!p.plan,
          pct: total?Math.round(learned/total*100):0};
}
// 首页：单词背诵进度仪表盘 HTML
function vocabDashHTML(){
  const stats=VOCAB_SETS.map(s=>({s,st:vSetStats(s)}));
  const agg=stats.reduce((a,{st})=>{a.learned+=st.learned;a.mastered+=st.mastered;a.todo+=st.todoToday;a.wrong+=st.wrong;return a;},
    {learned:0,mastered:0,todo:0,wrong:0});
  return `<div class="vdash">
    <div class="vdash-head"><span>📖 单词背诵进度</span><button class="vdash-all" data-nav="vocab">全部词库 →</button></div>
    <div class="vdash-sum">
      <div class="vds"><div class="vds-n">${agg.learned}</div><div class="vds-l">已学</div></div>
      <div class="vds"><div class="vds-n">${agg.mastered}</div><div class="vds-l">已掌握</div></div>
      <div class="vds${agg.todo?' hot':''}"><div class="vds-n">${agg.todo}</div><div class="vds-l">今日待背</div></div>
      <div class="vds"><div class="vds-n">${agg.wrong}</div><div class="vds-l">错词本</div></div>
    </div>
    <div class="vdash-sets">${stats.map(({s,st})=>`
      <button class="vdash-card" data-set="${s.id}">
        <div class="vdc-top"><span class="vdc-name">${esc(s.name)}</span>${
          st.todoToday? `<span class="vdc-due">待背 ${st.todoToday}</span>`
          : st.hasPlan? `<span class="vdc-doneb">今日完成 ✓</span>`
          : `<span class="vdc-newb">未开始</span>`}</div>
        <div class="vdc-bar"><i style="width:${st.pct}%"></i></div>
        <div class="vdc-meta">已学 ${st.learned}/${st.total} ${s.unit||"词"} · 掌握 ${st.mastered}${st.wrong?' · 错词 '+st.wrong:''}</div>
      </button>`).join("")}</div>
  </div>`;
}

// 词库选择页：进入单词背诵时先选择要背诵的词库
function renderVocabPicker(){
  stopTimer(); highlightNav(null); hideNoteFab();
  const cards=VOCAB_SETS.map(s=>{
    const p=vall.sets[s.id]||blankProg();
    const total=s.words.length, learned=p.cursor||0, mastered=vMasteredCountFor(p);
    const pct=total?Math.round(learned/total*100):0;
    const status=!total?'词库未加载':(p.plan?`已学 ${learned} · 已掌握 ${mastered}`:'未开始');
    return `<button class="vps-card${total?'':' disabled'}" data-id="${s.id}"${total?'':' disabled'}>
      <div class="vps-name">${esc(s.name)} <span class="vps-go">${p.plan?'继续 →':'开始 →'}</span></div>
      <div class="vps-sub">${esc(s.sub)} · 共 ${total} ${s.unit||"词"}</div>
      <div class="vps-bar"><i style="width:${pct}%"></i></div>
      <div class="vps-meta">${status}</div>
    </button>`;
  }).join("");
  const agg=vAggregateStats();
  const recents=(vall.recent||[]).slice(0,6);
  const recentHTML = recents.length ? `<div class="voc-recent">
    <div class="vr-head">📌 最近背诵</div>
    <div class="voc-recent-row">${recents.map(r=>{
      const kind=r.kind||"wb";
      const p=vall.sets[(kind==="it"?"it:":"wb:")+r.id]||blankProg();
      const learned=p.cursor||0, tot=r.words||0, pct=tot?Math.round(learned/tot*100):0;
      const metaLine = kind==="it" ? "雅思阅读话题" : (esc(r.category||"")+(r.scene?" · "+esc(r.scene):""));
      const hash = (kind==="it"?"#/vocab/topic/":"#/vocab/book/")+encodeURIComponent(r.id);
      return `<button class="vrec-card" data-hash="${esc(hash)}">
        <div class="vrec-name">${esc(r.name)}</div>
        <div class="vrec-meta">${metaLine}</div>
        <div class="vps-bar"><i style="width:${pct}%"></i></div>
        <div class="vrec-foot">已学 ${learned}/${tot} · <span class="vrec-go">继续背诵 →</span></div>
      </button>`;
    }).join("")}</div>
  </div>` : "";
  main.innerHTML=`<section class="voc-hero"><h1>📖 单词背诵</h1>
    <div class="voc-sub">选择要背诵的词库 · 每个词库的进度独立保存</div></section>
    <div class="voc-overview">
      <div class="vov-stats">
        <button class="vov" data-metric="learned"><div class="vov-n">${agg.learned}</div><div class="vov-l">累计已学</div></button>
        <button class="vov" data-metric="mastered"><div class="vov-n">${agg.mastered}</div><div class="vov-l">已掌握</div></button>
        <button class="vov${agg.due?' hot':''}" data-metric="due"><div class="vov-n">${agg.due}</div><div class="vov-l">今日待复习</div></button>
        <button class="vov" data-metric="wrong"><div class="vov-n">${agg.wrong}</div><div class="vov-l">错词本</div></button>
      </div>
      <button class="voc-search-btn" id="voc-search">🔍 搜索单词 / 词书</button>
    </div>
    ${vocabVoiceHTML()}
    ${recentHTML}
    <div class="vps-grid compact">${cards}</div>
    <div class="vps-grid compact" style="margin-top:0;padding-top:0">
      <button class="vps-card ielts-topic" onclick="location.hash='#/vocab/ielts-topic'">
        <div class="vps-name">雅思阅读话题词汇背诵 <span class="vps-go">进入 →</span></div>
        <div class="vps-sub">按话题分类背诵 · 22 个话题</div>
        <div class="vps-bar"><i style="width:0%"></i></div>
        <div class="vps-meta">3674 词 · 看词选义 / 看义选词 / 听音选义 / 听写 / 默写 五模式</div>
      </button>
      ${WB_CAT.length?`<button class="vps-card wb-entry" onclick="location.hash='#/vocab/books'">
        <div class="vps-name">📚 词书库 · 教材同步背单词 <span class="vps-go">进入 →</span></div>
        <div class="vps-sub">初中 / 高中 / 大学 / 留学 · ${window.WB_CATALOG.total_books||0} 本词书</div>
        <div class="vps-bar"><i style="width:0%"></i></div>
        <div class="vps-meta">${(window.WB_CATALOG.total_words||0).toLocaleString()} 词 · 看词选义 / 听音选义 / 听写 / 默写 四模式</div>
      </button>`:''}
    </div>
    ${WB_CAT.length?`<div class="wb-quick">
      <div class="wb-quick-h">📚 词书库 · 分类筛选<span class="wb-quick-tip">（点分类直接在下方查看词书）</span></div>
      <div class="wb-quick-bar">${wbQuickEntries().map(e=>`<button class="wb-qbtn${e.pri?' pri':''}" data-cat="${esc(e.cat)}" data-scene="${esc(e.scene||'')}">${esc(e.label)}</button>`).join("")}</div>
      <div class="wb-quick-results" id="wb-quick-results"></div>
    </div>`:""}`;
  main.querySelectorAll(".vps-card").forEach(c=>{ if(c.disabled || !c.dataset.id) return;
    c.onclick=()=>{ selectVocabSet(c.dataset.id); location.hash="#/vocab/home"; };
  });
  const sbtn=$("#voc-search"); if(sbtn) sbtn.onclick=()=>{ location.hash="#/vocab/search"; };
  bindVocabVoice();
  main.querySelectorAll(".wb-qbtn").forEach(b=>b.onclick=()=>{
    const res=$("#wb-quick-results"); if(!res) return;
    const already=b.classList.contains("active");
    main.querySelectorAll(".wb-qbtn").forEach(x=>x.classList.remove("active"));
    if(already){ res.innerHTML=""; return; }   // 再次点击收起
    b.classList.add("active");
    res.innerHTML=wbQuickResultsHTML(b.dataset.cat, b.dataset.scene||null);
    res.querySelectorAll(".wb-book").forEach(bk=>bk.onclick=()=>{ location.hash="#/vocab/book/"+encodeURIComponent(bk.dataset.id); });
  });
  main.querySelectorAll(".vov[data-metric]").forEach(b=>b.onclick=()=>{
    const m=b.dataset.metric, a=vAggregateStats();
    const val = m==='learned'?a.learned : m==='mastered'?a.mastered : m==='due'?a.due : a.wrong;
    if(!val){ toast("暂无记录"); return; }
    location.hash="#/vocab/overview/"+m;
  });
  main.querySelectorAll(".vrec-card").forEach(c=>c.onclick=()=>{ location.hash=c.dataset.hash; });
  // IELTS topic card navigates via inline onclick (no data-id)
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

/* ============================ 词书库：浏览 + 懒加载 ============================ */
// 词书浏览页：分类 Tab → 教材分组 → 词书列表（点击进入即按需拉取正文）
function renderWordbookBrowse(catName, focusScene){
  stopTimer(); highlightNav(null); hideNoteFab();
  if(!WB_CAT.length){ main.innerHTML='<section class="voc-hero"><h1>📚 词书库</h1><div class="voc-sub">词书目录未加载，请刷新页面。</div></section>'; return; }
  const cur = WB_CAT.find(c=>c.name===catName) || WB_CAT[0];
  const tabs = WB_CAT.map(c=>`<button class="wb-tab${c.name===cur.name?' on':''}" data-cat="${esc(c.name)}">${esc(c.name)}</button>`).join("");
  const scenes = (cur.scenes||[]).map(s=>{
    const books = s.books.map(b=>{
      const p = vall.sets[wbSetId(b.id)];
      const learned = p ? (p.cursor||0) : 0;
      const badge = learned>0 ? `<span class="wb-b-prog">已学 ${learned}/${b.words}</span>` : `<span class="wb-b-new">${b.words} 词</span>`;
      return `<button class="wb-book" data-id="${esc(String(b.id))}">
        <span class="wb-b-name">${esc(b.name)}</span>
        <span class="wb-b-meta">${b.chapters?b.chapters+' 单元 · ':''}${badge}</span>
      </button>`;
    }).join("");
    return `<div class="wb-scene${focusScene&&s.name===focusScene?' focus':''}" data-scene="${esc(s.name)}">
      <div class="wb-scene-h"><span>${esc(s.name)}</span><span class="wb-scene-n">${s.books.length} 本</span></div>
      <div class="wb-books">${books}</div>
    </div>`;
  }).join("");
  main.innerHTML=`<section class="voc-hero">
    <button class="voc-switch" onclick="location.hash='#/vocab'">⇄ 返回词库选择</button>
    <h1>📚 词书库</h1>
    <div class="voc-sub">教材同步 · 选择词书后可用「看词选义 / 听音选义 / 听写 / 默写」四种模式背诵，进度独立保存</div>
  </section>
  <div class="wb-tabs">${tabs}</div>
  <div class="wb-scenes">${scenes}</div>`;
  main.querySelectorAll(".wb-tab").forEach(t=>t.onclick=()=>{ location.hash="#/vocab/books/"+encodeURIComponent(t.dataset.cat); });
  main.querySelectorAll(".wb-book").forEach(b=>b.onclick=()=>{ location.hash="#/vocab/book/"+encodeURIComponent(b.dataset.id); });
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
  if(focusScene){ const el=main.querySelector('.wb-scene[data-scene="'+(window.CSS&&CSS.escape?CSS.escape(focusScene):focusScene)+'"]');
    if(el) setTimeout(()=>{ try{ el.scrollIntoView({behavior:"smooth",block:"start"}); }catch(e){ el.scrollIntoView(); } },60); }
}

// 记录最近背诵的词书（供词库首页“继续”入口）
function wbRecordRecent(entry){
  if(!entry) return;
  if(!vall.recent) vall.recent=[];
  const kind=entry.kind||"wb";
  vall.recent = vall.recent.filter(r=>!(String(r.id)===String(entry.id) && (r.kind||"wb")===kind));
  vall.recent.unshift({ id:entry.id, name:entry.name, kind:kind, category:entry.category||"", scene:entry.scene||"", words:entry.words, ts:Date.now() });
  if(vall.recent.length>8) vall.recent.length=8;
  vsave();
}
// 确保某词书正文已加载（懒加载 + 内存缓存），完成后回调；期间显示加载/错误界面
function wbEnsureLoaded(id, cb){
  const setId = wbSetId(id);
  if(WB_LOADED[setId]){ cb(WB_LOADED[setId]); return; }
  const meta = wbFindMeta(id);
  if(!meta){ toast("未找到该词书"); location.hash="#/vocab/books"; return; }
  main.innerHTML=`<section class="voc-hero"><h1>📚 ${esc(meta.name)}</h1>
    <div class="voc-sub">正在加载词书正文（${meta.words} 词）…</div></section>
    <div class="wb-loading"><div class="wb-spin"></div><div>首次加载需要下载词书数据，请稍候…</div></div>`;
  fetch(encodeURI(meta.file)).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }).then(data=>{
    const raw=[], chapters=[];
    (data.chapters||[]).forEach(ch=>{ const unit={name:ch.name, from:raw.length}; (ch.words||[]).forEach(w=>{ w._ch=ch.name; raw.push(w); }); unit.to=raw.length; chapters.push(unit); });
    const words = raw.map(w=>[ w.w||"", w.us||w.uk||"", w.tr||"" ]);
    WB_LOADED[setId] = { id:setId, name:meta.name, sub:meta.category+" · "+meta.scene, words, raw, chapters,
                         unit:"词", isWB:true, kind:"wb", book:meta };
    cb(WB_LOADED[setId]);
  }).catch(e=>{
    main.innerHTML=`<section class="voc-hero"><h1>📚 ${esc(meta.name)}</h1>
      <div class="voc-sub">词书加载失败：${esc(String(e.message||e))}</div></section>
      <div class="voc-actions center">
        <button class="voc-start" id="wb-retry">↻ 重试</button>
        <button class="voc-btn ghost" onclick="location.hash='#/vocab/books'">返回词书库</button>
      </div>
      <p class="voc-sub" style="margin-top:10px">提示：词书正文以本地文件加载，需通过网页服务器（如 GitHub Pages 或 <code>python -m http.server</code>）访问，直接双击打开 HTML 文件可能无法读取。</p>`;
    const rb=$("#wb-retry"); if(rb) rb.onclick=()=>wbEnsureLoaded(id, cb);
  });
}
// 打开一本词书：加载正文后复用背诵引擎，并记入最近背诵
function openWordbook(id){
  stopTimer(); highlightNav(null); hideNoteFab();
  wbEnsureLoaded(id, s=>{ wbRecordRecent(s.book); selectVocabSet(s.id); renderVocabHome(); });
}

// 雅思话题 → 动态词库（复用五种考查形式 + 学习模式 + 艾宾浩斯）；仅注册，不切换
function itEnsureLoaded(id){
  const setId="it:"+id;
  if(WB_LOADED[setId]) return WB_LOADED[setId];
  const topic=(typeof itGetTopic==="function")?itGetTopic(id):null;
  if(!topic || !topic.words || !topic.words.length) return null;
  const words=topic.words.map(w=>[ w.w||"", (w.p||"").replace(/^\/|\/$/g,""), ((w.s?w.s+" ":"")+(w.m||"")).trim() ]);
  const raw=topic.words.map(w=>({ ex:w.e||"", ex_cn:"" }));
  WB_LOADED[setId]={ id:setId, name:(topic.emoji?topic.emoji+" ":"")+topic.name+" · 雅思话题", sub:"雅思阅读话题词汇",
                     words, raw, unit:"词", kind:"it", topic };
  return WB_LOADED[setId];
}
function openIeltsTopic(id){
  stopTimer(); highlightNav(null); hideNoteFab();
  const s=itEnsureLoaded(id);
  if(!s){ toast("未找到该话题"); location.hash="#/vocab/ielts-topic"; return; }
  wbRecordRecent({ id:id, name:(s.topic.emoji?s.topic.emoji+" ":"")+s.topic.name, kind:"it", words:s.words.length });
  selectVocabSet(s.id); renderVocabHome();
}

/* ---------- 搜索模式：按词书名 + 已加载词库中的单词/释义 ---------- */
function vSearchBooks(qq){
  const q=qq.toLowerCase(); const out=[];
  for(const c of WB_CAT){ for(const s of (c.scenes||[])){ for(const b of (s.books||[])){
    if((b.name||"").toLowerCase().indexOf(q)>=0){ out.push({id:b.id,name:b.name,category:c.name,scene:s.name,words:b.words}); if(out.length>=100) return out; }
  }}}
  return out;
}
function vSearchWords(qq){
  const q=qq.toLowerCase(), out=[], cap=80;
  function scan(arr,setName){
    if(!arr) return;
    for(let i=0;i<arr.length && out.length<cap;i++){
      const e=arr[i]; if(!Array.isArray(e)) continue;
      const w=(e[0]||""), def=(e[2]||"");
      if(w.toLowerCase().indexOf(q)>=0 || def.indexOf(qq)>=0) out.push({w, ipa:e[1]||"", def, setName});
    }
  }
  scan(window.VOCAB,"考研词汇");
  scan(window.VOCAB_IELTS,"雅思词汇");
  for(const id in WB_LOADED){ if(out.length>=cap) break; scan(WB_LOADED[id].words, WB_LOADED[id].name); }
  return out;
}
function renderVocabSearch(){
  stopTimer(); highlightNav(null); hideNoteFab();
  main.innerHTML=`<section class="voc-hero">
    <button class="voc-switch" onclick="location.hash='#/vocab'">⇄ 返回</button>
    <h1>🔍 搜索单词 / 词书</h1>
    <div class="voc-sub">搜索全部词书名称，或在已加载词库中查找单词与释义</div></section>
    <div class="vsearch-wrap"><input type="text" id="vsearch-in" class="vsearch-in" placeholder="输入单词、中文释义或词书名…" autocomplete="off" autofocus></div>
    <div id="vsearch-res" class="vsearch-res"><div class="vsearch-tip">💡 词书正文需先打开才能按单词搜索；词书名称可直接搜索。</div></div>`;
  const inp=$("#vsearch-in"), res=$("#vsearch-res");
  function run(){
    const q=(inp.value||"").trim();
    if(q.length<1){ res.innerHTML=`<div class="vsearch-tip">💡 输入至少 1 个字符开始搜索。</div>`; return; }
    const books=vSearchBooks(q), words=vSearchWords(q);
    let html="";
    if(books.length){
      html+=`<div class="vsearch-sec"><div class="vsearch-h">📚 词书（${books.length}${books.length>=100?'+':''}）</div><div class="wb-books">`+
        books.map(b=>`<button class="wb-book" data-book="${esc(String(b.id))}"><span class="wb-b-name">${esc(b.name)}</span><span class="wb-b-meta">${esc(b.category)} · ${esc(b.scene)} · ${b.words} 词</span></button>`).join("")+`</div></div>`;
    }
    if(words.length){
      html+=`<div class="vsearch-sec"><div class="vsearch-h">🔤 单词（${words.length}${words.length>=80?'+':''} · 来自已加载词库）</div><div class="vsearch-words">`+
        words.map(w=>`<div class="vsw-item"><div class="vsw-top"><b>${esc(w.w)}</b>${w.ipa?' <span class="vsw-ipa">/'+esc(w.ipa)+'/</span>':''} <span class="vsw-src">${esc(w.setName)}</span></div><div class="vsw-def">${esc(w.def).replace(/\n/g,'；')}</div></div>`).join("")+`</div></div>`;
    }
    if(!html) html=`<div class="vsearch-tip">未找到匹配项。若要按单词搜索，请先打开对应词书。</div>`;
    res.innerHTML=html;
    res.querySelectorAll(".wb-book").forEach(b=>b.onclick=()=>{ location.hash="#/vocab/book/"+encodeURIComponent(b.dataset.book); });
  }
  inp.oninput=run;
  setTimeout(()=>{ try{ inp.focus(); }catch(e){} },60);
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

/* ---------- 词书分单元导出 PDF ---------- */
function renderWordbookExport(s){
  stopTimer(); highlightNav(null); hideNoteFab();
  const units = (s.chapters&&s.chapters.length) ? s.chapters : [{name:"全部", from:0, to:s.raw.length}];
  let sel="__all__";
  function draw(){
    const chips = `<button class="wb-ex-chip${sel==='__all__'?' on':''}" data-u="__all__">全部单元（${s.raw.length} 词）</button>`+
      units.map((u,i)=>`<button class="wb-ex-chip${sel===String(i)?' on':''}" data-u="${i}">${esc(u.name)}（${u.to-u.from}）</button>`).join("");
    const showIdx = sel==='__all__' ? units.map((_,i)=>i) : [parseInt(sel)];
    const body = showIdx.map(ui=>{
      const u=units[ui]; let rows="";
      for(let k=u.from;k<u.to;k++){ const w=s.raw[k]||{}; rows+=`<tr><td class="wbx-i">${k-u.from+1}</td><td class="wbx-w">${esc(w.w||"")}</td><td class="wbx-p">${esc(w.us||w.uk||"")}</td><td class="wbx-t">${esc((w.tr||"")).replace(/\n/g,"；")}</td></tr>`; }
      return `<div class="wb-export-unit"><h2 class="wbx-unit-h">${esc(u.name)} <small>${u.to-u.from} 词</small></h2>
        <table class="wbx-table"><thead><tr><th>#</th><th>单词</th><th>音标</th><th>释义</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");
    main.innerHTML=`<div class="wb-export">
      <div class="wb-export-ctrl">
        <section class="voc-hero">
          <button class="voc-switch" onclick="location.hash='#/vocab/book/${encodeURIComponent(s.book.id)}'">⇄ 返回词书</button>
          <h1>📄 分单元导出 PDF · ${esc(s.name)}</h1>
          <div class="voc-sub">选择要导出的单元，点「导出 PDF」用浏览器「打印 / 另存为 PDF」保存（每个单元自动分页）</div>
        </section>
        <div class="wb-ex-chips">${chips}</div>
        <div class="voc-actions"><button class="voc-start" id="wbx-print">📄 导出 PDF</button>
          <button class="voc-btn ghost" onclick="location.hash='#/vocab/book/${encodeURIComponent(s.book.id)}'">返回</button></div>
      </div>
      <div class="wbx-doc-title">${esc(s.name)} · ${esc(s.book.category||"")} ${esc(s.book.scene||"")}</div>
      ${body}
    </div>`;
    main.querySelectorAll(".wb-ex-chip").forEach(c=>c.onclick=()=>{ sel=c.dataset.u; draw(); });
    $("#wbx-print").onclick=()=>{ _pdfExportTarget="wordbook"; const orig=document.title; document.title=s.name+" · 词书"; doExportPDF(orig); setTimeout(()=>{ document.title=orig; },3000); };
    main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
  }
  draw();
}

function renderVocabHome(){
  stopTimer(); highlightNav(null); hideNoteFab();
  if(!VOC.length){ main.innerHTML='<section class="voc-hero"><h1>📖 单词背诵</h1><div class="voc-sub">词库未加载，请刷新页面。</div></section>'; return; }
  if(!vstore.plan){ renderVocabSetup(false); return; }
  const t=vToday(), q=vTodayQueue(), total=VOC.length;
  const todo=q.neu.length+q.rev.length, todayDone=vHist(t).done, todaySec=vHist(t).sec||0;
  let html=`<section class="voc-hero">
    <button class="voc-switch" id="voc-switch">⇄ 切换词库</button>
    <h1>📖 单词背诵 · ${esc(vsetById(curSetId).name)}</h1>
    <div class="voc-sub">共 ${total} ${vUnit()} · 每日新${vUnit()} ${vstore.plan.dailyNew} 个 · 卡片乱序 · 艾宾浩斯记忆曲线智能复习</div>
  </section>
  <div class="stats voc-stats">
    <button class="stat clickable" data-act="records"><span class="ico">📚</span><div class="num">${vstore.cursor}<small style="font-size:15px;color:var(--muted)">/${total}</small></div><div class="lab">已学单词 ›</div></button>
    <button class="stat clickable" data-act="records"><span class="ico">✅</span><div class="num">${vMasteredCount()}</div><div class="lab">已掌握 ›</div></button>
    <button class="stat clickable" data-act="wrong"><span class="ico">📕</span><div class="num">${vstore.wrong.length}</div><div class="lab">错词本 ›</div></button>
    <div class="stat"><span class="ico">🔥</span><div class="num">${vStreak()}</div><div class="lab">连续天数</div></div>
  </div>
  ${ vSupportsModes() ? `<div class="voc-modes">
    <div class="vm-head">考查形式</div>
    <div class="vm-chips">${V_MODES.map(m=>`<button class="vm-chip${vStdMode()===m.k?' on':''}" data-mode="${m.k}" title="${esc(m.desc)}">${esc(m.label)}</button>`).join("")}</div>
    <div class="vm-desc">${esc((V_MODES.find(m=>m.k===vStdMode())||V_MODES[0]).desc)}</div>
  </div>` : "" }
  <div class="voc-today">
    <div class="vt-head">今日任务 <span class="vt-date">${t}</span></div>
    <div class="vt-counts"><span class="vt-new">新词 <b>${q.neu.length}</b></span><span class="vt-rev">复习 <b>${q.rev.length}</b></span><span class="vt-done">今日已背 <b>${todayDone}</b></span><span class="vt-time">今日用时 <b>${fmtTime(todaySec)}</b></span></div>
    ${ todo>0 ? `<button class="voc-start" id="voc-start">▶ 开始今日背诵（${todo}）</button>`
             : `<div class="vt-empty">🎉 今日任务已完成！可继续提前学习。</div>
                <button class="voc-start" id="voc-more">▶ 继续背诵（额外）</button>` }
  </div>
  <div class="voc-actions">
    <button class="voc-btn" id="voc-wrong">📕 复习错词（${vstore.wrong.length}）</button>
    <button class="voc-btn" id="voc-records">📊 背诵记录</button>
    ${ isWbSet() ? `<button class="voc-btn" id="voc-export">📄 分单元导出PDF</button>` : "" }
    <button class="voc-btn ghost" id="voc-replan">⚙ 调整每日数量</button>
    <button class="voc-btn ghost danger" id="voc-reset">↺ 重置背诵进度</button>
  </div>`;
  const days=Object.keys(vstore.hist).sort().reverse().slice(0,7);
  if(days.length){
    html+=`<div class="voc-hist"><div class="vh-title">最近背诵记录 <span class="vh-tip">（点击日期查看当天单词）</span></div>`;
    days.forEach(d=>{ const h=vstore.hist[d]; html+=`<div class="vh-row" data-d="${esc(d)}"><span class="vh-d">${d} ›</span><span>新词 ${h.neu||0}</span><span>复习 ${h.rev||0}</span><span class="vh-wrong">错 ${h.wrong||0}</span><span class="vh-time">⏱ ${fmtTime(h.sec||0)}</span></div>`; });
    html+=`</div>`;
  }
  main.innerHTML=html;
  const sw=$("#voc-switch"); if(sw) sw.onclick=()=>{ location.hash=vBackHash(); };
  main.querySelectorAll(".vm-chip").forEach(ch=>ch.onclick=()=>{ vstore.smode=ch.dataset.mode; vsave(); renderVocabHome(); });
  // 直接调用渲染，避免退出练习后 hash 仍停留在 #/vocab/study 时点击无反应
  const sbn=$("#voc-start"); if(sbn) sbn.onclick=()=>{ renderVocabStudy(); };
  const more=$("#voc-more"); if(more) more.onclick=()=>{ renderVocabMore(); };
  $("#voc-records").onclick=()=>{ location.hash="#/vocab/records"; };
  const vex=$("#voc-export"); if(vex) vex.onclick=()=>{ location.hash="#/vocab/book-export/"+encodeURIComponent(curSetId.replace(/^wb:/,"")); };
  main.querySelectorAll(".vh-row").forEach(r=>r.onclick=()=>{ location.hash="#/vocab/records/"+encodeURIComponent(r.dataset.d); });
  $("#voc-wrong").onclick=()=>{ if(!vstore.wrong.length){ toast("错词本是空的 👍"); return; } renderVocabReview(); };
  main.querySelectorAll(".stat.clickable").forEach(b=>b.onclick=()=>{
    if(b.dataset.act==="records"){ location.hash="#/vocab/records"; }
    else if(b.dataset.act==="wrong"){ if(!vstore.wrong.length){ toast("错词本是空的 👍"); return; } renderVocabReview(); }
  });
  $("#voc-replan").onclick=()=>renderVocabSetup(true);
  $("#voc-reset").onclick=()=>{ if(confirm("确定重置「"+vsetById(curSetId).name+"」的全部背诵进度（已学 / 错词本 / 记录）吗？此操作不可撤销。")){ vall.sets[curSetId]=blankProg(); vstore=ensureSet(curSetId); vsave(); toast("背诵进度已重置"); renderVocabHome(); } };
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

function renderVocabSetup(isReplan){
  stopTimer(); highlightNav(null); hideNoteFab();
  const cur=vstore.plan?vstore.plan.dailyNew:20, presets=[10,20,30,50,80];
  main.innerHTML=`<section class="voc-hero"><h1>📖 ${isReplan?'调整背诵计划':'制定背诵计划'}</h1>
    <div class="voc-sub">${esc(vsetById(curSetId).name)} ${VOC.length} ${vUnit()} · 卡片乱序 · 按艾宾浩斯遗忘曲线自动安排复习</div></section>
  <div class="voc-setup">
    <div class="vs-q">每天背诵多少个<b>新单词</b>？</div>
    <div class="vs-presets">${presets.map(n=>`<button class="vs-chip${n===cur?' on':''}" data-n="${n}">${n}</button>`).join("")}</div>
    <div class="vs-custom"><label>自定义：</label><input type="number" id="vs-num" min="1" max="500" value="${cur}"> 个 / 天</div>
    <div class="vs-est" id="vs-est"></div>
    ${isReplan?'<div class="vs-note">调整只改变每日新词数量，已有进度与错词本会保留。</div>':''}
    <div class="vs-go-row">
      <button class="voc-start" id="vs-go">${isReplan?'保存':'🚀 开始背诵计划'}</button>
      ${isReplan?'<button class="voc-btn ghost" id="vs-cancel">取消</button>':''}
    </div>
  </div>`;
  const numEl=$("#vs-num");
  const est=()=>{ const n=Math.max(1,parseInt(numEl.value)||1); $("#vs-est").innerHTML=`按此进度，约需 <b>${Math.ceil(VOC.length/n)}</b> 天学完全部新词（复习自动穿插其中）。`; };
  est();
  main.querySelectorAll(".vs-chip").forEach(c=>c.onclick=()=>{ numEl.value=c.dataset.n; main.querySelectorAll(".vs-chip").forEach(x=>x.classList.remove("on")); c.classList.add("on"); est(); });
  numEl.oninput=()=>{ main.querySelectorAll(".vs-chip").forEach(x=>x.classList.toggle("on", x.dataset.n===numEl.value)); est(); };
  $("#vs-go").onclick=()=>{
    const n=Math.max(1,Math.min(500,parseInt(numEl.value)||20));
    if(!vstore.plan) vstore.plan={ dailyNew:n, start:vToday(), order:shuffle(VOC.map((_,i)=>i)) };
    else vstore.plan.dailyNew=n;
    vsave(); toast(isReplan?"已更新每日数量":"计划已创建，开始背诵吧！"); renderVocabHome();
  };
  const cc=$("#vs-cancel"); if(cc) cc.onclick=()=>renderVocabHome();
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

let vsess=null;          // {queue:[{idx,type}], pos, correct, wrong, mode, cur}
let vLastCorrectPos=-1;  // 上一张卡正确答案的位置，避免连续相同
function vocabRun(queue, mode){
  vLastCorrectPos=-1;
  if(!queue.length){ vocabSessionDone(mode); return; }
  vsess={ queue:shuffle(queue), pos:0, correct:0, wrong:0, mode, cur:null, studyMode:vStdMode(), origQueue:queue.slice() };
  vocabCard();
}
function renderVocabStudy(){
  stopTimer(); highlightNav(null); hideNoteFab();
  if(!vstore.plan){ renderVocabHome(); return; }
  const q=vTodayQueue();
  const queue=q.neu.map(i=>({idx:i,type:'new'})).concat(q.rev.map(i=>({idx:i,type:'review'})));
  // 先进入学习模式浏览当天词汇，再进入考查形式（近义词/后缀等特殊词库无考查形式，直接开始）
  if(vSupportsModes() && queue.length) renderVocabLearn(queue, 'study');
  else vocabRun(queue, 'study');
}
// 额外背诵：当天任务完成后仍可继续，提取下一批新词(突破每日上限)+到期复习
function renderVocabMore(){
  stopTimer(); highlightNav(null); hideNoteFab();
  if(!vstore.plan){ renderVocabHome(); return; }
  const t=vToday(), neu=[];
  for(let i=vstore.cursor;i<vstore.plan.order.length && neu.length<vstore.plan.dailyNew;i++){ const idx=vstore.plan.order[i]; if(!vstore.srs[idx]) neu.push(idx); }
  const rev=[];
  for(const k in vstore.srs){ const r=vstore.srs[k]; if(!r.mastered && r.due && r.due<=t) rev.push(+k); }
  if(!neu.length && !rev.length){ toast("已经没有更多新词啦 🎉"); renderVocabHome(); return; }
  const queue=neu.map(i=>({idx:i,type:'new'})).concat(rev.map(i=>({idx:i,type:'review'})));
  if(vSupportsModes()) renderVocabLearn(queue, 'study');
  else vocabRun(queue, 'study');
}
// 学习模式：先展示当天全部词汇（词/音标/释义/例句/朗读），再进入所选考查形式的背诵
let _vlReading=false;
function vlStopReading(){ if(window.speechSynthesis){ try{ speechSynthesis.cancel(); }catch(e){} } _vlReading=false; }
function vlReadAll(queue, btn){
  if(!('speechSynthesis' in window)){ toast("当前浏览器不支持语音朗读"); return; }
  if(_vlReading){ vlStopReading(); if(btn) btn.textContent="🔊 依次朗读"; return; }  // 再次点击停止
  const words=queue.map(q=>(VOC[q.idx]&&VOC[q.idx][0])||"").filter(Boolean);
  if(!words.length) return;
  _vlReading=true; if(btn) btn.textContent="⏹ 停止朗读";
  try{ speechSynthesis.cancel(); }catch(e){}
  const v=(typeof currentVoice==="function"&&currentVoice())||null;
  let i=0;
  (function next(){
    if(!_vlReading || i>=words.length){ _vlReading=false; if(btn) btn.textContent="🔊 依次朗读"; return; }
    const u=new SpeechSynthesisUtterance(words[i]); u.rate=_rate;
    if(v){ u.voice=v; u.lang=v.lang; } else u.lang="en-GB";
    u.onend=()=>{ i++; next(); }; u.onerror=()=>{ i++; next(); };
    try{ speechSynthesis.speak(u); }catch(e){ _vlReading=false; }
  })();
}
function renderVocabLearn(queue, mode){
  stopTimer(); highlightNav(null); hideNoteFab();
  if(!queue || !queue.length){ vocabRun(queue||[], mode); return; }
  const modeLabel=vModeLabel(vStdMode());
  const newN=queue.filter(q=>q.type==='new').length, revN=queue.length-newN;
  const rows=queue.map((it,i)=>{
    const e=VOC[it.idx]||[], word=e[0]||"", ipa=e[1]||"", def=e[2]||"";
    const raw=vRawEntry(it.idx);
    const ex = raw&&raw.ex ? `<div class="vl-ex"><button class="say-btn" data-say="${escAttr(raw.ex)}" title="朗读例句">🔊</button> ${esc(raw.ex)}${raw.ex_cn?' <span class="vl-ex-cn">'+esc(raw.ex_cn)+'</span>':''}</div>` : "";
    const tag = it.type==='new' ? '<span class="vl-tag new">新词</span>' : '<span class="vl-tag rev">复习</span>';
    return `<div class="vl-item">
      <div class="vl-idx">${i+1}</div>
      <div class="vl-main">
        <div class="vl-w-row"><span class="vl-w">${esc(word)}</span>${tag}<button class="vl-audio" data-w="${esc(word)}" title="朗读">🔊</button></div>
        ${ipa?`<div class="vl-ipa">/${esc(ipa)}/</div>`:''}
        <div class="vl-def">${esc(def).replace(/\n/g,'<br>')}</div>
        ${ex}
      </div>
    </div>`;
  }).join("");
  const isReview = mode==='review';
  const title = isReview ? '📕 错词学习' : '📖 学习 · 今日词汇';
  const sub = isReview
    ? `错词本共 ${queue.length} 词 · 先浏览记忆，再开始复习（考查形式：<b>${esc(modeLabel)}</b>）`
    : `共 ${queue.length} 词（新词 ${newN} · 复习 ${revN}）· 先浏览记忆，学完后进入「<b>${esc(modeLabel)}</b>」背诵`;
  const goLabel = isReview ? `✅ 学完了，开始复习错词（${esc(modeLabel)}）` : `✅ 学完了，开始背诵（${esc(modeLabel)}）`;
  main.innerHTML=`<section class="voc-hero">
    <button class="voc-switch" id="vl-exit">✕ 退出</button>
    <h1>${title}</h1>
    <div class="voc-sub">${sub}</div>
  </section>
  <div class="vl-bar">
    <button class="voc-start" id="vl-go">${goLabel}</button>
    <button class="voc-btn ghost" id="vl-readall">🔊 依次朗读</button>
  </div>
  <div class="vl-list">${rows}</div>
  <div class="vl-bar bottom"><button class="voc-start" id="vl-go2">${isReview?`✅ 开始复习错词（${esc(modeLabel)}）`:`✅ 开始背诵（${esc(modeLabel)}）`}</button></div>`;
  const go=()=>{ vlStopReading(); vocabRun(queue, mode); };
  $("#vl-exit").onclick=()=>{ vlStopReading(); renderVocabHome(); };
  $("#vl-go").onclick=go; $("#vl-go2").onclick=go;
  const ra=$("#vl-readall"); if(ra) ra.onclick=()=>vlReadAll(queue, ra);
  main.querySelectorAll(".vl-audio").forEach(b=>b.onclick=()=>{ flash(b); speak(b.dataset.w); });
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function renderVocabReview(){
  stopTimer(); highlightNav(null); hideNoteFab();
  const q=vstore.wrong.slice().map(i=>({idx:i,type:'review'}));
  // 错词复习也先进入学习模式浏览错词，再开始复习（特殊词库无学习模式则直接复习）
  if(q.length && vSupportsModes()) renderVocabLearn(q, 'review');
  else vocabRun(q, 'review');
}

// 取 3 个释义选项（1 正确 + 2 干扰），并随机摆放(不与上一张同位置)
function vocabOptions(idx, correct){
  const opts=[correct], used={}; used[idx]=1;
  let guard=0;
  while(opts.length<3 && guard<60){
    guard++;
    const r=Math.floor(Math.random()*VOC.length);
    if(used[r]) continue;
    const d=VOC[r][2];
    if(!d || opts.indexOf(d)>=0) continue;
    used[r]=1; opts.push(d);
  }
  while(opts.length<3) opts.push("（无）"+opts.length); // 极端兜底
  let order, pos, tries=0;
  do{ order=shuffle(opts); pos=order.indexOf(correct); tries++; }
  while(pos===vLastCorrectPos && tries<12);
  vLastCorrectPos=pos;
  return { order, pos };
}
function isSynSet(){ return vsetById(curSetId).mode==='synonym'; }
// 近义词模式：偏好较短的单词作为题面/选项（长释义短语仍保留在词组展示中）
function synShortWords(g){ return (g.w||[]).filter(w=>w.split(/\s+/).length<=2); }
function synPickWord(g, exclude){
  const sh=synShortWords(g).filter(w=>!exclude||w!==exclude);
  const pool=sh.length?sh:(g.w||[]).filter(w=>!exclude||w!==exclude);
  return pool.length?pool[Math.floor(Math.random()*pool.length)]:(g.w&&g.w[0]);
}
function synDistractors(gi, used){
  const out=[]; let guard=0;
  while(out.length<2 && guard<300){ guard++;
    const r=Math.floor(Math.random()*VOC.length);
    if(r===gi) continue;
    const w=synPickWord(VOC[r]);
    if(!w) continue; const k=w.toLowerCase();
    if(used[k]) continue; used[k]=1; out.push(w);
  }
  while(out.length<2) out.push("—"+out.length);
  return out;
}
let vSynLastPos=-1;
function vocabCardSyn(){
  const item=vsess.queue[vsess.pos], gi=item.idx, g=VOC[gi]||{w:[],m:"",c:""};
  const total=vsess.queue.length, n=vsess.pos+1;
  const pw=synPickWord(g);
  const cw=synPickWord(g, pw);
  const used={}; used[(pw||"").toLowerCase()]=1; used[(cw||"").toLowerCase()]=1;
  const dist=synDistractors(gi, used);
  let order=shuffle([cw].concat(dist)), pos=order.indexOf(cw), tries=0;
  while(pos===vSynLastPos && tries<12){ order=shuffle(order); pos=order.indexOf(cw); tries++; }
  vSynLastPos=pos;
  vsess.cur={ idx:gi, type:item.type, pos, pw, cw, group:g, answered:false, syn:true };
  vsess.cardShownAt=Date.now();
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const optsHTML = order.map((w,i)=>`<button class="vc-opt syn" data-i="${i}"><span class="vc-opt-k">${"ABC"[i]}</span><span class="vc-opt-t">${esc(w)}</span></button>`).join("");
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}
    </div>
    <div class="vc-card">
      <div class="vc-qlabel">选出下列单词的近义词</div>
      <div class="vc-word">${esc(pw)}</div>
      ${g.c?`<div class="vc-ipa muted">${esc(g.c)}${g.m?' · '+esc(g.m):''}</div>`:(g.m?`<div class="vc-ipa muted">${esc(g.m)}</div>`:'')}
      <button class="vc-audio" id="vc-audio" title="朗读发音">🔊</button>
    </div>
    <div class="vc-q">下面哪个词与它意思最接近？</div>
    <div class="vc-opts" id="vc-opts">${optsHTML}</div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  try{ speak(pw); }catch(e){}
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  $("#vc-audio").onclick=()=>{ flash($("#vc-audio")); speak(pw); };
  main.querySelectorAll(".vc-opt").forEach(b=>b.onclick=()=>vocabPick(parseInt(b.dataset.i)));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function vocabPickSyn(choice){
  const c=vsess.cur; c.answered=true;
  const correct = choice===c.pos;
  main.querySelectorAll(".vc-opt").forEach((b,i)=>{
    b.disabled=true; b.classList.add("done");
    if(i===c.pos) b.classList.add("correct");
    if(i===choice && !correct) b.classList.add("wrong");
  });
  vGrade(c.idx, correct);
  if(correct){
    vsess.correct++;
    if(vsess.mode==='review'){ vRemoveWrong(c.idx); vsave(); }
  } else {
    vsess.wrong++;
    if(vsess.mode==='study') vsess.queue.push({idx:c.idx,type:c.type});
  }
  try{ speak(c.cw); }catch(e){}
  const g=c.group;
  // 不管对错都给出答案：始终展示正确近义词、含义与整组同义词
  const fb=$("#vc-feedback");
  fb.innerHTML=`<div class="vf ${correct?'ok':'bad'}">${correct?'✓ 回答正确！':'✗ 答错了'} 　正确近义词：<b>${esc(c.cw)}</b></div>
    <div class="vf-learn">
      <div class="vf-word">${esc(c.pw)} ＝ ${esc(c.cw)}${g.c?' <span class="vf-ipa">'+esc(g.c)+'</span>':''}</div>
      ${g.m?`<div class="vf-def">含义：${esc(g.m)}</div>`:''}
      <div class="vf-syn">同义词组：${(g.w||[]).map(w=>'<span class="vf-syn-w">'+esc(w)+'</span>').join('')}</div>
    </div>
    <button class="vc-next" id="vc-next">继续 →</button>`;
  $("#vc-next").onclick=()=>vocabNext();
}
function isSfxSet(){ return vsetById(curSetId).mode==='suffix'; }
// 名词后缀：给出后缀，在 3 个含义中选出正确的（含混淆项）
let vSfxLastPos=-1;
function sfxDistractors(idx, correctMean){
  const out=[], used={}; used[correctMean]=1; let guard=0;
  while(out.length<2 && guard<200){
    guard++;
    const r=Math.floor(Math.random()*VOC.length);
    if(r===idx) continue;
    const m=VOC[r]&&VOC[r].mean;
    if(!m||used[m]) continue;
    used[m]=1; out.push(m);
  }
  while(out.length<2) out.push("（暂无）"+out.length);
  return out;
}
function vocabCardSfx(){
  const item=vsess.queue[vsess.pos], e=VOC[item.idx]||{suf:"",cat:"",mean:"",ex:[],eg:""};
  const total=vsess.queue.length, n=vsess.pos+1;
  const correct=e.mean||"（暂无释义）";
  const dist=sfxDistractors(item.idx, correct);
  let order=shuffle([correct].concat(dist)), pos=order.indexOf(correct), tries=0;
  while(pos===vSfxLastPos && tries<16){ order=shuffle(order); pos=order.indexOf(correct); tries++; } // 避免连续相同/规律
  vSfxLastPos=pos;
  vsess.cur={ idx:item.idx, type:item.type, pos, e, answered:false, sfx:true };
  vsess.cardShownAt=Date.now();
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const optsHTML=order.map((m,i)=>`<button class="vc-opt" data-i="${i}"><span class="vc-opt-k">${"ABC"[i]}</span><span class="vc-opt-t">${esc(m)}</span></button>`).join("");
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}
    </div>
    <div class="vc-card sfx-card">
      ${e.cat?`<div class="sfx-cat">${esc(e.cat)}</div>`:''}
      <div class="sfx-suf">${esc(e.suf)}</div>
    </div>
    <div class="vc-q">选择该后缀的正确含义：</div>
    <div class="vc-opts" id="vc-opts">${optsHTML}</div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  main.querySelectorAll(".vc-opt").forEach(b=>b.onclick=()=>vocabPick(parseInt(b.dataset.i)));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function vocabPickSfx(choice){
  const c=vsess.cur; c.answered=true;
  const correct = choice===c.pos;
  main.querySelectorAll(".vc-opt").forEach((b,i)=>{
    b.disabled=true; b.classList.add("done");
    if(i===c.pos) b.classList.add("correct");
    if(i===choice && !correct) b.classList.add("wrong");
  });
  vGrade(c.idx, correct);
  if(correct){ vsess.correct++; if(vsess.mode==='review'){ vRemoveWrong(c.idx); vsave(); } }
  else { vsess.wrong++; if(vsess.mode==='study') vsess.queue.push({idx:c.idx,type:c.type}); }
  const e=c.e;
  const exHTML=(e.ex||[]).map(x=>`<span class="sfx-ex"><b>${esc(x.w)}</b> ${esc(x.cn)}${x.note?` <span class="sfx-note">${esc(x.note)}</span>`:''}</span>`).join("");
  const fb=$("#vc-feedback");
  fb.innerHTML=`<div class="vf ${correct?'ok':'bad'}">${correct?'✓ 回答正确！':'✗ 答错了，正确含义已标绿'}</div>
    <div class="vf-learn sfx-ans">
      <div class="vf-word">${esc(e.suf)}${e.cat?' <span class="sfx-ans-cat">'+esc(e.cat)+'</span>':''}</div>
      ${exHTML?`<div class="sfx-exs"><div class="sfx-lab">例词</div>${exHTML}</div>`:''}
      ${e.eg?`<div class="sfx-eg"><b>例句：</b><button class="say-btn" data-say="${escAttr(e.eg)}" title="朗读例句">🔊</button> ${esc(e.eg)}</div>`:''}
    </div>
    <button class="vc-next" id="vc-next">继续 →</button>`;
  $("#vc-next").onclick=()=>vocabNext();
}
function vocabCard(){
  if(!vsess){ renderVocabHome(); return; }
  if(vsess.pos>=vsess.queue.length){ vocabSessionDone(vsess.mode); return; }
  if(isSfxSet()) return vocabCardSfx();
  if(isSynSet()) return vocabCardSyn();
  const sm=vsess.studyMode||"choice";
  if(sm==="dictation") return vocabCardInput("dictation");
  if(sm==="spell")     return vocabCardInput("spell");
  if(sm==="audio")     return vocabCardAudio();
  if(sm==="revchoice") return vocabCardRevChoice();
  const item=vsess.queue[vsess.pos], e=VOC[item.idx];
  const word=e[0], ipa=e[1], def=e[2]||"（暂无释义）";
  const total=vsess.queue.length, n=vsess.pos+1;
  const o=vocabOptions(item.idx, def);
  vsess.cur={ idx:item.idx, type:item.type, pos:o.pos, word, ipa, def, answered:false };
  vsess.cardShownAt=Date.now();
  const ipaHTML = ipa? `<div class="vc-ipa">/${esc(ipa)}/</div>` : `<div class="vc-ipa muted">点击 🔊 收听发音</div>`;
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const optsHTML = o.order.map((d,i)=>`<button class="vc-opt" data-i="${i}"><span class="vc-opt-k">${"ABC"[i]}</span><span class="vc-opt-t">${esc(d).replace(/\n/g,"<br>")}</span></button>`).join("");
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}${vLearnBtnHTML()}${vModeSwitchHTML()}
    </div>
    <div class="vc-card">
      <div class="vc-word">${esc(word)}</div>
      ${ipaHTML}
      <button class="vc-audio" id="vc-audio" title="朗读发音">🔊</button>
    </div>
    <div class="vc-q">选择正确的中文释义：</div>
    <div class="vc-opts" id="vc-opts">${optsHTML}</div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  try{ speak(word); }catch(e){}
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  $("#vc-audio").onclick=()=>{ flash($("#vc-audio")); speak(word); };
  main.querySelectorAll(".vc-opt").forEach(b=>b.onclick=()=>vocabPick(parseInt(b.dataset.i)));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
// 累计本张卡片的用时到今日记录（单卡封顶 120s，避免挂机虚高）
function vAccumTime(){
  if(!vsess||!vsess.cardShownAt) return;
  const dt=Math.min(120, Math.round((Date.now()-vsess.cardShownAt)/1000));
  vsess.cardShownAt=null;
  if(dt>0) vHist(vToday()).sec=(vHist(vToday()).sec||0)+dt;
}
function vocabPick(choice){
  const c=vsess&&vsess.cur; if(!c||c.answered) return; c.answered=true;
  vAccumTime();
  if(c.sfx) return vocabPickSfx(choice);
  if(c.syn) return vocabPickSyn(choice);
  const correct = choice===c.pos;
  main.querySelectorAll(".vc-opt").forEach((b,i)=>{
    b.disabled=true; b.classList.add("done");
    if(i===c.pos) b.classList.add("correct");
    if(i===choice && !correct) b.classList.add("wrong");
  });
  vGrade(c.idx, correct);
  const fb=$("#vc-feedback");
  if(correct){
    vsess.correct++;
    if(vsess.mode==='review'){ vRemoveWrong(c.idx); vsave(); }
    fb.innerHTML=`<div class="vf ok">✓ 回答正确！</div>`;
    setTimeout(()=>vocabNext(), 850);
  } else {
    vsess.wrong++;
    if(vsess.mode==='study') vsess.queue.push({idx:c.idx,type:c.type}); // 答错当天重现
    speak(c.word);
    fb.innerHTML=`<div class="vf bad">✗ 答错了，记住正确释义（已用绿色标出）：</div>
      <div class="vf-learn"><div class="vf-word">${esc(c.word)} ${c.ipa?'<span class="vf-ipa">/'+esc(c.ipa)+'/</span>':''}</div><div class="vf-def">${esc(c.def).replace(/\n/g,"<br>")}</div></div>
      <button class="vc-next" id="vc-next">继续 →</button>`;
    $("#vc-next").onclick=()=>vocabNext();
  }
}
function vocabNext(){ if(!vsess) return; vsess.pos++; vsess.cur=null; vocabCard(); }

/* ---------- 听写 / 默写 / 听音选义（复用 SRS 评分与错词本） ---------- */
// 统一评分：写入艾宾浩斯记录、累计会话对错、答错当天重现、复习答对移出错词本
function vocabApplyGrade(c, correct){
  vGrade(c.idx, correct);
  if(correct){ vsess.correct++; if(vsess.mode==='review'){ vRemoveWrong(c.idx); vsave(); } }
  else { vsess.wrong++; if(vsess.mode==='study') vsess.queue.push({idx:c.idx,type:c.type}); }
}
// 输入型模式的“答案 + 释义 + 例句”讲解块
function vInputLearnHTML(c, userAns){
  const raw=vRawEntry(c.idx);
  let ex="";
  if(raw && raw.ex) ex=`<div class="vf-ex"><b>例：</b><button class="say-btn" data-say="${escAttr(raw.ex)}" title="朗读例句">🔊</button> ${esc(raw.ex)}${raw.ex_cn?'<br><span class="vf-ex-cn">'+esc(raw.ex_cn)+'</span>':''}</div>`;
  return `<div class="vf-learn">
    ${userAns!=null?`<div class="vf-word">你的答案：<b style="color:var(--red)">${esc(userAns)||'（空）'}</b></div>`:''}
    <div class="vf-word">正确答案：<b style="color:var(--green)">${esc(c.word)}</b> ${c.ipa?'<span class="vf-ipa">/'+esc(c.ipa)+'/</span>':''}</div>
    <div class="vf-def">${esc(c.def).replace(/\n/g,'<br>')}</div>
    ${ex}
  </div>`;
}
// 听写(dictation)：听发音拼写；默写(spell)：看释义拼写
function vocabCardInput(mode){
  const item=vsess.queue[vsess.pos], e=VOC[item.idx];
  const word=e[0], ipa=e[1], def=e[2]||"（暂无释义）";
  const total=vsess.queue.length, n=vsess.pos+1;
  vsess.cur={ idx:item.idx, type:item.type, word, ipa, def, answered:false, imode:mode };
  vsess.cardShownAt=Date.now();
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const isDict = mode==='dictation';
  const cardInner = isDict
    ? `<div class="vc-qlabel">🎧 听写模式</div>
       <button class="vc-audio big" id="vc-audio" title="重新播放">🔊 播放发音</button>
       <div class="dict-hint">点 🔊 听发音，拼写单词</div>`
    : `<div class="vc-qlabel">✍️ 默写模式</div>
       <div class="it-meaning">${esc(def).replace(/\n/g,'<br>')}</div>`;
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}${vLearnBtnHTML()}${vModeSwitchHTML()}
    </div>
    <div class="vc-card spell-card">${cardInner}</div>
    <div class="vc-q">请拼写英文${(word||"").indexOf(" ")>=0?'（含空格）':'单词'}：</div>
    <div class="spell-input-wrap">
      <input type="text" class="spell-input" id="spell-input" placeholder="在此输入英文…" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus>
      <button class="spell-submit" id="spell-submit">✓ 提交</button>
    </div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  if(isDict){ try{ speak(word); }catch(e){} }
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  const au=$("#vc-audio"); if(au) au.onclick=()=>{ flash(au); speak(word); };
  const inp=$("#spell-input");
  inp.onkeydown=e=>{ if(e.key==='Enter') vocabInputCheck(); };
  $("#spell-submit").onclick=()=>vocabInputCheck();
  setTimeout(()=>{ try{ inp.focus(); }catch(e){} },80);
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function vocabInputCheck(){
  const c=vsess&&vsess.cur; if(!c||c.answered) return;
  const inp=$("#spell-input"); const ans=(inp.value||"").trim();
  if(!ans){ inp.classList.add("shake"); setTimeout(()=>inp.classList.remove("shake"),400); return; }
  c.answered=true; vAccumTime();
  const correct=vSpellMatch(ans, c.word);
  inp.disabled=true; const sb=$("#spell-submit"); if(sb) sb.disabled=true;
  inp.classList.add(correct?"ok":"bad");
  vocabApplyGrade(c, correct);
  if(!correct){ try{ speak(c.word); }catch(e){} }
  const fb=$("#vc-feedback");
  fb.innerHTML=`<div class="vf ${correct?'ok':'bad'}">${correct?'✓ 拼写正确！':'✗ 拼写错误'}</div>
    ${vInputLearnHTML(c, correct?null:ans)}
    <button class="vc-next" id="vc-next">继续 →</button>`;
  const nb=$("#vc-next"); nb.onclick=()=>vocabNext(); try{ nb.focus(); }catch(e){}
}
// 听音选义：听发音，从 4 个单词中选出听到的词
function vocabWordOptions(idx, correctWord, n){
  n=n||4;
  const opts=[correctWord], used={}; used[idx]=1; let guard=0;
  while(opts.length<n && guard<120){ guard++;
    const r=Math.floor(Math.random()*VOC.length);
    if(used[r]) continue; const w=VOC[r][0];
    if(!w || opts.indexOf(w)>=0) continue; used[r]=1; opts.push(w);
  }
  while(opts.length<n) opts.push("—"+opts.length);
  let order,pos,tries=0;
  do{ order=shuffle(opts); pos=order.indexOf(correctWord); tries++; } while(pos===vLastCorrectPos && tries<12);
  vLastCorrectPos=pos; return {order,pos};
}
function vocabCardAudio(){
  const item=vsess.queue[vsess.pos], e=VOC[item.idx];
  const word=e[0], ipa=e[1], def=e[2]||"（暂无释义）";
  const total=vsess.queue.length, n=vsess.pos+1;
  const o=vocabWordOptions(item.idx, word);
  vsess.cur={ idx:item.idx, type:item.type, pos:o.pos, word, ipa, def, answered:false, audio:true };
  vsess.cardShownAt=Date.now();
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const optsHTML=o.order.map((w,i)=>`<button class="vc-opt" data-i="${i}"><span class="vc-opt-k">${"ABCD"[i]}</span><span class="vc-opt-t">${esc(w)}</span></button>`).join("");
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}${vLearnBtnHTML()}${vModeSwitchHTML()}
    </div>
    <div class="vc-card">
      <div class="vc-qlabel">🎧 听音选义</div>
      <button class="vc-audio big" id="vc-audio" title="重新播放">🔊 播放发音</button>
      <div class="vc-ipa muted">听发音，选出你听到的单词</div>
    </div>
    <div class="vc-q">选择你听到的单词：</div>
    <div class="vc-opts" id="vc-opts">${optsHTML}</div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  try{ speak(word); }catch(e){}
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  $("#vc-audio").onclick=()=>{ flash($("#vc-audio")); speak(word); };
  main.querySelectorAll(".vc-opt").forEach(b=>b.onclick=()=>vocabPickAudio(parseInt(b.dataset.i)));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function vocabPickAudio(choice){
  const c=vsess&&vsess.cur; if(!c||c.answered) return; c.answered=true; vAccumTime();
  const correct=choice===c.pos;
  main.querySelectorAll(".vc-opt").forEach((b,i)=>{ b.disabled=true; b.classList.add("done");
    if(i===c.pos) b.classList.add("correct"); if(i===choice && !correct) b.classList.add("wrong"); });
  vocabApplyGrade(c, correct);
  if(!correct){ try{ speak(c.word); }catch(e){} }
  const fb=$("#vc-feedback");
  fb.innerHTML=`<div class="vf ${correct?'ok':'bad'}">${correct?'✓ 回答正确！':'✗ 答错了'}</div>
    ${vInputLearnHTML(c, null)}
    <button class="vc-next" id="vc-next">继续 →</button>`;
  const nb=$("#vc-next"); nb.onclick=()=>vocabNext(); try{ nb.focus(); }catch(e){}
}
// 看义选词：看中文释义，从 3 个单词中选出对应的英文
function vocabCardRevChoice(){
  const item=vsess.queue[vsess.pos], e=VOC[item.idx];
  const word=e[0], ipa=e[1], def=e[2]||"（暂无释义）";
  const total=vsess.queue.length, n=vsess.pos+1;
  const o=vocabWordOptions(item.idx, word, 3);
  vsess.cur={ idx:item.idx, type:item.type, pos:o.pos, word, ipa, def, answered:false, revc:true };
  vsess.cardShownAt=Date.now();
  const badge = item.type==='new'? '<span class="vc-badge new">新词</span>' : '<span class="vc-badge rev">复习</span>';
  const optsHTML=o.order.map((w,i)=>`<button class="vc-opt" data-i="${i}"><span class="vc-opt-k">${"ABC"[i]}</span><span class="vc-opt-t">${esc(w)}</span></button>`).join("");
  main.innerHTML=`<div class="voc-study">
    <div class="vc-top">
      <button class="vc-exit" id="vc-exit">✕ 退出</button>
      <div class="vc-prog"><div class="vc-bar"><i style="width:${Math.round(n/total*100)}%"></i></div><span class="vc-pn">${n} / ${total}</span></div>
      ${badge}${vLearnBtnHTML()}${vModeSwitchHTML()}
    </div>
    <div class="vc-card">
      <div class="vc-qlabel">看义选词</div>
      <div class="it-meaning">${esc(def).replace(/\n/g,'<br>')}</div>
    </div>
    <div class="vc-q">选择对应的英文单词：</div>
    <div class="vc-opts" id="vc-opts">${optsHTML}</div>
    <div class="vc-feedback" id="vc-feedback"></div>
  </div>`;
  $("#vc-exit").onclick=()=>{ vsess=null; renderVocabHome(); };
  vBindModeSwitch();
  main.querySelectorAll(".vc-opt").forEach(b=>b.onclick=()=>vocabPickRevChoice(parseInt(b.dataset.i)));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function vocabPickRevChoice(choice){
  const c=vsess&&vsess.cur; if(!c||c.answered) return; c.answered=true; vAccumTime();
  const correct=choice===c.pos;
  main.querySelectorAll(".vc-opt").forEach((b,i)=>{ b.disabled=true; b.classList.add("done");
    if(i===c.pos) b.classList.add("correct"); if(i===choice && !correct) b.classList.add("wrong"); });
  vocabApplyGrade(c, correct);
  try{ speak(c.word); }catch(e){}
  const fb=$("#vc-feedback");
  if(correct){
    fb.innerHTML=`<div class="vf ok">✓ 回答正确！</div>`;
    setTimeout(()=>vocabNext(), 850);
  } else {
    fb.innerHTML=`<div class="vf bad">✗ 答错了，正确单词已标绿：</div>
      ${vInputLearnHTML(c, null)}
      <button class="vc-next" id="vc-next">继续 →</button>`;
    const nb=$("#vc-next"); nb.onclick=()=>vocabNext(); try{ nb.focus(); }catch(e){}
  }
}
function vocabSessionDone(mode){
  const correct=vsess?vsess.correct:0, wrong=vsess?vsess.wrong:0, total=correct+wrong;
  vsess=null;
  let body;
  if(total===0){
    body = mode==='review'
      ? `<div class="vd-emoji">📕</div><h2>错词本是空的</h2><p class="vd-tip">背诵中答错的单词会自动收集到这里。</p>`
      : `<div class="vd-emoji">🎉</div><h2>今日任务已完成</h2><p class="vd-tip">可以点「继续背诵」提前学习更多新词，或明天再来巩固。</p>`;
  } else {
    const rate = total? Math.round(correct/total*100):0;
    body = `<div class="vd-emoji">🎉</div><h2>${mode==='review'?'错词复习完成':'本组背诵完成'}</h2>
      <div class="vd-stats"><div><b>${correct}</b><span>答对</span></div><div class="vd-wrong"><b>${wrong}</b><span>答错</span></div><div><b>${rate}%</b><span>正确率</span></div></div>
      <p class="vd-tip">${mode==='review'?'答对的单词已移出错词本。':'答错的单词已存入错词本，记得复习。'}</p>`;
  }
  const hasMore = !!vstore.plan && vstore.cursor < (vstore.plan.order||[]).length;
  main.innerHTML=`<div class="voc-done">${body}
    <div class="voc-actions center">
      ${mode!=='review' && hasMore ? '<button class="voc-start" id="vd-more">▶ 继续背诵</button>' : ''}
      <button class="voc-btn" id="vd-wrong">📕 错词本（${vstore.wrong.length}）</button>
      <button class="voc-btn ghost" id="vd-home">返回单词主页</button>
    </div></div>`;
  const m=$("#vd-more"); if(m) m.onclick=()=>renderVocabMore();
  $("#vd-home").onclick=()=>renderVocabHome();
  $("#vd-wrong").onclick=()=>{ if(!vstore.wrong.length){ toast("错词本是空的 👍"); return; } renderVocabReview(); };
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

// 背诵记录页（可导出 PDF）
// 已背单词记录：按「首次学习日期」分组，并标记答错过的
function vocabStudiedByDate(){
  const wrongSet={}; vstore.wrong.forEach(i=>wrongSet[i]=1);
  const order=(vstore.plan&&vstore.plan.order)||[];
  const seen={}, groups={};
  const push=idx=>{ if(seen[idx]) return; seen[idx]=1; const r=vstore.srs[idx]; const d=(r&&r.day)||"未记录日期"; (groups[d]=groups[d]||[]).push(idx); };
  order.forEach(idx=>{ if(vstore.srs[idx]) push(idx); });
  for(const k in vstore.srs){ push(+k); }
  const dates=Object.keys(groups).sort((a,b)=>{
    if(a==="未记录日期") return 1; if(b==="未记录日期") return -1; return a<b?1:-1; // 日期降序
  });
  let total=0; dates.forEach(d=>total+=groups[d].length);
  return {groups, dates, wrongSet, total};
}
function vocabWordRow(idx, i, wrongSet){
  const r=vstore.srs[idx]||{}, isWrong=!!wrongSet[idx];
  const status = isWrong ? '<span class="vr-tag err">❌ 答错</span>'
               : r.mastered ? '<span class="vr-tag ok">✅ 已掌握</span>'
               : '<span class="vr-tag lrn">学习中</span>';
  if(isSynSet()){
    const g=VOC[idx]||{w:[],m:"",c:""};
    return `<tr class="${isWrong?'vr-row-err':''}">
      <td>${i}</td>
      <td class="vr-w">${esc((g.w||[]).join(", "))}</td>
      <td class="vr-ph">${esc(g.c||"")}</td>
      <td class="vr-def">${esc(g.m||"")}</td>
      <td class="vr-st">${status}</td></tr>`;
  }
  if(isSfxSet()){
    const e=VOC[idx]||{suf:"",cat:"",mean:""};
    return `<tr class="${isWrong?'vr-row-err':''}">
      <td>${i}</td>
      <td class="vr-w">${esc(e.suf)}</td>
      <td class="vr-ph">${esc(e.cat||"")}</td>
      <td class="vr-def">${esc(e.mean||"")}</td>
      <td class="vr-st">${status}</td></tr>`;
  }
  const e=VOC[idx]||["","",""];
  return `<tr class="${isWrong?'vr-row-err':''}">
    <td>${i}</td>
    <td class="vr-w">${esc(e[0])}</td>
    <td class="vr-ph">${e[1]?'/'+esc(e[1])+'/':''}</td>
    <td class="vr-def">${esc(e[2]||"").replace(/\n/g,"<br>")}</td>
    <td class="vr-st">${status}</td></tr>`;
}
function renderVocabRecords(focusDate){
  stopTimer(); highlightNav(null); hideNoteFab();
  const {groups, dates, wrongSet, total}=vocabStudiedByDate();
  let sections="";
  if(!dates.length){
    sections=`<div class="vr-empty-box">还没有背诵记录，去背几个单词吧！</div>`;
  } else {
    const focus = focusDate && groups[focusDate] ? focusDate : dates[0]; // 默认展开最近一天或指定日期
    dates.forEach(d=>{
      const ids=groups[d];
      const h=vstore.hist[d]||{};
      const wrongN=ids.filter(i=>wrongSet[i]).length;
      const open = d===focus;
      const rows=ids.map((idx,i)=>vocabWordRow(idx,i+1,wrongSet)).join("");
      sections+=`<div class="vrec-day${open?' open':''}" data-d="${esc(d)}">
        <div class="vrec-day-h"><span class="vrec-arrow">▸</span><span class="vrec-date">${d==="未记录日期"?"未记录日期":d}</span>
          <span class="vrec-meta">${ids.length} ${vUnit()}${h.rev?" · 复习 "+h.rev:""}${wrongN?' · <span class="vrec-err">错 '+wrongN+'</span>':""}${h.sec?' · ⏱ '+fmtTime(h.sec):""}</span></div>
        <div class="vrec-day-b">
          <table class="vr-table vr-words">
            <thead><tr><th>#</th><th>${isSfxSet()?"后缀":isSynSet()?"同义词组":"单词"}</th><th>${isSfxSet()?"分类":isSynSet()?"词性":"音标"}</th><th>${isSfxSet()?"含义":isSynSet()?"含义":"释义"}</th><th>状态</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div></div>`;
    });
  }
  main.innerHTML=`<div class="voc-records">
    <div class="vrec-actions" id="vrec-actions">
      <button class="voc-btn ghost" id="vrec-back">← 返回</button>
      <button class="voc-btn" id="vrec-pdf">📄 导出为 PDF</button>
    </div>
    <section class="voc-hero"><h1>📋 背诵记录 · 按日期</h1>
      <div class="voc-sub">累计已背 <b>${total}</b> ${vUnit()} · 已掌握 ${vMasteredCount()} · <span style="color:#ffd9d2">标记答错 ${vstore.wrong.length}</span> · 连续 ${vStreak()} 天 · 累计用时 ${fmtTime(vTotalSec())}</div></section>
    <div class="vr-legend"><span class="vr-tag ok">✅ 已掌握</span><span class="vr-tag lrn">学习中</span><span class="vr-tag err">❌ 答错</span>（点日期可展开/收起；答错的词红色标出）</div>
    ${sections}
  </div>`;
  $("#vrec-back").onclick=()=>renderVocabHome();
  $("#vrec-pdf").onclick=()=>exportVocabRecordsPDF();
  main.querySelectorAll(".vrec-day-h").forEach(hd=>hd.onclick=()=>hd.parentElement.classList.toggle("open"));
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function exportVocabRecordsPDF(){
  const {total}=vocabStudiedByDate();
  if(!total){ toast("还没有已背单词可导出"); return; }
  main.querySelectorAll(".vrec-day").forEach(s=>s.classList.add("open")); // 导出时全部展开
  const bar=$("#vrec-actions"); if(bar) bar.style.display="none";
  const orig=document.title; document.title="背诵记录（按日期）- 青山沃思";
  _pdfExportTarget="vocab";
  doExportPDF(orig);
  setTimeout(()=>{ if(bar) bar.style.display=""; },3000);
}

/* ============================ 每日一练 (Daily Practice) ============================ */
const DAILY = window.DAILY || {exams:[]};
const DKEY = "glx.daily";
function dload(){ try{ return JSON.parse(localStorage.getItem(DKEY))||{days:{}}; }catch(e){ return {days:{}}; } }
let dstore = dload(); if(!dstore.days) dstore.days={}; if(!dstore.wrong) dstore.wrong={};
let dlRecPage = 0;
function dsave(){ try{ localStorage.setItem(DKEY, JSON.stringify(dstore)); }catch(e){} }
function dExams(){ return DAILY.exams||[]; }
// 单个题库练习统计（供仪表盘）
function dExamStats(ex){
  let total=0,done=0,mcqC=0,mcqT=0;
  ex.weeks.forEach(w=>w.days.forEach(d=>{ total++; const r=dstore.days[dKey(ex.id,w.id,d.id)]; if(r&&r.done){ done++; mcqC+=r.mcqCorrect||0; mcqT+=r.mcqTotal||0; } }));
  return {total,done,mcqC,mcqT,pct: total?Math.round(done/total*100):0};
}
// 首页：每日一练进度仪表盘
function dailyDashHTML(){
  const exams=dExams(); if(!exams.length) return "";
  const stats=exams.map(ex=>({ex,st:dExamStats(ex)}));
  const agg=stats.reduce((a,{st})=>{a.total+=st.total;a.done+=st.done;a.mcqC+=st.mcqC;a.mcqT+=st.mcqT;return a;},{total:0,done:0,mcqC:0,mcqT:0});
  const acc=agg.mcqT?Math.round(agg.mcqC/agg.mcqT*100):0;
  return `<div class="vdash">
    <div class="vdash-head"><span>📅 每日一练进度</span><button class="vdash-all" data-nav="daily">进入练习 →</button></div>
    <div class="vdash-sum">
      <div class="vds"><div class="vds-n">${agg.done}<small style="font-size:14px;color:var(--muted)">/${agg.total}</small></div><div class="vds-l">已完成天数</div></div>
      <div class="vds"><div class="vds-n">${agg.mcqC}</div><div class="vds-l">客观题答对</div></div>
      <div class="vds${acc>=80?' hot':''}"><div class="vds-n">${acc}%</div><div class="vds-l">客观题正确率</div></div>
      <div class="vds"><div class="vds-n">${stats.length}</div><div class="vds-l">题库数</div></div>
    </div>
    <div class="vdash-sets">${stats.map(({ex,st})=>`
      <button class="vdash-card" data-dexam="${esc(ex.id)}">
        <div class="vdc-top"><span class="vdc-name">${esc(ex.name)}</span>${
          (st.total&&st.done>=st.total)? '<span class="vdc-doneb">已完成 ✓</span>'
          : st.done? '<span class="vdc-due">已做 '+st.done+'</span>'
          : '<span class="vdc-newb">未开始</span>'}</div>
        <div class="vdc-bar"><i style="width:${st.pct}%"></i></div>
        <div class="vdc-meta">完成 ${st.done}/${st.total} 天${st.mcqT?' · 客观题 '+st.mcqC+'/'+st.mcqT:''}</div>
      </button>`).join("")}</div>
  </div>`;
}
function dExam(id){ return dExams().find(e=>e.id===id) || dExams()[0]; }
function dKey(a,b,c){ return a+"/"+b+"/"+c; }
function dFind(examId,weekId,dayId){
  const e=dExam(examId); if(!e) return null;
  const w=e.weeks.find(x=>x.id===weekId)||e.weeks[0]; if(!w) return null;
  const d=w.days.find(x=>x.id===dayId)||w.days[0]; if(!d) return null;
  return {e,w,d};
}
function dToday(){ const d=new Date(),p=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
function dDayMeta(d){
  const parts=[];
  if((d.mcq||[]).length) parts.push(d.mcq.length+" 选择");
  if((d.fill||[]).length) parts.push(d.fill.length+" 填空");
  if((d.cn2en||[]).length) parts.push(d.cn2en.length+" 翻译");
  if((d.trans||[]).length) parts.push(d.trans.length+" 翻译");
  if((d.writing||[]).length) parts.push(d.writing.length+" 写作");
  return parts.join(" · ");
}

// 每日一练主页：选考试 / 周 / 日 + 每日记录
function renderDailyHome(examId){
  stopTimer(); highlightNav(null); hideNoteFab();
  const EX=dExams();
  if(!EX.length){ main.innerHTML='<section class="hero"><h1>📅 每日一练</h1><p>题库未加载，请刷新页面。</p></section>'; return; }
  const e=dExam(examId);
  let html=`<section class="hero daily-hero">
    <h1>📅 每日一练</h1>
    <p>按周、按天完成专项练习。做完后点「提交 · 对答案」，<b>客观题自动批改</b>并显示全部参考答案；练习记录自动保存在本机，可<b>导出 PDF</b>。</p>
    <div class="daily-exam-tabs">${EX.map(x=>`<button class="det${x.id===e.id?' on':''}" data-exam="${esc(x.id)}">${esc(x.name)}</button>`).join("")}</div>
  </section>
  ${dailyDashHTML()}`;
  // 错题总览（紧贴进度仪表盘下方）
  { const wrongKeys=Object.keys(dstore.wrong).filter(k=>dstore.wrong[k]&&dstore.wrong[k].length);
    if(wrongKeys.length){let wt=0;wrongKeys.forEach(k=>{wt+=dstore.wrong[k].length});
    html+=`<div class="dl-wrong-bar"><span>📕 错题回顾 · <b>${wt} 题</b></span><button class="btn teal sm" id="dw-redo-all">🔁 重做全部错题</button></div>`;} }
  // 找到第一个未全部完成的周（默认展开），否则展开第一周
  let firstOpenIdx = 0;
  for (let i = 0; i < e.weeks.length; i++) {
    const w = e.weeks[i];
    const allDone = w.days.every(d => { const r = dstore.days[dKey(e.id, w.id, d.id)]; return r && r.done; });
    if (!allDone) { firstOpenIdx = i; break; }
  }
  e.weeks.forEach((w, wi) => {
    const allDone = w.days.every(d => { const r = dstore.days[dKey(e.id, w.id, d.id)]; return r && r.done; });
    const openAttr = wi === firstOpenIdx ? ' open' : '';
    html += `<details class="dl-week"${openAttr}><summary class="dl-week-h">${esc(e.name)} · ${esc(w.name)}${allDone ? ' <span class="dl-week-done">✓ 已完成</span>' : ''}</summary><div class="dl-days">`;
    w.days.forEach(d=>{
      const rec=dstore.days[dKey(e.id,w.id,d.id)], done=rec&&rec.done;
      html+=`<button class="dl-day${done?' done':''}" data-exam="${esc(e.id)}" data-week="${esc(w.id)}" data-day="${esc(d.id)}">
        <span class="dl-day-name">${esc(d.name)}${done?' <span class="dl-tick">✓</span>':''}</span>
        <span class="dl-day-meta">${done?`${rec.date}${rec.mcqTotal?` · 客观题 ${rec.mcqCorrect}/${rec.mcqTotal}`:''}${rec.studySec?` · 用时 ${fmtTime(rec.studySec)}`:''}`:dDayMeta(d)}</span>
      </button>`;
    });
    html+=`</div></details>`;
  });
  const recs=Object.keys(dstore.days).map(k=>({k,r:dstore.days[k]})).filter(x=>x.r.done).sort((a,b)=>(a.r.ts<b.r.ts?1:-1));
  const RP=5; // 每页条数
  const totalPages=Math.ceil(recs.length/RP);
  if(typeof dlRecPage==='undefined'||dlRecPage>=totalPages) dlRecPage=0;
  if(recs.length){
    const page=recs.slice(dlRecPage*RP, dlRecPage*RP+RP);
    html+=`<div class="dl-records"><div class="dl-rec-h">📋 每日记录 <span class="dl-rec-pn">${dlRecPage+1}/${totalPages} 页</span></div>`;
    page.forEach(({k,r})=>{
      const info=dFind.apply(null,k.split("/"));
      const label=info?`${esc(info.e.name)} · ${esc(info.w.name)} · ${esc(info.d.name)}`:esc(k);
      html+=`<div class="dl-rec-row" data-go="${esc(k)}"><span class="dl-rec-d">${r.date}</span><span class="dl-rec-l">${label}</span><span class="dl-rec-s">${r.mcqTotal?'客观题 '+r.mcqCorrect+'/'+r.mcqTotal:'已完成'}${r.studySec?' · 用时 '+fmtTime(r.studySec):''}</span></div>`;
    });
    html+=`<div class="dl-rec-pager">`;
    if(dlRecPage>0) html+=`<button class="btn ghost sm" id="dl-prev">◀ 上一页</button>`;
    else html+=`<span></span>`;
    html+=`<span class="dl-rec-info">共 ${recs.length} 条</span>`;
    if(dlRecPage<totalPages-1) html+=`<button class="btn ghost sm" id="dl-next">下一页 ▶</button>`;
    else html+=`<span></span>`;
    html+=`</div></div>`;
  }
  main.innerHTML=html;
  main.querySelectorAll(".det").forEach(b=>b.onclick=()=>{ location.hash="#/daily/"+encodeURIComponent(b.dataset.exam); });
  main.querySelectorAll(".dl-day").forEach(b=>b.onclick=()=>{ location.hash="#/daily/"+[b.dataset.exam,b.dataset.week,b.dataset.day].map(encodeURIComponent).join("/"); });
  main.querySelectorAll(".dl-rec-row").forEach(b=>b.onclick=()=>{ location.hash="#/daily/"+b.dataset.go.split("/").map(encodeURIComponent).join("/"); });
  // 分页按钮
  const prev=$("#dl-prev"), next=$("#dl-next");
  if(prev) prev.onclick=()=>{ dlRecPage--; renderDailyHome(examId); };
  if(next) next.onclick=()=>{ dlRecPage++; renderDailyHome(examId); };
  // 仪表盘内的题库卡片：切换到对应题库
  main.querySelectorAll(".vdash-card[data-dexam]").forEach(b=>b.onclick=()=>{ location.hash="#/daily/"+encodeURIComponent(b.dataset.dexam); });
  main.querySelectorAll('[data-nav="daily"]').forEach(b=>b.onclick=()=>{ const t=$("#dl-records")||main; t&&t.scrollIntoView&&t.scrollIntoView({behavior:"smooth"}); });
  const dwRedo=$("#dw-redo-all");if(dwRedo)dwRedo.onclick=()=>{renderDailyWrongRedo();};
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

let dwRedoSess=null;
function renderDailyWrongRedo(){
  stopTimer();const allQ=[];
  Object.keys(dstore.wrong).forEach(k=>{const arr=dstore.wrong[k];if(!arr||!arr.length)return;const info=dFind.apply(null,k.split("/"));if(!info)return;
  arr.forEach(qi=>{const q=(info.d.mcq||[])[qi];if(q)allQ.push({...q,_key:k,_qi:qi,_label:info.e.name+" · "+info.w.name+" · "+info.d.name+" Q"+(qi+1)});});});
  if(!allQ.length){toast("暂无错题");return;}
  dwRedoSess=allQ;
  let html="<section class='hero'><button class='voc-switch' id='dl-back'>← 返回</button><h1>📕 错题重做</h1><p>共 <b>"+allQ.length+"</b> 道错题，全部答对方可从错题本移除。</p></section><div class='dl-paper' id='dl-paper'>";
  allQ.forEach((q,qi)=>{html+="<div class='dl-q' id='dlq-"+qi+"'><div class='dl-q-stem'><b>"+(qi+1)+".</b> <span class='dw-src'>"+esc(q._label)+"</span> "+esc(q.q)+"</div><div class='dl-opts'>";
  q.options.forEach((opt,oi)=>{let cls="dl-opt";if(dwRedoSess[qi]._sel===oi)cls+=" sel";if(dwRedoSess[qi]._graded&&q.answer!=null&&q.answer>=0){if(oi===q.answer)cls+=" correct";else if(dwRedoSess[qi]._sel===oi)cls+=" wrong";}
  html+="<button class='"+cls+"' data-q='"+qi+"' data-o='"+oi+"'"+(dwRedoSess[qi]._graded?" disabled":"")+"><span class='dl-opt-k'>"+"ABCD"[oi]+"</span><span class='dl-opt-t'>"+esc(opt)+"</span></button>";});
  html+="</div></div>";});
  html+="<div class='quiz-actions' id='dw-actions'><button class='btn teal' id='dw-submit'>📝 提交批改</button><button class='btn ghost' id='dl-back2'>← 返回每日一练</button></div></div>";
  main.innerHTML=html;
  $("#dl-back").onclick=()=>{dwRedoSess=null;location.hash="#/daily";};
  $("#dl-back2").onclick=()=>{dwRedoSess=null;location.hash="#/daily";};
  main.querySelectorAll(".dl-opt").forEach(b=>b.onclick=()=>{if(dwRedoSess[+b.dataset.q]._graded)return;dwRedoSess[+b.dataset.q]._sel=+b.dataset.o;b.parentElement.querySelectorAll(".dl-opt").forEach(o=>o.classList.remove("sel"));b.classList.add("sel");});
  $("#dw-submit").onclick=()=>{let correct=0,total=0;dwRedoSess.forEach((q,qi)=>{q._graded=true;if(q.answer!=null&&q.answer>=0){total++;if(q._sel===q.answer)correct++;}});dwRedoSess.forEach(q=>{if(q._sel===q.answer&&q.answer!=null&&q.answer>=0){const arr=dstore.wrong[q._key];if(arr){const idx=arr.indexOf(q._qi);if(idx>=0)arr.splice(idx,1);if(!arr.length)delete dstore.wrong[q._key];}}});dsave();renderDailyWrongRedoShow(correct,total);};
  main.scrollTo&&main.scrollTo(0,0);window.scrollTo(0,0);
}
function renderDailyWrongRedoShow(correct,total){
  $("#dw-submit").remove();
  // Don't show correct/wrong per-question, just the score
  main.querySelectorAll(".dl-opt").forEach(b=>b.disabled=true);
  $("#dw-actions").innerHTML="<div class='result-banner "+(correct/total>=0.8?"good":correct/total>=0.5?"mid":"low")+"'><span class='big'>"+correct+"/"+total+"</span><div class='rtxt'><b>正确率 "+Math.round(correct/total*100)+"%</b><div>"+(correct===total?"🎉 全部答对！错题本已清空。":"答对的题已从错题本移除，剩余错题可重新进入复习。")+"</div></div></div><button class='btn teal' onclick=\"location.hash='#/daily'\">📅 返回每日一练</button>";
  main.scrollTo&&main.scrollTo(0,0);window.scrollTo(0,0);
}

let dSess=null;
const DSUBJ=["trans","writing","fill","cn2en"];   // 主观题类型
function renderDailyDay(examId,weekId,dayId){
  stopTimer(); highlightNav(null); hideNoteFab();
  const info=dFind(examId,weekId,dayId);
  if(!info){ renderDailyHome(); return; }
  const {e,w,d}=info, key=dKey(e.id,w.id,d.id), saved=dstore.days[key];
  startDailyTimer(key);
  const arr=k=>d[k]||[];
  if(!dSess || dSess.key!==key){
    dSess={ key, examId:e.id, weekId:w.id, dayId:d.id, graded:!!(saved&&saved.done),
      mcq:(saved&&saved.mcqAns)?saved.mcqAns.slice():arr("mcq").map(()=>null) };
    DSUBJ.forEach(k=>{ dSess[k]=(saved&&saved[k+"Ans"])?saved[k+"Ans"].slice():arr(k).map(()=>""); });
  }
  const g=dSess.graded;
  let secNo=0; const cn=["一","二","三","四","五","六"];
  let html=`<section class="hero daily-hero">
    <button class="voc-switch" id="dl-back">← 返回</button>
    <div class="timer-pill" style="position:absolute;right:24px;top:24px"><span class="dot"></span>本次练习 <span id="live-timer">${fmtTime((saved&&saved.studySec)||0)}</span></div>
    <h1>📅 ${esc(e.name)} · ${esc(d.name)}</h1>
    <p>${d.theme?esc(d.theme)+'　|　':''}${esc(w.name)}　|　${g?'已完成 · 客观题已批改，主观题附参考答案'+(saved&&saved.studySec?' · 练习用时 '+fmtTime(saved.studySec):''):'作答后点击底部「提交 · 对答案」，客观题将自动批改'}</p>
    ${g?`<div class="dl-hero-btns"><button class="btn teal sm" id="dl-pdf-top">📄 导出 PDF</button><button class="btn ghost sm" id="dl-redo-top">↺ 重做本日</button></div>`:''}
  </section>
  <div class="dl-paper" id="dl-paper">`;
  // 参考资料：词汇 / 短语
  if(arr("vocab").length||arr("phrases").length){
    html+=`<details class="dl-ref-box"${g?' open':''}><summary>📚 本日词汇 / 短语（参考）</summary>`;
    if(arr("vocab").length){ html+=`<table class="dl-voc"><tbody>`+d.vocab.map(v=>`<tr><td class="dv-w">${esc(v.w)}</td><td class="dv-i">${v.ipa?'/'+esc(v.ipa)+'/':''}</td><td class="dv-p">${esc(v.pos||'')}</td><td>${esc(v.cn||'')}</td></tr>`).join("")+`</tbody></table>`; }
    if(arr("phrases").length){ html+=`<div class="dl-phr">`+d.phrases.map(p=>`<span class="dl-phr-i"><b>${esc(p.en)}</b> ${esc(p.cn)}</span>`).join("")+`</div>`; }
    html+=`</details>`;
  }
  // 单选题（自动批改）
  if(arr("mcq").length){
    secNo++;
    html+=`<div class="dl-sec"><h2>${cn[secNo-1]}、单项选择题（${d.mcq.length}题 · 自动批改）</h2>`;
    d.mcq.forEach((q,qi)=>{
      html+=`<div class="dl-q" id="dlq-${qi}"><div class="dl-q-stem"><b>${qi+1}.</b> ${esc(q.q)}</div><div class="dl-opts">`;
      q.options.forEach((opt,oi)=>{
        const sel=dSess.mcq[qi]===oi; let cls="dl-opt";
        if(sel) cls+=" sel";
        if(g && q.answer!=null && q.answer>=0){ if(oi===q.answer) cls+=" correct"; else if(sel) cls+=" wrong"; }
        html+=`<button class="${cls}" data-q="${qi}" data-o="${oi}"${g?' disabled':''}><span class="dl-opt-k">${"ABCD"[oi]}</span><span class="dl-opt-t">${esc(opt)}</span></button>`;
      });
      html+=`</div>`;
      if(g){ html+= (q.answer!=null&&q.answer>=0)
        ? `<div class="dl-explain"><b>答案：${"ABCD"[q.answer]}</b>${q.explain?'　'+esc(q.explain):''}</div>`
        : `<div class="dl-explain muted">（本题暂无标准答案）</div>`; }
      html+=`</div>`;
    });
    html+=`</div>`;
  }
  // 主观题区块（通用）
  function subjSec(kind,title,stemFn,refFn,placeholder,grouped){
    if(!arr(kind).length) return;
    secNo++;
    html+=`<div class="dl-sec"><h2>${cn[secNo-1]}、${title}（${d[kind].length}题）</h2>`;
    let lastPat=null;
    d[kind].forEach((q,qi)=>{
      if(grouped && q.pattern!==lastPat){ lastPat=q.pattern; html+=`<div class="dl-pat">${q.cat?`<span class="dl-pat-cat">${esc(q.cat)}</span>`:''}${esc(q.pattern)}${q.example?`<div class="dl-pat-ex">例句：${esc(q.example)}</div>`:''}</div>`; }
      html+=`<div class="dl-q"><div class="dl-q-stem"><b>${qi+1}.</b> ${stemFn(q)}</div>`;
      if(g){
        const val=dSess[kind][qi];
        html+=`<div class="dl-your">${kind==='trans'?'你的译文':'你的答案'}：${esc(val)||'<span class="dl-blank">（未作答）</span>'}</div>`;
        const ref=refFn(q); if(ref) html+=ref;
      } else {
        html+=`<textarea class="dl-input" data-sub="${kind}" data-i="${qi}" placeholder="${placeholder}">${esc(dSess[kind][qi]||"")}</textarea>`;
      }
      html+=`</div>`;
    });
    html+=`</div>`;
  }
  subjSec("trans","长难句翻译（英译汉）",q=>esc(q.en),
    q=>`<div class="dl-ref"><div class="dl-ref-t">参考译文</div><div>${esc(q.zh)}</div>${q.structure?`<div class="dl-ref-struct">句子结构：${esc(q.structure)}</div>`:''}</div>`,
    "在此输入你的译文…");
  subjSec("writing","写作练习（汉译英）",q=>esc(q.prompt),
    q=>`<div class="dl-ref"><div class="dl-ref-t">参考答案</div><div>${esc(q.answer)}</div></div>`,
    "在此输入英文…", true);
  subjSec("fill","词汇 / 词组填空",q=>esc(q.prompt),
    q=>q.answer?`<div class="dl-ref"><div class="dl-ref-t">参考答案</div><div>${esc(q.answer)}</div></div>`:'',
    "在此填写…");
  subjSec("cn2en","翻译练习（汉译英）",q=>esc(q.cn),
    q=>q.answer?`<div class="dl-ref"><div class="dl-ref-t">参考答案</div><div>${esc(q.answer)}</div></div>`:'',
    "在此输入英文…");
  html+=`</div>`; // dl-paper
  html+=`<div class="dl-actions" id="dl-actions">`;
  if(!g) html+=`<button class="voc-start" id="dl-submit">✅ 提交 · 对答案</button>`;
  else html+=`<button class="voc-btn" id="dl-pdf">📄 导出 PDF</button><button class="voc-btn ghost" id="dl-redo">↺ 重做本日</button><button class="voc-btn ghost" id="dl-back2">← 返回列表</button>`;
  html+=`</div>`;
  main.innerHTML=html;
  $("#dl-back").onclick=()=>{ location.hash="#/daily/"+encodeURIComponent(e.id); };
  if(!g){
    main.querySelectorAll(".dl-opt").forEach(b=>b.onclick=()=>{
      const qi=+b.dataset.q, oi=+b.dataset.o; dSess.mcq[qi]=oi;
      const wrap=document.getElementById("dlq-"+qi); wrap.querySelectorAll(".dl-opt").forEach(x=>x.classList.toggle("sel", +x.dataset.o===oi));
    });
    main.querySelectorAll("[data-sub]").forEach(t=>t.oninput=()=>{ dSess[t.dataset.sub][+t.dataset.i]=t.value; });
    $("#dl-submit").onclick=()=>submitDailyDay();
  } else {
    $("#dl-pdf").onclick=()=>exportDailyPDF(e,w,d);
    $("#dl-redo").onclick=()=>{ if(confirm("重做本日？将清除本日已保存的作答与记录。")){ delete dstore.days[key]; dsave(); dSess=null; renderDailyDay(e.id,w.id,d.id); } };
    $("#dl-back2").onclick=()=>{ location.hash="#/daily/"+encodeURIComponent(e.id); };
    // Top buttons (same actions)
    const pdfTop=$("#dl-pdf-top"), redoTop=$("#dl-redo-top");
    if(pdfTop) pdfTop.onclick=()=>exportDailyPDF(e,w,d);
    if(redoTop) redoTop.onclick=()=>{ if(confirm("重做本日？将清除本日已保存的作答与记录。")){ delete dstore.days[key]; dsave(); dSess=null; renderDailyDay(e.id,w.id,d.id); } };
  }
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}
function submitDailyDay(){
  if(!dSess) return;
  main.querySelectorAll("[data-sub]").forEach(t=>{ dSess[t.dataset.sub][+t.dataset.i]=t.value; });
  const info=dFind(dSess.examId,dSess.weekId,dSess.dayId); if(!info) return; const d=info.d, mcq=d.mcq||[];
  let correct=0, gradable=0;
  mcq.forEach((q,i)=>{ if(q.answer!=null&&q.answer>=0){ gradable++; if(dSess.mcq[i]===q.answer) correct++; } });
  dSess.graded=true;
  // Compute study time
  let studySec=(dstore.days[dSess.key]&&dstore.days[dSess.key].studySec)||0;
  if(timer.type==='daily' && timer.dKey===dSess.key){
    if(!document.hidden){ studySec+=(Date.now()-timer.start)/1000; }
  }
  const rec={ done:true, date:dToday(), ts:Date.now(), mcqCorrect:correct, mcqTotal:gradable, mcqAns:dSess.mcq.slice(), studySec };
  DSUBJ.forEach(k=>{ if((d[k]||[]).length) rec[k+"Ans"]=dSess[k].slice(); });
  dstore.days[dSess.key]=rec;
  const wrongIdx=[]; mcq.forEach((q,i)=>{ if(q.answer!=null&&q.answer>=0&&dSess.mcq[i]!==q.answer) wrongIdx.push(i); });
  if(wrongIdx.length) dstore.wrong[dSess.key]=wrongIdx; else delete dstore.wrong[dSess.key];
  dsave();
  toast(gradable?`已对答案：客观题答对 ${correct} / ${gradable}`:"已提交，参考答案已显示");
  renderDailyDay(dSess.examId,dSess.weekId,dSess.dayId);
}
function exportDailyPDF(e,w,d){
  const bar=$("#dl-actions"); if(bar) bar.style.display="none";
  const back=$("#dl-back"); if(back) back.style.display="none";
  const orig=document.title; document.title=`${e.name} ${w.name} ${d.name} 练习结果 - 青山沃思`;
  _pdfExportTarget="daily";
  doExportPDF(orig);
  setTimeout(()=>{ if(bar) bar.style.display=""; if(back) back.style.display=""; },3000);
}


/* ============================ 雅思阅读话题词汇背诵 ============================ */
let itState = null; // { topicId, words:[], pos, correct, wrong, mode:'study'|'spell' }

function itGetTopics() {
  var data = window.VOCAB_IELTS_TOPIC;
  return data && data.topics ? data.topics : [];
}

function itGetTopic(id) {
  return itGetTopics().find(function(t) { return t.id === id; });
}

// 话题选择页：进入话题即用新引擎（五种考查形式 + 学习模式 + 计划复习）
function renderVocabIeltsTopic() {
  stopTimer(); highlightNav(null); hideNoteFab();
  var topics = itGetTopics();
  if (!topics.length) {
    main.innerHTML = '<section class="voc-hero"><h1>📖 雅思阅读话题词汇背诵</h1><div class="voc-sub">数据未加载，请刷新页面。</div></section>';
    return;
  }
  var totalWords = 0;
  var cards = topics.map(function(t) {
    totalWords += t.words.length;
    var p = vall.sets['it:'+t.id];
    var learned = p ? (p.cursor||0) : 0;
    var meta = learned>0 ? '已学 '+learned+'/'+t.words.length : t.words.length+' 词';
    return '<button class="wb-book" data-id="' + esc(t.id) + '">' +
      '<span class="wb-b-name">' + esc(t.emoji || '📖') + ' ' + esc(t.name) + '</span>' +
      '<span class="wb-b-meta">' + meta + '</span>' +
    '</button>';
  }).join('');

  main.innerHTML = '<section class="voc-hero">' +
    '<button class="voc-switch" onclick="location.hash=\'#/vocab\'">⇄ 返回词库选择</button>' +
    '<h1>📖 雅思阅读话题词汇背诵</h1>' +
    '<div class="voc-sub">按话题分类 · 共 ' + topics.length + ' 个话题 · ' + totalWords + ' 词</div>' +
    '<p class="voc-sub" style="margin-top:6px">进入话题后可用「看词选义 / 看义选词 / 听音选义 / 听写 / 默写」五种考查形式，先学习模式浏览、再背诵，艾宾浩斯智能复习</p>' +
  '</section>' +
  '<div class="wb-books">' + cards + '</div>';

  main.querySelectorAll('.wb-book').forEach(function(card) {
    card.onclick = function() { location.hash = '#/vocab/topic/' + encodeURIComponent(card.dataset.id); };
  });
  main.scrollTo && main.scrollTo(0,0); window.scrollTo(0,0);
}



// 学习模式：看单词，选中文释义（带读音）
function renderVocabIeltsTopicStudy(topicId) {
  stopTimer(); highlightNav(null); hideNoteFab();
  var topic = itGetTopic(topicId);
  if (!topic || !topic.words.length) { renderVocabIeltsTopic(); return; }
  
  itState = {
    topicId: topicId,
    words: shuffle(topic.words.slice()),
    pos: 0,
    correct: 0,
    wrong: 0,
    mode: 'study'
  };
  itStudyCard(topic);
}

function itStudyCard(topic) {
  if (!itState || itState.pos >= itState.words.length) { itSessionDone(topic); return; }
  
  var entry = itState.words[itState.pos];
  var total = itState.words.length;
  var n = itState.pos + 1;
  var word = entry.w;
  var phonetic = entry.p || '';
  var meaning = entry.m || '（暂无释义）';
  var posText = entry.s || '';
  
  // 生成 3 个选项（1个正确 + 2个干扰）
  var correct = meaning;
  var opts = [correct];
  var used = {};
  used[itState.pos] = 1;
  var guard = 0;
  while (opts.length < 3 && guard < 200) {
    guard++;
    var ri = Math.floor(Math.random() * itState.words.length);
    if (used[ri]) continue;
    var dm = itState.words[ri].m;
    if (!dm || opts.indexOf(dm) >= 0) continue;
    used[ri] = 1;
    opts.push(dm);
  }
  opts = shuffle(opts);
  var correctIdx = opts.indexOf(correct);
  
  itState.cur = { pos: correctIdx, word: word, phonetic: phonetic, meaning: meaning, answered: false };
  
  var optsHTML = opts.map(function(d, i) {
    return '<button class="vc-opt" data-i="' + i + '"><span class="vc-opt-k">' + 'ABC'[i] + '</span><span class="vc-opt-t">' + esc(d) + '</span></button>';
  }).join('');
  
  main.innerHTML = '<div class="voc-study">' +
    '<div class="vc-top">' +
      '<button class="vc-exit" id="vc-exit">✕ 退出</button>' +
      '<div class="vc-prog"><div class="vc-bar"><i style="width:' + Math.round(n/total*100) + '%"></i></div><span class="vc-pn">' + n + ' / ' + total + '</span></div>' +
      '<span class="vc-badge new">学习模式</span>' +
    '</div>' +
    '<div class="vc-card">' +
      '<div class="vc-qlabel">' + esc(topic.name) + '</div>' +
      '<div class="vc-word">' + esc(word) + '</div>' +
      (phonetic ? '<div class="vc-ipa">' + esc(phonetic) + '</div>' : '') +
      (posText ? '<div class="vc-pos">' + esc(posText) + '</div>' : '') +
      '<button class="vc-audio" id="vc-audio" title="朗读发音">🔊</button>' +
    '</div>' +
    '<div class="vc-q">选择正确的中文释义：</div>' +
    '<div class="vc-opts" id="vc-opts">' + optsHTML + '</div>' +
    '<div class="vc-feedback" id="vc-feedback"></div>' +
  '</div>';
  
  try { speak(word); } catch(e) {}
  document.getElementById('vc-exit').onclick = function() { itState = null; renderVocabIeltsTopic(); };
  document.getElementById('vc-audio').onclick = function() { try { speak(word); } catch(e) {} };
  main.querySelectorAll('.vc-opt').forEach(function(b) {
    b.onclick = function() { itPick(parseInt(b.dataset.i), topic); };
  });
  main.scrollTo && main.scrollTo(0,0); window.scrollTo(0,0);
}

function itPick(choice, topic) {
  var c = itState && itState.cur;
  if (!c || c.answered) return;
  c.answered = true;
  
  var correct = choice === c.pos;
  main.querySelectorAll('.vc-opt').forEach(function(b, i) {
    b.disabled = true;
    b.classList.add('done');
    if (i === c.pos) b.classList.add('correct');
    if (i === choice && !correct) b.classList.add('wrong');
  });
  
  if (correct) {
    itState.correct++;
    var fb = document.getElementById('vc-feedback');
    fb.innerHTML = '<div class="vf ok">✓ 回答正确！</div>';
    setTimeout(function() { itState.pos++; itStudyCard(topic); }, 850);
  } else {
    itState.wrong++;
    itState.words.push(itState.words[itState.pos]);
    try { speak(c.word); } catch(e) {}
    var fb = document.getElementById('vc-feedback');
    fb.innerHTML = '<div class="vf bad">✗ 答错了，记住正确释义：</div>' +
      '<div class="vf-learn"><div class="vf-word">' + esc(c.word) + (c.phonetic ? ' <span class="vf-ipa">' + esc(c.phonetic) + '</span>' : '') + '</div><div class="vf-def">' + esc(c.meaning) + '</div></div>' +
      '<button class="vc-next" id="vc-next">继续 →</button>';
    document.getElementById('vc-next').onclick = function() { itState.pos++; itStudyCard(topic); };
  }
}

// 默写模式：听发音 + 看中文，拼写英文
function renderVocabIeltsTopicSpell(topicId) {
  stopTimer(); highlightNav(null); hideNoteFab();
  var topic = itGetTopic(topicId);
  if (!topic || !topic.words.length) { renderVocabIeltsTopic(); return; }
  
  itState = {
    topicId: topicId,
    words: shuffle(topic.words.slice()),
    pos: 0,
    correct: 0,
    wrong: 0,
    mode: 'spell'
  };
  itSpellCard(topic);
}

function itSpellCard(topic) {
  if (!itState || itState.pos >= itState.words.length) { itSessionDone(topic); return; }
  
  var entry = itState.words[itState.pos];
  var total = itState.words.length;
  var n = itState.pos + 1;
  var word = entry.w;
  var phonetic = entry.p || '';
  var meaning = entry.m || '';
  var pos = entry.s || '';
  
  itState.cur = { word: word, phonetic: phonetic, meaning: meaning, answered: false };
  
  main.innerHTML = '<div class="voc-study">' +
    '<div class="vc-top">' +
      '<button class="vc-exit" id="vc-exit">✕ 退出</button>' +
      '<div class="vc-prog"><div class="vc-bar"><i style="width:' + Math.round(n/total*100) + '%"></i></div><span class="vc-pn">' + n + ' / ' + total + '</span></div>' +
      '<span class="vc-badge rev">默写模式</span>' +
    '</div>' +
    '<div class="vc-card spell-card">' +
      '<div class="vc-qlabel">' + esc(topic.name) + '</div>' +
      '<div class="it-meaning">' + esc(meaning) + '</div>' +
      (pos ? '<div class="vc-pos">' + esc(pos) + '</div>' : '') +
    '</div>' +
    '<div class="vc-q">请拼写英文单词：</div>' +
    '<div class="spell-input-wrap">' +
      '<input type="text" class="spell-input" id="spell-input" placeholder="在此输入英文单词..." autocomplete="off" autofocus>' +
      '<button class="spell-submit" id="spell-submit">✓ 提交</button>' +
    '</div>' +
    '<div class="vc-feedback" id="vc-feedback"></div>' +
  '</div>';
  
  document.getElementById('vc-exit').onclick = function() { itState = null; renderVocabIeltsTopic(); };
  var inp = document.getElementById('spell-input');
  inp.onkeydown = function(e) { if (e.key === 'Enter') itSpellCheck(topic); };
  document.getElementById('spell-submit').onclick = function() { itSpellCheck(topic); };
  
  // auto-focus
  setTimeout(function() { inp.focus(); }, 100);
  main.scrollTo && main.scrollTo(0,0); window.scrollTo(0,0);
}

function itSpellCheck(topic) {
  var c = itState && itState.cur;
  if (!c || c.answered) return;
  
  var inp = document.getElementById('spell-input');
  var answer = (inp.value || '').trim();
  if (!answer) {
    // shake input
    inp.classList.add('shake');
    setTimeout(function() { inp.classList.remove('shake'); }, 400);
    return;
  }
  c.answered = true;
  
  // Normalize comparison
  var normalized = answer.toLowerCase().replace(/[^a-z-]/g, '');
  var correctWord = c.word.toLowerCase().replace(/[^a-z-]/g, '');
  
  // Also check if answer contains '/' which means alternatives
  var correctVariants = [correctWord];
  if (c.word.indexOf('/') >= 0) {
    correctWord.split('/').forEach(function(v) { correctVariants.push(v.trim()); });
  }
  
  var isCorrect = correctVariants.indexOf(normalized) >= 0;
  
  // Disable input
  inp.disabled = true;
  document.getElementById('spell-submit').disabled = true;
  
  var fb = document.getElementById('vc-feedback');
  if (isCorrect) {
    itState.correct++;
    fb.innerHTML = '<div class="vf ok">✓ 拼写正确！ ' + esc(c.word) + '</div>' +
      '<button class="vc-next" id="vc-next">继续 →</button>';
    document.getElementById('vc-next').onclick = function() { itState.pos++; itSpellCard(topic); };
  } else {
    itState.wrong++;
    itState.words.push(itState.words[itState.pos]); // 答错加入队尾重来
    fb.innerHTML = '<div class="vf bad">✗ 拼写错误！</div>' +
      '<div class="vf-learn">' +
        '<div class="vf-word">你的答案：<b style="color:var(--red)">' + esc(answer) + '</b></div>' +
        '<div class="vf-word">正确答案：<b style="color:var(--green)">' + esc(c.word) + '</b></div>' +
        (c.phonetic ? '<div class="vf-ipa">/' + esc(c.phonetic) + '/</div>' : '') +
        '<div class="vf-def">' + esc(c.meaning) + '</div>' +
      '</div>' +
      '<button class="vc-next" id="vc-next">继续 →</button>';
    document.getElementById('vc-next').onclick = function() { itState.pos++; itSpellCard(topic); };
  }
}


/* ========== 计划模式 (Plan Mode) ========== */
var ITP_KEY = "glx.ieltstopic";
function itpLoad(){
  try { return JSON.parse(localStorage.getItem(ITP_KEY)) || {}; } catch(e) { return {}; }
}
function itpSave(d){ try { localStorage.setItem(ITP_KEY, JSON.stringify(d)); } catch(e) {} }
function itpGet(topicId){ var d=itpLoad(); return d[topicId] || null; }
function itpEnsure(topicId){
  var d=itpLoad();
  if(!d[topicId]) d[topicId]={plan:null,cursor:0,learned:{},wrong:[],hist:{}};
  var p=d[topicId];
  if(!p.learned) p.learned={}; if(!p.wrong) p.wrong=[]; if(!p.hist) p.hist={};
  return {all:d, topic:p, topicId:topicId};
}

// 计划主页：显示进度或首次设置
function renderVocabIeltsTopicPlan(topicId){
  stopTimer(); highlightNav(null); hideNoteFab();
  var topic=itGetTopic(topicId);
  if(!topic||!topic.words.length){ renderVocabIeltsTopic(); return; }
  var data=itpEnsure(topicId), p=data.topic;
  
  if(!p.plan){ renderVocabIeltsTopicPlanSetup(topic); return; }
  
  // Show progress dashboard
  var total=topic.words.length, learned=p.cursor||0, mastered=0;
  for(var k in p.learned){ if(p.learned[k].mastered) mastered++; }
  var wrongLen=(p.wrong||[]).length;
  var t=vToday();
  var todayH=p.hist[t]||{};
  var newRem=Math.max(0, p.plan.dailyNew - (todayH.neu||0));
  var revDue=0;
  for(var k in p.learned){
    var r=p.learned[k];
    if(r&&!r.mastered&&r.due&&r.due<=t) revDue++;
  }
  var todo=newRem+revDue;
  
  main.innerHTML='<section class="voc-hero">'+
    '<button class="voc-switch" id="it-plan-back">← 返回话题列表</button>'+
    '<h1>📅 计划背诵 · '+esc(topic.name)+'</h1>'+
    '<div class="voc-sub">共 '+total+' 词 · 每日新词 '+p.plan.dailyNew+' 个 · 智能复习</div>'+
  '</section>'+
  '<div class="stats voc-stats">'+
    '<div class="stat"><span class="ico">📚</span><div class="num">'+learned+'<small style="font-size:15px;color:var(--muted)">/'+total+'</small></div><div class="lab">已学单词</div></div>'+
    '<div class="stat"><span class="ico">✅</span><div class="num">'+mastered+'</div><div class="lab">已掌握</div></div>'+
    '<div class="stat"><span class="ico">📕</span><div class="num">'+wrongLen+'</div><div class="lab">错词本</div></div>'+
    '<div class="stat"><span class="ico">🎯</span><div class="num">'+(total?Math.round(learned/total*100):0)+'%</div><div class="lab">学习进度</div></div>'+
  '</div>'+
  '<div class="voc-today">'+
    '<div class="vt-head">今日任务 <span class="vt-date">'+t+'</span></div>'+
    '<div class="vt-counts"><span class="vt-new">新词 <b>'+newRem+'</b></span><span class="vt-rev">复习 <b>'+revDue+'</b></span><span class="vt-done">今日已背 <b>'+(todayH.done||0)+'</b></span></div>'+
    (todo>0?'<button class="voc-start" id="it-plan-start">▶ 开始今日背诵（'+todo+'）</button>':
     '<div class="vt-empty">🎉 今日任务已完成！</div>')+
  '</div>'+
  '<div class="voc-actions">'+
    '<button class="voc-btn" id="it-plan-wrong">📕 错词本（'+wrongLen+'）</button>'+
    '<button class="voc-btn ghost" id="it-plan-replan">⚙ 调整每日数量</button>'+
    '<button class="voc-btn ghost danger" id="it-plan-reset">↺ 重置进度</button>'+
  '</div>';
  
  document.getElementById('it-plan-back').onclick=function(){ renderVocabIeltsTopic(); };
  if(todo>0) document.getElementById('it-plan-start').onclick=function(){ renderVocabIeltsTopicPlanStudy(topic); };
  document.getElementById('it-plan-wrong').onclick=function(){
    var data2=itpEnsure(topicId);
    if(!data2.topic.wrong.length){ toast("错词本是空的 👍"); return; }
    itpRunWrong(data2.topic.wrong.slice(), topic, 'plan-review');
  };
  document.getElementById('it-plan-replan').onclick=function(){ renderVocabIeltsTopicPlanSetup(topic, true); };
  document.getElementById('it-plan-reset').onclick=function(){
    if(confirm('确定重置「'+topic.name+'」的计划进度吗？此操作不可撤销。')){
      var d=itpLoad(); delete d[topicId]; itpSave(d); toast("已重置"); renderVocabIeltsTopicPlan(topicId);
    }
  };
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

// 计划设置页
function renderVocabIeltsTopicPlanSetup(topic, isReplan){
  stopTimer(); highlightNav(null); hideNoteFab();
  var data=itpEnsure(topic.id), p=data.topic;
  var cur=(p.plan&&p.plan.dailyNew)||20, presets=[10,20,30,50,80];
  
  main.innerHTML='<section class="voc-hero"><h1>📅 '+(isReplan?'调整计划':'制定背诵计划')+'</h1>'+
    '<div class="voc-sub">'+esc(topic.name)+' · '+topic.words.length+' 词 · 按计划每日定量背诵</div></section>'+
  '<div class="voc-setup">'+
    '<div class="vs-q">每天背诵多少个<b>新单词</b>？</div>'+
    '<div class="vs-presets">'+presets.map(function(n){ return '<button class="vs-chip'+(n===cur?' on':'')+'" data-n="'+n+'">'+n+'</button>'; }).join('')+'</div>'+
    '<div class="vs-custom"><label>自定义：</label><input type="number" id="vs-num" min="1" max="500" value="'+cur+'"> 个 / 天</div>'+
    '<div class="vs-est" id="vs-est"></div>'+
    (isReplan?'<div class="vs-note">调整只改变每日新词数量，已有进度会保留。</div>':'')+
    '<div class="vs-go-row">'+
      '<button class="voc-start" id="vs-go">'+(isReplan?'保存':'🚀 开始背诵计划')+'</button>'+
      (isReplan?'<button class="voc-btn ghost" id="vs-cancel">取消</button>':'')+
    '</div>'+
  '</div>';
  
  var numEl=document.getElementById('vs-num');
  var est=function(){ var n=Math.max(1,parseInt(numEl.value)||1); document.getElementById('vs-est').innerHTML='按此进度，约需 <b>'+Math.ceil(topic.words.length/n)+'</b> 天学完全部新词。'; };
  est();
  main.querySelectorAll('.vs-chip').forEach(function(c){ c.onclick=function(){ numEl.value=c.dataset.n; main.querySelectorAll('.vs-chip').forEach(function(x){ x.classList.remove('on'); }); c.classList.add('on'); est(); }; });
  numEl.oninput=function(){ main.querySelectorAll('.vs-chip').forEach(function(x){ x.classList.toggle('on', x.dataset.n===numEl.value); }); est(); };
  
  document.getElementById('vs-go').onclick=function(){
    var n=Math.max(1,Math.min(500,parseInt(numEl.value)||20));
    var d=itpEnsure(topic.id);
    if(!d.topic.plan) d.topic.plan={dailyNew:n, start:vToday(), order:shuffle(topic.words.map(function(_,i){ return i; }))};
    else d.topic.plan.dailyNew=n;
    d.all[topic.id]=d.topic; itpSave(d.all);
    toast(isReplan?'已更新每日数量':'计划已创建，开始背诵吧！'); renderVocabIeltsTopicPlan(topic.id);
  };
  var cc=document.getElementById('vs-cancel'); if(cc) cc.onclick=function(){ renderVocabIeltsTopicPlan(topic.id); };
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

// 计划模式背诵
function renderVocabIeltsTopicPlanStudy(topic){
  stopTimer(); highlightNav(null); hideNoteFab();
  var data=itpEnsure(topic.id), p=data.topic;
  if(!p.plan){ renderVocabIeltsTopicPlan(topic.id); return; }
  
  var t=vToday(), todayH=p.hist[t]||{neu:0,rev:0,done:0};
  var newRem=Math.max(0, p.plan.dailyNew - todayH.neu);
  var queue=[];
  
  // 新词
  var added=0;
  for(var i=p.cursor;i<p.plan.order.length&&added<newRem;i++){
    var idx=p.plan.order[i];
    if(!p.learned[idx]){ queue.push({idx:idx,type:'new'}); added++; }
  }
  // 到期复习
  for(var k in p.learned){
    var r=p.learned[k];
    if(r&&!r.mastered&&r.due&&r.due<=t) queue.push({idx:+k,type:'review'});
  }
  
  if(!queue.length){ toast("🎉 今日任务已完成！"); renderVocabIeltsTopicPlan(topic.id); return; }
  
  itpRun(queue, topic, 'plan');
}

function itpRun(queue, topic, mode){
  itState={topicId:topic.id, words:shuffle(queue), pos:0, correct:0, wrong:0, mode:mode, planTopic:topic};
  itpCard(topic);
}

function itpCard(topic){
  if(!itState||itState.pos>=itState.words.length){ itpSessionDone(topic); return; }
  
  var q=itState.words[itState.pos];
  var entry=topic.words[q.idx];
  var total=itState.words.length, n=itState.pos+1;
  var word=entry.w, phonetic=entry.p||'', meaning=entry.m||'（暂无释义）', posText=entry.s||'';
  
  // 3 options
  var correct=meaning, opts=[correct], used={}; used[q.idx]=1;
  var guard=0;
  while(opts.length<3&&guard<200){
    guard++;
    var ri=Math.floor(Math.random()*topic.words.length);
    if(used[ri]) continue;
    var dm=topic.words[ri].m;
    if(!dm||opts.indexOf(dm)>=0) continue;
    used[ri]=1; opts.push(dm);
  }
  opts=shuffle(opts);
  var correctIdx=opts.indexOf(correct);
  
  itState.cur={idx:q.idx, type:q.type, pos:correctIdx, word:word, phonetic:phonetic, meaning:meaning, answered:false};
  
  var badge=q.type==='new'?'<span class="vc-badge new">新词</span>':'<span class="vc-badge rev">复习</span>';
  var optsHTML=opts.map(function(d,i){
    return '<button class="vc-opt" data-i="'+i+'"><span class="vc-opt-k">'+'ABC'[i]+'</span><span class="vc-opt-t">'+esc(d)+'</span></button>';
  }).join('');
  
  main.innerHTML='<div class="voc-study">'+
    '<div class="vc-top">'+
      '<button class="vc-exit" id="vc-exit">✕ 退出</button>'+
      '<div class="vc-prog"><div class="vc-bar"><i style="width:'+Math.round(n/total*100)+'%"></i></div><span class="vc-pn">'+n+' / '+total+'</span></div>'+
      badge+
    '</div>'+
    '<div class="vc-card">'+
      '<div class="vc-qlabel">'+esc(topic.name)+' · 计划模式</div>'+
      '<div class="vc-word">'+esc(word)+'</div>'+
      (phonetic?'<div class="vc-ipa">'+esc(phonetic)+'</div>':'')+
      (posText?'<div class="vc-pos">'+esc(posText)+'</div>':'')+
      '<button class="vc-audio" id="vc-audio" title="朗读发音">🔊</button>'+
    '</div>'+
    '<div class="vc-q">选择正确的中文释义：</div>'+
    '<div class="vc-opts" id="vc-opts">'+optsHTML+'</div>'+
    '<div class="vc-feedback" id="vc-feedback"></div>'+
  '</div>';
  
  try{ speak(word); }catch(e){}
  document.getElementById('vc-exit').onclick=function(){ itState=null; renderVocabIeltsTopicPlan(topic.id); };
  document.getElementById('vc-audio').onclick=function(){ try{ speak(word); }catch(e){} };
  main.querySelectorAll('.vc-opt').forEach(function(b){
    b.onclick=function(){ itpPick(parseInt(b.dataset.i), topic); };
  });
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

function itpPick(choice, topic){
  var c=itState&&itState.cur; if(!c||c.answered) return;
  c.answered=true;
  var correct=choice===c.pos;
  
  main.querySelectorAll('.vc-opt').forEach(function(b,i){
    b.disabled=true; b.classList.add('done');
    if(i===c.pos) b.classList.add('correct');
    if(i===choice&&!correct) b.classList.add('wrong');
  });
  
  // Save to plan progress
  var data=itpEnsure(topic.id), p=data.topic;
  var t=vToday(), todayH=p.hist[t]||{neu:0,rev:0,done:0};
  var wasNew=!p.learned[c.idx];
  var lr=p.learned[c.idx]||{wrong:0};
  
  if(correct){
    itState.correct++;
    lr.st=(lr.st||0)+1;
    if(lr.st>=6){ lr.mastered=true; lr.due=null; }
    else { lr.mastered=false; lr.due=vAddDays(t,[1,2,4,7,15,30][lr.st-1]||30); }
    if(wasNew){ p.cursor++; todayH.neu=(todayH.neu||0)+1; }
    else { todayH.rev=(todayH.rev||0)+1; }
  } else {
    itState.wrong++;
    lr.st=1; lr.mastered=false; lr.due=vAddDays(t,1);
    lr.wrong=(lr.wrong||0)+1;
    if(p.wrong.indexOf(c.idx)<0) p.wrong.push(c.idx);
    if(wasNew){ todayH.neu=(todayH.neu||0)+1; }
    else { todayH.rev=(todayH.rev||0)+1; }
  }
  todayH.done=(todayH.done||0)+1;
  p.learned[c.idx]=lr; p.hist[t]=todayH;
  data.all[topic.id]=p; itpSave(data.all);
  
  var fb=document.getElementById('vc-feedback');
  if(correct){
    fb.innerHTML='<div class="vf ok">✓ 回答正确！</div>';
    setTimeout(function(){ itState.pos++; itpCard(topic); },850);
  } else {
    try{ speak(c.word); }catch(e){}
    fb.innerHTML='<div class="vf bad">✗ 答错了，记住正确释义：</div>'+
      '<div class="vf-learn"><div class="vf-word">'+esc(c.word)+(c.phonetic?' <span class="vf-ipa">'+esc(c.phonetic)+'</span>':'')+'</div><div class="vf-def">'+esc(c.meaning)+'</div></div>'+
      '<button class="vc-next" id="vc-next">继续 →</button>';
    document.getElementById('vc-next').onclick=function(){ itState.pos++; itpCard(topic); };
  }
}

function itpRunWrong(wrongIndices, topic, mode){
  itState={topicId:topic.id, words:wrongIndices.map(function(i){ return {idx:i,type:'review'}; }), pos:0, correct:0, wrong:0, mode:mode, planTopic:topic};
  itpCard(topic);
}

function itpSessionDone(topic){
  var correct=itState?itState.correct:0, wrong=itState?itState.wrong:0, total=correct+wrong;
  var mode=itState?itState.mode:'plan'; itState=null;
  
  var body;
  if(total===0){
    body='<div class="vd-emoji">🎉</div><h2>今日任务已完成</h2><p class="vd-tip">所有单词都已复习过，明天再来巩固吧。</p>';
  } else {
    var rate=total?Math.round(correct/total*100):0;
    var emoji=rate>=90?'🎉':rate>=70?'👍':'💪';
    body='<div class="vd-emoji">'+emoji+'</div><h2>本组背诵完成</h2>'+
      '<div class="vd-stats"><div><b>'+correct+'</b><span>答对</span></div><div class="vd-wrong"><b>'+wrong+'</b><span>答错</span></div><div><b>'+rate+'%</b><span>正确率</span></div></div>'+
      '<p class="vd-tip">答错的单词已存入错词本，明天会自动复习。</p>';
  }
  
  main.innerHTML='<div class="voc-done">'+body+
    '<div class="voc-actions center">'+
      (mode==='plan'?'<button class="voc-start" id="itp-more">▶ 继续额外背诵</button>':'')+
      '<button class="voc-btn" id="itp-back">📋 返回计划主页</button>'+
    '</div></div>';
  
  var more=document.getElementById('itp-more');
  if(more) more.onclick=function(){ renderVocabIeltsTopicPlanStudy(topic); };
  document.getElementById('itp-back').onclick=function(){ renderVocabIeltsTopicPlan(topic.id); };
  main.scrollTo&&main.scrollTo(0,0); window.scrollTo(0,0);
}

function itSessionDone(topic) {
  var correct = itState ? itState.correct : 0;
  var wrong = itState ? itState.wrong : 0;
  var total = correct + wrong;
  var mode = itState ? itState.mode : 'study';
  itState = null;
  
  var body;
  if (total === 0) {
    body = '<div class="vd-emoji">📖</div><h2>没有单词可背</h2><p class="vd-tip">该话题暂未收录词汇。</p>';
  } else {
    var rate = total ? Math.round(correct / total * 100) : 0;
    var emoji = rate >= 90 ? '🎉' : rate >= 70 ? '👍' : '💪';
    body = '<div class="vd-emoji">' + emoji + '</div>' +
      '<h2>' + (mode === 'spell' ? '默写完成' : '背诵完成') + '</h2>' +
      '<div class="vd-stats"><div><b>' + correct + '</b><span>答对</span></div><div class="vd-wrong"><b>' + wrong + '</b><span>答错</span></div><div><b>' + rate + '%</b><span>正确率</span></div></div>';
    if (wrong > 0) {
      body += '<p class="vd-tip">答错的单词已自动加入队尾，可继续练习。</p>';
    }
  }
  
  var topicName = topic ? topic.name : '';
  var topicEmoji = topic ? topic.emoji : '📖';
  
  main.innerHTML = '<div class="voc-done">' + body +
    '<div class="voc-actions center">' +
      '<button class="voc-start" id="it-retry">↺ 重新背诵「' + esc(topicName) + '」</button>' +
      '<button class="voc-btn" id="it-back">📋 返回话题列表</button>' +
    '</div></div>';
  
  document.getElementById('it-retry').onclick = function() {
    if (mode === 'spell') {
      location.hash = '#/vocab/ielts-topic/spell/' + encodeURIComponent(topicId);
    } else {
      location.hash = '#/vocab/ielts-topic/' + encodeURIComponent(topicId);
    }
  };
  document.getElementById('it-back').onclick = function() { renderVocabIeltsTopic(); };
  
  var topicId = topic ? topic.id : '';
  main.scrollTo && main.scrollTo(0,0); window.scrollTo(0,0);
}


/* ============================ 每日励志名言弹窗 ============================ */
const QUOTE_KEY="glx.quoteDay";
function quoteDayOfYear(d){ const start=new Date(d.getFullYear(),0,0); return Math.floor((d-start)/86400000); }
// 每天首次打开显示一条名言：按「年内第几天 + 年份」取序，保证每天不同、逐年轮换
function showDailyQuote(force){
  const QS=window.QUOTES||[]; if(!QS.length) return;
  const today=vToday();
  if(!force){ let last=null; try{ last=localStorage.getItem(QUOTE_KEY); }catch(e){} if(last===today) return; }
  if($("#quote-ov")) return;
  const d=new Date(), idx=(((quoteDayOfYear(d)-1)+d.getFullYear())%QS.length+QS.length)%QS.length;
  const q=QS[idx]||QS[0];
  const o=document.createElement("div"); o.id="quote-ov"; o.className="quote-ov";
  o.innerHTML=`<div class="quote-card">
    <div class="quote-badge">📅 Quote of the Day · 每日一句</div>
    <div class="quote-mark">&ldquo;</div>
    <div class="quote-text">${esc(q.q)}</div>
    <div class="quote-author">— ${esc(q.a)}</div>
    <div class="quote-sub">Give today your all — you've got this! ✨</div>
    <button class="quote-close" id="quote-close">开启今天 →</button>
  </div>`;
  document.body.appendChild(o);
  requestAnimationFrame(()=>o.classList.add("show"));
  const close=()=>{ o.classList.remove("show"); setTimeout(()=>{ try{o.remove();}catch(e){} },300); };
  const cb=$("#quote-close"); if(cb) cb.onclick=close;
  o.addEventListener("click",e=>{ if(e.target===o) close(); });
  document.addEventListener("keydown",function esc2(e){ if(e.key==="Escape"){ close(); document.removeEventListener("keydown",esc2); } });
  try{ localStorage.setItem(QUOTE_KEY, today); }catch(e){}
}

/* init */
buildNav();
route();
// 例句朗读：所有 .say-btn（例句旁的🔊）统一委托处理
document.addEventListener("click",function(e){ const b=e.target&&e.target.closest&&e.target.closest(".say-btn"); if(b){ e.preventDefault(); e.stopPropagation(); flash(b); speak(b.getAttribute("data-say")||""); } });
{ const tb=$("#tut-btn"); if(tb) tb.onclick=()=>{ const p=$("#settings-panel"); if(p) p.classList.remove("show"); openTutorial(); }; }
try{
  if(localStorage.getItem(ONBOARD_KEY)!=="1"){ setTimeout(openTutorial,500); }   // 新用户先看教程，名言从次日起
  else { setTimeout(showDailyQuote,400); }
}catch(e){ setTimeout(showDailyQuote,400); }
})();
