/* ============================================================
   shop.js — สคริปต์กลางของเว็บไซต์ลูกค้า (ใช้ร่วมกันทุกหน้า)
   หน้าไหนกำลังแสดงอยู่ ดูจาก <body data-page="home|shop|about">
   - home  : order.html  — โชว์สินค้าเด่นที่ตั้งไว้ในแดชบอร์ด
   - shop  : shop.html   — สินค้าที่เปิดขายทั้งหมด
   - about : about.html  — เกี่ยวกับเรา + ติดต่อ (หน้าเดียวกัน)
   ตะกร้าเก็บใน localStorage จึงติดตามไปทุกหน้า
   ============================================================ */
(function () {
  'use strict';
  var $ = UI.$, $$ = UI.$$, esc = DB.esc, money = DB.money;
  var T = function (k, v) { return I18N.t(k, v); };
  var PAGE = document.body.dataset.page || 'home';
  var CART_KEY = 'crowscase_cart';

  DB.load();
  var S = DB.state.settings;
  function cur() { return S.currency || '฿'; }

  /* ---------- ตะกร้า (ใช้ร่วมทุกหน้า) ---------- */
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { cart = []; }
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter(function (c) { return c && DB.product(c.pid); });
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { } }

  /* ================= ส่วนที่ใช้ร่วมทุกหน้า ================= */
  function paintLangSwitch() {
    var box = $('#langSwitch'); if (!box) return;
    box.innerHTML = I18N.LANGS.map(function (l) {
      return '<button class="lang-btn ' + (I18N.get() === l.id ? 'active' : '') + '" data-lang="' + l.id +
        '" title="' + esc(l.label) + '" aria-pressed="' + (I18N.get() === l.id) + '">' + esc(l.short) + '</button>';
    }).join('');
    $$('#langSwitch .lang-btn').forEach(function (b) {
      b.onclick = function () {
        if (I18N.get() === b.dataset.lang) return;
        I18N.set(b.dataset.lang); UI.closeModal(); renderAll();
      };
    });
  }

  function paintNav() {
    var active = PAGE;
    if (PAGE === 'about' && location.hash === '#contact') active = 'contact';
    $$('[data-nav]').forEach(function (l) { l.classList.toggle('active', l.dataset.nav === active); });
  }

  function paintBrand() {
    S = DB.state.settings;
    $$('[data-shopname]').forEach(function (e) { e.textContent = S.shopName; });
    $$('[data-tagline]').forEach(function (e) { e.textContent = S.tagline; });
    UI.paintLogos();
    var titles = { home: S.tagline, shop: T('shopTitle'), about: T('navAbout') + ' & ' + T('navContact') };
    document.title = S.shopName + ' — ' + titles[PAGE];
    if ($('#footInfo')) $('#footInfo').textContent =
      S.address + ' • ' + T('ctPhoneLb') + ' ' + S.phone + (S.line ? ' • LINE ' + S.line : '');
    if ($('#footNote')) $('#footNote').textContent = S.openHours + ' — ' + S.orderFooter;
    if (S.accent) {
      var lighten = function (hex, amt) {
        var n = parseInt(hex.slice(1), 16);
        var r = Math.min(255, Math.max(0, (n >> 16) + amt));
        var g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
        var b = Math.min(255, Math.max(0, (n & 255) + amt));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      };
      var rs = document.documentElement.style;
      rs.setProperty('--gold', S.accent);
      rs.setProperty('--gold-lt', lighten(S.accent, 35));
      rs.setProperty('--gold-dk', lighten(S.accent, -30));
      rs.setProperty('--grad-gold', 'linear-gradient(135deg,' + lighten(S.accent, 40) + ' 0%,' + S.accent + ' 45%,' + lighten(S.accent, -25) + ' 100%)');
    }
  }

  /* ข้อความประจำหน้าเว็บ (ทุก element ที่มี data-t) */
  function paintStatic() {
    $$('[data-t]').forEach(function (e) { e.textContent = T(e.dataset.t); });
    $$('[data-tph]').forEach(function (e) { e.placeholder = T(e.dataset.tph); });
    if ($('#fabLabel')) $('#fabLabel').textContent = T('cartFab');
    if ($('#trustBox')) {
      $('#trustBox').innerHTML = [1, 2, 3].map(function (i) {
        return '<div class="trust-item"><div class="ic">' + ['◆', '✦', '☗'][i - 1] + '</div>' +
          '<b>' + esc(T('trust' + i + 'T')) + '</b><span>' + esc(T('trust' + i + 'D')) + '</span></div>';
      }).join('');
    }
    if ($('#stepsBox')) {
      $('#stepsBox').innerHTML = [1, 2, 3].map(function (i) {
        return '<div><div style="font-size:26px;color:var(--gold)">' + ['①', '②', '③'][i - 1] + '</div>' +
          '<b>' + esc(T('step' + i + 'T')) + '</b>' +
          '<div style="font-size:12.5px;color:var(--muted);line-height:1.8">' + esc(T('step' + i + 'D')) + '</div></div>';
      }).join('');
    }
  }

  /* ================= หน้าแรก ================= */
  function paintHome() {
    var p = DB.featured();
    $('#heroBadge').textContent = I18N.s('heroBadge') || '';
    $('#heroTitle').textContent = I18N.s('heroTitle') || '';
    $('#heroText').textContent = I18N.s('heroText') || '';
    $('#heroBuy').textContent = I18N.s('heroCta') || T('btnBuy');

    if (!p) {
      $('#heroPrice').innerHTML = '';
      $('#heroImage').innerHTML = '<span class="ico">📦</span>';
      $('#heroBuy').style.display = 'none';
      return;
    }
    $('#heroPrice').innerHTML =
      '<span class="now">' + cur() + money(p.price) + '</span>' +
      '<span class="nm">' + esc(p.name) + '</span>' +
      (p.qty > 0 ? '<span class="badge b-ok">' + esc(T('heroReady')) + '</span>'
                 : '<span class="badge b-danger">' + esc(T('heroSoldOut')) + '</span>');
    $('#heroImage').innerHTML =
      (p.imageType === 'url' && p.image
        ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">'
        : '<span class="ico">' + esc(p.image || '📦') + '</span>') +
      '<div class="feature-tag"><b style="color:var(--gold-lt)">' + esc(p.category) + '</b>' +
      '<span style="color:var(--muted-2)"> • ' + esc(T('heroCode')) + ' ' + esc(p.sku) + '</span></div>';
    $('#heroBuy').style.display = '';
    $('#heroBuy').disabled = p.qty <= 0;
    $('#heroBuy').onclick = function () { add(p.id); openCart(); };
  }

  /* ================= เลือกซื้อ ================= */
  var filter = { cat: 'all', q: '' };

  function drawCats() {
    var box = $('#cats'); if (!box) return;
    var cats = ['all'].concat(DB.state.categories.filter(function (c) {
      return DB.state.products.some(function (p) { return p.active && p.category === c; });
    }));
    box.innerHTML = cats.map(function (c) {
      return '<span class="chip ' + (filter.cat === c ? 'active' : '') + '" data-c="' + esc(c) + '">' +
        (c === 'all' ? esc(T('catAll')) : esc(c)) + '</span>';
    }).join('');
    $$('#cats .chip').forEach(function (c) {
      c.onclick = function () { filter.cat = c.dataset.c; drawCats(); drawGrid(); };
    });
  }
  function items() {
    var q = filter.q.trim().toLowerCase();
    return DB.state.products.filter(function (p) {
      if (!p.active) return false;                       // แสดงเฉพาะสินค้าที่เปิดขาย
      if (filter.cat !== 'all' && p.category !== filter.cat) return false;
      if (q && (p.name + ' ' + p.category).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function drawGrid() {
    var box = $('#grid'); if (!box) return;
    var list = items(), all = DB.state.products.filter(function (p) { return p.active; });
    if ($('#shopCount')) {
      $('#shopCount').textContent = list.length + ' / ' + all.length;
    }
    if (!list.length) { box.innerHTML = UI.empty('🔍', T('noResult'), T('noResultSub')); return; }
    var feat = DB.featured();
    box.innerHTML = list.map(function (p) {
      var out = p.qty <= 0;
      var inCart = cart.find(function (c) { return c.pid === p.id; });
      return '<div class="prod" style="cursor:default">' +
        (out ? '<span class="badge b-danger tag-out">' + esc(T('tagSoldOut')) + '</span>'
             : (feat && feat.id === p.id ? '<span class="badge b-gold tag-out">' + esc(T('tagRecommend')) + '</span>' : '')) +
        '<div class="prod-img" style="height:160px;font-size:56px">' +
          (p.imageType === 'url' && p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : esc(p.image || '📦')) + '</div>' +
        '<div class="prod-body" style="padding:13px">' +
          '<div style="font-size:10.5px;letter-spacing:1.2px;color:var(--muted-2);text-transform:uppercase">' + esc(p.category) + '</div>' +
          '<div class="prod-nm" style="height:auto;margin:5px 0 9px;font-size:13.5px">' + esc(p.name) + '</div>' +
          '<div class="prod-price" style="font-size:18px;margin-bottom:11px">' + cur() + money(p.price) + '</div>' +
          (out ? '<button class="btn btn-sm btn-block" disabled>' + esc(T('btnSoldOut')) + '</button>'
               : '<button class="btn btn-sm ' + (inCart ? '' : 'btn-gold') + ' btn-block" data-add="' + p.id + '">' +
                 (inCart ? esc(T('btnPicked')) + ' (' + inCart.qty + ')' : esc(T('btnBuy'))) + '</button>') +
        '</div></div>';
    }).join('');
    $$('[data-add]').forEach(function (b) { b.onclick = function () { add(b.dataset.add); }; });
  }

  /* ================= เกี่ยวกับ + ติดต่อ ================= */
  function paintAbout() {
    $('#aboutTitle').textContent = I18N.s('aboutTitle') || '';
    $('#aboutEst').textContent = S.founded ? T('aboutEst', { year: S.founded }) : '';
    $('#aboutBody').innerHTML = String(I18N.s('aboutText') || '').split(/\n\s*\n/).map(function (t) {
      return '<p>' + esc(t.trim()).replace(/\n/g, '<br>') + '</p>';
    }).join('');
    var pts = S.aboutPoints || [];
    $('#aboutPoints').innerHTML = pts.filter(function (p) { return p && p.t; }).map(function (p, i) {
      return '<div class="trust-item"><div class="ic">' + ['◆', '✦', '☗'][i % 3] + '</div>' +
        '<b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></div>';
    }).join('');
  }

  function paintContact() {
    var cards = [];
    if (S.line) cards.push({
      href: S.lineUrl || ('https://line.me/R/ti/p/' + encodeURIComponent(S.line)),
      ic: '💬', lb: T('ctLineLb'), vl: S.line, sb: T('ctLineSb')
    });
    if (S.facebook || S.facebookUrl) cards.push({
      href: S.facebookUrl || ('https://www.facebook.com/search/top?q=' + encodeURIComponent(S.facebook)),
      ic: '📘', lb: T('ctFbLb'), vl: S.facebook || T('ctFbFallback'), sb: T('ctFbSb')
    });
    if (S.phone) cards.push({
      href: 'tel:' + String(S.phone).replace(/[^0-9+]/g, ''),
      ic: '📞', lb: T('ctPhoneLb'), vl: S.phone, sb: T('ctPhoneSb')
    });
    if (S.email) cards.push({
      href: 'mailto:' + S.email, ic: '✉', lb: T('ctMailLb'), vl: S.email, sb: T('ctMailSb')
    });
    $('#contactCards').innerHTML = cards.map(function (c) {
      return '<a class="contact-card" href="' + esc(c.href) + '" target="_blank" rel="noopener">' +
        '<div class="ic">' + c.ic + '</div><div class="lb">' + esc(c.lb) + '</div>' +
        '<div class="vl">' + esc(c.vl) + '</div><div class="sb">' + esc(c.sb) + '</div></a>';
    }).join('');
    $('#contactInfo').innerHTML =
      box(T('infoAddr'), esc(S.address) + (S.mapUrl ? '<br><a href="' + esc(S.mapUrl) + '" target="_blank" rel="noopener">' + esc(T('openMap')) + '</a>' : '')) +
      box(T('infoHours'), esc(S.openHours)) +
      box(T('infoOnline'), esc(T('infoOnlineV')));
    function box(l, v) {
      return '<div class="info-box"><div class="lb">' + esc(l) + '</div><div class="vl">' + v + '</div></div>';
    }
  }

  /* ================= ตะกร้า & สั่งซื้อ ================= */
  function add(pid) {
    var p = DB.product(pid); if (!p) return;
    if (p.qty <= 0) return UI.toast(T('soldOutToast'), 'warn');
    var l = cart.find(function (c) { return c.pid === pid; });
    if (l) l.qty++;
    else cart.push({ pid: p.id, name: p.name, image: p.image, imageType: p.imageType, price: p.price, qty: 1 });
    saveCart();
    UI.toast(T('addedToast', { name: p.name }), 'ok', 1500);
    drawGrid(); drawFab();
  }
  function drawFab() {
    var f = $('#fab'); if (!f) return;
    var n = cart.reduce(function (a, c) { return a + c.qty; }, 0);
    f.style.display = n ? 'flex' : 'none';
    $('#fabN').textContent = n;
  }

  function openCart() {
    if (!cart.length) return;
    var total = cart.reduce(function (a, c) { return a + c.price * c.qty; }, 0);
    UI.modal({
      title: T('cartTitle'), wide: true,
      body:
        '<div class="sec-title">' + esc(T('cartItems')) + '</div>' +
        '<div id="cartBox">' + cart.map(function (c, i) {
          return '<div class="ci">' + UI.imgHtml(c, 'ci-ico') +
            '<div style="flex:1;min-width:0"><div class="ci-nm">' + esc(c.name) + '</div>' +
            '<div class="ci-pr">' + cur() + money(c.price) + ' × ' + c.qty + '</div></div>' +
            '<div class="qty-ctl"><button class="qbtn" data-m="-" data-i="' + i + '">−</button>' +
            '<span class="qn">' + c.qty + '</span>' +
            '<button class="qbtn" data-m="+" data-i="' + i + '">+</button>' +
            '<button class="qbtn" data-m="x" data-i="' + i + '" style="color:#e0574f">×</button></div></div>';
        }).join('') + '</div>' +
        '<div class="sumline total" style="margin-bottom:20px"><span>' + esc(T('cartTotal')) + '</span><b>' + cur() + money(total) + '</b></div>' +
        '<div class="sec-title">' + esc(T('cartInfo')) + '</div>' +
        '<div class="row">' +
          '<div class="field"><label>' + esc(T('fName')) + ' <span class="req">*</span></label>' +
            '<input class="input" id="cName" placeholder="' + esc(T('fNamePh')) + '"></div>' +
          '<div class="field"><label>' + esc(T('fPhone')) + ' <span class="req">*</span></label>' +
            '<input class="input" id="cPhone" type="tel" placeholder="' + esc(T('fPhonePh')) + '"></div>' +
        '</div>' +
        '<div class="field"><label>' + esc(T('fNote')) + '</label>' +
          '<textarea class="input" id="cNote" rows="3" placeholder="' + esc(T('fNotePh')) + '"></textarea></div>' +
        '<div class="tip"><span class="i">🔒</span><div>' + T('privacy') + '</div></div>',
      footHtml: '<button class="btn btn-ghost" data-close>' + esc(T('btnCancel')) + '</button>' +
        '<button class="btn btn-gold" id="mdOk">' + esc(T('submitOrder')) + '</button>',
      onRender: function (ov) {
        $$('.qbtn', ov).forEach(function (b) {
          b.onclick = function () {
            var i = +b.dataset.i;
            if (b.dataset.m === '+') cart[i].qty++;
            else if (b.dataset.m === '-') { cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); }
            else cart.splice(i, 1);
            saveCart(); UI.closeModal(); drawGrid(); drawFab();
            if (cart.length) openCart();
          };
        });
      },
      onOk: function (ov) {
        var n = $('#cName', ov).value.trim(), p = $('#cPhone', ov).value.trim();
        if (!n) { UI.toast(T('errName'), 'err'); return false; }
        if (!/^[0-9+\-\s()]{8,20}$/.test(p)) { UI.toast(T('errPhone'), 'err'); return false; }
        var o = DB.placeOrder({ name: n, phone: p, note: $('#cNote', ov).value.trim(), items: cart.slice() });
        cart = []; saveCart(); drawGrid(); drawFab(); UI.closeModal();
        thanks(o);
        return false;
      }
    });
  }

  function thanks(o) {
    UI.modal({
      title: T('thanksTitle'),
      body: '<div style="text-align:center;padding:8px 0 4px">' +
        '<div style="font-size:52px">✅</div>' +
        '<h3 style="margin:10px 0 6px">' + esc(T('thanksHi', { name: o.name })) + '</h3>' +
        '<p style="color:var(--muted);line-height:1.8">' + esc(T('thanksOrderNo')) + ' <b class="gold-text">' + esc(o.code) + '</b><br>' +
        esc(T('thanksCallback', { phone: o.phone })) + '<br>' +
        esc(T('thanksTotal')) + ' <b>' + cur() + money(o.total) + '</b></p>' +
        '<div class="tip" style="text-align:left;margin-top:18px"><span class="i">📞</span><div>' +
        esc(T('thanksUrgent')) + ' <b>' + esc(S.phone) + '</b>' +
        (S.line ? ' • LINE <b>' + esc(S.line) + '</b>' : '') + '</div></div></div>',
      footHtml: '<button class="btn btn-gold" data-close>' + esc(T('thanksBtn')) + '</button>'
    });
  }

  /* ================= เริ่มทำงาน ================= */
  if ($('#q')) $('#q').oninput = function () { filter.q = this.value; drawGrid(); };
  if ($('#fab')) $('#fab').onclick = openCart;
  $('#overlay').onclick = function (e) { if (e.target === this) UI.closeModal(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UI.closeModal(); });
  window.addEventListener('hashchange', paintNav);
  window.addEventListener('storage', function (e) {
    if (e.key === DB.KEY) { DB.load(); renderAll(); }   // แดชบอร์ดแก้ข้อมูล → หน้าเว็บอัปเดตตาม
  });

  function renderAll() {
    paintLangSwitch(); paintNav(); paintBrand(); paintStatic();
    if (PAGE === 'home') paintHome();
    if (PAGE === 'shop') { drawCats(); drawGrid(); }
    if (PAGE === 'about') { paintAbout(); paintContact(); }
    drawFab();
  }
  renderAll();

  /* เชื่อม Supabase (ถ้าตั้งค่าไว้): ดึงสินค้า/ตั้งค่าล่าสุด และรับอัปเดตเรียลไทม์
     ทางร้านแก้ราคาหรือสต๊อกในแดชบอร์ด หน้าเว็บลูกค้าจะเปลี่ยนตามทันทีโดยไม่ต้องรีเฟรช */
  if (window.Cloud && Cloud.configured()) {
    Cloud.init({
      mode: 'public',
      onChange: function () {
        cart = cart.filter(function (c) { return DB.product(c.pid); });
        saveCart(); renderAll();
      }
    }).then(function () { renderAll(); })
      .catch(function (e) { console.warn('[cloud]', e); });
  }
})();
