// 持久化保存层：把所有 glx.* 记录同时镜像到 IndexedDB，并在 localStorage 被清空时自动还原。
// 目标：任何浏览器都尽力保存背诵记录；更新网页（重新部署）不影响已保存的数据。
(function(){
  "use strict";
  var PREFIX=/^glx\./;
  var hasIDB = (typeof indexedDB!=="undefined") && !!indexedDB;
  var _dbP=null;

  function openDB(){
    return new Promise(function(res,rej){
      try{
        var r=indexedDB.open("glx-durable",1);
        r.onupgradeneeded=function(){ try{ r.result.createObjectStore("kv"); }catch(e){} };
        r.onsuccess=function(){ res(r.result); };
        r.onerror=function(){ rej(r.error); };
        r.onblocked=function(){ rej(new Error("blocked")); };
      }catch(e){ rej(e); }
    });
  }
  function db(){
    if(!hasIDB) return Promise.reject(new Error("no-idb"));
    if(!_dbP) _dbP=openDB().catch(function(e){ _dbP=null; throw e; });
    return _dbP;
  }
  function idbPut(k,v){ if(!hasIDB) return; db().then(function(d){ try{ d.transaction("kv","readwrite").objectStore("kv").put(v,k); }catch(e){} }).catch(function(){}); }
  function idbDel(k){ if(!hasIDB) return; db().then(function(d){ try{ d.transaction("kv","readwrite").objectStore("kv").delete(k); }catch(e){} }).catch(function(){}); }
  function idbAll(){
    if(!hasIDB) return Promise.resolve({});
    return db().then(function(d){
      return new Promise(function(res){
        var out={};
        try{
          var st=d.transaction("kv","readonly").objectStore("kv"), cur=st.openCursor();
          cur.onsuccess=function(e){ var c=e.target.result; if(c){ out[String(c.key)]=c.value; c.continue(); } else res(out); };
          cur.onerror=function(){ res(out); };
        }catch(e){ res(out); }
      });
    }).catch(function(){ return {}; });
  }

  // 拦截 localStorage 写入：glx.* 键同步镜像到 IndexedDB（应用无需改动任何保存逻辑）
  var _set=null, _rem=null;
  try{
    _set=localStorage.setItem.bind(localStorage);
    _rem=localStorage.removeItem.bind(localStorage);
    localStorage.setItem=function(k,v){ _set(k,v); try{ if(PREFIX.test(k)) idbPut(k, String(v)); }catch(e){} };
    localStorage.removeItem=function(k){ _rem(k); try{ if(PREFIX.test(k)) idbDel(k); }catch(e){} };
  }catch(e){}
  window.__glxRawSet=_set;

  // 启动时还原：优先请求持久化存储；若 localStorage 缺失而 IndexedDB 尚存则还原；再把当前数据回写备份。
  window.__durableRestore=function(){
    return new Promise(function(resolve){
      try{ if(navigator.storage && navigator.storage.persist){ navigator.storage.persist().catch(function(){}); } }catch(e){}
      if(!hasIDB){ resolve(); return; }
      var done=false, finish=function(){ if(done) return; done=true; resolve(); };
      var timer=setTimeout(finish, 3000); // 最多等 3 秒，避免拖慢启动
      idbAll().then(function(backup){
        try{
          var restored=0, put=(window.__glxRawSet||function(k,v){ localStorage.setItem(k,v); });
          for(var k in backup){
            if(PREFIX.test(k) && backup[k]!=null && localStorage.getItem(k)===null){
              try{ put.call(localStorage, k, String(backup[k])); restored++; }catch(e){}
            }
          }
          // 反向备份：把现有 localStorage 里的 glx.* 全部写入 IndexedDB，保证 IDB 是最新副本
          for(var i=0;i<localStorage.length;i++){ var kk=localStorage.key(i); if(kk && PREFIX.test(kk)){ idbPut(kk, localStorage.getItem(kk)); } }
          window.__glxRestored=restored;
        }catch(e){}
        clearTimeout(timer); finish();
      }).catch(function(){ clearTimeout(timer); finish(); });
    });
  };
})();
