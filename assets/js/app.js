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
    tickClock(); setInterval(tickClock, 30000);

    /* ยังไม่ได้ตั้งค่า Supabase → ทำงานแบบเดิม (ข้อมูลอยู่ในเครื่อง) */
    if (!global.Cloud || !Cloud.configured()) {
      paintCloudStatus('local');
      var u = DB.currentUser();
      if (u) enterApp(); else showLogin();
      return;
    }

    showLogin();
    $('#loginBusy').style.display = '';
    Cloud.init({ mode: 'admin', onChange: onCloudChange, onStatus: paintCloudStatus })
      .then(function (st) {
        $('#loginBusy').style.display = 'none';
        if (st !== 'online') { applySettings(); return; }
        return Cloud.session().then(function (ses) {
          var uid = ses && ses.user && ses.user.id;
          var me = DB.state.users.find(function (x) { return x.id === uid; });
          if (me && me.active) { DB.setSession(uid); applySettings(); enterApp(); }
          else if (uid) {
            UI.toast('บัญชีนี้ยังไม่ถูกตั้งเป็นพนักงานในระบบ — ติดต่อเจ้าของร้าน', 'err', 6000);
            Cloud.signOut();
          }
        });
      })
      .catch(function (e) {
        $('#loginBusy').style.display = 'none';
        UI.toast('เชื่อมต่อ Supabase ไม่สำเร็จ: ' + e.message, 'err', 6000);
      });
  }

  /* มีข้อมูลใหม่จากเครื่องอื่น → วาดหน้าจอใหม่ */
  var rerenderTimer = null;
  function onCloudChange(table) {
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(function () {
      if (!$('#app').classList.contains('active')) return;
      applySettings(); render(); refreshBadges();
      if (table === 'orders') {
        var n = DB.newOrders().length;
        if (n) UI.toast('มีออเดอร์ออนไลน์เข้าใหม่ • รอติดต่อ ' + n + ' รายการ', 'warn', 4000);
      }
    }, 220);
  }

  /* ป้ายสถานะการเชื่อมต่อบนแถบบน */
  function paintCloudStatus(st, err) {
    var el = $('#cloudStatus'); if (!el) return;
    var map = {
      local: ['b-mute', '● ข้อมูลในเครื่อง', 'ยังไม่ได้เชื่อม Supabase — ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น'],
      connecting: ['b-warn', '● กำลังเชื่อมต่อ…', 'กำลังเชื่อมต่อ Supabase'],
      online: ['b-ok', '● เรียลไทม์', 'เชื่อมต่อ Supabase แล้ว ข้อมูลอัปเดตอัตโนมัติทุกเครื่อง'],
      signedout: ['b-mute', '● ยังไม่เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบ'],
      error: ['b-danger', '● เชื่อมต่อไม่ได้', err || 'เชื่อมต่อ Supabase ไม่สำเร็จ']
    };
    var m = map[st] || map.local;
    el.className = 'badge ' + m[0];
    el.textContent = m[1];
    el.title = m[2];
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
    UI.paintLogos();
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
    var cloud = global.Cloud && Cloud.configured();
    $('#login').style.display = 'grid';
    $('#app').classList.remove('active');

    /* ปรับฟอร์มตามระบบล็อกอินที่ใช้อยู่ */
    $('#lgUserLabel').textContent = cloud ? 'อีเมล' : 'ชื่อผู้ใช้';
    $('#lgUser').type = cloud ? 'email' : 'text';
    $('#lgUser').placeholder = cloud ? 'you@example.com' : 'admin';
    $('#lgUser').autocomplete = cloud ? 'email' : 'username';
    $('#loginHintLocal').style.display = cloud ? 'none' : '';
    $('#loginHintCloud').style.display = cloud ? '' : 'none';
    $('#lgForgot').style.display = cloud ? '' : 'none';

    var f = $('#loginForm');
    f.onsubmit = function (e) {
      e.preventDefault();
      var user = $('#lgUser').value, pass = $('#lgPass').value;

      if (!cloud) {
        var r = DB.login(user, pass);
        if (!r.ok) { UI.toast(r.msg, 'err'); $('#lgPass').select(); return; }
        UI.toast('ยินดีต้อนรับ ' + r.user.name, 'ok');
        enterApp();
        return;
      }

      $('#loginBusy').style.display = '';
      Cloud.signIn(user, pass).then(function (res) {
        if (!res.ok) { $('#loginBusy').style.display = 'none'; UI.toast(res.msg, 'err'); $('#lgPass').select(); return; }
        return Cloud.afterLogin().then(function () {
          $('#loginBusy').style.display = 'none';
          var me = DB.state.users.find(function (x) { return x.id === res.user.id; });
          if (!me) { UI.toast('บัญชีนี้ยังไม่ถูกตั้งเป็นพนักงานในระบบ', 'err', 6000); Cloud.signOut(); return; }
          if (!me.active) { UI.toast('บัญชีนี้ถูกระงับการใช้งาน', 'err'); Cloud.signOut(); return; }
          me.lastLogin = DB.nowISO();
          DB.log(me, 'เข้าสู่ระบบ', '');
          DB.setSession(me.id);
          applySettings();
          UI.toast('ยินดีต้อนรับ ' + me.name, 'ok');
          enterApp();
        });
      }).catch(function (e) {
        $('#loginBusy').style.display = 'none';
        UI.toast('เข้าสู่ระบบไม่สำเร็จ: ' + e.message, 'err', 5000);
      });
    };

    $('#lgForgot').onclick = function (ev) {
      ev.preventDefault();
      var email = ($('#lgUser').value || '').trim();
      if (!email) return UI.toast('กรอกอีเมลก่อน แล้วกดลิงก์นี้อีกครั้ง', 'warn');
      var sb = Cloud.client();
      if (!sb) return UI.toast('ยังเชื่อมต่อ Supabase ไม่ได้', 'err');
      sb.auth.resetPasswordForEmail(email).then(function (r) {
        if (r.error) UI.toast(r.error.message, 'err');
        else UI.toast('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ' + email + ' แล้ว', 'ok', 5000);
      });
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
        DB.logout(); Views.posReset();
        if (global.Cloud && Cloud.configured()) {
          Cloud.signOut().then(function () { location.reload(); });
        } else location.reload();
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
