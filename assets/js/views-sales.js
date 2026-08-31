/* ============================================================
   views-sales.js — ภาพรวม / รายการขาย (POS) / ประวัติการขาย
   ============================================================ */
(function (global) {
  'use strict';
  var $ = UI.$, $$ = UI.$$, esc = DB.esc, money = DB.money;
  var V = global.Views = global.Views || {};

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysAgo(n) { var d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; }
  function cur() { return DB.state.settings.currency || '฿'; }

  /* ==========================================================
     1) ภาพรวม
     ========================================================== */
  V.overview = function (el) {
    var S = DB.state, sales = DB.activeSales();
    var t0 = startOfDay(new Date()).toISOString();
    var today = sales.filter(function (s) { return s.ts >= t0; });
    var y0 = daysAgo(1).toISOString();
    var yest = sales.filter(function (s) { return s.ts >= y0 && s.ts < t0; });
    var m0 = new Date(); m0.setDate(1); m0 = startOfDay(m0).toISOString();
    var month = sales.filter(function (s) { return s.ts >= m0; });

    var todaySum = DB.sumTotal(today), yestSum = DB.sumTotal(yest);
    var diff = yestSum ? ((todaySum - yestSum) / yestSum * 100) : 0;
    var showCost = DB.can('report.cost');
    var low = DB.lowStock(), waiting = DB.newOrders();

    /* --- กราฟ 14 วัน --- */
    var chartData = [];
    for (var i = 13; i >= 0; i--) {
      var d = daysAgo(i), n = daysAgo(i - 1);
      var list = sales.filter(function (s) { return s.ts >= d.toISOString() && s.ts < n.toISOString(); });
      chartData.push({ label: d.getDate() + '/' + (d.getMonth() + 1), v: DB.sumTotal(list) });
    }

    /* --- Top 5 สินค้าขายดี 30 วัน --- */
    var d30 = daysAgo(29).toISOString();
    var agg = {};
    sales.filter(function (s) { return s.ts >= d30; }).forEach(function (s) {
      s.items.forEach(function (it) {
        if (!agg[it.pid]) agg[it.pid] = { name: it.name, image: it.image, imageType: it.imageType, qty: 0, amt: 0, profit: 0 };
        agg[it.pid].qty += it.qty; agg[it.pid].amt += it.price * it.qty;
        agg[it.pid].profit += (it.price - (it.cost || 0)) * it.qty;
      });
    });
    var top = Object.keys(agg).map(function (k) { var o = agg[k]; o.pid = k; return o; })
      .sort(function (a, b) { return b.amt - a.amt; });
    var maxAmt = top.length ? top[0].amt : 1;

    /* --- คำแนะนำสินค้าที่ควรมี/ควรสั่งเพิ่ม --- */
    var recs = buildRecommendations(agg, 30);

    /* --- สัดส่วนช่องทาง --- */
    var byCh = {};
    month.forEach(function (s) { byCh[s.channel] = (byCh[s.channel] || 0) + s.total; });
    var chColors = ['#d4af37', '#6aa5e0', '#4fbf82', '#e0a33a'];
    var chParts = Object.keys(byCh).map(function (k, i) { return { label: k, v: byCh[k], color: chColors[i % 4] }; });
    var byPay = {};
    month.forEach(function (s) { byPay[s.method] = (byPay[s.method] || 0) + s.total; });

    el.innerHTML =
      /* KPI */
      '<div class="grid g-4 mb16">' +
        kpi('ยอดขายวันนี้', cur() + money(todaySum), 'gold',
          (yestSum ? '<span class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '▲' : '▼') + ' ' +
            Math.abs(diff).toFixed(1) + '%</span> เทียบเมื่อวาน' : 'ยังไม่มียอดเปรียบเทียบ'), '💰') +
        kpi('ยอดขายเดือนนี้', cur() + money(DB.sumTotal(month)), '', month.length + ' บิล • เฉลี่ย ' +
          cur() + money(month.length ? DB.sumTotal(month) / month.length : 0) + '/บิล', '📈') +
        (showCost
          ? kpi('กำไรขั้นต้นเดือนนี้', cur() + money(DB.sumProfit(month)), '',
            'อัตรากำไร ' + (DB.sumTotal(month) ? (DB.sumProfit(month) / DB.sumTotal(month) * 100).toFixed(1) : 0) + '%', '💎')
          : kpi('จำนวนบิลวันนี้', today.length + ' บิล', '', 'สินค้าที่ขายได้ ' +
            today.reduce(function (a, s) { return a + s.items.reduce(function (x, i) { return x + i.qty; }, 0); }, 0) + ' ชิ้น', '🧾')) +
        kpi('ต้องจัดการด่วน', (waiting.length + low.length) + ' รายการ', '',
          '<span class="' + (waiting.length ? 'down' : '') + '">ออเดอร์รอติดต่อ ' + waiting.length + '</span> • สินค้าใกล้หมด ' + low.length, '🔔') +
      '</div>' +

      /* แจ้งเตือน */
      ((waiting.length || low.length)
        ? '<div class="grid g-2 mb16">' +
            (waiting.length ? alertCard('✦', 'มีออเดอร์ออนไลน์รอติดต่อกลับ ' + waiting.length + ' รายการ',
              waiting.slice(0, 3).map(function (o) { return esc(o.name) + ' (' + esc(o.phone) + ') • ' + cur() + money(o.total); }).join('<br>'),
              'orders', 'ไปที่ Order Online') : '') +
            (low.length ? alertCard('▤', 'สินค้าใกล้หมด / หมดสต๊อก ' + low.length + ' รายการ',
              low.slice(0, 3).map(function (p) { return esc(p.name) + ' — เหลือ ' + p.qty + ' ' + esc(p.unit); }).join('<br>'),
              'stock', 'ไปที่สต๊อกสินค้า') : '') +
          '</div>' : '') +

      /* กราฟ + Top5 */
      '<div class="grid g-32 mb16">' +
        '<div class="card gold-edge"><div class="card-head"><h3>ยอดขาย 14 วันล่าสุด</h3>' +
          '<div class="sp"><span class="badge b-mute">รวม ' + cur() + money(chartData.reduce(function (a, c) { return a + c.v; }, 0)) + '</span></div></div>' +
          UI.barChart(chartData) + '</div>' +
        '<div class="card"><div class="card-head"><h3>สินค้าขายดี 30 วัน</h3></div>' +
          (top.length ? top.slice(0, 6).map(function (t, i) {
            return '<div class="rank"><span class="rank-no">' + (i + 1) + '</span>' + UI.imgHtml(t) +
              '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.name) + '</div>' +
              '<div class="rank-bar"><i style="width:' + (t.amt / maxAmt * 100).toFixed(0) + '%"></i></div></div>' +
              '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--gold-lt)">' + cur() + DB.moneyShort(t.amt) + '</div>' +
              '<div style="font-size:11px;color:var(--muted-2)">' + t.qty + ' ชิ้น</div></div></div>';
          }).join('') : UI.empty('📊', 'ยังไม่มีข้อมูลการขาย')) +
        '</div>' +
      '</div>' +

      /* คำแนะนำ */
      '<div class="card gold-edge mb16"><div class="card-head"><h3>◆ แนะนำ: สินค้าที่ควรมี & ควรเร่งขาย</h3>' +
        '<div class="sp"><span class="badge b-gold">วิเคราะห์จากยอดขาย 30 วัน</span></div></div>' +
        recs.html + '</div>' +

      /* สัดส่วน */
      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>สัดส่วนช่องทางการขาย (เดือนนี้)</h3></div>' +
          (chParts.length ? '<div class="flex" style="gap:22px"><div>' + UI.donut(chParts) + '</div><div style="flex:1">' +
            chParts.map(function (p) {
              return '<div class="sumline"><span><i style="width:10px;height:10px;border-radius:3px;display:inline-block;background:' + p.color + ';margin-right:7px"></i>' + esc(p.label) + '</span>' +
                '<b style="color:var(--text)">' + cur() + money(p.v) + '</b></div>';
            }).join('') + '</div></div>' : UI.empty('🧭', 'ยังไม่มีข้อมูล')) + '</div>' +
        '<div class="card"><div class="card-head"><h3>วิธีชำระเงินยอดนิยม (เดือนนี้)</h3></div>' +
          (Object.keys(byPay).length ? Object.keys(byPay).sort(function (a, b) { return byPay[b] - byPay[a]; }).map(function (k) {
            var pct = DB.sumTotal(month) ? byPay[k] / DB.sumTotal(month) * 100 : 0;
            return '<div style="margin-bottom:13px"><div class="sumline" style="margin-bottom:4px"><span>' + esc(k) + '</span>' +
              '<b style="color:var(--text)">' + cur() + money(byPay[k]) + ' <span style="color:var(--muted-2);font-weight:400">(' + pct.toFixed(0) + '%)</span></b></div>' +
              '<div class="rank-bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
          }).join('') : UI.empty('💳', 'ยังไม่มีข้อมูล')) + '</div>' +
      '</div>';

    $$('[data-goto]', el).forEach(function (b) { b.onclick = function () { App.go(b.dataset.goto); }; });
  };

  function kpi(label, val, cls, delta, ico) {
    return '<div class="kpi"><div class="lbl">' + ico + ' ' + esc(label) + '</div>' +
      '<div class="val ' + (cls || '') + '">' + val + '</div><div class="delta">' + delta + '</div></div>';
  }
  function alertCard(ico, title, body, goto, btn) {
    return '<div class="card" style="border-color:rgba(212,175,55,.3)"><div class="flex" style="align-items:flex-start">' +
      '<span style="font-size:22px;color:var(--gold)">' + ico + '</span>' +
      '<div style="flex:1"><div style="font-weight:700;margin-bottom:6px">' + esc(title) + '</div>' +
      '<div style="font-size:12.5px;color:var(--muted);line-height:1.7">' + body + '</div></div></div>' +
      '<button class="btn btn-sm btn-gold mt16" data-goto="' + goto + '">' + esc(btn) + ' →</button></div>';
  }

  /* คำแนะนำอัตโนมัติ: ควรสั่งเพิ่ม / ควรเร่งระบาย / ควรเพิ่มสินค้าในหมวดที่ขายดี */
  function buildRecommendations(agg, days) {
    var S = DB.state, showCost = DB.can('report.cost');
    var restock = [], slow = [], push = [];

    S.products.filter(function (p) { return p.active; }).forEach(function (p) {
      var a = agg[p.id];
      var velocity = a ? a.qty / days : 0;               // ชิ้น/วัน
      var cover = velocity > 0 ? p.qty / velocity : 999;  // ขายได้อีกกี่วัน
      var margin = p.price ? (p.price - p.cost) / p.price * 100 : 0;
      if (velocity > 0 && cover < 14) {
        restock.push({ p: p, need: Math.max(1, Math.ceil(velocity * 30 - p.qty)), cover: cover, velocity: velocity });
      } else if (!a && p.qty > 0) {
        slow.push({ p: p, value: p.qty * p.cost });
      }
      if (a && margin >= 45) push.push({ p: p, margin: margin, amt: a.amt });
    });
    restock.sort(function (a, b) { return a.cover - b.cover; });
    slow.sort(function (a, b) { return b.value - a.value; });
    push.sort(function (a, b) { return b.amt - a.amt; });

    /* หมวดที่ทำเงินสูงสุด → แนะนำเพิ่มสินค้าในหมวดนี้ */
    var byCat = {};
    S.products.forEach(function (p) {
      var a = agg[p.id]; if (!a) return;
      byCat[p.category] = (byCat[p.category] || 0) + a.amt;
    });
    var bestCat = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; })[0];

    var html = '<div class="grid g-3">' +
      recBox('🛒', 'ควรสั่งเข้าเพิ่ม (ของจะหมดใน 14 วัน)', restock.length
        ? restock.slice(0, 5).map(function (r) {
          return '<div class="sumline"><span>' + esc(r.p.name) + '<br><span style="font-size:11px;color:var(--muted-2)">เหลือ ' +
            r.p.qty + ' ' + esc(r.p.unit) + ' • ขายเฉลี่ย ' + r.velocity.toFixed(1) + '/วัน • พออีก ' + Math.floor(r.cover) + ' วัน</span></span>' +
            '<b class="badge b-warn">สั่งเพิ่ม ' + r.need + '</b></div>';
        }).join('')
        : '<div style="color:var(--muted-2);font-size:12.5px">สต๊อกยังเพียงพอทุกรายการ ✓</div>') +
      recBox('⚡', 'ควรเร่งขาย / จัดโปร (กำไรสูง)', push.length
        ? push.slice(0, 5).map(function (r) {
          return '<div class="sumline"><span>' + esc(r.p.name) + '<br><span style="font-size:11px;color:var(--muted-2)">คงเหลือ ' + r.p.qty + ' ' + esc(r.p.unit) + '</span></span>' +
            '<b class="badge b-ok">' + (showCost ? 'กำไร ' + r.margin.toFixed(0) + '%' : 'ขายดี') + '</b></div>';
        }).join('')
        : '<div style="color:var(--muted-2);font-size:12.5px">ยังไม่มีข้อมูลเพียงพอ</div>') +
      recBox('🕸', 'สินค้าไม่เคลื่อนไหว 30 วัน', slow.length
        ? slow.slice(0, 5).map(function (r) {
          return '<div class="sumline"><span>' + esc(r.p.name) + '<br><span style="font-size:11px;color:var(--muted-2)">ค้างสต๊อก ' + r.p.qty + ' ' + esc(r.p.unit) +
            (showCost ? ' • จมทุน ' + cur() + DB.moneyShort(r.value) : '') + '</span></span>' +
            '<b class="badge b-danger">ลดราคา?</b></div>';
        }).join('')
        : '<div style="color:var(--muted-2);font-size:12.5px">สินค้าทุกรายการมีการเคลื่อนไหว ✓</div>') +
      '</div>' +
      UI.tip('<b>สรุปเชิงกลยุทธ์:</b> ' +
        (bestCat ? 'หมวด <b>' + esc(bestCat) + '</b> ทำเงินสูงสุดในรอบ 30 วัน — ควรเพิ่มความหลากหลายของสินค้าในหมวดนี้ก่อนหมวดอื่น. ' : '') +
        (restock.length ? 'มี <b>' + restock.length + '</b> รายการที่ควรสั่งเข้าภายในสัปดาห์นี้เพื่อไม่ให้ขาดสต๊อก. ' : '') +
        (slow.length ? 'มี <b>' + slow.length + '</b> รายการที่ไม่ขยับเลย — พิจารณาจัดชุดขายพ่วงกับสินค้าขายดี หรือลดราคาเพื่อคืนเงินสด.' : ''));
    return { html: html, restock: restock, slow: slow, push: push };
  }
  function recBox(ico, title, body) {
    return '<div style="background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:14px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--gold-lt)">' + ico + ' ' + esc(title) + '</div>' + body + '</div>';
  }

  /* ==========================================================
     2) รายการขาย (POS)
     ========================================================== */
  var cart = [], held = [], posFilter = { cat: 'all', q: '' };

  V.pos = function (el) {
    el.innerHTML =
      '<div class="pos">' +
        '<div>' +
          '<div class="toolbar">' +
            '<input class="input grow" id="posQ" placeholder="ค้นหาชื่อสินค้า หรือ สแกน/พิมพ์รหัส SKU…" value="' + esc(posFilter.q) + '">' +
            '<button class="btn" id="btnHold">⏸ พักบิล' + (held.length ? ' (' + held.length + ')' : '') + '</button>' +
          '</div>' +
          '<div class="chip-row mb16" id="catChips"></div>' +
          '<div class="prod-grid" id="posGrid"></div>' +
        '</div>' +
        '<div class="cart">' +
          '<div class="cart-head"><b>🛒 ตะกร้าขาย</b><span class="badge b-mute" id="cartCount">0 ชิ้น</span>' +
            '<button class="btn btn-sm btn-ghost" style="margin-left:auto" id="btnClear">ล้าง</button></div>' +
          '<div class="cart-items" id="cartItems"></div>' +
          '<div class="cart-foot" id="cartFoot"></div>' +
        '</div>' +
      '</div>';

    renderChips(); renderGrid(); renderCart();
    $('#posQ').oninput = function () { posFilter.q = this.value; renderGrid(); };
    $('#posQ').onkeydown = function (e) {
      if (e.key === 'Enter') {
        var hit = visibleProducts();
        if (hit.length === 1) { addToCart(hit[0].id); this.value = ''; posFilter.q = ''; renderGrid(); }
      }
    };
    $('#btnClear').onclick = function () { if (!cart.length) return; cart = []; renderCart(); renderGrid(); };
    $('#btnHold').onclick = holdDialog;
  };

  function renderChips() {
    var cats = ['all'].concat(DB.state.categories);
    $('#catChips').innerHTML = cats.map(function (c) {
      return '<span class="chip ' + (posFilter.cat === c ? 'active' : '') + '" data-cat="' + esc(c) + '">' +
        (c === 'all' ? 'ทั้งหมด' : esc(c)) + '</span>';
    }).join('');
    $$('#catChips .chip').forEach(function (c) {
      c.onclick = function () { posFilter.cat = c.dataset.cat; renderChips(); renderGrid(); };
    });
  }
  function visibleProducts() {
    var q = posFilter.q.trim().toLowerCase();
    return DB.state.products.filter(function (p) {
      if (!p.active) return false;
      if (posFilter.cat !== 'all' && p.category !== posFilter.cat) return false;
      if (q && (p.name + ' ' + p.sku).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderGrid() {
    var list = visibleProducts();
    var g = $('#posGrid'); if (!g) return;
    if (!list.length) { g.innerHTML = UI.empty('🔍', 'ไม่พบสินค้าที่ค้นหา', 'ลองเปลี่ยนคำค้นหรือหมวดหมู่'); return; }
    g.innerHTML = list.map(function (p) {
      var inCart = cart.find(function (c) { return c.pid === p.id; });
      var left = p.qty - (inCart ? inCart.qty : 0);
      return '<div class="prod ' + (left <= 0 ? 'out' : '') + '" data-id="' + p.id + '">' +
        (left <= 0 ? '<span class="badge b-danger tag-out">หมด</span>' : '') +
        '<div class="prod-img">' + (p.imageType === 'url' && p.image ? '<img src="' + esc(p.image) + '" alt="">' : esc(p.image || '📦')) + '</div>' +
        '<div class="prod-body"><div class="prod-nm">' + esc(p.name) + '</div>' +
        '<div class="prod-meta"><span class="prod-price">' + cur() + money(p.price) + '</span>' +
        '<span class="prod-qty">คงเหลือ ' + left + '</span></div></div></div>';
    }).join('');
    $$('#posGrid .prod').forEach(function (c) {
      c.onclick = function () { if (!c.classList.contains('out')) addToCart(c.dataset.id); };
    });
  }
  function addToCart(pid) {
    var p = DB.product(pid); if (!p) return;
    var line = cart.find(function (c) { return c.pid === pid; });
    if (line) { if (line.qty >= p.qty) { UI.toast('สต๊อก ' + p.name + ' ไม่พอ', 'warn'); return; } line.qty++; }
    else cart.push({ pid: p.id, sku: p.sku, name: p.name, image: p.image, imageType: p.imageType, price: p.price, cost: p.cost, qty: 1 });
    renderCart(); renderGrid();
  }
  function calc() {
    var sub = cart.reduce(function (a, c) { return a + c.price * c.qty; }, 0);
    var dis = Number($('#disc') ? $('#disc').value : 0) || 0;
    dis = Math.min(dis, sub);
    var S = DB.state.settings;
    var vat = S.vatEnabled ? (sub - dis) * (S.vatRate / 100) : 0;
    return { sub: sub, dis: dis, vat: vat, total: sub - dis + vat };
  }
  function renderCart() {
    var box = $('#cartItems'); if (!box) return;
    if (!cart.length) box.innerHTML = UI.empty('🛍', 'ยังไม่มีสินค้าในตะกร้า', 'คลิกที่สินค้าเพื่อเพิ่ม');
    else box.innerHTML = cart.map(function (c, i) {
      return '<div class="ci">' + UI.imgHtml(c, 'ci-ico') +
        '<div style="flex:1;min-width:0"><div class="ci-nm">' + esc(c.name) + '</div>' +
        '<div class="ci-pr">' + cur() + money(c.price) + ' × ' + c.qty + ' = <b style="color:var(--gold-lt)">' + cur() + money(c.price * c.qty) + '</b></div></div>' +
        '<div class="qty-ctl"><button class="qbtn" data-m="-" data-i="' + i + '">−</button>' +
        '<span class="qn">' + c.qty + '</span>' +
        '<button class="qbtn" data-m="+" data-i="' + i + '">+</button>' +
        '<button class="qbtn" data-m="x" data-i="' + i + '" style="color:#e0574f">×</button></div></div>';
    }).join('');
    $$('#cartItems .qbtn').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.i, c = cart[i], p = DB.product(c.pid);
        if (b.dataset.m === '+') { if (p && c.qty >= p.qty) return UI.toast('สต๊อกไม่พอ', 'warn'); c.qty++; }
        else if (b.dataset.m === '-') { c.qty--; if (c.qty <= 0) cart.splice(i, 1); }
        else cart.splice(i, 1);
        renderCart(); renderGrid();
      };
    });
    $('#cartCount').textContent = cart.reduce(function (a, c) { return a + c.qty; }, 0) + ' ชิ้น';

    var canDisc = DB.can('sale.discount'), S = DB.state.settings;
    var f = $('#cartFoot');
    var c0 = calc();
    f.innerHTML =
      '<div class="sumline"><span>ยอดรวมสินค้า</span><span>' + cur() + money(c0.sub) + '</span></div>' +
      '<div class="sumline"><span>ส่วนลด' + (canDisc ? '' : ' <span class="badge b-mute" style="font-size:10px">ไม่มีสิทธิ์</span>') + '</span>' +
        '<input class="input" id="disc" type="number" min="0" step="1" value="' + c0.dis + '" ' + (canDisc ? '' : 'disabled') +
        ' style="width:96px;padding:4px 8px;text-align:right"></div>' +
      (S.vatEnabled ? '<div class="sumline"><span>VAT ' + S.vatRate + '%</span><span>' + cur() + money(c0.vat) + '</span></div>' : '') +
      '<div class="sumline total"><span>รวมสุทธิ</span><b>' + cur() + money(c0.total) + '</b></div>' +
      '<div class="row" style="margin:12px 0 10px">' +
        '<select class="input" id="payM">' + DB.PAY_METHODS.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="payCh">' + DB.CHANNELS.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<input class="input mb16" id="custName" placeholder="ชื่อลูกค้า / เบอร์โทร (ถ้ามี)" style="margin-bottom:10px">' +
      '<button class="btn btn-gold btn-block" id="btnPay" ' + (cart.length ? '' : 'disabled') + '>ชำระเงิน ' + cur() + money(c0.total) + '</button>';

    if ($('#disc')) $('#disc').oninput = function () { renderCartTotals(); };
    $('#btnPay').onclick = checkout;
  }
  function renderCartTotals() {
    var c0 = calc();
    var lines = $$('#cartFoot .sumline');
    var totalEl = $('#cartFoot .sumline.total b');
    if (totalEl) totalEl.textContent = cur() + money(c0.total);
    var btn = $('#btnPay'); if (btn) btn.textContent = 'ชำระเงิน ' + cur() + money(c0.total);
  }

  function checkout() {
    var c0 = calc();
    if (!cart.length) return;
    UI.modal({
      title: 'ยืนยันการชำระเงิน',
      body: '<div class="sumline total" style="margin:0 0 16px"><span>ยอดที่ต้องชำระ</span><b>' + cur() + money(c0.total) + '</b></div>' +
        '<div class="field"><label>รับเงินมา (' + cur() + ')</label>' +
        '<input class="input" id="rcv" type="number" value="' + c0.total.toFixed(2) + '" step="1"></div>' +
        '<div class="field"><label>เงินทอน</label><div id="chg" style="font-size:22px;font-weight:700;color:var(--gold-lt)">' + cur() + '0.00</div></div>' +
        '<div class="field"><label>หมายเหตุ</label><input class="input" id="snote" placeholder="เช่น ลูกค้าขอใบเสร็จ"></div>',
      okText: 'ยืนยัน & พิมพ์ใบเสร็จ',
      onRender: function (ov) {
        var r = $('#rcv', ov);
        function upd() { $('#chg', ov).textContent = cur() + money(Math.max(0, (Number(r.value) || 0) - c0.total)); }
        r.oninput = upd; upd(); setTimeout(function () { r.select(); }, 60);
      },
      onOk: function (ov) {
        var rcv = Number($('#rcv', ov).value) || 0;
        if (rcv < c0.total) { UI.toast('จำนวนเงินที่รับน้อยกว่ายอดชำระ', 'err'); return false; }
        var sale = DB.commitSale({
          items: cart.map(function (c) { return Object.assign({}, c); }),
          subtotal: c0.sub, discount: c0.dis, vat: c0.vat, total: c0.total,
          method: $('#payM').value, channel: $('#payCh').value,
          received: rcv, customer: $('#custName').value.trim(), note: $('#snote', ov).value.trim()
        });
        cart = [];
        UI.closeModal();
        UI.toast('บันทึกการขาย ' + sale.code + ' เรียบร้อย', 'ok');
        App.refreshBadges();
        showReceipt(sale);
        renderCart(); renderGrid();
        return false;
      }
    });
  }

  function holdDialog() {
    var body = '';
    if (cart.length) body += '<button class="btn btn-gold btn-block mb16" id="doHold">⏸ พักบิลปัจจุบัน (' + cart.length + ' รายการ)</button>';
    body += held.length
      ? '<div class="sec-title">บิลที่พักไว้</div>' + held.map(function (h, i) {
        return '<div class="ci"><div style="flex:1"><div class="ci-nm">' + esc(h.label) + '</div>' +
          '<div class="ci-pr">' + h.items.length + ' รายการ • ' + cur() + money(h.items.reduce(function (a, c) { return a + c.price * c.qty; }, 0)) + '</div></div>' +
          '<button class="btn btn-sm btn-gold" data-take="' + i + '">เรียกคืน</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + i + '">ลบ</button></div>';
      }).join('')
      : '<div style="color:var(--muted-2);font-size:13px">ยังไม่มีบิลที่พักไว้</div>';
    UI.modal({
      title: 'พักบิล / เรียกบิลคืน', body: body, foot: false,
      onRender: function (ov) {
        var h = $('#doHold', ov);
        if (h) h.onclick = function () {
          held.push({ label: 'บิลพัก ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), items: cart.slice() });
          cart = []; UI.closeModal(); renderCart(); renderGrid();
          $('#btnHold').textContent = '⏸ พักบิล (' + held.length + ')';
          UI.toast('พักบิลเรียบร้อย', 'ok');
        };
        $$('[data-take]', ov).forEach(function (b) {
          b.onclick = function () { cart = held.splice(+b.dataset.take, 1)[0].items; UI.closeModal(); renderCart(); renderGrid(); };
        });
        $$('[data-del]', ov).forEach(function (b) {
          b.onclick = function () { held.splice(+b.dataset.del, 1); UI.closeModal(); holdDialog(); };
        });
      }
    });
  }

  function receiptHtml(s) {
    var S = DB.state.settings;
    var logo = new URL(UI.logoSrc(), location.href).href;
    return '<div class="receipt" id="rcpt">' +
      '<div class="c"><img src="' + esc(logo) + '" alt="" style="width:74px;height:74px;object-fit:contain;margin-bottom:6px"><br>' +
      '<b style="font-size:15px">' + esc(S.shopName) + '</b><br>' + esc(S.address) + '<br>โทร ' + esc(S.phone) + '</div><hr>' +
      '<div>เลขที่: ' + esc(s.code) + '</div><div>วันที่: ' + DB.fmtDateTime(s.ts) + '</div>' +
      '<div>พนักงาน: ' + esc(s.staffName) + '</div>' + (s.customer ? '<div>ลูกค้า: ' + esc(s.customer) + '</div>' : '') + '<hr>' +
      s.items.map(function (i) {
        return '<div style="display:flex;justify-content:space-between"><span>' + esc(i.name) + '<br>&nbsp;&nbsp;' + i.qty + ' x ' + money(i.price) + '</span>' +
          '<span>' + money(i.price * i.qty) + '</span></div>';
      }).join('') + '<hr>' +
      row('ยอดรวม', money(s.subtotal)) +
      (s.discount ? row('ส่วนลด', '-' + money(s.discount)) : '') +
      (s.vat ? row('VAT', money(s.vat)) : '') +
      '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:6px"><span>รวมสุทธิ</span><span>' + money(s.total) + '</span></div>' +
      row('ชำระโดย', esc(s.method)) +
      (s.received ? row('รับเงิน', money(s.received)) + row('เงินทอน', money(s.change || 0)) : '') +
      '<hr><div class="c">' + esc(S.orderFooter || 'ขอบคุณที่ใช้บริการ') + '</div></div>';
    function row(a, b) { return '<div style="display:flex;justify-content:space-between"><span>' + a + '</span><span>' + b + '</span></div>'; }
  }
  function showReceipt(s) {
    UI.modal({
      title: 'ใบเสร็จ ' + s.code, body: receiptHtml(s),
      footHtml: '<button class="btn btn-ghost" data-close>ปิด</button><button class="btn btn-gold" id="btnPrint">🖨 พิมพ์ใบเสร็จ</button>',
      onRender: function (ov) {
        $('#btnPrint', ov).onclick = function () {
          var w = window.open('', '_blank', 'width=380,height=640');
          w.document.write('<html><head><title>ใบเสร็จ ' + esc(s.code) + '</title><meta charset="utf-8">' +
            '<style>body{font-family:"Courier New",monospace;font-size:12px;padding:12px}hr{border:none;border-top:1px dashed #999}.c{text-align:center}</style>' +
            '</head><body>' + receiptHtml(s).replace('class="receipt"', '') + '</body></html>');
          w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 350);
        };
      }
    });
  }
  V.showReceipt = showReceipt;

  /* ==========================================================
     3) ประวัติการขาย
     ========================================================== */
  var hf = { from: '', to: '', staff: 'all', ch: 'all', pay: 'all', q: '', status: 'all' };

  V.history = function (el) {
    if (!hf.from) {
      hf.from = DB.todayKey(daysAgo(29));
      hf.to = DB.todayKey(new Date());
    }
    el.innerHTML =
      '<div class="card mb16"><div class="toolbar" style="margin:0">' +
        '<div><label style="font-size:11px;color:var(--muted)">จากวันที่</label><input class="input" type="date" id="hFrom" value="' + hf.from + '"></div>' +
        '<div><label style="font-size:11px;color:var(--muted)">ถึงวันที่</label><input class="input" type="date" id="hTo" value="' + hf.to + '"></div>' +
        '<div class="grow"><label style="font-size:11px;color:var(--muted)">ค้นหา</label><input class="input" id="hQ" style="width:100%" placeholder="เลขที่บิล / ชื่อสินค้า / ลูกค้า" value="' + esc(hf.q) + '"></div>' +
        '<div><label style="font-size:11px;color:var(--muted)">พนักงาน</label><select class="input" id="hStaff"><option value="all">ทั้งหมด</option>' +
          DB.state.users.map(function (u) { return '<option value="' + u.id + '" ' + (hf.staff === u.id ? 'selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select></div>' +
        '<div><label style="font-size:11px;color:var(--muted)">ช่องทาง</label><select class="input" id="hCh"><option value="all">ทั้งหมด</option>' +
          DB.CHANNELS.map(function (c) { return '<option ' + (hf.ch === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '<div><label style="font-size:11px;color:var(--muted)">สถานะ</label><select class="input" id="hSt">' +
          '<option value="all">ทั้งหมด</option><option value="completed" ' + (hf.status === 'completed' ? 'selected' : '') + '>สำเร็จ</option>' +
          '<option value="void" ' + (hf.status === 'void' ? 'selected' : '') + '>ยกเลิก</option></select></div>' +
        '<div style="display:flex;gap:8px;align-items:flex-end">' +
          '<button class="btn" id="hToday">วันนี้</button>' +
          (DB.can('data.export') ? '<button class="btn btn-gold" id="hExport">⬇ CSV</button>' : '') +
        '</div>' +
      '</div></div>' +
      '<div id="hSummary" class="grid g-4 mb16"></div>' +
      '<div class="card"><div class="card-head"><h3>รายการบิลทั้งหมด</h3><div class="sp"><span id="hCount" class="badge b-mute"></span></div></div>' +
      '<div class="tbl-wrap" id="hTable"></div></div>' +
      UI.tip('<b>แนะนำเพิ่มเติม:</b> คลิกที่แถวเพื่อดูรายละเอียดบิล พิมพ์ใบเสร็จซ้ำ หรือยกเลิกบิล (ระบบจะคืนสต๊อกอัตโนมัติ) • ส่งออก CSV เพื่อนำเข้าโปรแกรมบัญชี • ประวัติทุกบิลผูกกับชื่อพนักงานที่ขาย ใช้ตรวจสอบย้อนหลังและคำนวณคอมมิชชั่นได้');

    ['hFrom', 'hTo', 'hQ', 'hStaff', 'hCh', 'hSt'].forEach(function (id) {
      var e = $('#' + id);
      e['on' + (id === 'hQ' ? 'input' : 'change')] = function () {
        hf.from = $('#hFrom').value; hf.to = $('#hTo').value; hf.q = $('#hQ').value;
        hf.staff = $('#hStaff').value; hf.ch = $('#hCh').value; hf.status = $('#hSt').value;
        drawHistory();
      };
    });
    $('#hToday').onclick = function () {
      hf.from = hf.to = DB.todayKey(new Date());
      $('#hFrom').value = hf.from; $('#hTo').value = hf.to; drawHistory();
    };
    if ($('#hExport')) $('#hExport').onclick = function () {
      var rows = [['เลขที่บิล', 'วันที่', 'เวลา', 'พนักงาน', 'ช่องทาง', 'ชำระโดย', 'ลูกค้า', 'รายการ', 'ยอดรวม', 'ส่วนลด', 'สุทธิ', 'สถานะ']];
      filterHistory().forEach(function (s) {
        var d = new Date(s.ts);
        rows.push([s.code, DB.todayKey(d), d.toLocaleTimeString('th-TH'), s.staffName, s.channel, s.method, s.customer,
          s.items.map(function (i) { return i.name + ' x' + i.qty; }).join(' | '),
          s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2), s.status === 'void' ? 'ยกเลิก' : 'สำเร็จ']);
      });
      UI.downloadCSV('sales-history-' + DB.todayKey(new Date()) + '.csv', rows);
      UI.toast('ส่งออกไฟล์ CSV แล้ว', 'ok');
    };
    drawHistory();
  };

  function filterHistory() {
    var from = hf.from ? new Date(hf.from + 'T00:00:00').toISOString() : '0';
    var to = hf.to ? new Date(hf.to + 'T23:59:59').toISOString() : '9999';
    var q = hf.q.trim().toLowerCase();
    return DB.state.sales.filter(function (s) {
      if (s.ts < from || s.ts > to) return false;
      if (hf.staff !== 'all' && s.staffId !== hf.staff) return false;
      if (hf.ch !== 'all' && s.channel !== hf.ch) return false;
      if (hf.status !== 'all' && (s.status || 'completed') !== hf.status) return false;
      if (q) {
        var hay = (s.code + ' ' + s.customer + ' ' + s.staffName + ' ' + s.items.map(function (i) { return i.name; }).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return b.ts < a.ts ? -1 : 1; });
  }

  function drawHistory() {
    var list = filterHistory();
    var ok = list.filter(function (s) { return s.status !== 'void'; });
    var showCost = DB.can('report.cost');
    var qty = ok.reduce(function (a, s) { return a + s.items.reduce(function (x, i) { return x + i.qty; }, 0); }, 0);

    $('#hSummary').innerHTML =
      kpi('จำนวนบิล', ok.length + ' บิล', '', list.length - ok.length ? (list.length - ok.length) + ' บิลถูกยกเลิก' : 'ทั้งหมดสำเร็จ', '🧾') +
      kpi('ยอดขายรวม', cur() + money(DB.sumTotal(ok)), 'gold', 'สินค้า ' + qty + ' ชิ้น', '💰') +
      kpi('เฉลี่ยต่อบิล', cur() + money(ok.length ? DB.sumTotal(ok) / ok.length : 0), '', 'ส่วนลดรวม ' + cur() + money(ok.reduce(function (a, s) { return a + s.discount; }, 0)), '📊') +
      (showCost ? kpi('กำไรขั้นต้น', cur() + money(DB.sumProfit(ok)), '',
        'อัตรากำไร ' + (DB.sumTotal(ok) ? (DB.sumProfit(ok) / DB.sumTotal(ok) * 100).toFixed(1) : 0) + '%', '💎')
        : kpi('ช่วงเวลา', (hf.from || '-'), '', 'ถึง ' + (hf.to || '-'), '📅'));

    $('#hCount').textContent = list.length + ' รายการ';
    if (!list.length) { $('#hTable').innerHTML = UI.empty('🗂', 'ไม่พบบิลในช่วงเวลานี้', 'ลองขยายช่วงวันที่หรือล้างตัวกรอง'); return; }

    $('#hTable').innerHTML = '<table><thead><tr><th>เลขที่บิล</th><th>วันที่/เวลา</th><th>รายการ</th><th>พนักงาน</th>' +
      '<th>ช่องทาง</th><th>ชำระ</th><th class="num">สุทธิ</th><th>สถานะ</th></tr></thead><tbody>' +
      list.slice(0, 300).map(function (s) {
        return '<tr style="cursor:pointer" data-id="' + s.id + '">' +
          '<td><b style="color:var(--gold-lt)">' + esc(s.code) + '</b></td>' +
          '<td style="white-space:nowrap">' + DB.fmtDateTime(s.ts) + '</td>' +
          '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            esc(s.items.map(function (i) { return i.name + ' ×' + i.qty; }).join(', ')) + '</td>' +
          '<td>' + esc(s.staffName) + '</td><td>' + esc(s.channel) + '</td><td>' + esc(s.method) + '</td>' +
          '<td class="num"><b>' + cur() + money(s.total) + '</b></td>' +
          '<td>' + (s.status === 'void' ? '<span class="badge b-danger">ยกเลิก</span>' : '<span class="badge b-ok">สำเร็จ</span>') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (list.length > 300 ? '<div style="padding:10px;text-align:center;color:var(--muted-2);font-size:12px">แสดง 300 รายการล่าสุด — ใช้ตัวกรองเพื่อดูช่วงอื่น</div>' : '');

    $$('#hTable tbody tr').forEach(function (tr) {
      tr.onclick = function () { saleDetail(tr.dataset.id); };
    });
  }

  function saleDetail(id) {
    var s = DB.state.sales.find(function (x) { return x.id === id; });
    if (!s) return;
    var showCost = DB.can('report.cost');
    var body = '<div class="grid g-2 mb16" style="gap:10px">' +
      info('เลขที่บิล', s.code) + info('วันที่', DB.fmtDateTime(s.ts)) +
      info('พนักงานขาย', s.staffName) + info('ช่องทาง', s.channel + ' • ' + s.method) +
      (s.customer ? info('ลูกค้า', s.customer) : '') + (s.note ? info('หมายเหตุ', s.note) : '') +
      '</div>' +
      '<div class="tbl-wrap"><table style="min-width:auto"><thead><tr><th>สินค้า</th><th class="num">ราคา</th><th class="num">จำนวน</th>' +
      (showCost ? '<th class="num">กำไร</th>' : '') + '<th class="num">รวม</th></tr></thead><tbody>' +
      s.items.map(function (i) {
        return '<tr><td><div class="flex">' + UI.imgHtml(i) + '<span>' + esc(i.name) + '</span></div></td>' +
          '<td class="num">' + money(i.price) + '</td><td class="num">' + i.qty + '</td>' +
          (showCost ? '<td class="num" style="color:var(--ok)">' + money((i.price - (i.cost || 0)) * i.qty) + '</td>' : '') +
          '<td class="num"><b>' + money(i.price * i.qty) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="margin-top:14px">' +
      '<div class="sumline"><span>ยอดรวม</span><span>' + cur() + money(s.subtotal) + '</span></div>' +
      (s.discount ? '<div class="sumline"><span>ส่วนลด</span><span style="color:var(--danger)">-' + cur() + money(s.discount) + '</span></div>' : '') +
      (s.vat ? '<div class="sumline"><span>VAT</span><span>' + cur() + money(s.vat) + '</span></div>' : '') +
      '<div class="sumline total"><span>รวมสุทธิ</span><b>' + cur() + money(s.total) + '</b></div></div>' +
      (s.status === 'void' ? '<div class="tip mt16"><span class="i">⚠</span><div><b>บิลนี้ถูกยกเลิกแล้ว</b><br>' +
        DB.fmtDateTime(s.voidAt) + (s.voidReason ? ' • เหตุผล: ' + esc(s.voidReason) : '') + '</div></div>' : '');

    var foot = '<button class="btn btn-ghost" data-close>ปิด</button>' +
      '<button class="btn" id="btnRe">🖨 พิมพ์ซ้ำ</button>' +
      (s.status !== 'void' && DB.can('sale.void') ? '<button class="btn btn-danger" id="btnVoid">ยกเลิกบิล</button>' : '');

    UI.modal({
      title: 'รายละเอียดบิล', body: body, wide: true, footHtml: foot,
      onRender: function (ov) {
        $('#btnRe', ov).onclick = function () { UI.closeModal(); showReceipt(s); };
        var bv = $('#btnVoid', ov);
        if (bv) bv.onclick = function () {
          UI.closeModal();
          UI.modal({
            title: 'ยกเลิกบิล ' + s.code,
            body: '<p style="color:var(--muted);margin-bottom:14px">ระบบจะคืนสินค้าเข้าสต๊อกอัตโนมัติ และตัดยอดขายบิลนี้ออกจากรายงาน</p>' +
              '<div class="field"><label>เหตุผลการยกเลิก <span class="req">*</span></label><input class="input" id="vr" placeholder="เช่น ลูกค้าคืนสินค้า / คีย์ผิด"></div>',
            okText: 'ยืนยันยกเลิกบิล',
            footHtml: '<button class="btn btn-ghost" data-close>ไม่ยกเลิก</button><button class="btn btn-danger" id="mdOk">ยืนยันยกเลิกบิล</button>',
            onOk: function (ov2) {
              var r = $('#vr', ov2).value.trim();
              if (!r) { UI.toast('กรุณาระบุเหตุผล', 'err'); return false; }
              DB.voidSale(s.id, r);
              UI.toast('ยกเลิกบิลและคืนสต๊อกแล้ว', 'ok');
              App.render();
            }
          });
        };
      }
    });
  }
  function info(l, v) {
    return '<div style="background:var(--panel-2);padding:10px 13px;border-radius:9px">' +
      '<div style="font-size:11px;color:var(--muted-2)">' + esc(l) + '</div>' +
      '<div style="font-weight:600;font-size:13.5px">' + esc(v) + '</div></div>';
  }

  V.posReset = function () { cart = []; };
})(window);
