/**
 * 旧站停机公告（阅读站 / 单词站共用）
 * ------------------------------------------------------------------
 * 作用：在**旧地址**打开网站时弹一次「本站将于 2026-10-15 停止运行」的公告，
 *      给出新站网址与跳转链接，并提供「带着记录去新站」一键搬迁入口
 *      （跳到新站时带 ?migrate=1，新站的迁移向导会立即弹出并帮用户把本机记录搬过去）。
 *
 * 只在旧域名显示；新站（jimmyenglish.org）与本地开发默认不显示，避免打扰。
 * 想在本机预览：加 ?oldhost=1（例如 http://127.0.0.1:8765/Jimmy阅读机考.html?oldhost=1）
 *
 * 用法（两个站点各一行，无需改任何样式）：
 *   <script src="js/migration-notice.js" data-target="reading"></script>      阅读站
 *   <script src="migration-notice.js" data-target="vocab"></script>           单词/语法站
 * 自定域名列表：<script ... data-hosts="a.example.com,b.example.com">
 */
(function () {
  'use strict';

  var DEADLINE = '2026-10-15';                  // 旧站停止运行日期
  var NEW_SITE = 'https://jimmyenglish.org/';   // 新站
  var NEW_VOCAB = 'https://jimmyenglish.org/grammar/#/vocab';
  var STORE_KEY = 'jmmy_old_site_notice_v1';    // 记住「稍后再说」，24 小时内不再弹
  var OLD_HOSTS = [
    'jimmy-reading.netlify.app',
    'jimmy-grammar.netlify.app',
    'jimmy-library.github.io'
  ];
  var NEW_HOSTS = ['jimmyenglish.org', 'www.jimmyenglish.org'];
  var SNOOZE_MS = 24 * 60 * 60 * 1000;

  var script = document.currentScript;
  var target = (script && script.getAttribute('data-target')) || (/\/grammar\//.test(location.pathname) ? 'vocab' : 'reading');
  var extraHosts = ((script && script.getAttribute('data-hosts')) || '')
    .split(',').map(function (h) { return h.trim().toLowerCase(); }).filter(Boolean);
  var hosts = OLD_HOSTS.concat(extraHosts);

  function isOldHost() {
    if (/[?&]oldhost=1/.test(location.search)) return true;           // 本机预览用
    var h = location.hostname.toLowerCase();
    if (NEW_HOSTS.indexOf(h) >= 0) return false;
    return hosts.indexOf(h) >= 0;
  }
  function daysLeft() {
    var end = new Date(DEADLINE + 'T00:00:00');
    var now = new Date();
    var d = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    return d > 0 ? d : 0;
  }
  function snoozed() {
    try {
      var t = Number(localStorage.getItem(STORE_KEY) || 0);
      return t && (Date.now() - t) < SNOOZE_MS;
    } catch (e) { return false; }
  }
  function snooze() {
    try { localStorage.setItem(STORE_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  }

  function ensureCSS() {
    if (document.getElementById('jmnotice-style')) return;
    var css = ''
      + '.jmnotice-mask{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483600;display:flex;'
      + 'align-items:center;justify-content:center;padding:20px;font-family:"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif}'
      + '.jmnotice-card{background:#fff;border-radius:18px;max-width:520px;width:100%;box-shadow:0 24px 60px rgba(15,23,42,.28);'
      + 'overflow:hidden;animation:jmnotice-in .22s ease-out}'
      + '@keyframes jmnotice-in{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}'
      + '.jmnotice-head{background:linear-gradient(135deg,#fff7ed,#ffedd5);padding:18px 22px 14px;border-bottom:1px solid #fed7aa}'
      + '.jmnotice-head h3{margin:0;font-size:17px;color:#9a3412;font-weight:700}'
      + '.jmnotice-head p{margin:6px 0 0;font-size:13px;color:#b45309}'
      + '.jmnotice-body{padding:18px 22px;font-size:14px;line-height:1.75;color:#1f2d3d}'
      + '.jmnotice-body b{color:#b91c1c}'
      + '.jmnotice-url{display:inline-block;margin:4px 0;padding:3px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;'
      + 'font-weight:600;text-decoration:none;word-break:break-all}'
      + '.jmnotice-url:hover{background:#dbeafe}'
      + '.jmnotice-tip{margin-top:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;color:#475569}'
      + '.jmnotice-foot{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:0 22px 20px}'
      + '.jmnotice-btn{border:0;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}'
      + '.jmnotice-btn--primary{background:#2563eb;color:#fff}.jmnotice-btn--primary:hover{background:#1d4ed8}'
      + '.jmnotice-btn--ghost{background:#f1f5f9;color:#334155}.jmnotice-btn--ghost:hover{background:#e2e8f0}'
      + '.jmnotice-close{margin-left:auto;background:none;border:0;color:#94a3b8;font-size:20px;line-height:1;cursor:pointer;padding:4px 8px}'
      + '.jmnotice-count{font-size:12px;color:#94a3b8;padding:0 22px 16px}';
    var style = document.createElement('style');
    style.id = 'jmnotice-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function show() {
    if (document.querySelector('.jmnotice-mask')) return;
    ensureCSS();
    var vocab = target === 'vocab';
    var newUrl = vocab ? NEW_VOCAB : NEW_SITE;
    var migrateUrl = (vocab ? 'https://jimmyenglish.org/grammar/' : NEW_SITE) + '?migrate=1';
    var left = daysLeft();

    var mask = document.createElement('div');
    mask.className = 'jmnotice-mask';
    mask.innerHTML = ''
      + '<div class="jmnotice-card" role="dialog" aria-modal="true" aria-label="站点迁移公告">'
      + '  <div class="jmnotice-head">'
      + '    <h3>🚚 本站即将停止运行，请改用新地址</h3>'
      + '    <p>旧地址将于 <b>' + DEADLINE + '</b> 停止运行' + (left ? '（还剩 ' + left + ' 天）' : '') + '</p>'
      + '  </div>'
      + '  <div class="jmnotice-body">'
      + '    <div>新站（内容一样，速度更快）：</div>'
      + '    <a class="jmnotice-url" href="' + newUrl + '">' + newUrl + '</a>'
      + '    <div class="jmnotice-tip">'
      + (vocab
        ? '你的单词进度、错题与收藏都记在这个浏览器里。点下面的「带着记录去新站」，新站会引导你把记录搬过去，搬完照旧接着背。'
        : '你的练习记录、错题和皮肤设置都记在这个浏览器里。点下面的「带着记录去新站」，新站会引导你把记录搬过去（只增不减，不会覆盖）。')
      + '    </div>'
      + '  </div>'
      + '  <div class="jmnotice-foot">'
      + '    <button class="jmnotice-btn jmnotice-btn--primary" data-go="migrate">📦 带着记录去新站</button>'
      + '    <button class="jmnotice-btn jmnotice-btn--ghost" data-go="site">先去新站看看</button>'
      + '    <button class="jmnotice-close" data-go="later" title="稍后再说" aria-label="关闭">×</button>'
      + '  </div>'
      + '  <div class="jmnotice-count">选「×」表示稍后再说，24 小时内不再提示。</div>'
      + '</div>';
    document.body.appendChild(mask);

    function close() { mask.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') { snooze(); close(); } }
    document.addEventListener('keydown', onKey);

    mask.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-go]');
      if (btn) {
        var go = btn.getAttribute('data-go');
        if (go === 'later') { snooze(); close(); return; }
        if (go === 'migrate') {
          try { localStorage.setItem(STORE_KEY, String(Date.now())); } catch (err) { /* ignore */ }
          location.href = migrateUrl;
          return;
        }
        if (go === 'site') { location.href = newUrl; return; }
      }
      if (e.target === mask) { snooze(); close(); }     // 点遮罩也算稍后
    });
  }

  function boot() {
    if (!isOldHost() || snoozed()) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', show, { once: true }); return; }
    setTimeout(show, 900);       // 让页面先渲染出来，别抢首屏
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.JMNotify = { show: show, isOldHost: isOldHost, daysLeft: daysLeft, DEADLINE: DEADLINE, target: target };
})();
