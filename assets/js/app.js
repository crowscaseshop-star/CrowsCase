/* ============================================================
   app.js — โครงระบบ: เข้าสู่ระบบ / เมนู / เราเตอร์ / สิทธิ์
   ============================================================ */
(function (global) {
  'use strict';
  var $ = UI.$, $$ = UI.$$, esc = DB.esc;
  var current = 'overview';

  var App = global.App = {
    go: go, render: render, refreshBadges: refreshBadges, applySettings: applySettings, boot: boot
  };

  function boot() {
    DB.load();
    applySettings();
    var u = DB.currentUser();
    if (u) enterApp(); else showLogin();
    tickClock(); setInterval(tickClock, 30000);
  }

  /* ---------- ธีม / ข้อมูลร้าน ---------- */
  function applySettings() {
    var S = DB.state.settings;
    if (S.accent) {
      var r = document.documentElement.style;
      r.setProperty('--gold', S.accent);
      r.setProperty('--grad-gold', 'linear-gradient(135deg,' + lighten(S.accent, 40) + ' 0%,' + S.accent + ' 45%,' + lighten(S.accent, -25) + ' 100%)');
      r.setProperty('--gold-lt', lighten(S.accent, 35));
      r.setProperty('--gold-dk', lighten(S.accent, -30));
      r.setProperty('--line', hexA(S.accent, .16));
    }
    document.title = S.shopName + ' • ระบบจัดการการขาย';
    $$('[data-shopname]').forEach(function (e) { e.textContent = S.shopName; });
    $$('[data-shoplogo]').forEach(function (e) { e.textContent = S.logo; });
    $$('[data-tagline]').forEach(function (e) { e.textContent = S.tagline; });
  }
  function lighten(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, (n >> 16) + amt));
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
    var b = Math.min(255, Math.max(0, (n & 255) + amt));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------- Login ---------- */
  function showLogin() {
    $('#login').style.display = 'grid';
    $('#app').classList.remove('active');
    var f = $('#loginForm');
    f.onsubmit = function (e) {
      e.preventDefault();
      var r = DB.login($('#lgUser').value, $('#lgPass').value);
      if (!r.ok) { UI.toast(r.msg, 'err'); $('#lgPass').select(); return; }
      UI.toast('ยินดีต้อนรับ ' + r.user.name, 'ok');
      enterApp();
    };
  }

  function enterApp() {
    var u = DB.currentUser();
    $('#login').style.display = 'none';
    $('#app').classList.add('active');
    $('#meName').textContent = u.name;
    $('#meRole').textContent = (DB.ROLES[u.role] || DB.ROLES.custom).name;
    $('#meAvatar').textContent = u.name.charAt(0);
    buildNav();
    var first = DB.MENUS.filter(function (m) { return DB.canSee(m.id); })[0];
    go(DB.canSee(current) ? current : (first ? first.id : 'overview'));
  }

  /* ---------- Nav ---------- */
  function buildNav() {
    var groups = {}, order = [];
    DB.MENUS.forEach(function (m) {
      if (!DB.canSee(m.id)) return;
      if (!groups[m.group]) { groups[m.group] = []; order.push(m.group); }
      groups[m.group].push(m);
    });
    $('#nav').innerHTML = order.map(function (g) {
      return '<div class="nav-label">' + esc(g) + '</div>' + groups[g].map(function (m) {
        return '<div class="nav-item" data-menu="' + m.id + '"><span class="nav-ico">' + m.icon + '</span>' +
          '<span>' + esc(m.name) + '</span><span class="nav-badge" data-badge="' + m.id + '" style="display:none"></span></div>';
      }).join('');
    }).join('');
    $$('#nav .nav-item').forEach(function (n) {
      n.onclick = function () { go(n.dataset.menu); $('#sidebar').classList.remove('open'); };
    });
    refreshBadges();
  }

  function refreshBadges() {
    var nOrders = DB.newOrders().length;
    var nLow = DB.state.settings.lowStockAlert ? DB.lowStock().length : 0;
    setBadge('orders', nOrders);
    setBadge('stock', nLow);
    function setBadge(id, n) {
      var b = $('[data-badge="' + id + '"]');
      if (!b) return;
      if (n > 0) { b.textContent = n; b.style.display = ''; } else b.style.display = 'none';
    }
  }

  /* ---------- Router ---------- */
  function go(menu) {
    if (!DB.canSee(menu)) { UI.toast('คุณไม่มีสิทธิ์เข้าถึงเมนูนี้', 'err'); return; }
    current = menu;
    $$('#nav .nav-item').forEach(function (n) { n.classList.toggle('active', n.dataset.menu === menu); });
    var m = DB.MENUS.find(function (x) { return x.id === menu; });
    $('#pageTitle').textContent = m ? m.name : '';
    $('#pageCrumb').textContent = m ? (m.group + ' / ' + m.name) : '';
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    var el = $('#content');
    var fn = global.Views[current];
    if (!fn) { el.innerHTML = UI.empty('🚧', 'ยังไม่มีหน้านี้'); return; }
    try { fn(el); } catch (e) {
      console.error(e);
      el.innerHTML = UI.empty('⚠', 'เกิดข้อผิดพลาดในการแสดงผล', e.message);
    }
    refreshBadges();
  }

  function tickClock() {
    var c = $('#clock');
    if (!c) return;
    var d = new Date();
    c.textContent = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) +
      ' • ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- ปุ่มบนแถบบน ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    boot();
    $('#btnLogout').onclick = function () {
      UI.confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่?', 'ออกจากระบบ', function () {
        DB.logout(); Views.posReset(); location.reload();
      });
    };
    $('#menuToggle').onclick = function () { $('#sidebar').classList.toggle('open'); };
    $('#btnShop').onclick = function () { window.open('order.html', '_blank'); };
    $('#overlay').onclick = function (e) { if (e.target === this) UI.closeModal(); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.closeModal();
    });
    // ซิงก์ข้อมูลข้ามแท็บ (เช่น ลูกค้าสั่งซื้อจาก order.html ในอีกแท็บ)
    window.addEventListener('storage', function (e) {
      if (e.key === DB.KEY) { DB.load(); refreshBadges(); }
    });
  });
})(window);
