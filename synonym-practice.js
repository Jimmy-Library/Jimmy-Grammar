// Synonym replacement practice module.
const SR_KEY = "glx.synonymReplacement";
const SR_PAGE_SIZE = 8;
let srSession = null;
let srHistoryPage = 1;

function srApi(){
  const api=window.SYNONYM_APP_API;
  if(!api) throw new Error("同义替换模块尚未完成初始化");
  return api;
}

function srItems(){
  return (window.SYNONYM_PRACTICE && window.SYNONYM_PRACTICE.items) || [];
}
function srDefaultState(){ return {dailyCount:10,order:[],cursor:0,records:[]}; }
function srLoad(){
  try{
    const saved=JSON.parse(localStorage.getItem(SR_KEY)||"null");
    const state=Object.assign(srDefaultState(),saved||{});
    state.dailyCount=Math.max(1,Math.min(50,Number(state.dailyCount)||10));
    state.records=Array.isArray(state.records)?state.records:[];
    state.order=Array.isArray(state.order)?state.order:[];
    state.cursor=Math.max(0,Number(state.cursor)||0);
    return state;
  }catch(_){ return srDefaultState(); }
}
function srSave(state){ localStorage.setItem(SR_KEY,JSON.stringify(state)); }
function srEnsureOrder(state){
  const ids=srItems().map(x=>x.id);
  const set=new Set(ids);
  const valid=state.order.length===ids.length&&state.order.every(id=>set.has(id))&&new Set(state.order).size===ids.length;
  if(!valid){ state.order=srApi().shuffle(ids); state.cursor=0; }
  if(state.cursor>=state.order.length){ state.order=srApi().shuffle(ids); state.cursor=0; }
  srSave(state);
}
function srDateKey(value){
  const d=value?new Date(value):new Date();
  if(Number.isNaN(d.getTime())) return "";
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function srDateTime(value){
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"":d.toLocaleString("zh-CN",{hour12:false});
}
function srStats(state){
  const practiced=new Set();
  state.records.forEach(r=>(r.answers||[]).forEach(a=>practiced.add(a.id)));
  const today=srDateKey();
  return {
    total:srItems().length,
    practiced:practiced.size,
    today:state.records.filter(r=>srDateKey(r.createdAt)===today).reduce((n,r)=>n+(r.answers||[]).length,0),
    records:state.records.length
  };
}
function synonymDashHTML(){
  const state=srLoad(),s=srStats(state);
  return `<section class="dash-card sr-dash">
    <div class="dash-title">🔄 同义词替换</div>
    <div class="dash-main"><b>${s.practiced}</b> / ${s.total} 题已练习</div>
    <div class="dash-sub">今日 ${s.today} 题 · 每组 ${state.dailyCount} 题</div>
    <button class="dash-go" data-nav="synonym">开始练习 →</button>
  </section>`;
}

function renderSynonymHome(){
  const {main,byId,fmtTime,esc,toast,stopTimer,highlightNav,hideNoteFab}=srApi();
  stopTimer(); highlightNav("synonym"); hideNoteFab();
  const state=srLoad(); srEnsureOrder(state);
  const stats=srStats(state);
  const maxPage=Math.max(1,Math.ceil(state.records.length/SR_PAGE_SIZE));
  srHistoryPage=Math.min(Math.max(1,srHistoryPage),maxPage);
  const records=state.records.slice().reverse().slice((srHistoryPage-1)*SR_PAGE_SIZE,srHistoryPage*SR_PAGE_SIZE);
  main.innerHTML=`
    <section class="sr-hero">
      <div>
        <div class="eyebrow">CAMBRIDGE 4–13 · 485 道真题语料</div>
        <h1>同义词替换练习</h1>
        <p>根据题干与原文填写对应的同义或反义替换。提交后仅展示参考答案，不判定对错。</p>
      </div>
      <button class="sr-start" id="srStartTop">开始今日练习</button>
    </section>
    <section class="sr-stats">
      <div><b>${stats.total}</b><span>题库总数</span></div>
      <div><b>${stats.practiced}</b><span>累计练习</span></div>
      <div><b>${stats.today}</b><span>今日完成</span></div>
      <div><b>${stats.records}</b><span>练习记录</span></div>
    </section>
    <section class="sr-plan card">
      <div class="sr-plan-head">
        <div><h2>每日练习数量</h2><p>设置每组题量，默认 10 题，最多 50 题。</p></div>
        <span class="sr-remain">当前轮次剩余 ${Math.max(0,state.order.length-state.cursor)} 题</span>
      </div>
      <div class="sr-count-row">
        ${[5,10,15,20,30].map(n=>`<button class="sr-count ${state.dailyCount===n?"active":""}" data-count="${n}">${n} 题</button>`).join("")}
        <label class="sr-custom">自定义 <input id="srCustomCount" type="number" min="1" max="50" value="${state.dailyCount}"></label>
        <button class="btn primary" id="srSaveCount">保存设置</button>
      </div>
    </section>
    <section class="sr-records card">
      <div class="sr-rec-head">
        <div><h2>练习记录</h2><p>可以回顾每次填写内容和参考答案，并导出为 PDF。</p></div>
        ${state.records.length?`<span>第 ${srHistoryPage} / ${maxPage} 页</span>`:""}
      </div>
      ${records.length?records.map(r=>`
        <div class="sr-rec-row">
          <span><b>${srDateTime(r.createdAt)}</b><small>${r.answers.length} 题</small></span>
          <span>剑桥 ${r.books&&r.books.length?r.books.join("、"):"真题"}</span>
          <span>用时 ${fmtTime(r.seconds||0)}</span>
          <span class="sr-rec-buttons"><button data-review="${esc(r.id)}">回顾</button><button data-export="${esc(r.id)}">导出 PDF</button></span>
        </div>`).join(""):`<div class="sr-empty">还没有练习记录，完成一组后会自动保存到这里。</div>`}
      ${state.records.length>SR_PAGE_SIZE?`<div class="pager">
        <button id="srPrevPage" ${srHistoryPage<=1?"disabled":""}>上一页</button>
        <button id="srNextPage" ${srHistoryPage>=maxPage?"disabled":""}>下一页</button>
      </div>`:""}
    </section>`;
  byId("srStartTop").onclick=()=>{srSession=null;location.hash="#/synonym/practice";};
  main.querySelectorAll("[data-count]").forEach(btn=>btn.onclick=()=>{
    main.querySelectorAll("[data-count]").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active"); byId("srCustomCount").value=btn.dataset.count;
  });
  byId("srSaveCount").onclick=()=>{
    state.dailyCount=Math.max(1,Math.min(50,Number(byId("srCustomCount").value)||10));
    srSave(state); toast("已保存：每组 "+state.dailyCount+" 题"); renderSynonymHome();
  };
  main.querySelectorAll("[data-review]").forEach(btn=>btn.onclick=()=>location.hash="#/synonym/record/"+encodeURIComponent(btn.dataset.review));
  main.querySelectorAll("[data-export]").forEach(btn=>btn.onclick=()=>srExportRecord(btn.dataset.export));
  if(byId("srPrevPage")) byId("srPrevPage").onclick=()=>{srHistoryPage--;renderSynonymHome();};
  if(byId("srNextPage")) byId("srNextPage").onclick=()=>{srHistoryPage++;renderSynonymHome();};
}

function srMakeSession(){
  const {shuffle}=srApi();
  const state=srLoad(); srEnsureOrder(state);
  const count=Math.min(state.dailyCount,state.order.length);
  const chosen=state.order.slice(state.cursor,state.cursor+count);
  if(chosen.length<count){
    const rest=shuffle(srItems().map(x=>x.id).filter(id=>!chosen.includes(id)));
    chosen.push(...rest.slice(0,count-chosen.length));
  }
  const map=new Map(srItems().map(x=>[x.id,x]));
  return {createdAt:new Date().toISOString(),startedAt:Date.now(),cursorStart:state.cursor,ids:chosen,items:chosen.map(id=>map.get(id)).filter(Boolean)};
}
function renderSynonymPractice(){
  const {main,byId,esc,stopTimer,highlightNav,hideNoteFab}=srApi();
  stopTimer(); highlightNav("synonym"); hideNoteFab();
  if(!srSession) srSession=srMakeSession();
  const session=srSession;
  main.innerHTML=`<section class="sr-paper">
    <div class="sr-card-head">
      <div><div class="eyebrow">今日同义替换 · ${session.items.length} 题</div><h1>填写对应的同义 / 反义替换</h1><p>填写后统一提交。你的答案不会被判定对错。</p></div>
      <button class="btn" id="srBack">返回记录</button>
    </div>
    <form id="srForm">
      ${session.items.map((item,i)=>`<article class="sr-card">
        <div class="sr-card-head"><b>${i+1}. 剑桥 ${item.book} · 第 ${item.number} 题</b><small>题目 PDF 第 ${item.page} 页</small></div>
        <div class="sr-sentence"><span>Question</span>${esc(item.question)}</div>
        <div class="sr-sentence original"><span>Original</span>${esc(item.original)}</div>
        <div class="sr-input-grid">
          <label>题目中的关键词 / 短语<textarea rows="2" data-prompt="${esc(item.id)}" placeholder="填写题干中的表达"></textarea></label>
          <label>原文中的同义 / 反义替换<textarea rows="2" data-answer="${esc(item.id)}" placeholder="填写原文中的对应表达"></textarea></label>
        </div>
      </article>`).join("")}
      <div class="sr-actions"><button type="button" class="btn" id="srCancel">稍后再练</button><button type="submit" class="btn primary">提交并查看参考答案</button></div>
    </form>
  </section>`;
  byId("srBack").onclick=byId("srCancel").onclick=()=>{srSession=null;location.hash="#/synonym";};
  byId("srForm").onsubmit=e=>{e.preventDefault();srSubmitSession(session);};
}
function srSubmitSession(session){
  const {main,shuffle}=srApi();
  const state=srLoad();
  const answers=session.items.map(item=>({
    id:item.id,book:item.book,number:item.number,page:item.page,question:item.question,original:item.original,prompt:item.prompt,answer:item.answer,
    userPrompt:(main.querySelector('[data-prompt="'+CSS.escape(item.id)+'"]')||{}).value||"",
    userAnswer:(main.querySelector('[data-answer="'+CSS.escape(item.id)+'"]')||{}).value||""
  }));
  const record={id:"sr-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),createdAt:new Date().toISOString(),seconds:Math.max(1,Math.round((Date.now()-session.startedAt)/1000)),books:[...new Set(answers.map(a=>a.book))],answers};
  state.records.push(record);
  state.cursor=Math.min(state.order.length,session.cursorStart+session.ids.length);
  if(state.cursor>=state.order.length){state.order=shuffle(srItems().map(x=>x.id));state.cursor=0;}
  srSave(state); srSession=null; location.hash="#/synonym/record/"+encodeURIComponent(record.id);
}
function srRecordHTML(record,forPrint){
  const {fmtTime,esc}=srApi();
  return `<section class="sr-paper">
    <div class="sr-card-head">
      <div><div class="eyebrow">同义替换练习记录</div><h1>${srDateTime(record.createdAt)}</h1><p>共 ${record.answers.length} 题 · 用时 ${fmtTime(record.seconds||0)} · 仅展示参考答案</p></div>
      ${forPrint?"":`<button class="btn" id="srRecordBack">返回记录</button>`}
    </div>
    ${record.answers.map((item,i)=>`<article class="sr-card">
      <div class="sr-card-head"><b>${i+1}. 剑桥 ${item.book} · 第 ${item.number} 题</b><small>题目 PDF 第 ${item.page} 页</small></div>
      <div class="sr-sentence"><span>Question</span>${esc(item.question)}</div>
      <div class="sr-sentence original"><span>Original</span>${esc(item.original)}</div>
      <div class="sr-your-grid">
        <div><span>你填写的题干表达</span><b>${esc(item.userPrompt)||"（未填写）"}</b></div>
        <div><span>你填写的原文替换</span><b>${esc(item.userAnswer)||"（未填写）"}</b></div>
      </div>
      <div class="sr-reference"><div class="sr-ref-title">参考答案</div><div class="sr-ref-grid">
        <div><span>题干表达</span><b>${esc(item.prompt)}</b></div>
        <div><span>同义 / 反义替换</span><b>${esc(item.answer)}</b></div>
      </div></div>
    </article>`).join("")}
    ${forPrint?"":`<div class="sr-actions"><button class="btn" id="srExport">导出本次记录 PDF</button><button class="btn primary" id="srContinue">继续下一组</button></div>`}
  </section>`;
}
function renderSynonymRecord(id){
  const {main,byId,stopTimer,highlightNav,hideNoteFab}=srApi();
  stopTimer(); highlightNav("synonym"); hideNoteFab();
  const record=srLoad().records.find(r=>r.id===id);
  if(!record){
    main.innerHTML=`<section class="sr-empty card"><h2>未找到这条练习记录</h2><button class="btn primary" id="srRecordBack">返回练习首页</button></section>`;
    byId("srRecordBack").onclick=()=>location.hash="#/synonym"; return;
  }
  main.innerHTML=srRecordHTML(record,false);
  byId("srRecordBack").onclick=()=>location.hash="#/synonym";
  byId("srExport").onclick=()=>srExportRecord(record.id);
  byId("srContinue").onclick=()=>{srSession=null;location.hash="#/synonym/practice";};
}
function srExportRecord(id){
  const {main,toast,setPdfExportTarget,doExportPDF,route}=srApi();
  const record=srLoad().records.find(r=>r.id===id);
  if(!record){toast("未找到练习记录");return;}
  const oldTitle=document.title;
  main.innerHTML=srRecordHTML(record,false);
  document.title="同义替换练习记录_"+srDateKey(record.createdAt);
  setPdfExportTarget("synonym");
  doExportPDF(oldTitle);
  if(!/MicroMessenger/i.test(navigator.userAgent)){
    setTimeout(()=>route(),2600);
  }
}
