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
let timer = {id:null, chId:null, start:0, acc:0};
function startTimer(chId){
  stopTimer();
  timer.chId=chId; timer.start=Date.now();
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
function flushTimer(){
  if(!timer.chId) return;
  if(!document.hidden){ const now=Date.now(); chRec(timer.chId).studySec+=(now-timer.start)/1000; timer.start=now; }
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
    <h1>英语语法速通宝典 · 学习中心</h1>
    <div class="en">A Quick Guide to English Grammar Mastery · By Jimmy</div>
    <p>系统讲解 词法 · 时态语态 · 复合句与非谓语 三大模块，每章配套练习与详解。学习进度、用时与成绩将自动保存在本机，随时回顾。</p>
    <button class="hero-cta" data-nav="game">🎮 开始语法闯关挑战</button>
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
if('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged=function(){ pickVoice(); updateIpaNotice(); }; }
function speak(text){
  if(!('speechSynthesis' in window)){ toast("当前浏览器不支持语音朗读"); return; }
  const v=_enVoice||pickVoice();
  if(!v && !_warned){ _warned=true;
    toast("⚠ 系统未安装英文语音，发音可能不准。请安装英文(English)语音包后刷新"); }
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=0.7; u.pitch=1;
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
  {i:"👋",t:"欢迎使用",b:"欢迎来到 <b>《英语语法速通宝典》</b>！这是一套离线的英语语法自学工具，所有进度、笔记都<b>保存在本机</b>，无需联网。<br><br>下面用 1 分钟带你认识全部功能 👇"},
  {i:"📊",t:"学习总览与章节",b:"首页是<b>学习总览</b>，展示已完成章节、累计用时、平均正确率。<br><br>下方按模块排列 <b>34 个章节卡片</b>（词法 · 时态语态 · 从句与非谓语 · 附录），点击任意卡片即可进入学习。"},
  {i:"📖",t:"四个学习标签",b:"每个章节内有：<br>• <b>知识讲解</b>：系统讲解 + 表格 + 易错点<br>• <b>巩固练习</b>：入门/进阶/复习三档，<b>自动批改</b>并给解析<br>• <b>抽认卡</b>：固定搭配/动词等翻卡记忆<br>• <b>学习记录</b>：用时、成绩与错题本"},
  {i:"📕",t:"错题本",b:"在练习或闯关中<b>做错的题会自动收进</b>「学习记录 → 错题本」。<br><br>点 <b>🔁 重做错题</b> 只练错题，全部答对后自动移除——专治薄弱点。"},
  {i:"🎮",t:"闯关挑战",b:"侧边栏 <b>🎮 闯关挑战</b>：<b>连击得分</b>、限时抢答，越快越准分越高！<br><br>可<b>自选章节</b>或综合练习，结束有评级与<b>挑战记录</b>，错题同样进错题本。"},
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

// PDF export using html2canvas + jsPDF (bundled locally for mobile/WeChat)
let _pdfLibsReady=false;
function loadPDFLibs(cb){
  if(_pdfLibsReady){ cb(); return; }
  // Check if libs loaded via <script> tags
  if(typeof html2canvas!=="undefined" && typeof jspdf!=="undefined"){
    _pdfLibsReady=true; cb(); return;
  }
  // Still loading, poll
  const chk=setInterval(()=>{
    if(typeof html2canvas!=="undefined" && typeof jspdf!=="undefined"){
      clearInterval(chk); _pdfLibsReady=true; cb();
    }
  },100);
  setTimeout(()=>{clearInterval(chk); if(!_pdfLibsReady){ toast("PDF 库未加载"); exportViaPrint(); }},5000);
}

let _pdfExportTarget=null; // 'exam' or 'chapter' context
let _pdfChapterData=null;

function exportViaPrint(){
  ensurePrintElems();
  const style=document.createElement("style");
  style.id="pdf-print-style";
  style.textContent=`@media print{body{background:#fff!important}#sidebar,#topbar,#brand-badge,#note-fab,#hl-bar,#hl-edit,.note-drawer,#scrim,.exam-submit-bar,.ch-pdf-btn,.timer-pill,#live-timer,.tabs{display:none!important}#app{padding:0!important;margin:0!important;display:block!important}#main{padding:20px!important;max-width:100%!important;zoom:1!important}.exam-paper,.ch-hero{box-shadow:none!important;border-radius:0!important}.exam-q.graded,.lesson,.q-card{break-inside:avoid}.print-header,.print-footer{display:block!important}.print-footer{display:flex!important}}@media screen{#pdf-print-style{display:none}}`;
  document.head.appendChild(style);
  setTimeout(()=>{window.print();},200);
  setTimeout(()=>{try{document.head.removeChild(style);}catch(e){}},1500);
}

function exportExamPDF(){
  const origTitle=document.title;
  const exam=window.EXAMS[examState?examState.type:"full"];
  document.title=(exam?exam.name:"入学测试卷")+" - 青山沃思";
  // Save context for fallback
  _pdfExportTarget="exam";
  loadPDFLibs(()=>{ doExportPDF(origTitle); });
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
  loadPDFLibs(()=>{ doExportPDF(origTitle); });
}

function doExportPDF(origTitle){
  ensurePrintElems();
  if(!_pdfLibsReady || typeof html2canvas==="undefined" || typeof jspdf==="undefined"){
    exportViaPrint();
    setTimeout(()=>{document.title=origTitle;},1500);
    return;
  }
  const el=document.getElementById("main");
  if(!el){ exportViaPrint(); return; }
  // Temporarily show print header/footer for capture
  const ph=document.getElementById("print-header");
  const pf=document.getElementById("print-footer");
  if(ph) ph.style.display="block";
  if(pf) pf.style.display="flex";
  toast("正在生成 PDF…");
  // WeChat shows the result as an on-screen image (not a real PDF), so capture
  // at a higher pixel density to keep text crisp on high-DPI phone screens.
  const isWX=/MicroMessenger/i.test(navigator.userAgent);
  const capScale=isWX?Math.min(3,Math.max(2,(window.devicePixelRatio||2)*1.5)):2;
  html2canvas(el,{scale:capScale,useCORS:true,logging:false,backgroundColor:"#ffffff"}).then(canvas=>{
    if(ph) ph.style.display="";
    if(pf) pf.style.display="";
    const {jsPDF}=jspdf;
    const imgData=canvas.toDataURL("image/jpeg",0.92);
    const w=canvas.width, h=canvas.height;
    const pdfW=210, pdfH=297; // A4 mm
    const scale=pdfW/w;
    const pageH=h*scale;
    const pdf=new jsPDF("p","mm","a4");
    let remaining=pageH, pos=0, srcY=0;
    while(remaining>0){
      const sliceH=Math.min(remaining,pdfH);
      if(pos>0) pdf.addPage();
      pdf.addImage(imgData,"JPEG",0,0,pdfW,sliceH,undefined,"FAST",0,srcY/pdfW*pdfW/scale);
      remaining-=pdfH;
      pos++;
      srcY+=pdfH/scale;
    }
    // WeChat's in-app browser cannot render generated PDFs (it blocks data-URI
    // window.open, ignores the download attribute, and won't preview blob PDFs).
    // Instead show the rendered page as a long image that WeChat CAN display —
    // users long-press to save to album, or open in an external browser.
    if(isWX){
      showImageOverlayWeChat(canvas, document.title);
    }else{
      pdf.save(document.title+".pdf");
    }
    document.title=origTitle;
    toast(isWX?"长按图片可保存到相册":"PDF 已保存 ✓");
    // Cleanup
    const inj=$("#print-notes-inject"); if(inj) inj.remove();
  }).catch(e=>{
    if(ph) ph.style.display="";
    if(pf) pf.style.display="";
    console.error(e);
    exportViaPrint();
    setTimeout(()=>{document.title=origTitle;},1500);
    const inj=$("#print-notes-inject"); if(inj) inj.remove();
  });
}

// WeChat fallback: render the captured page as a long image inside a
// full-screen overlay. WeChat fully supports long-press-to-save on <img>,
// so this lets users actually get the document out of the in-app browser.
function showImageOverlayWeChat(canvas, filename){
  let dataURL;
  // PNG is lossless — keeps text/lines sharp (JPEG softens small fonts).
  try{ dataURL=canvas.toDataURL("image/png"); }
  catch(e){ toast("生成失败，请截屏保存"); return; }
  const old=document.getElementById("wx-pdf-overlay");
  if(old) old.remove();
  const ov=document.createElement("div");
  ov.id="wx-pdf-overlay";
  ov.innerHTML=`
    <div class="wx-pdf-bar">
      <span class="wx-pdf-tip">长按图片保存到相册，或点右上角「···」在浏览器中打开</span>
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

/* init */
buildNav();
route();
{ const tb=$("#tut-btn"); if(tb) tb.onclick=()=>{ const p=$("#settings-panel"); if(p) p.classList.remove("show"); openTutorial(); }; }
try{ if(localStorage.getItem(ONBOARD_KEY)!=="1") setTimeout(openTutorial,500); }catch(e){}
})();
