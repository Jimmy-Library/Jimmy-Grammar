/* ============================================================================
   本机记录检查 / 迁移 · 自动检测浏览器里已有的「单词 / 练习记录 / 皮肤设置」
   ----------------------------------------------------------------------------
   为什么需要它：浏览器数据按域名隔离。站点换地址（本地预览 ↔ 线上、旧域名 ↔ 新域名）
   后旧记录读不到，这个模块负责找回来并合并，绝不覆盖本机已有数据。

   覆盖三类数据：
   A. 语法应用（单词背诵/章节练习/每日一练/入学测试/笔记/收藏）：localStorage 的 glx.*
   B. 阅读机考（阅读练习记录/套题进度/草稿/词汇本/错词表）：localStorage 若干键
      + IndexedDB「ExamSystemDB.keyValueStore」里的 exam_system_*（练习记录真身在这里）
   C. 皮肤与主题设置：theme / image_skin / skin_pointer_settings_v2 / custom_image_skin_* 等
      + IndexedDB「jimmy_image_skin_cache.assets」（自定义指针图标等图片资源）

   三条路径：
   1) 同域自动 —— 开页即检查：词库单词并入「单词收藏」；练习记录只剩备份时自动补回；
      主题只剩内部记录时自动补回。
   2) 跨域一键 —— 弹窗打开旧地址，旧站把全部记录 postMessage 回来并合并。
   3) 手动兜底 —— 导出 / 导入 JSON 文件、粘贴 JSON、复制旧地址控制台代码片段。

   合并规则：只增不减。对象递归合并、数组并集去重、数字取较大值、布尔取或、
   日期字符串取较晚，偏好字段以本机为准 —— 绝不覆盖掉本机记录。
   本文件不属于上游 Jimmy-Grammar 仓库，重新同步上游时不会被覆盖。
   ============================================================================ */
(function () {
  "use strict";

  /* ------------------------------------------------------------- 数据归类 */
  var GRAMMAR_RE = /^glx\./;                 // 语法应用命名空间
  var OWN_RE = /^glx\.localimport/;          // 本模块自己的状态与快照
  var STATE_KEY = "glx.localimport";
  var BAK_KEY = "glx.localimport.bak";
  var DEF_OLD = "https://jimmy-grammar.netlify.app/#/vocab";

  /* 阅读机考的 localStorage 键（精确 / 前缀） */
  var READING_EXACT = {
    "theme": "主题", "three_bg_theme": "背景主题", "image_skin": "图片皮肤",
    "image_skin_default_summer_v1": "皮肤迁移标记", "skin_pointer_settings_v2": "指针皮肤",
    "preferred_theme_portal": "主题偏好记录", "preferred_theme_skip_session": "主题弹窗状态",
    "jimmy_reading_practice_records_backup_v1": "练习记录备份",
    "browser_notice_seen_v1": "提示状态", "daily_suite_prompt_seen_v1": "套题提示状态",
    "jimmy_vocabulary_notebook_v1": "词汇本", "jimmy_vocabulary_notebook_backup_v1": "词汇本备份",
    "vocab_words": "词汇表", "vocab_user_config": "词汇配置",
    "vocab_review_queue": "复习队列", "vocab_active_list_id": "当前词表",
    "ielts_offline_completion_queue_v1": "离线待同步记录", "ielts_sim_session": "模拟会话"
  };
  var READING_PREFIX = [
    "custom_image_skin_", "vocab_list_", "ielts_suite_progress::", "ielts_suite_draft::",
    "ielts_single_draft::", "ielts_force_resume::", "daily_suite_recommendation_v1::"
  ];
  /* 阅读机考的 IndexedDB：练习记录/统计数据/题库索引/设置都在这里 */
  var IDB_DBS = [
    { name: "ExamSystemDB", store: "keyValueStore" },
    { name: "jimmy_image_skin_cache", store: "assets" }
  ];
  var IDB_LABEL = { "ExamSystemDB": "阅读机考数据（练习记录/统计/题库索引）", "jimmy_image_skin_cache": "皮肤图片资源" };

  var WORD_FIELDS = ["word", "w", "term", "spelling", "headword", "text", "en"];
  var TR_FIELDS = ["meaning", "def", "definition", "translation", "tr", "cn", "zh", "trans", "note"];

  var STATE = loadState();
  var cachedIDB = null;

  /* ---------------------------------------------------------------- 基础工具 */
  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function loadState() { return readJSON(STATE_KEY, { done: {}, last: null, log: [] }); }
  function saveState() { rawSet(STATE_KEY, JSON.stringify(STATE)); }
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function isLeafDate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s); }
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33 ^ s.charCodeAt(--i)) >>> 0; return h.toString(36); }
  function u8(s) { return (s || "").length; }
  function sizeLabel(s) { var n = u8(s); return n < 1024 ? n + " B" : (n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"); }
  function isGrammarKey(k) { return GRAMMAR_RE.test(k) && !OWN_RE.test(k); }
  function isSkinKey(k) { return /^custom_image_skin_|^image_skin|^skin_pointer|^theme$|^three_bg_theme|^preferred_theme/.test(k); }
  function isReadingKey(k) {
    if (READING_EXACT[k]) return true;
    for (var i = 0; i < READING_PREFIX.length; i++) if (k.indexOf(READING_PREFIX[i]) === 0) return true;
    return false;
  }
  function keyLabel(k) {
    if (READING_EXACT[k]) return READING_EXACT[k];
    if (GRAMMAR_RE.test(k)) {
      var m = {
        "glx.v1": "章节练习", "glx.vocab": "单词背诵", "glx.ielts-topic": "话题词汇",
        "glx.daily": "每日一练", "glx.exam": "入学测试", "glx.favwords": "单词收藏",
        "glx.notebook": "笔记", "glx.notes": "多条笔记", "glx.game": "闯关", "glx.ui": "界面偏好"
      };
      return m[k] || ("语法应用·" + k.replace(/^glx\./, ""));
    }
    for (var i = 0; i < READING_PREFIX.length; i++) if (k.indexOf(READING_PREFIX[i]) === 0) return "阅读机考·" + k;
    return k;
  }
  function localKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && (isGrammarKey(k) || isReadingKey(k))) out.push(k); } } catch (e) {}
    return out.sort();
  }

  /* ------------------------------------------------------------- 合并（只增不减） */
  /* 偏好类字段：导入时不覆盖本机选择 */
  var PREF_KEYS = { dailyNew: 1, start: 1, fz: 1, sidebarW: 1, navHidden: 1, rate: 1, voice: 1, theme: 1, tone: 1, unit: 1 };
  function mergeValue(a, b, key) {
    if (PREF_KEYS[key] && a !== undefined && a !== null) return a;
    if (a === undefined || a === null) return b;
    if (b === undefined || b === null) return a;
    if (isObj(a) && isObj(b)) {
      var out = {}, ks = Object.keys(a).concat(Object.keys(b).filter(function (k) { return !(k in a); }));
      for (var i = 0; i < ks.length; i++) out[ks[i]] = mergeValue(a[ks[i]], b[ks[i]], ks[i]);
      return out;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      var seen = {}, out2 = [];
      a.concat(b).forEach(function (x) {
        var j = JSON.stringify(x === undefined ? null : x);
        if (!seen[j]) { seen[j] = 1; out2.push(x); }
      });
      return out2;
    }
    if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
    if (typeof a === "boolean" && typeof b === "boolean") return a || b;
    if (isLeafDate(a) && isLeafDate(b)) return a > b ? a : b;
    return a;                       // 其它冲突：保留本机值
  }
  function mergeData(local, incoming) {
    var merged = mergeValue(local, incoming);
    return { v: merged, changed: JSON.stringify(merged) !== JSON.stringify(local === undefined ? null : local) };
  }

  /* ------------------------------------------------------------- IndexedDB */
  function idbOpen(name, store) {
    return new Promise(function (res, rej) {
      var r;
      try { r = indexedDB.open(name, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () { try { if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store); } catch (e) {} };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error("blocked")); };
    });
  }
  function idbAll(name, store) {
    return idbOpen(name, store).then(function (db) {
      return new Promise(function (res) {
        var out = {};
        try {
          var cur = db.transaction(store, "readonly").objectStore(store).openCursor();
          cur.onsuccess = function (e) { var c = e.target.result; if (c) { out[String(c.key)] = c.value; c.continue(); } else { db.close(); res(out); } };
          cur.onerror = function () { db.close(); res(out); };
        } catch (e) { try { db.close(); } catch (_) {} res(out); }
      });
    }).catch(function () { return {}; });
  }
  function idbPut(name, store, key, value) {
    return idbPutRaw(name, store, key, value);
  }
  /* 有的库用内联主键（ExamSystemDB 的记录形如 {key, value, timestamp}），
     有的用外键（jimmy_image_skin_cache 直接 key 参数）。写之前先取 keyPath。 */
  function idbMeta(name, store) {
    return idbOpen(name, store).then(function (db) {
      var m = { keyPath: null };
      try { m.keyPath = db.transaction(store, "readonly").objectStore(store).keyPath; } catch (e) {}
      try { db.close(); } catch (e) {}
      return m;
    }).catch(function () { return { keyPath: null }; });
  }
  function unpackRecord(keyPath, rec) {
    if (keyPath === "key" && isObj(rec) && Object.prototype.hasOwnProperty.call(rec, "value")) return rec.value;
    return rec;
  }
  function packRecord(keyPath, key, value, prev) {
    if (keyPath === "key") {
      var ts = (prev && prev.timestamp) || Date.now();
      return { key: key, value: value, timestamp: ts };
    }
    return value;
  }
  function idbPutRaw(name, store, key, value) {
    return idbMeta(name, store).then(function (meta) {
      return idbOpen(name, store).then(function (db) {
        return new Promise(function (res) {
          try {
            var tx = db.transaction(store, "readwrite"), os = tx.objectStore(store);
            if (meta.keyPath) os.put(packRecord(meta.keyPath, key, value, null));
            else os.put(value, key);
            tx.oncomplete = function () { db.close(); res(true); };
            tx.onerror = tx.onabort = function () { db.close(); res(false); };
          } catch (e) { try { db.close(); } catch (_) {} res(false); }
        });
      });
    }).catch(function () { return false; });
  }
  function blobToDataURL(b) {
    return new Promise(function (res) {
      try {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result)); };
        fr.onerror = function () { res(null); };
        fr.readAsDataURL(b);
      } catch (e) { res(null); }
    });
  }
  function dataURLToBlob(u) {
    try {
      var parts = String(u).split(","), meta = parts[0], body = parts[1];
      var mime = (meta.match(/:(.*?);/) || [])[1] || "application/octet-stream";
      var bin = atob(body), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) { return null; }
  }
  /* 阅读机考把值包成 JSON 字符串信封：{"data":…,"timestamp":…,"version":…,"compressed":…}
     （compressData 不压缩数组，只压缩大对象）。这里负责解开 / 重新包上。 */
  function unwrapEnvelope(v) {
    if (typeof v === "string") {
      try {
        var p = JSON.parse(v);
        if (isObj(p) && Object.prototype.hasOwnProperty.call(p, "data")) return p.data;
        return p;
      } catch (e) { return v; }
    }
    if (isObj(v) && Object.prototype.hasOwnProperty.call(v, "data") &&
        (Object.prototype.hasOwnProperty.call(v, "timestamp") || Object.prototype.hasOwnProperty.call(v, "version"))) return v.data;
    return v;
  }
  function wrapEnvelope(payload, prevRaw) {
    if (prevRaw !== undefined && typeof prevRaw !== "string") return payload;   // 原本是裸值 → 保持裸值
    var version = "1.0.0";
    try { if (window.storage && window.storage.persistentStore && window.storage.persistentStore.version) version = window.storage.persistentStore.version; } catch (e) {}
    return JSON.stringify({ data: payload, timestamp: Date.now(), version: version, compressed: false });
  }
  /* 阅读 App 的数据走它自己的存储 API 写，才能同时刷新信封、可恢复备份与同步事件 */
  var APP_STORAGE_KEYS = ["practice_records", "user_stats", "settings", "exam_index", "exam_index_configurations",
    "active_exam_index_key", "learning_goals", "browse_filter", "current_category", "current_exam_type"];
  var BACKUP_KEY = "jimmy_reading_practice_records_backup_v1";
  function appStore() {
    try {
      var s = window.storage;
      if (!s) return null;
      if (typeof s.get === "function" && typeof s.set === "function") return s;
      var p = s.persistentStore;
      if (p && typeof p.get === "function") return p;
      return null;
    } catch (e) { return null; }
  }
  function appStoreSet(store, key, value) {
    try {
      if (typeof store.set === "function") return Promise.resolve(store.set(key, value));
      if (typeof store.writePersistentValue === "function") return Promise.resolve(store.writePersistentValue(key, value));
    } catch (e) {}
    return Promise.resolve(false);
  }
  /* 用 App 的 API 合并阅读机考的数据；返回 { handled: [IDB键], changed } */
  function idbMergeViaApp(dump) {
    var store = appStore();
    if (!store || !dump || !dump.ExamSystemDB) return Promise.resolve({ handled: [], changed: 0 });
    var vals = (dump.ExamSystemDB || {}).values || {};
    var handled = [], changed = 0;
    var jobs = Object.keys(vals).map(function (k) {
      var sk = k.replace(/^exam_system_/, "");
      if (APP_STORAGE_KEYS.indexOf(sk) < 0) return null;
      handled.push(k);
      var incoming = unpackIDBValue(vals[k]);
      return Promise.resolve(store.get(sk, null)).then(function (cur) {
        var base = (cur === undefined) ? null : cur;
        var merged = mergeValue(base, incoming);
        if (JSON.stringify(merged) === JSON.stringify(base)) return false;
        changed++;
        return appStoreSet(store, sk, merged);
      }).catch(function () { return false; });
    }).filter(Boolean);
    return Promise.all(jobs).then(function () { return { handled: handled, changed: changed }; });
  }
  /* 读全部 IDB（信封解开、Blob 转 dataURL，便于 postMessage / JSON 导出） */
  function idbDump() {
    return Promise.all(IDB_DBS.map(function (d) {
      return idbMeta(d.name, d.store).then(function (meta) {
        return idbAll(d.name, d.store).then(function (all) {
          var keys = Object.keys(all);
          return Promise.all(keys.map(function (k) {
            var raw = all[k];
            var rec = unpackRecord(meta.keyPath, raw);
            var v = unwrapEnvelope(rec);
            if (typeof Blob !== "undefined" && v instanceof Blob) {
              return blobToDataURL(v).then(function (u) { return { k: k, v: u ? { __blob: 1, type: v.type, dataURL: u } : null }; });
            }
            return { k: k, v: v };
          })).then(function (pairs) {
            var values = {};
            pairs.forEach(function (p) { if (p.v !== null && p.v !== undefined) values[p.k] = p.v; });
            return { name: d.name, store: d.store, keyPath: meta.keyPath, values: values };
          });
        });
      });
    })).then(function (list) {
      var out = {};
      list.forEach(function (l) { if (Object.keys(l.values).length) out[l.name] = l; });
      cachedIDB = out;
      return out;
    });
  }
  function unpackIDBValue(v) {
    if (isObj(v) && v.__blob && v.dataURL && typeof Blob !== "undefined") return dataURLToBlob(v.dataURL) || v;
    return v;
  }
  function idbWrite(name, store, keyPath, key, value, prev) {
    return idbOpen(name, store).then(function (db) {
      return new Promise(function (res) {
        try {
          var tx = db.transaction(store, "readwrite"), os = tx.objectStore(store);
          if (keyPath) os.put(packRecord(keyPath, key, value, prev));
          else os.put(value, key);
          tx.oncomplete = function () { db.close(); res(true); };
          tx.onerror = tx.onabort = function () { db.close(); res(false); };
        } catch (e) { try { db.close(); } catch (_) {} res(false); }
      });
    }).catch(function () { return false; });
  }
  /* 合并写入 IDB；skipKeys 里的键已由 App API 处理过。返回改动条数 */
  function idbMerge(dump, skipKeys) {
    var names = Object.keys(dump || {});
    if (!names.length) return Promise.resolve(0);
    var changed = 0;
    return names.reduce(function (chain, name) {
      return chain.then(function () {
        var meta = dump[name];
        var store = meta.store || (IDB_DBS.filter(function (d) { return d.name === name; })[0] || {}).store;
        if (!store) return null;
        return idbMeta(name, store).then(function (info) {
          var keyPath = meta.keyPath || info.keyPath || null;
          return idbAll(name, store).then(function (rawLocal) {
            var local = {};
            Object.keys(rawLocal).forEach(function (k) { local[k] = unwrapEnvelope(unpackRecord(keyPath, rawLocal[k])); });
            var jobs = Object.keys(meta.values || {}).map(function (k) {
              if (skipKeys && skipKeys.indexOf(k) >= 0) return Promise.resolve(false);
              var incoming = unpackIDBValue(meta.values[k]);
              var hasLocal = Object.prototype.hasOwnProperty.call(local, k);
              var merged = hasLocal ? mergeValue(local[k], incoming) : incoming;
              if (hasLocal && JSON.stringify(merged) === JSON.stringify(local[k])) return Promise.resolve(false);
              changed++;
              var out = (name === "ExamSystemDB") ? wrapEnvelope(merged, hasLocal ? unpackRecord(keyPath, rawLocal[k]) : undefined) : merged;
              return idbWrite(name, store, keyPath, k, out, rawLocal[k]).then(function (ok) {
                if (ok && k === "exam_system_practice_records" && Array.isArray(merged)) {
                  rawSet(BACKUP_KEY, JSON.stringify({ schemaVersion: 1, updatedAt: new Date().toISOString(), records: merged }));
                }
                return ok;
              });
            });
            return Promise.all(jobs);
          });
        });
      });
    }, Promise.resolve()).then(function () { return changed; });
  }

  /* ------------------------------------------- 同域：阅读机考的单词数据 */
  function normalizeWord(it) {
    if (typeof it === "string") { var s = it.trim(); return s ? { w: s, tr: "" } : null; }
    if (!isObj(it)) return null;
    var w = "", tr = "";
    for (var i = 0; i < WORD_FIELDS.length && !w; i++) if (typeof it[WORD_FIELDS[i]] === "string") w = it[WORD_FIELDS[i]];
    for (var j = 0; j < TR_FIELDS.length && !tr; j++) {
      var v = it[TR_FIELDS[j]];
      if (typeof v === "string") tr = v;
      else if (Array.isArray(v) && typeof v[0] === "string") tr = v.join(" / ");
      else if (isObj(v) && typeof v.zh === "string") tr = v.zh;
    }
    w = String(w).trim();
    if (!w || !/[a-zA-Z]/.test(w)) return null;
    return { w: w, tr: String(tr).trim() };
  }
  function collectReadingWords() {
    var found = [], src = [];
    var keys = ["jimmy_vocabulary_notebook_v1", "jimmy_vocabulary_notebook_backup_v1", "vocab_words",
      "vocab_list_p1_errors", "vocab_list_p4_errors", "vocab_list_master_errors", "vocab_list_custom"];
    keys.forEach(function (k) {
      var parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(k)); } catch (e) { parsed = null; }
      if (!parsed) return;
      var list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.words) ? parsed.words : null);
      if (!list) return;
      var n = 0;
      list.forEach(function (it) { var w = normalizeWord(it); if (w) { found.push(w); n++; } });
      if (n) src.push({ key: k, count: n });
    });
    return { words: found, sources: src };
  }

  /* --------------------------------------------------------- 快照 / 导入导出 */
  function snapshot() {
    var o = {};
    localKeys().forEach(function (k) { o[k] = raw(k); });
    rawSet(BAK_KEY, JSON.stringify({ ts: Date.now(), ls: o }));
  }
  /* 兼容 v1（平铺 glx.* 字符串）与 v2（{ls, idb}）两种载荷 */
  function normalizePayload(p) {
    if (!isObj(p)) return null;
    if (isObj(p.payload)) p = p.payload;
    if (isObj(p.ls) || isObj(p.idb)) return { ls: p.ls || {}, idb: p.idb || {} };
    var ls = {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (typeof v === "string" && (GRAMMAR_RE.test(k) || isReadingKey(k))) ls[k] = v;
    });
    return { ls: ls, idb: {} };
  }
  function importLS(ls) {
    var changed = 0, detail = [];
    Object.keys(ls || {}).forEach(function (k) {
      if (OWN_RE.test(k) || (!GRAMMAR_RE.test(k) && !isReadingKey(k))) return;
      var incoming = ls[k];
      if (typeof incoming === "string") { try { incoming = JSON.parse(incoming); } catch (e) { /* 保留原始字符串 */ } }
      if (incoming === undefined || incoming === null) return;
      var localStr = raw(k);
      if (localStr === null) {
        rawSet(k, typeof incoming === "string" ? incoming : JSON.stringify(incoming));
        changed++; detail.push({ key: k, name: keyLabel(k), mode: "新增" }); return;
      }
      var local = null; try { local = JSON.parse(localStr); } catch (e) { local = null; }
      var r = mergeData(local, incoming);
      if (!r.changed) return;
      var next = typeof r.v === "string" ? r.v : JSON.stringify(r.v);
      if (next === localStr) return;
      rawSet(k, next);
      changed++; detail.push({ key: k, name: keyLabel(k), mode: "合并" });
    });
    return { changed: changed, detail: detail };
  }
  function importPayload(payload, label) {
    var p = normalizePayload(payload);
    if (!p) return Promise.resolve({ changed: 0, ls: 0, idb: 0, detail: [] });
    var hasLocal = localKeys().some(function (k) { return raw(k) !== null; });
    if (hasLocal) snapshot(); else rawSet(BAK_KEY, JSON.stringify({ ts: Date.now(), ls: {} }));
    var res = importLS(p.ls);
    return idbMergeViaApp(p.idb).then(function (viaApp) {
      return idbMerge(p.idb, viaApp.handled).then(function (rawChanged) {
        var idbChanged = viaApp.changed + rawChanged;
        STATE.done[label] = Date.now(); STATE.last = Date.now();
        STATE.log.push({ ts: Date.now(), label: label, ls: res.changed, idb: idbChanged });
        STATE.log = STATE.log.slice(-20);
        saveState();
        return { changed: res.changed + idbChanged, ls: res.changed, idb: idbChanged, detail: res.detail };
      });
    });
  }
  function exportAll() {
    return idbDump().then(function (idb) {
      var ls = {};
      localKeys().forEach(function (k) { ls[k] = raw(k); });
      return { app: "jimmy-site", version: 2, origin: location.origin, ts: Date.now(), ls: ls, idb: idb };
    });
  }
  function download(obj, name) {
    try {
      var b = new Blob([JSON.stringify(obj)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------- 同域：自动检查与补回 */
  function sigOfReadingWords(words) { return "readingWords:" + hash(words.map(function (w) { return w.w + "|" + w.tr; }).join(",")); }
  function srcLen() {
    var t = 0;
    ["jimmy_vocabulary_notebook_v1", "jimmy_vocabulary_notebook_backup_v1", "vocab_words",
      "vocab_list_p1_errors", "vocab_list_p4_errors", "vocab_list_master_errors", "vocab_list_custom"]
      .forEach(function (k) { var m = raw(k); if (m) t = Math.max(t, m.length); });
    return t;                            // 用长度当“版本”，内容变长就重新导入
  }
  function sameOriginImport(opts) {
    opts = opts || {};
    var got = collectReadingWords();
    var added = 0;
    if (got.words.length) {
      var sig = sigOfReadingWords(got.words);
      if (opts.force || !STATE.done[sig] || STATE.done[sig] < srcLen()) {
        var favs = readJSON("glx.favwords", []);
        if (!Array.isArray(favs)) favs = [];
        var have = {};
        favs.forEach(function (x) { if (x && x.w) have[String(x.w).toLowerCase()] = 1; });
        got.words.forEach(function (w) {
          var k = w.w.toLowerCase();
          if (have[k]) return;
          have[k] = 1; added++;
          favs.unshift({ w: w.w, tr: w.tr || "", ts: Date.now(), from: "阅读机考·词汇本" });
        });
        if (added) {
          snapshot();                       // 先存快照，可撤销
          rawSet("glx.favwords", JSON.stringify(favs));
          STATE.done[sig] = Date.now(); STATE.last = Date.now();
          STATE.log.push({ ts: Date.now(), label: sig, ls: 1, idb: 0 });
          STATE.log = STATE.log.slice(-20); saveState();
        }
      }
    }
    return { added: added, total: got.words.length, sources: got.sources };
  }
  /* 练习记录：数据库为空而本机还有备份时补回（阅读机考自己的备份键）
     备份键的结构是 {schemaVersion, updatedAt, records:[...]}，也可能直接是数组 */
  function restorePracticeRecords() {
    var backupRaw = raw(BACKUP_KEY);
    if (!backupRaw) return Promise.resolve(0);
    var backup = null; try { backup = JSON.parse(backupRaw); } catch (e) { backup = null; }
    var list = Array.isArray(backup) ? backup : (isObj(backup) && Array.isArray(backup.records) ? backup.records : null);
    var n = list ? list.length : 0;
    if (!n) return Promise.resolve(0);
    var KEY = "exam_system_practice_records";
    var store = appStore();
    if (store) {                                   // 优先走 App 自己的 API，信封/备份/事件一起处理
      return Promise.resolve(store.get("practice_records", [])).then(function (cur) {
        var curN = Array.isArray(cur) ? cur.length : 0;
        if (curN >= n) return 0;
        return appStoreSet(store, "practice_records", list).then(function (ok) { return ok ? n : 0; });
      }).catch(function () { return 0; });
    }
    return idbMeta("ExamSystemDB", "keyValueStore").then(function (meta) {
      return idbAll("ExamSystemDB", "keyValueStore").then(function (all) {
        var rec = all[KEY];
        var cur = unwrapEnvelope(unpackRecord(meta.keyPath, rec));
        var curN = Array.isArray(cur) ? cur.length : (isObj(cur) ? Object.keys(cur).length : 0);
        if (curN >= n) return 0;                          // 本机记录更全，不动
        var out = wrapEnvelope(list, rec === undefined ? undefined : unpackRecord(meta.keyPath, rec));
        return idbWrite("ExamSystemDB", "keyValueStore", meta.keyPath, KEY, out, rec).then(function (ok) { return ok ? n : 0; });
      });
    });
  }
  /* 主题：只剩内部偏好记录时补回（theme-switcher 的 recordInternalTheme） */
  function restoreTheme() {
    if (raw("theme")) return 0;
    var portal = readJSON("preferred_theme_portal", null);
    var t = portal && portal.theme;
    if (!t || t === "default") return 0;
    rawSet("theme", String(t));
    return 1;
  }
  function autoCheck() {
    var out = { words: 0, records: 0, theme: 0 };
    out.words = sameOriginImport({}).added;
    out.theme = restoreTheme();
    return restorePracticeRecords().then(function (n) { out.records = n; return out; });
  }

  /* --------------------------------------------------------- 跨域桥：收发两端 */
  function gatherPayload() {
    var ls = {};
    localKeys().forEach(function (k) { ls[k] = raw(k); });
    return { ls: ls, idb: {} };
  }
  function sendTo(target) {
    if (!target) return false;
    idbDump().then(function (idb) {
      var p = gatherPayload(); p.idb = idb;
      try { target.postMessage({ glx: "records", origin: location.origin, ts: Date.now(), payload: p }, "*"); } catch (e) {}
    });
    return true;
  }
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.glx === "request") { sendTo(e.source); return; }
    if (d.glx === "records" && isObj(d.payload)) offer(d);
  });
  function autoSendToOpener() {
    if (!/glx=send/.test(location.search + location.hash)) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (sendTo(window.opener) || n > 12) clearInterval(t);
    }, 700);
  }
  function startBridge(url) {
    url = (url || "").trim() || DEF_OLD;
    var w = null;
    try { w = window.open(url, "glx-bridge", "width=520,height=680"); } catch (e) { w = null; }
    if (!w) { toast("弹窗被拦住了，请允许本页弹窗后重试"); return false; }
    var n = 0;
    var t = setInterval(function () {
      n++;
      try { w.postMessage({ glx: "request" }, "*"); } catch (e) {}
      if (n > 20 || w.closed) clearInterval(t);
    }, 700);
    return true;
  }
  function summarize(p) {
    var g = 0, r = 0, s = 0;
    Object.keys(p.ls || {}).forEach(function (k) {
      if (isGrammarKey(k)) g++;
      else if (isSkinKey(k)) s++;
      else r++;
    });
    var idbNames = Object.keys(p.idb || {});
    var idbN = idbNames.reduce(function (n, name) { return n + Object.keys((p.idb[name] || {}).values || {}).length; }, 0);
    return { grammar: g, reading: r, skin: s, idb: idbN, idbNames: idbNames };
  }
  function offer(d) {
    var s = summarize(d.payload);
    var rows = [
      "单词背诵 / 语法练习记录：" + s.grammar + " 项",
      "阅读练习记录 / 词汇表：" + s.reading + " 项",
      "皮肤与主题设置：" + s.skin + " 项",
      "阅读机考数据库（练习记录等）：" + s.idb + " 项" + (s.idbNames.length ? "（" + s.idbNames.join("、") + "）" : "")
    ];
    modal("📥 收到本机记录", "来源：" + (d.origin || "未知地址"),
      '<div class="li-list">' + rows.map(function (r) { return '<div class="li-row">' + esc(r) + "</div>"; }).join("") + "</div>" +
      '<p class="li-sub">将与本机记录合并（只增不减，不覆盖已有数据）。</p>',
      [{ t: "✔ 导入并刷新", p: 1, fn: function () { doImport(d.payload, "bridge:" + (d.origin || "?")); } },
       { t: "取消", fn: closeModal }]);
  }
  function doImport(payload, label) {
    return importPayload(payload, label).then(function (r) {
      closeModal();
      if (r.changed) { toast("已导入 " + r.changed + " 项记录，正在刷新…"); setTimeout(function () { location.reload(); }, 1200); }
      else toast("本机记录已是最新，无需导入");
      return r;
    });
  }

  /* ------------------------------------------------------------------- 提示 UI */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var tT = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(tT); tT = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function ensureCSS() {
    if (document.getElementById("li-style")) return;
    var s = document.createElement("style"); s.id = "li-style";
    s.textContent =
      ".li-mask{position:fixed;inset:0;background:rgba(8,20,35,.5);z-index:120;display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".li-box{background:#fff;color:var(--ink,#1f2d3d);border-radius:16px;box-shadow:0 18px 48px rgba(8,20,35,.28);max-width:600px;width:100%;max-height:86vh;overflow:auto;padding:20px 22px}" +
      ".li-box h3{margin:0 0 6px;font-size:18px}" +
      ".li-sub{color:var(--muted,#7b8794);font-size:13px;margin:6px 0 0;line-height:1.7}" +
      ".li-sec{border-top:1px dashed rgba(0,0,0,.12);margin-top:16px;padding-top:14px}" +
      ".li-sec h4{margin:0 0 8px;font-size:14px}" +
      ".li-row{font-size:13px;padding:3px 0;color:var(--ink,#1f2d3d)}" +
      ".li-list{max-height:190px;overflow:auto;background:#f6f8fa;border-radius:10px;padding:8px 12px;margin-top:8px}" +
      ".li-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}" +
      ".li-btn{border:0;border-radius:10px;padding:9px 14px;font-size:14px;cursor:pointer;background:#eef2f6;color:#1f2d3d;font-weight:600}" +
      ".li-btn.p{background:var(--teal,#0e9488);color:#fff}" +
      ".li-btn.ghost{background:transparent;border:1px solid rgba(0,0,0,.14)}" +
      ".li-inp{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.16);border-radius:10px;padding:9px 11px;font-size:13px;margin-top:6px;font-family:inherit}" +
      ".li-code{width:100%;box-sizing:border-box;height:92px;border:1px solid rgba(0,0,0,.16);border-radius:10px;padding:8px 10px;font-size:11.5px;font-family:ui-monospace,Menlo,monospace;margin-top:6px;background:#fbfcfd}" +
      ".li-warn{color:#b45309}";
    document.head.appendChild(s);
  }
  var modalEl = null;
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
  function modal(title, sub, bodyHTML, buttons) {
    ensureCSS(); closeModal();
    var mask = document.createElement("div"); mask.className = "li-mask";
    var box = document.createElement("div"); box.className = "li-box";
    box.innerHTML = "<h3>" + esc(title) + "</h3>" + (sub ? '<p class="li-sub">' + esc(sub) + "</p>" : "") + bodyHTML;
    var bar = document.createElement("div"); bar.className = "li-btns";
    (buttons || []).forEach(function (b) {
      var el = document.createElement("button");
      el.className = "li-btn" + (b.p ? " p" : "") + (b.ghost ? " ghost" : "");
      el.textContent = b.t;
      el.onclick = function () { if (b.fn) b.fn(); };
      bar.appendChild(el);
    });
    box.appendChild(bar);
    mask.appendChild(box);
    mask.addEventListener("click", function (e) { if (e.target === mask) closeModal(); });
    document.body.appendChild(mask);
    modalEl = mask;
    return box;
  }

  /* -------------------------------------------------------------------- 面板 */
  function openPanel() {
    ensureCSS();
    var got = collectReadingWords();
    var keys = localKeys();
    var grammarKeys = keys.filter(isGrammarKey);
    var skinKeys = keys.filter(isSkinKey);
    var readingKeys = keys.filter(function (k) { return isReadingKey(k) && !isSkinKey(k); });
    var bak = readJSON(BAK_KEY, null);
    var listOf = function (arr) {
      return arr.map(function (k) { return '<div class="li-row">· ' + esc(keyLabel(k)) + "　" + sizeLabel(raw(k)) + "</div>"; }).join("") || '<div class="li-row li-warn">暂无</div>';
    };
    var body =
      '<div class="li-sec"><h4>① 同域自动检查（本机已有数据）</h4>' +
      '<p class="li-sub">同一域名下能直接读：词汇本 ' + got.words.length + " 个单词 · 语法记录 " + grammarKeys.length +
      " 项 · 阅读记录 " + readingKeys.length + " 项 · 皮肤/主题 " + skinKeys.length + " 项。" +
      "练习记录只剩备份、主题只剩内部记录时会自动补回。</p>" +
      '<div class="li-btns"><button class="li-btn p" id="li-check">立即检查并导入</button>' +
      (bak ? '<button class="li-btn ghost" id="li-undo">↺ 撤销上次导入</button>' : "") + "</div></div>" +

      '<div class="li-sec"><h4>② 从旧地址一键导入（跨域）</h4>' +
      '<p class="li-sub">旧地址在别的域名下，浏览器不允许直接读取；弹窗打开它一次，就能把单词、阅读练习记录、皮肤设置整体传回来。</p>' +
      '<input class="li-inp" id="li-url" value="' + esc(DEF_OLD) + '">' +
      '<div class="li-btns"><button class="li-btn p" id="li-go">打开旧站并导入</button>' +
      '<button class="li-btn ghost" id="li-snip">手动导入代码</button></div></div>' +

      '<div class="li-sec"><h4>③ 文件 / 粘贴</h4>' +
      '<p class="li-sub">导出本机记录（含阅读机考数据库）留档，或导入别处导出的 JSON。</p>' +
      '<textarea class="li-code" id="li-paste" placeholder="在此粘贴记录 JSON…"></textarea>' +
      '<div class="li-btns"><button class="li-btn" id="li-file">选择文件导入</button>' +
      '<button class="li-btn" id="li-pastego">粘贴导入</button>' +
      '<button class="li-btn ghost" id="li-export">导出本机记录</button></div>' +
      '<input type="file" id="li-fileinput" accept=".json,application/json" style="display:none"></div>' +

      '<div class="li-sec"><h4>本机数据体检</h4>' +
      '<p class="li-sub">语法应用 · 单词与练习（' + grammarKeys.length + " 项）</p><div class=\"li-list\">" + listOf(grammarKeys) + "</div>" +
      '<p class="li-sub">阅读机考 · 练习记录 / 草稿 / 词汇（' + readingKeys.length + " 项）</p><div class=\"li-list\">" + listOf(readingKeys) + "</div>" +
      '<p class="li-sub">皮肤与主题设置（' + skinKeys.length + " 项）</p><div class=\"li-list\">" + listOf(skinKeys) + "</div>" +
      '<p class="li-sub" id="li-idb">阅读机考数据库：检查中…</p>' +
      (STATE.last ? '<p class="li-sub">上次导入：' + new Date(STATE.last).toLocaleString() + "</p>" : "") +
      "</div>";

    modal("📥 记录检查 / 迁移", "单词 · 练习记录 · 皮肤设置都保存在本机浏览器里，按域名隔离", body,
      [{ t: "关闭", ghost: 1, fn: closeModal }]);

    var $ = function (id) { return document.getElementById(id); };
    idbDump().then(function (dump) {
      var el = $("li-idb"); if (!el) return;
      var parts = Object.keys(dump).map(function (name) {
        return (IDB_LABEL[name] || name) + "：" + Object.keys((dump[name] || {}).values || {}).length + " 项";
      });
      el.textContent = "阅读机考数据库：" + (parts.join(" · ") || "暂无数据");
    });
    if ($("li-check")) $("li-check").onclick = function () {
      autoCheck().then(function (r) {
        closeModal();
        var bits = [];
        if (r.words) bits.push(r.words + " 个单词");
        if (r.records) bits.push(r.records + " 条练习记录");
        if (r.theme) bits.push("主题设置");
        toast(bits.length ? "已自动导入：" + bits.join("、") : "本机记录已是最新，无需导入");
      });
    };
    if ($("li-undo")) $("li-undo").onclick = function () {
      if (undoLast()) { toast("已撤销上次导入"); setTimeout(function () { location.reload(); }, 900); }
      else toast("没有可撤销的导入");
    };
    if ($("li-go")) $("li-go").onclick = function () {
      if (!startBridge($("li-url").value)) return;
      closeModal();
      toast("正在等待旧站回传记录…（旧站如无本功能，请用「手动导入代码」）");
    };
    if ($("li-snip")) $("li-snip").onclick = showSnippet;
    if ($("li-export")) $("li-export").onclick = function () {
      var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
      var name = "jimmy-记录导出-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ".json";
      exportAll().then(function (o) { toast(download(o, name) ? "已导出：" + name : "导出失败，请换个浏览器试试"); });
    };
    if ($("li-file")) $("li-file").onclick = function () { $("li-fileinput").click(); };
    if ($("li-fileinput")) $("li-fileinput").onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { handleText(String(fr.result || ""), f.name); };
      fr.readAsText(f);
    };
    if ($("li-pastego")) $("li-pastego").onclick = function () { handleText($("li-paste").value, "粘贴内容"); };
  }
  function handleText(txt, label) {
    var o = null; try { o = JSON.parse(txt); } catch (e) { o = null; }
    if (!isObj(o)) { toast("内容不是有效的记录 JSON"); return Promise.resolve(null); }
    var p = normalizePayload(o);
    if (!p || (!Object.keys(p.ls).length && !Object.keys(p.idb).length)) { toast("这里面没有可导入的记录"); return Promise.resolve(null); }
    return doImport(o, "file:" + label);
  }
  function snippetText() {
    return "(function(){var o={},i,k;for(i=0;i<localStorage.length;i++){k=localStorage.key(i);" +
      "if(/^glx\\./.test(k)||/^(theme|three_bg_theme|image_skin|skin_pointer_settings_v2|preferred_theme|jimmy_|vocab_|ielts_|daily_suite|browser_notice|custom_image_skin)/.test(k))o[k]=localStorage.getItem(k);}" +
      "function done(idb){var b=new Blob([JSON.stringify({app:'jimmy-site',version:2,origin:location.origin,ts:Date.now(),ls:o,idb:idb||{}})],{type:'application/json'});" +
      "var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='jimmy-记录导出-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();}" +
      "var names=[['ExamSystemDB','keyValueStore'],['jimmy_image_skin_cache','assets']],out={},left=names.length;" +
      "names.forEach(function(p){try{var r=indexedDB.open(p[0],1);r.onupgradeneeded=function(){try{r.result.createObjectStore(p[1])}catch(e){}};" +
      "r.onerror=r.onblocked=function(){if(--left===0)done(out)};r.onsuccess=function(){var db=r.result,vals={};try{var st=db.transaction(p[1],'readonly').objectStore(p[1]),cu=st.openCursor();" +
      "cu.onsuccess=function(e){var c=e.target.result;if(c){vals[String(c.key)]=c.value;c.continue()}else{db.close();if(Object.keys(vals).length)out[p[0]]={store:p[1],values:vals};if(--left===0)done(out)}};" +
      "cu.onerror=function(){db.close();if(--left===0)done(out)}}catch(e){db.close();if(--left===0)done(out)}}}catch(e){if(--left===0)done(out)}});})();";
  }
  function showSnippet() {
    var code = snippetText();
    modal("手动导入代码", "在旧地址页面按 F12 → Console 粘贴执行，会下载一个记录 JSON（含阅读机考数据库）；再用「选择文件导入」载入。",
      '<textarea class="li-code" id="li-sn" style="height:170px" readonly>' + esc(code) + "</textarea>",
      [{ t: "复制代码", p: 1, fn: function () { copy(code); } }, { t: "返回", fn: openPanel }]);
  }
  function copy(txt) {
    function ok() { toast("已复制，去旧地址粘贴执行"); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fb);
    else fb();
    function fb() {
      try {
        var t = document.createElement("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.focus(); t.select(); document.execCommand("copy"); t.remove(); ok();
      } catch (e) { toast("复制失败，请手动选中复制"); }
    }
  }

  /* ---------------------------------------------------------- 撤销 / 入口注入 */
  function undoLast() {
    var bak = readJSON(BAK_KEY, null);
    if (!bak || !bak.ls) return false;
    Object.keys(bak.ls).forEach(function (k) { rawSet(k, bak.ls[k]); });
    localKeys().forEach(function (k) { if (!(k in bak.ls)) rawDel(k); });
    rawDel(BAK_KEY);
    return true;
  }
  /* 语法应用：⚙ 设置面板 */
  function injectGrammarEntry() {
    var panel = document.getElementById("settings-panel");
    if (!panel || document.getElementById("li-open")) return;
    var b = document.createElement("button");
    b.className = "sp-link"; b.id = "li-open"; b.textContent = "📥 记录检查 / 迁移";
    b.onclick = function (e) { e.stopPropagation(); panel.classList.remove("show"); openPanel(); };
    var reset = document.getElementById("reset-btn");
    if (reset) panel.insertBefore(b, reset); else panel.appendChild(b);
  }
  /* 阅读机考：⚙ 设置页里插一张卡 */
  function injectReadingEntry() {
    var view = document.getElementById("settings-view");
    if (!view || view.querySelector("#li-card")) return;
    var group = view.querySelector(".hero-settings-group");
    if (!group) return;
    var card = document.createElement("div");
    card.className = "hero-panel hero-section data-management-panel";
    card.id = "li-card";
    card.innerHTML = '<h3>📥 本机记录迁移</h3>' +
      '<p class="hero-panel__muted">换地址 / 换域名后取回单词背诵、阅读练习记录与皮肤设置</p>' +
      '<div class="hero-settings-actions"><button class="btn hero-btn data-mgmt-btn" id="li-open2">📥 检查并迁移本机记录</button></div>';
    group.appendChild(card);
    card.querySelector("#li-open2").onclick = function (e) { e.preventDefault(); openPanel(); };
  }
  function watchViews() {
    try {
      var obs = new MutationObserver(function () { injectReadingEntry(); injectGrammarEntry(); });
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    } catch (e) {}
  }

  /* --------------------------------------------------------------------- 启动 */
  function boot() {
    try { injectGrammarEntry(); } catch (e) {}
    try { injectReadingEntry(); } catch (e) {}
    try { autoSendToOpener(); } catch (e) {}
    watchViews();
    setTimeout(function () {
      try {
        autoCheck().then(function (r) {
          var bits = [];
          if (r.words) bits.push(r.words + " 个单词");
          if (r.records) bits.push(r.records + " 条练习记录");
          if (r.theme) bits.push("主题设置");
          if (bits.length) toast("检测到本机已有记录，已自动导入：" + bits.join("、"));
        });
      } catch (e) {}
    }, 1600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* 供调试与自动测试 */
  window.GLXImport = {
    scan: function () {
      var g = collectReadingWords();
      return {
        readingWords: g.words.length, sources: g.sources,
        grammarKeys: localKeys().filter(isGrammarKey),
        readingKeys: localKeys().filter(function (k) { return isReadingKey(k) && !isSkinKey(k); }),
        skinKeys: localKeys().filter(isSkinKey),
        state: STATE, hasBackup: !!readJSON(BAK_KEY, null)
      };
    },
    sameOriginImport: sameOriginImport,
    autoCheck: autoCheck,
    restorePracticeRecords: restorePracticeRecords,
    restoreTheme: restoreTheme,
    importPayload: importPayload,
    exportAll: exportAll,
    idbDump: idbDump,
    idbMerge: idbMerge,
    undoLast: undoLast,
    openPanel: openPanel,
    handleText: handleText,
    snippetText: snippetText
  };
})();
