/* ============================================================
   views-manage.js — สต๊อกสินค้า / Order Online / พนักงาน / ตั้งค่า / บันทึกกิจกรรม
   ============================================================ */
(function (global) {
  'use strict';
  var $ = UI.$, $$ = UI.$$, esc = DB.esc, money = DB.money;
  var V = global.Views = global.Views || {};
  function cur() { return DB.state.settings.currency || '฿'; }

  /* ==========================================================
     สต๊อกสินค้า
     ========================================================== */
  var sf = { q: '', cat: 'all', st: 'all' };

  V.stock = function (el) {
    var S = DB.state, showCost = DB.can('report.cost') || DB.can('product.price');
    var prods = S.products;
    var stockValue = prods.reduce(function (a, p) { return a + p.qty * p.cost; }, 0);
    var sellValue = prods.reduce(function (a, p) { return a + p.qty * p.price; }, 0);
    var low = DB.lowStock();

    el.innerHTML =
      '<div class="grid g-4 mb16">' +
        card('จำนวนสินค้า', prods.length + ' รายการ', 'ใน ' + S.categories.length + ' หมวดหมู่', '▤') +
        card('สินค้าคงเหลือรวม', prods.reduce(function (a, p) { return a + p.qty; }, 0) + ' ชิ้น',
          prods.filter(function (p) { return p.qty === 0; }).length + ' รายการหมดสต๊อก', '📦') +
        (showCost ? card('มูลค่าสต๊อก (ต้นทุน)', cur() + money(stockValue), 'มูลค่าขาย ' + cur() + DB.moneyShort(sellValue), '💰')
          : card('มูลค่าขายรวม', cur() + DB.moneyShort(sellValue), 'ตามราคาขายปัจจุบัน', '💰')) +
        card('ต้องเติมสต๊อก', low.length + ' รายการ', low.length ? 'ต่ำกว่าจุดสั่งซื้อขั้นต่ำ' : 'สต๊อกปกติทั้งหมด ✓', '⚠') +
      '</div>' +

      '<div class="card mb16"><div class="toolbar" style="margin:0">' +
        '<input class="input grow" id="sQ" placeholder="ค้นหาชื่อสินค้า / SKU…" value="' + esc(sf.q) + '">' +
        '<select class="input" id="sCat"><option value="all">ทุกหมวดหมู่</option>' +
          S.categories.map(function (c) { return '<option ' + (sf.cat === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="sSt">' +
          '<option value="all">สถานะทั้งหมด</option>' +
          '<option value="low" ' + (sf.st === 'low' ? 'selected' : '') + '>ใกล้หมด</option>' +
          '<option value="out" ' + (sf.st === 'out' ? 'selected' : '') + '>หมดสต๊อก</option>' +
          '<option value="ok" ' + (sf.st === 'ok' ? 'selected' : '') + '>ปกติ</option></select>' +
        (DB.can('data.export') ? '<button class="btn" id="sExport">⬇ CSV</button>' : '') +
        (DB.can('product.create') ? '<button class="btn btn-gold" id="sAdd">+ เพิ่มสินค้า</button>' : '') +
      '</div></div>' +

      '<div class="card mb16"><div class="card-head"><h3>รายการสินค้า</h3><div class="sp"><span class="badge b-mute" id="sCount"></span></div></div>' +
      '<div class="tbl-wrap" id="sTable"></div></div>' +

      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>ความเคลื่อนไหวสต๊อกล่าสุด</h3></div><div id="sLogs"></div></div>' +
        '<div class="card"><div class="card-head"><h3>◆ แนะนำเพิ่มเติมสำหรับงานสต๊อก</h3></div>' +
          '<div class="stack">' +
          bullet('ตั้ง “จำนวนขั้นต่ำ” ทุกสินค้า', 'ระบบจะเตือนอัตโนมัติเมื่อของเหลือน้อยกว่าค่านี้ ทำให้ไม่ขาดของขายดี') +
          bullet('บันทึกต้นทุนทุกครั้งที่รับเข้า', 'ใช้คำนวณกำไรขั้นต้นและมูลค่าสต๊อกได้แม่นยำ (เห็นเฉพาะผู้มีสิทธิ์)') +
          bullet('ตรวจนับสต๊อกจริงทุกเดือน', 'ใช้ปุ่ม “ปรับสต๊อก” เพื่อแก้ตัวเลขให้ตรงของจริง พร้อมระบุเหตุผลทุกครั้ง') +
          bullet('ทุกการเคลื่อนไหวถูกบันทึกชื่อผู้ทำ', 'ตรวจสอบย้อนหลังได้ว่าใครรับเข้า/ปรับลด เมื่อไร ป้องกันของหาย') +
          '</div></div>' +
      '</div>';

    ['sQ', 'sCat', 'sSt'].forEach(function (id) {
      $('#' + id)['on' + (id === 'sQ' ? 'input' : 'change')] = function () {
        sf.q = $('#sQ').value; sf.cat = $('#sCat').value; sf.st = $('#sSt').value; drawStock();
      };
    });
    if ($('#sAdd')) $('#sAdd').onclick = function () { productForm(null); };
    if ($('#sExport')) $('#sExport').onclick = function () {
      var rows = [['SKU', 'ชื่อสินค้า', 'หมวดหมู่', 'ต้นทุน', 'ราคาขาย', 'คงเหลือ', 'ขั้นต่ำ', 'หน่วย', 'มูลค่าต้นทุน']];
      filterStock().forEach(function (p) {
        rows.push([p.sku, p.name, p.category, p.cost, p.price, p.qty, p.minQty, p.unit, (p.qty * p.cost).toFixed(2)]);
      });
      UI.downloadCSV('stock-' + DB.todayKey(new Date()) + '.csv', rows);
      UI.toast('ส่งออกไฟล์ CSV แล้ว', 'ok');
    };
    drawStock(); drawStockLogs();
  };

  function card(l, v, sub, ico) {
    return '<div class="kpi"><div class="lbl">' + ico + ' ' + esc(l) + '</div><div class="val">' + v + '</div><div class="delta">' + esc(sub) + '</div></div>';
  }
  function bullet(t, d) {
    return '<div class="flex" style="align-items:flex-start;gap:11px"><span style="color:var(--gold);font-size:15px">✦</span>' +
      '<div><div style="font-size:13.5px;font-weight:600">' + esc(t) + '</div>' +
      '<div style="font-size:12px;color:var(--muted-2);line-height:1.6">' + esc(d) + '</div></div></div>';
  }

  function filterStock() {
    var q = sf.q.trim().toLowerCase();
    return DB.state.products.filter(function (p) {
      if (q && (p.name + ' ' + p.sku).toLowerCase().indexOf(q) < 0) return false;
      if (sf.cat !== 'all' && p.category !== sf.cat) return false;
      if (sf.st === 'low' && !(p.qty > 0 && p.qty <= p.minQty)) return false;
      if (sf.st === 'out' && p.qty !== 0) return false;
      if (sf.st === 'ok' && p.qty <= p.minQty) return false;
      return true;
    });
  }

  function drawStock() {
    var list = filterStock(), showCost = DB.can('report.cost') || DB.can('product.price');
    $('#sCount').textContent = list.length + ' รายการ';
    if (!list.length) { $('#sTable').innerHTML = UI.empty('📦', 'ไม่พบสินค้า', 'ลองล้างตัวกรอง หรือเพิ่มสินค้าใหม่'); return; }
    $('#sTable').innerHTML = '<table><thead><tr><th>สินค้า</th><th>หมวดหมู่</th>' +
      (showCost ? '<th class="num">ต้นทุน</th>' : '') + '<th class="num">ราคาขาย</th>' +
      (showCost ? '<th class="num">กำไร</th>' : '') +
      '<th class="num">คงเหลือ</th><th class="num">ขั้นต่ำ</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>' +
      list.map(function (p) {
        var st = p.qty === 0 ? '<span class="badge b-danger">หมดสต๊อก</span>'
          : p.qty <= p.minQty ? '<span class="badge b-warn">ใกล้หมด</span>'
          : '<span class="badge b-ok">ปกติ</span>';
        var mg = p.price ? ((p.price - p.cost) / p.price * 100).toFixed(0) : 0;
        return '<tr>' +
          '<td><div class="flex">' + UI.imgHtml(p) + '<div><div style="font-weight:600">' + esc(p.name) + '</div>' +
            '<div style="font-size:11px;color:var(--muted-2)">' + esc(p.sku) + mediaCount(p) + '</div></div></div></td>' +
          '<td><span class="badge b-mute">' + esc(p.category) + '</span></td>' +
          (showCost ? '<td class="num">' + money(p.cost) + '</td>' : '') +
          '<td class="num"><b style="color:var(--gold-lt)">' + money(p.price) + '</b></td>' +
          (showCost ? '<td class="num" style="color:var(--ok)">' + mg + '%</td>' : '') +
          '<td class="num"><b>' + p.qty + '</b> <span style="color:var(--muted-2);font-size:11px">' + esc(p.unit) + '</span></td>' +
          '<td class="num" style="color:var(--muted-2)">' + p.minQty + '</td>' +
          '<td>' + st + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
            (DB.can('stock.adjust') ? '<button class="btn btn-sm" data-adj="' + p.id + '" title="รับเข้า/ปรับสต๊อก">±</button> ' : '') +
            (DB.can('product.edit') || DB.can('product.price') ? '<button class="btn btn-sm" data-edit="' + p.id + '">แก้ไข</button> ' : '') +
            (DB.can('product.delete') ? '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">ลบ</button>' : '') +
            (!DB.can('stock.adjust') && !DB.can('product.edit') && !DB.can('product.delete') ? '<span style="color:var(--muted-2);font-size:12px">ดูอย่างเดียว</span>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table>';

    $$('[data-edit]').forEach(function (b) { b.onclick = function () { productForm(b.dataset.edit); }; });
    $$('[data-adj]').forEach(function (b) { b.onclick = function () { adjustForm(b.dataset.adj); }; });
    $$('[data-del]').forEach(function (b) {
      b.onclick = function () {
        var p = DB.product(b.dataset.del);
        UI.confirmBox('ลบสินค้า', 'ต้องการลบ <b>' + esc(p.name) + '</b> ออกจากระบบถาวรหรือไม่?<br>' +
          '<span style="color:var(--muted-2);font-size:12px">ประวัติการขายเดิมจะยังคงอยู่ แต่สินค้านี้จะหายจากหน้าขายและหน้าเว็บ</span>',
          'ลบถาวร', function () {
            DB.state.products = DB.state.products.filter(function (x) { return x.id !== p.id; });
            DB.logAct('ลบสินค้า', p.sku + ' • ' + p.name);
            UI.toast('ลบสินค้าแล้ว', 'ok'); App.render();
          }, true);
      };
    });
  }

  function drawStockLogs() {
    var logs = DB.state.stockLogs.slice(0, 12);
    var map = { in: ['รับเข้า', 'b-ok'], sale: ['ขายออก', 'b-info'], adjust: ['ปรับยอด', 'b-warn'], 'return': ['คืนสต๊อก', 'b-gold'], 'new': ['สินค้าใหม่', 'b-gold'] };
    $('#sLogs').innerHTML = logs.length ? logs.map(function (l) {
      var m = map[l.type] || ['อื่นๆ', 'b-mute'];
      return '<div class="rank"><span class="badge ' + m[1] + '">' + m[0] + '</span>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.name) + '</div>' +
        '<div style="font-size:11px;color:var(--muted-2)">' + DB.fmtDateTime(l.ts) + ' • ' + esc(l.userName) + (l.note ? ' • ' + esc(l.note) : '') + '</div></div>' +
        '<div style="font-weight:700;color:' + (l.delta >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (l.delta >= 0 ? '+' : '') + l.delta + '</div></div>';
    }).join('') : UI.empty('📋', 'ยังไม่มีการเคลื่อนไหว');
  }

  /* จำนวนรูป/วิดีโอ แสดงใต้ชื่อสินค้าในตารางสต๊อก */
  function mediaCount(p) {
    var m = p.media || [];
    if (!m.length) return '';
    var img = m.filter(function (x) { return x.type === 'image'; }).length;
    var vid = m.length - img;
    return ' • <span style="color:var(--gold-dk)">' + (img ? '🖼 ' + img : '') + (img && vid ? ' ' : '') + (vid ? '🎬 ' + vid : '') + '</span>';
  }

  /* ---------- ตัวช่วยจัดการสื่อของสินค้า ---------- */
  function ytId(url) {
    var m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function mediaThumb(it) {
    if (it.type === 'youtube') return '<img src="https://img.youtube.com/vi/' + esc(it.id) + '/mqdefault.jpg" alt="">';
    if (it.type === 'video') return '<video src="' + esc(it.url) + '#t=0.5" muted playsinline preload="metadata"></video>';
    return '<img src="' + esc(it.url) + '" alt="">';
  }
  /* รูปหลักของสินค้า = รูปภาพชิ้นแรกในคลังสื่อ */
  function coverOf(media, fallbackEmoji) {
    var img = (media || []).find(function (m) { return m.type === 'image'; });
    if (img) return { image: img.url, imageType: 'url' };
    return { image: fallbackEmoji || '📦', imageType: 'emoji' };
  }

  function productForm(id) {
    var p = id ? DB.product(id) : null;
    var S = DB.state;
    var canPrice = DB.can('product.price');
    var canQty = DB.can('stock.adjust');
    var media = (p && Array.isArray(p.media)) ? JSON.parse(JSON.stringify(p.media)) : [];
    var pid = p ? p.id : DB.uid('p');
    var removed = [];   // ไฟล์ที่ถูกลบออก จะไปลบจริงตอนกดบันทึก
    UI.modal({
      title: p ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', wide: true,
      body:
        '<div class="row"><div class="field" style="flex:2"><label>ชื่อสินค้า <span class="req">*</span></label>' +
          '<input class="input" id="pName" value="' + esc(p ? p.name : '') + '" placeholder="เช่น สร้อยคอทองคำ 96.5%"></div>' +
          '<div class="field"><label>รหัส SKU</label><input class="input" id="pSku" value="' + esc(p ? p.sku : nextSku()) + '"></div></div>' +
        '<div class="row"><div class="field"><label>หมวดหมู่</label><select class="input" id="pCat">' +
          S.categories.map(function (c) { return '<option ' + (p && p.category === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
          '<option value="__new">+ เพิ่มหมวดหมู่ใหม่…</option></select></div>' +
          '<div class="field"><label>หน่วยนับ</label><input class="input" id="pUnit" value="' + esc(p ? p.unit : 'ชิ้น') + '"></div></div>' +
        '<div class="row">' +
          '<div class="field"><label>ราคาทุน (' + cur() + ')' + (canPrice ? '' : ' 🔒') + '</label>' +
            '<input class="input" id="pCost" type="number" min="0" step="0.01" value="' + (p ? p.cost : 0) + '" ' + (canPrice ? '' : 'disabled') + '></div>' +
          '<div class="field"><label>ราคาขาย (' + cur() + ') <span class="req">*</span>' + (canPrice ? '' : ' 🔒') + '</label>' +
            '<input class="input" id="pPrice" type="number" min="0" step="0.01" value="' + (p ? p.price : 0) + '" ' + (canPrice ? '' : 'disabled') + '></div>' +
          '<div class="field"><label>คงเหลือ' + (canQty ? '' : ' 🔒') + '</label>' +
            '<input class="input" id="pQty" type="number" min="0" step="1" value="' + (p ? p.qty : 0) + '" ' + (canQty ? '' : 'disabled') + '></div>' +
          '<div class="field"><label>แจ้งเตือนเมื่อต่ำกว่า</label>' +
            '<input class="input" id="pMin" type="number" min="0" step="1" value="' + (p ? p.minQty : 3) + '"></div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">🖼 รูปภาพ & วิดีโอตัวอย่าง (ลูกค้าเห็นบนหน้าเว็บ)</div>' +
        '<div class="media-grid" id="mediaGrid"></div>' +
        '<div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:10px">' +
          '<label class="btn btn-sm btn-gold">🖼 เพิ่มรูป (เลือกได้หลายรูป)' +
            '<input type="file" id="mImg" accept="image/*" multiple style="display:none"></label>' +
          '<label class="btn btn-sm">🎬 เพิ่มวิดีโอ' +
            '<input type="file" id="mVid" accept="video/*" style="display:none"></label>' +
          '<button type="button" class="btn btn-sm" id="mUrl">🔗 ใส่ลิงก์ YouTube / ลิงก์ไฟล์</button>' +
          '<span id="mBusy" style="display:none;font-size:12.5px;color:var(--gold-lt);align-self:center"></span>' +
        '</div>' +
        '<div class="hint">รูปแรกจะถูกใช้เป็น<b>รูปหลัก</b>ของสินค้า • กด ★ เพื่อเลื่อนรูปที่ต้องการขึ้นเป็นรูปหลัก • ' +
          (cloudOn() ? 'ไฟล์เก็บบน Supabase Storage (รูปไม่เกิน 10 MB, วิดีโอไม่เกิน 50 MB)'
                     : '<b style="color:var(--warn)">ยังไม่ได้เชื่อม Supabase</b> — อัปโหลดได้เฉพาะรูป (เก็บในเครื่อง) ส่วนวิดีโอให้ใช้ลิงก์ YouTube') + '</div>' +
        '<div class="row" style="align-items:flex-start;margin-top:14px">' +
          '<div class="field" style="max-width:200px"><label>ไอคอนสำรอง (ใช้เมื่อไม่มีรูป)</label>' +
            '<input class="input" id="pEmoji" maxlength="4" value="' +
            esc(p && p.imageType !== 'url' ? p.image : '') + '" placeholder="เช่น 📦"></div>' +
        '</div>' +
        (p ? '<div class="hint">สร้างเมื่อ ' + DB.fmtDateTime(p.createdAt) + '</div>' : ''),
      okText: p ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า',
      onRender: function (ov) {
        var cat = $('#pCat', ov);
        cat.onchange = function () {
          if (cat.value === '__new') {
            var n = prompt('ชื่อหมวดหมู่ใหม่');
            if (n && n.trim()) {
              S.categories.push(n.trim()); DB.save();
              cat.innerHTML = S.categories.map(function (c) { return '<option ' + (c === n.trim() ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
                '<option value="__new">+ เพิ่มหมวดหมู่ใหม่…</option>';
            } else cat.selectedIndex = 0;
          }
        };
        /* ----- คลังรูปภาพ & วิดีโอ ----- */
        function drawMedia() {
          var box = $('#mediaGrid', ov);
          if (!media.length) {
            box.innerHTML = '<div class="media-empty">ยังไม่มีรูปหรือวิดีโอ — กดปุ่มด้านล่างเพื่อเพิ่ม</div>';
            return;
          }
          box.innerHTML = media.map(function (it, i) {
            var isCover = it.type === 'image' && media.findIndex(function (x) { return x.type === 'image'; }) === i;
            return '<div class="media-item' + (isCover ? ' cover' : '') + '">' +
              mediaThumb(it) +
              (it.type !== 'image' ? '<span class="mi-play">▶</span>' : '') +
              (isCover ? '<span class="mi-badge">รูปหลัก</span>' : '') +
              '<div class="mi-tools">' +
                (i > 0 ? '<button type="button" title="เลื่อนขึ้นเป็นรูปหลัก" data-mup="' + i + '">★</button>' : '') +
                '<button type="button" title="ลบออก" data-mdel="' + i + '">✕</button>' +
              '</div></div>';
          }).join('');
          $$('[data-mup]', box).forEach(function (b) {
            b.onclick = function () { var i = +b.dataset.mup; media.unshift(media.splice(i, 1)[0]); drawMedia(); };
          });
          $$('[data-mdel]', box).forEach(function (b) {
            b.onclick = function () {
              var it = media.splice(+b.dataset.mdel, 1)[0];
              if (it && it.path) removed.push(it.path);
              drawMedia();
            };
          });
        }
        function busy(msg) {
          var b = $('#mBusy', ov);
          b.style.display = msg ? '' : 'none';
          b.textContent = msg || '';
        }
        async function addFiles(files, kind) {
          var list = Array.prototype.slice.call(files);
          for (var i = 0; i < list.length; i++) {
            var f = list[i];
            var maxMB = kind === 'video' ? 50 : 10;
            if (f.size > maxMB * 1024 * 1024) { UI.toast(f.name + ' ใหญ่เกิน ' + maxMB + ' MB', 'err', 4000); continue; }
            busy('กำลังอัปโหลด ' + (i + 1) + '/' + list.length + '…');
            try {
              if (cloudOn()) {
                var r = await Cloud.uploadMedia(f, pid);
                media.push({ type: kind, url: r.url, path: r.path });
              } else {
                if (kind === 'video') { UI.toast('อัปโหลดวิดีโอต้องเชื่อม Supabase ก่อน — ใช้ลิงก์ YouTube แทนได้', 'warn', 5000); continue; }
                if (f.size > 1.5 * 1024 * 1024) { UI.toast(f.name + ' ใหญ่เกิน 1.5 MB (โหมดออฟไลน์)', 'err', 4000); continue; }
                var dataUrl = await new Promise(function (res, rej) {
                  var rd = new FileReader(); rd.onload = function (e) { res(e.target.result); }; rd.onerror = rej; rd.readAsDataURL(f);
                });
                media.push({ type: 'image', url: dataUrl });
              }
              drawMedia();
            } catch (e) {
              UI.toast('อัปโหลด ' + f.name + ' ไม่สำเร็จ: ' + e.message, 'err', 6000);
            }
          }
          busy('');
        }
        $('#mImg', ov).onchange = function () { addFiles(this.files, 'image'); this.value = ''; };
        $('#mVid', ov).onchange = function () { addFiles(this.files, 'video'); this.value = ''; };
        $('#mUrl', ov).onclick = function () {
          var u = prompt('วางลิงก์ YouTube หรือลิงก์ไฟล์รูป/วิดีโอ');
          if (!u) return;
          u = u.trim();
          var yid = ytId(u);
          if (yid) media.push({ type: 'youtube', url: u, id: yid });
          else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) media.push({ type: 'video', url: u });
          else media.push({ type: 'image', url: u });
          drawMedia();
        };
        drawMedia();
      },
      onOk: function (ov) {
        var name = $('#pName', ov).value.trim();
        if (!name) { UI.toast('กรุณากรอกชื่อสินค้า', 'err'); return false; }
        var emo = $('#pEmoji', ov).value.trim();
        var cover = coverOf(media, emo);
        var data = {
          name: name, sku: $('#pSku', ov).value.trim() || nextSku(),
          category: $('#pCat', ov).value === '__new' ? S.categories[0] : $('#pCat', ov).value,
          unit: $('#pUnit', ov).value.trim() || 'ชิ้น',
          minQty: Math.max(0, +$('#pMin', ov).value || 0),
          media: media, image: cover.image, imageType: cover.imageType
        };
        /* ลบไฟล์ที่เอาออกจากคลังสื่อทิ้งจริง เพื่อไม่ให้กินพื้นที่ */
        if (cloudOn()) removed.forEach(function (path) { Cloud.deleteMedia(path); });
        if (DB.can('product.price')) {
          data.cost = Math.max(0, +$('#pCost', ov).value || 0);
          data.price = Math.max(0, +$('#pPrice', ov).value || 0);
          if (!data.price) { UI.toast('กรุณากรอกราคาขาย', 'err'); return false; }
        }
        if (p) {
          var oldQty = p.qty;
          Object.assign(p, data);
          if (DB.can('stock.adjust')) {
            var nq = Math.max(0, +$('#pQty', ov).value || 0);
            if (nq !== oldQty) { p.qty = nq; DB.stockLog(p, 'adjust', nq - oldQty, 'แก้ไขจากฟอร์มสินค้า'); }
          }
          DB.logAct('แก้ไขสินค้า', p.sku + ' • ' + p.name);
          UI.toast('บันทึกการแก้ไขแล้ว', 'ok');
        } else {
          if (!DB.can('product.create')) { UI.toast('ไม่มีสิทธิ์เพิ่มสินค้า', 'err'); return false; }
          var np = Object.assign({
            id: pid, cost: 0, price: 0, qty: 0, active: true, createdAt: DB.nowISO()
          }, data);
          np.qty = DB.can('stock.adjust') ? Math.max(0, +$('#pQty', ov).value || 0) : 0;
          DB.state.products.push(np);
          DB.stockLog(np, 'new', np.qty, 'สร้างสินค้าใหม่');
          DB.logAct('เพิ่มสินค้า', np.sku + ' • ' + np.name);
          UI.toast('เพิ่มสินค้าเรียบร้อย', 'ok');
        }
        DB.save(); App.render();
      }
    });
  }
  function nextSku() {
    var n = DB.state.products.length + 1;
    return 'CRW-' + String(n).padStart(3, '0');
  }

  function adjustForm(id) {
    var p = DB.product(id);
    UI.modal({
      title: 'รับเข้า / ปรับสต๊อก — ' + p.name,
      body: '<div class="tip mb16"><span class="i">📦</span><div>คงเหลือปัจจุบัน <b>' + p.qty + ' ' + esc(p.unit) + '</b> • จุดสั่งซื้อขั้นต่ำ ' + p.minQty + '</div></div>' +
        '<div class="field"><label>ประเภทรายการ</label><select class="input" id="aType">' +
        '<option value="in">รับสินค้าเข้า (+)</option><option value="adjust">ปรับลด / ของเสีย (−)</option>' +
        '<option value="set">ตั้งค่าคงเหลือใหม่ (ตรวจนับ)</option></select></div>' +
        '<div class="field"><label>จำนวน</label><input class="input" id="aQty" type="number" min="0" step="1" value="1"></div>' +
        (DB.can('product.price') ? '<div class="field"><label>อัปเดตราคาทุนต่อหน่วย (ถ้ามี)</label><input class="input" id="aCost" type="number" min="0" step="0.01" placeholder="' + p.cost + '"></div>' : '') +
        '<div class="field"><label>หมายเหตุ</label><input class="input" id="aNote" placeholder="เช่น รับจากซัพพลายเออร์ A / ของแตกชำรุด"></div>',
      okText: 'บันทึก',
      onOk: function (ov) {
        var t = $('#aType', ov).value, q = Math.max(0, +$('#aQty', ov).value || 0);
        if (!q && t !== 'set') { UI.toast('กรุณาระบุจำนวน', 'err'); return false; }
        var before = p.qty, delta;
        if (t === 'in') p.qty += q;
        else if (t === 'adjust') p.qty = Math.max(0, p.qty - q);
        else p.qty = q;
        delta = p.qty - before;
        var c = $('#aCost', ov);
        if (c && c.value !== '') p.cost = Math.max(0, +c.value || 0);
        DB.stockLog(p, t === 'in' ? 'in' : 'adjust', delta, $('#aNote', ov).value.trim());
        DB.logAct('ปรับสต๊อก', p.name + ' ' + (delta >= 0 ? '+' : '') + delta + ' → คงเหลือ ' + p.qty);
        UI.toast('อัปเดตสต๊อกแล้ว', 'ok');
        App.render();
      }
    });
  }

  /* ==========================================================
     Order Online
     ========================================================== */
  var of_ = { st: 'all' };

  V.orders = function (el) {
    var S = DB.state, orders = S.orders;
    var cnt = {};
    Object.keys(DB.ORDER_STATUS).forEach(function (k) { cnt[k] = orders.filter(function (o) { return o.status === k; }).length; });
    var link = location.href.replace(/index\.html.*$/, '') .replace(/#.*$/, '') + 'order.html';

    el.innerHTML =
      '<div class="grid g-4 mb16">' +
        card('รอติดต่อกลับ', cnt['new'] + ' ออเดอร์', 'ควรติดต่อภายใน 24 ชม.', '🔔') +
        card('กำลังดำเนินการ', (cnt['contacted'] + cnt['confirmed']) + ' ออเดอร์', 'ติดต่อแล้ว/ยืนยันแล้ว', '📞') +
        card('ปิดการขายแล้ว', cnt['done'] + ' ออเดอร์', 'แปลงเป็นบิลขายเรียบร้อย', '✓') +
        card('มูลค่ารอปิดการขาย', cur() + money(orders.filter(function (o) { return ['new', 'contacted', 'confirmed'].indexOf(o.status) > -1; })
          .reduce(function (a, o) { return a + o.total; }, 0)), 'โอกาสทางการขายที่ยังค้างอยู่', '💰') +
      '</div>' +

      '<div class="card mb16"><div class="flex" style="flex-wrap:wrap;gap:12px">' +
        '<div style="flex:1;min-width:220px"><div style="font-weight:700;margin-bottom:4px">🔗 ลิงก์หน้าสั่งซื้อสำหรับลูกค้า</div>' +
        '<div style="font-size:12px;color:var(--muted-2);word-break:break-all">' + esc(link) + '</div></div>' +
        '<button class="btn" id="oCopy">📋 คัดลอกลิงก์</button>' +
        '<a class="btn btn-gold" href="order.html" target="_blank">เปิดหน้าร้านออนไลน์ →</a>' +
      '</div>' +
      '<div class="flex" style="flex-wrap:wrap;gap:8px;margin-top:12px;border-top:1px solid var(--line-soft);padding-top:12px">' +
        '<span style="font-size:12px;color:var(--muted-2)">หน้าย่อย:</span>' +
        '<a class="btn btn-sm" href="order.html" target="_blank">🏠 หน้าแรก</a>' +
        '<a class="btn btn-sm" href="shop.html" target="_blank">🛍 เลือกซื้อ</a>' +
        '<a class="btn btn-sm" href="about.html" target="_blank">📖 เกี่ยวกับ & ติดต่อ</a>' +
      '</div></div>' +

      '<div class="chip-row mb16" id="oChips">' +
        '<span class="chip ' + (of_.st === 'all' ? 'active' : '') + '" data-st="all">ทั้งหมด (' + orders.length + ')</span>' +
        Object.keys(DB.ORDER_STATUS).map(function (k) {
          return '<span class="chip ' + (of_.st === k ? 'active' : '') + '" data-st="' + k + '">' + DB.ORDER_STATUS[k].name + ' (' + cnt[k] + ')</span>';
        }).join('') +
      '</div>' +
      '<div id="oList"></div>' +
      UI.tip('<b>แนะนำเพิ่มเติม:</b> กดปุ่มโทรออกได้ทันทีจากเบอร์ลูกค้า • เมื่อลูกค้ายืนยัน ให้กด <b>“ปิดการขาย”</b> ระบบจะสร้างบิลขายและตัดสต๊อกให้อัตโนมัติ ' +
        '• ควรใส่หมายเหตุทุกครั้งหลังโทร เพื่อให้พนักงานคนอื่นรับช่วงต่อได้ • ออเดอร์ที่ค้างเกิน 24 ชม. จะถูกไฮไลต์เตือน');

    $('#oCopy').onclick = function () {
      navigator.clipboard.writeText(link).then(function () { UI.toast('คัดลอกลิงก์แล้ว', 'ok'); },
        function () { UI.toast('คัดลอกไม่สำเร็จ — คัดลอกด้วยตนเอง', 'warn'); });
    };
    $$('#oChips .chip').forEach(function (c) {
      c.onclick = function () { of_.st = c.dataset.st; App.render(); };
    });
    drawOrders();
  };

  function drawOrders() {
    var list = DB.state.orders.filter(function (o) { return of_.st === 'all' || o.status === of_.st; });
    var box = $('#oList');
    if (!list.length) { box.innerHTML = '<div class="card">' + UI.empty('✦', 'ยังไม่มีออเดอร์ในสถานะนี้', 'ออเดอร์จากหน้าเว็บจะเข้ามาที่นี่อัตโนมัติ') + '</div>'; return; }
    var canManage = DB.can('order.manage');
    box.innerHTML = '<div class="stack">' + list.map(function (o) {
      var stale = o.status === 'new' && (Date.now() - new Date(o.ts).getTime()) > 864e5;
      var st = DB.ORDER_STATUS[o.status] || DB.ORDER_STATUS['new'];
      return '<div class="card" style="' + (stale ? 'border-color:rgba(224,87,79,.4)' : '') + '">' +
        '<div class="flex" style="flex-wrap:wrap;gap:12px;margin-bottom:14px">' +
          '<div><div style="font-weight:700;font-size:15px">' + esc(o.name) + ' ' +
            '<span class="badge ' + st.cls + '">' + st.name + '</span>' +
            (stale ? ' <span class="badge b-danger">ค้างเกิน 24 ชม.</span>' : '') + '</div>' +
            '<div style="font-size:12.5px;color:var(--muted)">' + esc(o.code) + ' • ' + DB.fmtDateTime(o.ts) +
            (o.handledBy ? ' • ดูแลโดย ' + esc(o.handledBy) : '') + '</div></div>' +
          '<div style="margin-left:auto;text-align:right">' +
            '<div style="font-size:19px;font-weight:700;color:var(--gold-lt)">' + cur() + money(o.total) + '</div>' +
            '<a href="tel:' + esc(o.phone) + '" style="font-size:13px">📞 ' + esc(o.phone) + '</a></div>' +
        '</div>' +
        '<div class="flex" style="flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
          o.items.map(function (i) {
            return '<div class="flex" style="background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:7px 12px 7px 7px">' +
              UI.imgHtml(i) + '<div><div style="font-size:12.5px;font-weight:600">' + esc(i.name) + '</div>' +
              '<div style="font-size:11.5px;color:var(--muted-2)">' + cur() + money(i.price) + ' × ' + i.qty + '</div></div></div>';
          }).join('') +
        '</div>' +
        (o.note ? '<div class="tip" style="margin-bottom:12px"><span class="i">📝</span><div>' + esc(o.note) + '</div></div>' : '') +
        (canManage ? '<div class="flex" style="flex-wrap:wrap;gap:8px">' +
          (o.status === 'new' ? '<button class="btn btn-sm" data-st="contacted" data-id="' + o.id + '">✓ ติดต่อแล้ว</button>' : '') +
          (['new', 'contacted'].indexOf(o.status) > -1 ? '<button class="btn btn-sm" data-st="confirmed" data-id="' + o.id + '">✓ ลูกค้ายืนยัน</button>' : '') +
          (['confirmed', 'contacted'].indexOf(o.status) > -1 ? '<button class="btn btn-sm btn-gold" data-close-sale="' + o.id + '">💰 ปิดการขาย (สร้างบิล)</button>' : '') +
          '<button class="btn btn-sm" data-note="' + o.id + '">📝 บันทึกหมายเหตุ</button>' +
          (['done', 'cancel'].indexOf(o.status) < 0 ? '<button class="btn btn-sm btn-danger" data-st="cancel" data-id="' + o.id + '">ยกเลิกออเดอร์</button>' : '') +
          (DB.can('sale.void') ? '<button class="btn btn-sm btn-danger" data-odel="' + o.id + '" title="ลบออกจากระบบถาวร">🗑 ลบถาวร</button>' : '') +
          '</div>'
          : '<div style="font-size:12px;color:var(--muted-2)">คุณไม่มีสิทธิ์จัดการออเดอร์ (ดูอย่างเดียว)</div>') +
        '</div>';
    }).join('') + '</div>';

    $$('[data-st]', box).forEach(function (b) {
      b.onclick = function () {
        var o = DB.state.orders.find(function (x) { return x.id === b.dataset.id; });
        o.status = b.dataset.st;
        o.handledBy = DB.currentUser().name; o.handledAt = DB.nowISO();
        DB.logAct('อัปเดตออเดอร์', o.code + ' → ' + DB.ORDER_STATUS[o.status].name);
        UI.toast('อัปเดตสถานะแล้ว', 'ok'); App.refreshBadges(); App.render();
      };
    });
    $$('[data-odel]', box).forEach(function (b) {
      b.onclick = function () {
        var o = DB.state.orders.find(function (x) { return x.id === b.dataset.odel; });
        UI.confirmBox('ลบออเดอร์ถาวร', 'ลบ <b>' + esc(o.code) + '</b> (' + esc(o.name) + ') ออกจากระบบถาวร?<br>' +
          '<span style="font-size:12px;color:var(--muted-2)">ใช้สำหรับล้างรายการทดสอบหรือออเดอร์ขยะ — ถ้าเป็นลูกค้าจริงที่ไม่ซื้อแล้ว แนะนำให้กด “ยกเลิกออเดอร์” แทนเพื่อเก็บประวัติไว้</span>',
          'ลบถาวร', function () {
            DB.state.orders = DB.state.orders.filter(function (x) { return x.id !== o.id; });
            DB.logAct('ลบออเดอร์ถาวร', o.code + ' • ' + o.name);
            UI.toast('ลบออเดอร์แล้ว', 'ok'); App.refreshBadges(); App.render();
          }, true);
      };
    });
    $$('[data-note]', box).forEach(function (b) {
      b.onclick = function () {
        var o = DB.state.orders.find(function (x) { return x.id === b.dataset.note; });
        UI.modal({
          title: 'หมายเหตุ — ' + o.code,
          body: '<div class="field"><label>บันทึกการติดต่อ / รายละเอียดเพิ่มเติม</label>' +
            '<textarea class="input" id="onote" rows="4">' + esc(o.note) + '</textarea></div>',
          onOk: function (ov) {
            o.note = $('#onote', ov).value.trim(); DB.save();
            UI.toast('บันทึกแล้ว', 'ok'); App.render();
          }
        });
      };
    });
    $$('[data-close-sale]', box).forEach(function (b) {
      b.onclick = function () {
        var o = DB.state.orders.find(function (x) { return x.id === b.dataset.closeSale; });
        var short = o.items.filter(function (i) { var p = DB.product(i.pid); return !p || p.qty < i.qty; });
        UI.modal({
          title: 'ปิดการขาย ' + o.code,
          body: (short.length ? '<div class="tip" style="border-color:rgba(224,87,79,.4);margin-bottom:14px"><span class="i">⚠</span><div>' +
            'สต๊อกไม่พอสำหรับ: <b>' + short.map(function (i) { return esc(i.name); }).join(', ') + '</b> — ระบบจะตัดเท่าที่มี</div></div>' : '') +
            '<div class="sumline total" style="margin:0 0 14px"><span>ยอดรวม</span><b>' + cur() + money(o.total) + '</b></div>' +
            '<div class="field"><label>วิธีชำระเงิน</label><select class="input" id="cm">' +
            DB.PAY_METHODS.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></div>',
          okText: 'สร้างบิลขาย',
          onOk: function (ov) {
            var items = o.items.map(function (i) {
              var p = DB.product(i.pid);
              return { pid: i.pid, sku: p ? p.sku : '', name: i.name, image: i.image, imageType: i.imageType, price: i.price, cost: p ? p.cost : 0, qty: i.qty };
            });
            var sale = DB.commitSale({
              items: items, subtotal: o.total, discount: 0, vat: 0, total: o.total,
              method: $('#cm', ov).value, channel: 'ออนไลน์', received: o.total,
              customer: o.name + ' (' + o.phone + ')', note: 'จากออเดอร์ออนไลน์ ' + o.code
            });
            o.status = 'done'; o.saleId = sale.id;
            o.handledBy = DB.currentUser().name; o.handledAt = DB.nowISO();
            DB.save();
            UI.toast('สร้างบิล ' + sale.code + ' และตัดสต๊อกแล้ว', 'ok');
            UI.closeModal(); App.refreshBadges(); App.render();
            Views.showReceipt(sale);
            return false;
          }
        });
      };
    });
  }

  /* ==========================================================
     จัดการพนักงาน
     ========================================================== */
  V.staff = function (el) {
    var S = DB.state, me = DB.currentUser();
    el.innerHTML =
      '<div class="grid g-4 mb16">' +
        card('บัญชีทั้งหมด', S.users.length + ' บัญชี', S.users.filter(function (u) { return u.active; }).length + ' บัญชีใช้งานอยู่', '☗') +
        card('เจ้าของ/ผู้จัดการ', S.users.filter(function (u) { return ['owner', 'manager'].indexOf(u.role) > -1; }).length + ' คน', 'เข้าถึงข้อมูลเชิงลึกได้', '👑') +
        card('พนักงานทั่วไป', S.users.filter(function (u) { return ['cashier', 'stock', 'custom'].indexOf(u.role) > -1; }).length + ' คน', 'จำกัดสิทธิ์ตามตำแหน่ง', '👥') +
        card('บัญชีถูกระงับ', S.users.filter(function (u) { return !u.active; }).length + ' บัญชี', 'เข้าสู่ระบบไม่ได้', '🚫') +
      '</div>' +

      '<div class="card mb16"><div class="card-head"><h3>บัญชีพนักงาน</h3>' +
        '<div class="sp"><button class="btn btn-gold" id="uAdd">+ สร้างบัญชีพนักงาน</button></div></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>พนักงาน</th><th>ชื่อผู้ใช้</th><th>ตำแหน่ง</th><th>เมนูที่เห็น</th>' +
        '<th>สิทธิ์พิเศษ</th><th>เข้าระบบล่าสุด</th><th>สถานะ</th><th style="text-align:right">จัดการ</th></tr></thead><tbody>' +
        S.users.map(function (u) {
          var r = DB.ROLES[u.role] || DB.ROLES.custom;
          var deep = ['product.delete', 'product.price', 'sale.void', 'report.cost'].filter(function (a) { return (u.actions || []).indexOf(a) > -1; }).length;
          return '<tr>' +
            '<td><div class="flex"><span class="avatar">' + esc(u.name.charAt(0)) + '</span><div>' +
              '<div style="font-weight:600">' + esc(u.name) + (u.id === me.id ? ' <span class="badge b-gold">คุณ</span>' : '') + '</div>' +
              '<div style="font-size:11px;color:var(--muted-2)">' + esc(u.email || u.phone || '—') + '</div></div></div></td>' +
            '<td><code style="color:var(--gold-lt)">' + esc(u.username) + '</code></td>' +
            '<td><span class="badge ' + r.color + '">' + esc(r.name) + '</span></td>' +
            '<td>' + (u.role === 'owner' ? 'ทุกเมนู' : (u.menus || []).length + ' / ' + DB.MENUS.length + ' เมนู') + '</td>' +
            '<td>' + (u.role === 'owner' ? '<span class="badge b-gold">เต็มสิทธิ์</span>' :
              (deep ? '<span class="badge b-warn">ข้อมูลเชิงลึก ' + deep + '</span>' : '<span class="badge b-mute">พื้นฐาน</span>')) + '</td>' +
            '<td style="font-size:12px;color:var(--muted)">' + (u.lastLogin ? DB.fmtDateTime(u.lastLogin) : 'ยังไม่เคยเข้า') + '</td>' +
            '<td>' + (u.active ? '<span class="badge b-ok">ใช้งาน</span>' : '<span class="badge b-danger">ระงับ</span>') + '</td>' +
            '<td style="text-align:right;white-space:nowrap">' +
              '<button class="btn btn-sm" data-uedit="' + u.id + '">แก้ไข</button> ' +
              '<button class="btn btn-sm" data-upass="' + u.id + '">รหัสผ่าน</button> ' +
              (u.id !== me.id ? '<button class="btn btn-sm btn-danger" data-udel="' + u.id + '">ลบ</button>' : '') +
            '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +

      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>ตำแหน่งมาตรฐานในระบบ</h3></div><div class="stack">' +
          Object.keys(DB.ROLES).filter(function (k) { return k !== 'custom'; }).map(function (k) {
            var r = DB.ROLES[k];
            return '<div style="background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:12px 14px">' +
              '<div class="flex" style="margin-bottom:6px"><span class="badge ' + r.color + '">' + esc(r.name) + '</span>' +
              '<span style="font-size:11.5px;color:var(--muted-2);margin-left:auto">' + r.menus.length + ' เมนู • ' + r.actions.length + ' สิทธิ์</span></div>' +
              '<div style="font-size:12px;color:var(--muted);line-height:1.6">เมนู: ' +
              r.menus.map(function (m) { var mm = DB.MENUS.find(function (x) { return x.id === m; }); return mm ? mm.name : m; }).join(' · ') + '</div></div>';
          }).join('') + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>◆ แนะนำเพิ่มเติมด้านความปลอดภัย</h3></div><div class="stack">' +
          bullet('แยกบัญชีรายบุคคล ห้ามใช้ร่วมกัน', 'ทุกบิล ทุกการปรับสต๊อก จะผูกกับชื่อคนทำ ตรวจสอบย้อนหลังได้จริง') +
          bullet('ปิดสิทธิ์ “แก้ไขราคา” และ “ลบสินค้า” สำหรับพนักงานขาย', 'เป็นข้อมูลเชิงลึกที่กระทบต้นทุน-กำไร ควรเปิดเฉพาะผู้จัดการขึ้นไป') +
          bullet('พนักงานลาออก ให้ “ระงับบัญชี” แทนการลบ', 'ประวัติการขายเดิมยังอ้างอิงชื่อได้ครบถ้วน') +
          (cloudOn()
            ? bullet('ระงับบัญชี = ตัดสิทธิ์ทันทีทุกเครื่อง', 'ระบบซิงก์เรียลไทม์ พนักงานที่ถูกระงับจะใช้งานต่อไม่ได้แม้เปิดหน้าค้างไว้') +
              bullet('ลบพนักงานในแอปไม่ได้ลบบัญชีอีเมล', 'ถ้าต้องการลบถาวร ให้ไปลบที่ Supabase → Authentication → Users ด้วย')
            : bullet('เปลี่ยนรหัสผ่าน admin ทันทีหลังติดตั้ง', 'ค่าเริ่มต้นคือ 1234 ซึ่งไม่ปลอดภัยสำหรับใช้งานจริง')) +
          '</div>' + UI.tip(cloudOn()
            ? 'ข้อมูลเก็บบน <b>Supabase</b> แล้ว — พนักงานทุกคนเห็นข้อมูลชุดเดียวกันและอัปเดตทันทีทุกเครื่อง ' +
              'รหัสผ่านเก็บแบบเข้ารหัสในระบบ Auth เจ้าของร้านก็ดูไม่ได้ ใช้ปุ่ม “รหัสผ่าน” เพื่อส่งลิงก์ตั้งใหม่ทางอีเมลแทน'
            : 'ระบบนี้เก็บข้อมูลไว้ในเครื่องที่เปิดใช้งาน (localStorage) — เหมาะกับการใช้ในร้าน 1 เครื่อง หากต้องการให้พนักงานหลายคนเห็นข้อมูลเดียวกันแบบเรียลไทม์ ต้องต่อฐานข้อมูลบนเซิร์ฟเวอร์เพิ่ม') +
        '</div>' +
      '</div>';

    $('#uAdd').onclick = function () { userForm(null); };
    $$('[data-uedit]').forEach(function (b) { b.onclick = function () { userForm(b.dataset.uedit); }; });
    $$('[data-upass]').forEach(function (b) { b.onclick = function () { passForm(b.dataset.upass); }; });
    $$('[data-udel]').forEach(function (b) {
      b.onclick = function () {
        var u = S.users.find(function (x) { return x.id === b.dataset.udel; });
        if (u.role === 'owner' && S.users.filter(function (x) { return x.role === 'owner'; }).length <= 1) {
          return UI.toast('ต้องมีบัญชีเจ้าของร้านอย่างน้อย 1 บัญชี', 'err');
        }
        UI.confirmBox('ลบบัญชีพนักงาน', 'ลบบัญชี <b>' + esc(u.name) + '</b> ออกจากระบบ?<br>' +
          '<span style="font-size:12px;color:var(--muted-2)">แนะนำให้ใช้การ “ระงับบัญชี” แทน เพื่อคงประวัติการขายให้ตรวจสอบได้' +
          (cloudOn() ? '<br>หมายเหตุ: การลบนี้ตัดสิทธิ์เข้าใช้งานทันที แต่บัญชีอีเมลยังค้างอยู่ใน Supabase → Authentication → Users หากต้องการลบถาวรให้ไปลบที่นั่นด้วย' : '') +
          '</span>',
          'ลบบัญชี', function () {
            S.users = S.users.filter(function (x) { return x.id !== u.id; });
            DB.logAct('ลบบัญชีพนักงาน', u.name + ' (' + u.username + ')');
            UI.toast('ลบบัญชีแล้ว', 'ok'); App.render();
          }, true);
      };
    });
  };

  function userForm(id) {
    var S = DB.state, u = id ? S.users.find(function (x) { return x.id === id; }) : null;
    var menus = u ? (u.menus || []).slice() : DB.ROLES.cashier.menus.slice();
    var acts = u ? (u.actions || []).slice() : DB.ROLES.cashier.actions.slice();
    var role = u ? u.role : 'cashier';

    UI.modal({
      title: u ? 'แก้ไขพนักงาน — ' + u.name : 'สร้างบัญชีพนักงานใหม่', wide: true,
      body:
        '<div class="row">' +
          '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="input" id="uName" value="' + esc(u ? u.name : '') + '"></div>' +
          '<div class="field"><label>เบอร์โทร</label><input class="input" id="uPhone" value="' + esc(u ? u.phone : '') + '"></div>' +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label>ชื่อผู้ใช้ (username) <span class="req">*</span></label>' +
            '<input class="input" id="uUser" value="' + esc(u ? u.username : '') + '" placeholder="ภาษาอังกฤษ ไม่เว้นวรรค"></div>' +
          (cloudOn()
            ? '<div class="field"><label>อีเมลสำหรับเข้าสู่ระบบ <span class="req">*</span></label>' +
                '<input class="input" id="uEmail" type="email" value="' + esc(u ? (u.email || '') + '' : '') + '" ' +
                (u ? 'disabled' : 'placeholder="staff@example.com"') + '></div>'
            : '') +
          (u ? '' : '<div class="field"><label>รหัสผ่าน' + (cloudOn() ? ' (อย่างน้อย 6 ตัว)' : '') + ' <span class="req">*</span></label>' +
                '<input class="input" id="uPass" type="text" value="' + (cloudOn() ? '' : '1234') + '"></div>') +
        '</div>' +
        (cloudOn() && !u ? UI.tip('ระบบจะสร้างบัญชีเข้าสู่ระบบใน Supabase ให้อัตโนมัติ พนักงานใช้ <b>อีเมลและรหัสผ่านนี้</b> เข้าระบบได้ทันที และเปลี่ยนรหัสผ่านเองภายหลังได้จากลิงก์ "ลืมรหัสผ่าน"') : '') +
        '<div class="field"><label>ตำแหน่ง (เลือกเพื่อกำหนดสิทธิ์อัตโนมัติ)</label>' +
          '<select class="input" id="uRole">' + Object.keys(DB.ROLES).map(function (k) {
            return '<option value="' + k + '" ' + (role === k ? 'selected' : '') + '>' + esc(DB.ROLES[k].name) + '</option>';
          }).join('') + '</select>' +
          '<div class="hint">เลือกตำแหน่งแล้วยังปรับสิทธิ์รายข้อด้านล่างเพิ่มเติมได้</div></div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">เมนูที่พนักงานคนนี้มองเห็น</div>' +
        '<div class="perm-grid" id="menuGrid">' + DB.MENUS.map(function (m) {
          return '<label class="perm"><input type="checkbox" class="mchk" value="' + m.id + '" ' + (menus.indexOf(m.id) > -1 ? 'checked' : '') + '>' +
            '<div><div class="t">' + m.icon + ' ' + esc(m.name) + '</div><div class="d">กลุ่ม: ' + esc(m.group) + '</div></div></label>';
        }).join('') + '</div>' +
        '<div class="divider"></div>' +
        '<div class="sec-title">สิทธิ์การทำงาน (🔒 = ข้อมูลเชิงลึก ควรจำกัด)</div>' +
        '<div class="perm-grid" id="actGrid">' + DB.ACTIONS.map(function (a) {
          var deep = ['product.delete', 'product.price', 'sale.void', 'report.cost'].indexOf(a.id) > -1;
          return '<label class="perm"><input type="checkbox" class="achk" value="' + a.id + '" ' + (acts.indexOf(a.id) > -1 ? 'checked' : '') + '>' +
            '<div><div class="t">' + (deep ? '🔒 ' : '') + esc(a.name) + '</div><div class="d">' + esc(a.desc) + '</div></div></label>';
        }).join('') + '</div>' +
        (u ? '<div class="divider"></div><label class="perm" style="max-width:260px"><input type="checkbox" id="uActive" ' + (u.active ? 'checked' : '') + '>' +
          '<div><div class="t">เปิดใช้งานบัญชี</div><div class="d">ปิดเพื่อระงับการเข้าสู่ระบบ</div></div></label>' : ''),
      okText: u ? 'บันทึก' : 'สร้างบัญชี',
      onRender: function (ov) {
        $('#uRole', ov).onchange = function () {
          var r = DB.ROLES[this.value];
          $$('.mchk', ov).forEach(function (c) { c.checked = r.menus.indexOf(c.value) > -1; });
          $$('.achk', ov).forEach(function (c) { c.checked = r.actions.indexOf(c.value) > -1; });
        };
      },
      onOk: function (ov) {
        var name = $('#uName', ov).value.trim(), un = $('#uUser', ov).value.trim().toLowerCase();
        if (!name || !un) { UI.toast('กรุณากรอกชื่อและ username', 'err'); return false; }
        if (S.users.some(function (x) { return x.username.toLowerCase() === un && (!u || x.id !== u.id); })) {
          UI.toast('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 'err'); return false;
        }
        var m = $$('.mchk', ov).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        var a = $$('.achk', ov).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        if (!m.length) { UI.toast('ต้องเลือกอย่างน้อย 1 เมนู', 'err'); return false; }
        var rl = $('#uRole', ov).value;
        if (u) {
          if (u.role === 'owner' && rl !== 'owner' && S.users.filter(function (x) { return x.role === 'owner'; }).length <= 1) {
            UI.toast('ต้องมีเจ้าของร้านอย่างน้อย 1 บัญชี', 'err'); return false;
          }
          Object.assign(u, { name: name, username: un, phone: $('#uPhone', ov).value.trim(), role: rl, menus: m, actions: a });
          var ac = $('#uActive', ov); if (ac) u.active = ac.checked;
          DB.logAct('แก้ไขบัญชีพนักงาน', name + ' (' + un + ') • ตำแหน่ง ' + DB.ROLES[rl].name);
          UI.toast('บันทึกข้อมูลพนักงานแล้ว', 'ok');
        } else if (cloudOn()) {
          /* สร้างบัญชีเข้าสู่ระบบใน Supabase Auth ก่อน แล้วค่อยบันทึกข้อมูลพนักงาน */
          var email = ($('#uEmail', ov).value || '').trim();
          var pw2 = $('#uPass', ov).value || '';
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { UI.toast('กรุณากรอกอีเมลให้ถูกต้อง', 'err'); return false; }
          if (pw2.length < 6) { UI.toast('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 'err'); return false; }
          var btn = $('#mdOk', ov);
          btn.disabled = true; btn.textContent = 'กำลังสร้างบัญชี…';
          Cloud.createAuthUser(email, pw2).then(function (uid) {
            S.users.push({
              id: uid, email: email, username: un, name: name,
              role: rl, menus: m, actions: a, phone: $('#uPhone', ov).value.trim(),
              active: true, createdAt: DB.nowISO(), lastLogin: null
            });
            DB.logAct('สร้างบัญชีพนักงาน', name + ' (' + email + ') • ตำแหน่ง ' + DB.ROLES[rl].name);
            UI.closeModal(); App.render();
            UI.toast('สร้างบัญชี ' + email + ' เรียบร้อย — แจ้งรหัสผ่านให้พนักงานได้เลย', 'ok', 6000);
          }).catch(function (err) {
            btn.disabled = false; btn.textContent = 'สร้างบัญชี';
            UI.toast('สร้างบัญชีไม่สำเร็จ: ' + err.message, 'err', 6000);
          });
          return false;
        } else {
          var pw = $('#uPass', ov).value || '1234';
          S.users.push({
            id: DB.uid('u'), username: un, name: name, pass: DB.hash(pw),
            role: rl, menus: m, actions: a, phone: $('#uPhone', ov).value.trim(),
            active: true, createdAt: DB.nowISO(), lastLogin: null
          });
          DB.logAct('สร้างบัญชีพนักงาน', name + ' (' + un + ') • ตำแหน่ง ' + DB.ROLES[rl].name);
          UI.toast('สร้างบัญชี ' + un + ' เรียบร้อย (รหัสผ่าน: ' + pw + ')', 'ok', 5000);
        }
        DB.save(); App.render();
      }
    });
  }

  function cloudOn() { return !!(window.Cloud && Cloud.isOn()); }

  /* การ์ดสถานะ Supabase ในหน้าจัดการเว็บไซต์ */
  function cloudCard() {
    var C = window.Cloud;
    var st = C ? C.status : 'local';
    var badge = {
      online: '<span class="badge b-ok">● เชื่อมต่อแล้ว — ซิงก์เรียลไทม์</span>',
      connecting: '<span class="badge b-warn">● กำลังเชื่อมต่อ…</span>',
      error: '<span class="badge b-danger">● เชื่อมต่อไม่สำเร็จ</span>',
      signedout: '<span class="badge b-mute">● ยังไม่เข้าสู่ระบบ</span>',
      local: '<span class="badge b-mute">● ยังไม่ได้ตั้งค่า</span>'
    }[st] || '';

    var body;
    if (st === 'online') {
      var host = '';
      try { host = new URL(window.CC_CONFIG.SUPABASE_URL).host; } catch (e) { }
      body =
        '<div class="grid g-4 mb16">' +
          card('สินค้า', DB.state.products.length + ' รายการ', 'ซิงก์แล้ว', '▤') +
          card('บิลขาย', DB.state.sales.length + ' บิล', 'ซิงก์แล้ว', '🧾') +
          card('ออเดอร์ออนไลน์', DB.state.orders.length + ' รายการ', 'เข้ามาแบบเรียลไทม์', '✦') +
          card('บัญชีพนักงาน', DB.state.users.length + ' บัญชี', 'ล็อกอินผ่าน Supabase Auth', '☗') +
        '</div>' +
        UI.tip('ฐานข้อมูล <b>' + esc(host) + '</b> • ทุกเครื่องที่เข้าระบบจะเห็นข้อมูลชุดเดียวกันและอัปเดตทันทีโดยไม่ต้องรีเฟรช ' +
          '• ออเดอร์ที่ลูกค้าสั่งจากหน้าเว็บจะเด้งเข้ามาที่เมนู Order Online ทันที') +
        '<div class="flex" style="gap:9px;flex-wrap:wrap;margin-top:14px">' +
          '<button class="btn" id="cloudPull">⬇ ดึงข้อมูลล่าสุดจากคลาวด์</button>' +
          '<button class="btn" id="cloudPush">⬆ อัปโหลดข้อมูลในเครื่องขึ้นคลาวด์ทั้งหมด</button>' +
        '</div>';
    } else if (st === 'error') {
      body = UI.tip('<b>เชื่อมต่อไม่สำเร็จ:</b> ' + esc(C ? C.error : '') +
        '<br>ตรวจสอบว่า URL และ anon key ใน <b>assets/js/config.js</b> ถูกต้อง และรันไฟล์ <b>supabase/schema.sql</b> ใน SQL Editor แล้ว');
    } else {
      body =
        UI.tip('ตอนนี้ข้อมูลเก็บอยู่ใน<b>เบราว์เซอร์เครื่องนี้เครื่องเดียว</b> — ออเดอร์ที่ลูกค้าสั่งจากเว็บจริงจะยังไม่เข้ามาที่นี่') +
        '<div class="sec-title" style="margin-top:16px">วิธีเปิดใช้งานฐานข้อมูลกลาง</div>' +
        '<div class="stack">' +
          bullet('1. สร้างโปรเจกต์ที่ supabase.com', 'เลือกภูมิภาค Singapore จะเร็วที่สุดสำหรับผู้ใช้ในไทย') +
          bullet('2. รันไฟล์ supabase/schema.sql', 'เปิด SQL Editor ในโปรเจกต์ → วางทั้งไฟล์ → Run (สร้างตาราง สิทธิ์ และเปิด Realtime ให้ครบ)') +
          bullet('3. ใส่ค่าใน assets/js/config.js', 'คัดลอก Project URL และ anon key จาก Project Settings → API (ห้ามใช้ service_role key)') +
          bullet('4. สร้างบัญชีเจ้าของร้านคนแรก', 'ทำตามคำอธิบายท้ายไฟล์ schema.sql แล้วเข้าสู่ระบบด้วยอีเมลนั้น') +
        '</div>';
    }
    return '<div class="card gold-edge mb16"><div class="card-head"><h3>☁ ฐานข้อมูลกลาง & ซิงก์เรียลไทม์ (Supabase)</h3>' +
      '<div class="sp">' + badge + '</div></div>' + body + '</div>';
  }

  function passForm(id) {
    var u = DB.state.users.find(function (x) { return x.id === id; });

    /* โหมด Supabase: รหัสผ่านอยู่ในระบบ Auth เปลี่ยนแทนกันไม่ได้
       จึงส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของพนักงานแทน */
    if (cloudOn()) {
      UI.modal({
        title: 'รหัสผ่าน — ' + u.name,
        body: UI.tip('ระบบเก็บรหัสผ่านไว้ใน Supabase Auth แบบเข้ารหัส แม้แต่เจ้าของร้านก็ดูหรือตั้งแทนกันไม่ได้ ' +
          '<b>วิธีที่ปลอดภัยคือส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของพนักงาน</b>') +
          '<div class="field" style="margin-top:14px"><label>อีเมลของพนักงาน</label>' +
          '<input class="input" id="rpEmail" type="email" value="' + esc(u.email || '') + '"></div>',
        okText: '📧 ส่งลิงก์ตั้งรหัสผ่านใหม่',
        onOk: function (ov) {
          var em = ($('#rpEmail', ov).value || '').trim();
          if (!em) { UI.toast('กรุณากรอกอีเมล', 'err'); return false; }
          var sb = Cloud.client();
          sb.auth.resetPasswordForEmail(em).then(function (r) {
            if (r.error) UI.toast(r.error.message, 'err', 5000);
            else { UI.toast('ส่งลิงก์ไปที่ ' + em + ' แล้ว', 'ok', 5000); DB.logAct('ส่งลิงก์ตั้งรหัสผ่านใหม่', em); }
          });
        }
      });
      return;
    }

    UI.modal({
      title: 'เปลี่ยนรหัสผ่าน — ' + u.name,
      body: '<div class="field"><label>รหัสผ่านใหม่ <span class="req">*</span></label><input class="input" id="np" type="text" placeholder="อย่างน้อย 4 ตัวอักษร"></div>' +
        '<div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input class="input" id="np2" type="text"></div>',
      okText: 'เปลี่ยนรหัสผ่าน',
      onOk: function (ov) {
        var a = $('#np', ov).value, b = $('#np2', ov).value;
        if (a.length < 4) { UI.toast('รหัสผ่านสั้นเกินไป', 'err'); return false; }
        if (a !== b) { UI.toast('รหัสผ่านยืนยันไม่ตรงกัน', 'err'); return false; }
        u.pass = DB.hash(a);
        DB.logAct('เปลี่ยนรหัสผ่าน', 'บัญชี ' + u.username);
        UI.toast('เปลี่ยนรหัสผ่านเรียบร้อย', 'ok');
      }
    });
  }

  /* ==========================================================
     จัดการเว็บไซต์ (ตั้งค่า)
     ========================================================== */
  V.settings = function (el) {
    var S = DB.state.settings;
    var pts = S.aboutPoints || [];
    el.innerHTML =
      /* ---------- โลโก้ & แบรนด์ ---------- */
      '<div class="card gold-edge mb16"><div class="card-head"><h3>โลโก้ & เอกลักษณ์แบรนด์</h3>' +
        '<div class="sp"><span class="badge b-gold">ใช้ทุกหน้า: เข้าสู่ระบบ · แดชบอร์ด · หน้าเว็บ · ใบเสร็จ · ไอคอนแท็บ</span></div></div>' +
        '<div class="row" style="align-items:flex-start">' +
          '<div style="flex:0 0 150px"><label style="font-size:12.5px;color:var(--muted)">ตัวอย่างโลโก้</label>' +
            '<div id="logoPrev" class="login-logo" data-logo style="width:132px;height:132px;margin:6px 0 0">' + UI.logoImg() + '</div></div>' +
          '<div style="flex:2">' +
            (/^data:/.test(S.logoUrl || '')
              ? '<div class="field"><label>โลโก้ปัจจุบัน</label><input class="input" value="ไฟล์ที่อัปโหลดไว้ในเครื่องนี้" disabled>' +
                '<button class="btn btn-sm" id="logoReset" style="margin-top:8px">↺ กลับไปใช้ไฟล์ assets/img/logo.png</button></div>'
              : f('ที่อยู่ไฟล์โลโก้ (path หรือ URL)', 'logoUrl', S.logoUrl)) +
            '<div class="hint">แนะนำให้บันทึกไฟล์โลโก้ไว้ที่ <b>assets/img/logo.png</b> เพื่อให้ลูกค้าทุกคนเห็นบนเว็บที่เผยแพร่จริง</div>' +
            '<div class="field" style="margin-top:12px"><label>หรืออัปโหลดไฟล์จากเครื่อง</label>' +
              '<input type="file" id="logoFile" accept="image/*" style="font-size:12.5px">' +
              '<div class="hint">ไฟล์ที่อัปโหลดจะเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น (เห็นเฉพาะเครื่องนี้) — ถ้าจะให้ลูกค้าเห็นด้วย ต้องวางไฟล์จริงในโฟลเดอร์ assets/img</div></div>' +
          '</div>' +
          '<div style="flex:2">' +
            f('ชื่อร้าน', 'shopName', S.shopName) +
            f('สโลแกนใต้ชื่อ', 'tagline', S.tagline) +
            f('สกุลเงิน', 'currency', S.currency) +
          '</div>' +
        '</div></div>' +

      '<div class="grid g-2 mb16">' +
        /* ---------- หน้าแรก ---------- */
        '<div class="card"><div class="card-head"><h3>🏠 หน้าแรก — สินค้าที่นำเสนอ</h3></div>' +
          '<div class="field"><label>สินค้าเด่นที่โชว์บนหน้าแรก <span class="req">*</span></label>' +
            '<select class="input" data-k="featuredId">' +
            DB.state.products.filter(function (p) { return p.active; }).map(function (p) {
              return '<option value="' + p.id + '" ' + (S.featuredId === p.id ? 'selected' : '') + '>' +
                esc(p.name) + ' — ' + cur() + money(p.price) + '</option>';
            }).join('') + '</select>' +
            '<div class="hint">สินค้าที่เลือกจะขึ้นเป็นฉากใหญ่หน้าแรกพร้อมรูป ราคา และปุ่มสั่งซื้อ</div></div>' +
          f('ป้ายกำกับเหนือหัวข้อ', 'heroBadge', S.heroBadge) +
          f('หัวข้อใหญ่', 'heroTitle', S.heroTitle) +
          '<div class="field"><label>ข้อความอธิบายใต้หัวข้อ</label><textarea class="input" data-k="heroText" rows="3">' + esc(S.heroText) + '</textarea></div>' +
          f('ข้อความบนปุ่ม', 'heroCta', S.heroCta) +
        '</div>' +

        /* ---------- ติดต่อ ---------- */
        '<div class="card"><div class="card-head"><h3>📞 ติดต่อ — ช่องทางติดต่อร้าน</h3></div>' +
          f('เบอร์โทรศัพท์', 'phone', S.phone) +
          '<div class="row">' + f('LINE ID', 'line', S.line) + f('ลิงก์ LINE (line.me/…)', 'lineUrl', S.lineUrl) + '</div>' +
          '<div class="row">' + f('ชื่อเพจ Facebook', 'facebook', S.facebook) + f('ลิงก์ Facebook', 'facebookUrl', S.facebookUrl) + '</div>' +
          f('อีเมล (ถ้ามี)', 'email', S.email) +
          f('ที่อยู่ร้าน', 'address', S.address) +
          '<div class="row">' + f('เวลาทำการ', 'openHours', S.openHours) + f('ลิงก์แผนที่ (Google Maps)', 'mapUrl', S.mapUrl) + '</div>' +
        '</div>' +
      '</div>' +

      /* ---------- เกี่ยวกับ ---------- */
      '<div class="card mb16"><div class="card-head"><h3>📖 เกี่ยวกับ — เรื่องราวก่อนจะมาเป็น Crow’s Case</h3></div>' +
        '<div class="row">' + f('หัวข้อหน้าเกี่ยวกับ', 'aboutTitle', S.aboutTitle) + f('ก่อตั้งปี', 'founded', S.founded) + '</div>' +
        '<div class="field"><label>เนื้อหา (เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่)</label>' +
          '<textarea class="input" data-k="aboutText" rows="7">' + esc(S.aboutText) + '</textarea></div>' +
        '<div class="sec-title">จุดเด่น 3 ข้อ (แสดงเป็นการ์ดใต้เนื้อหา)</div>' +
        '<div class="grid g-3">' + [0, 1, 2].map(function (i) {
          var p = pts[i] || { t: '', d: '' };
          return '<div style="background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:12px">' +
            '<div class="field"><label>หัวข้อที่ ' + (i + 1) + '</label><input class="input" data-ap="' + i + '|t" value="' + esc(p.t) + '"></div>' +
            '<div class="field" style="margin:0"><label>คำอธิบาย</label><textarea class="input" data-ap="' + i + '|d" rows="3">' + esc(p.d) + '</textarea></div></div>';
        }).join('') + '</div></div>' +

      /* ---------- คำแปลหลายภาษา ---------- */
      '<div class="card mb16"><div class="card-head"><h3>🌐 เนื้อหาหลายภาษา (English / 中文)</h3>' +
        '<div class="sp"><span class="badge b-mute">เว้นว่าง = ใช้ข้อความภาษาไทย</span></div></div>' +
        UI.tip('ลูกค้ากดสลับภาษาได้ที่มุมขวาบนของหน้าเว็บ • ข้อความประจำหน้าเว็บ (เมนู ปุ่ม ฟอร์ม ขั้นตอนสั่งซื้อ) ระบบแปลให้อัตโนมัติแล้ว ' +
          'ช่องด้านล่างนี้ใช้แปลเฉพาะ<b>เนื้อหาที่คุณเขียนเอง</b> • <b>ชื่อสินค้าและหมวดหมู่</b>จะแสดงตามที่กรอกในสต๊อกทุกภาษา หากต้องการชื่ออังกฤษ แนะนำตั้งชื่อสินค้าแบบไทย-อังกฤษในบรรทัดเดียว') +
        '<div class="grid g-2" style="margin-top:16px">' +
          [['en', 'English 🇬🇧'], ['zh', '中文 🇨🇳']].map(function (L) {
            var t = (S.i18n && S.i18n[L[0]]) || {};
            return '<div style="background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:16px">' +
              '<div class="sec-title">' + esc(L[1]) + '</div>' +
              ft('ป้ายกำกับหน้าแรก', L[0], 'heroBadge', t.heroBadge) +
              ft('หัวข้อใหญ่หน้าแรก', L[0], 'heroTitle', t.heroTitle) +
              fta('คำโปรยหน้าแรก', L[0], 'heroText', t.heroText, 3) +
              ft('ข้อความบนปุ่ม', L[0], 'heroCta', t.heroCta) +
              ft('หัวข้อหน้าเกี่ยวกับ', L[0], 'aboutTitle', t.aboutTitle) +
              fta('เนื้อหาหน้าเกี่ยวกับ', L[0], 'aboutText', t.aboutText, 6) +
              '</div>';
          }).join('') +
        '</div></div>' +

      /* ---------- ภาษี ---------- */
      '<div class="card mb16"><div class="card-head"><h3>ภาษี & การแสดงผล</h3></div>' +
        '<div class="grid g-3">' +
          '<div><label class="perm"><input type="checkbox" id="vatOn" ' + (S.vatEnabled ? 'checked' : '') + '>' +
            '<div><div class="t">คิด VAT ในบิลขาย</div><div class="d">เพิ่มบรรทัดภาษีในหน้าชำระเงินและใบเสร็จ</div></div></label>' +
            '<div style="margin-top:10px">' + f('อัตรา VAT (%)', 'vatRate', S.vatRate, 'number') + '</div></div>' +
          '<div><label class="perm"><input type="checkbox" id="lowOn" ' + (S.lowStockAlert ? 'checked' : '') + '>' +
            '<div><div class="t">แจ้งเตือนสินค้าใกล้หมด</div><div class="d">แสดงตัวเลขเตือนบนเมนูสต๊อกและหน้าภาพรวม</div></div></label></div>' +
          '<div>' + f('ข้อความท้ายใบเสร็จ / ท้ายเว็บ', 'orderFooter', S.orderFooter) + '</div>' +
        '</div></div>' +

      '<div class="card mb16"><div class="card-head"><h3>โทนสีเว็บไซต์</h3><div class="sp"><span class="badge b-gold">ธีมพรีเมียม ดำ-ทอง</span></div></div>' +
        '<div class="chip-row" id="accents">' +
          [['#d4af37', 'ทองคลาสสิก'], ['#e8c86a', 'ทองอ่อน'], ['#c9a227', 'ทองเข้ม'], ['#b08d57', 'ทองแชมเปญ'], ['#cd7f32', 'ทองแดง']]
            .map(function (a) {
              return '<span class="chip ' + ((DB.state.settings.accent || '#d4af37') === a[0] ? 'active' : '') + '" data-acc="' + a[0] + '">' +
                '<i style="display:inline-block;width:11px;height:11px;border-radius:50%;background:' + a[0] + ';margin-right:7px;vertical-align:-1px"></i>' + a[1] + '</span>';
            }).join('') +
        '</div>' +
        '<div class="hint">โครงสีหลักยังคงเป็นดำ-ทองพรีเมียม เปลี่ยนได้เฉพาะเฉดทองเพื่อให้เข้ากับแบรนด์</div></div>' +

      /* ---------- Supabase ---------- */
      cloudCard() +

      '<div class="card mb16"><div class="card-head"><h3>หมวดหมู่สินค้า</h3>' +
        '<div class="sp"><button class="btn btn-sm" id="catAdd">+ เพิ่มหมวดหมู่</button></div></div>' +
        '<div class="chip-row" id="catList">' + DB.state.categories.map(function (c, i) {
          return '<span class="chip">' + esc(c) + ' <b data-catdel="' + i + '" style="color:var(--danger);margin-left:6px;cursor:pointer">×</b></span>';
        }).join('') + '</div></div>' +

      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>สำรอง & กู้คืนข้อมูล</h3></div>' +
          '<div class="stack">' +
            '<button class="btn btn-block" id="bkExport">⬇ ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</button>' +
            '<label class="btn btn-block" style="cursor:pointer">⬆ นำเข้าไฟล์สำรอง<input type="file" id="bkImport" accept=".json" style="display:none"></label>' +
            '<button class="btn btn-block btn-danger" id="bkReset">⟳ ล้างข้อมูลทั้งหมด & เริ่มต้นใหม่</button>' +
          '</div>' +
          UI.tip('<b>สำคัญ:</b> ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้ ควรดาวน์โหลดไฟล์สำรองอย่างน้อยสัปดาห์ละครั้ง และเก็บไว้บน OneDrive/Google Drive') +
        '</div>' +
        '<div class="card"><div class="card-head"><h3>◆ แนะนำเพิ่มเติมสำหรับระบบเว็บไซต์</h3></div><div class="stack">' +
          bullet('ตั้งชื่อร้าน โลโก้ และเบอร์โทรให้ครบ', 'ข้อมูลนี้จะไปแสดงบนหน้าสั่งซื้อออนไลน์และใบเสร็จทันที') +
          bullet('ส่งลิงก์ order.html ให้ลูกค้า', 'ลูกค้าเลือกสินค้า กรอกชื่อ-เบอร์ แล้วออเดอร์จะเข้าเมนู Order Online ทันที') +
          bullet('เปิด VAT เฉพาะเมื่อจดทะเบียนภาษี', 'ถ้ายังไม่จด VAT ให้ปิดไว้ ระบบจะไม่แสดงบรรทัดภาษีในใบเสร็จ') +
          bullet('อัปโหลดรูปสินค้าจริง', 'สินค้าที่มีรูปจริงเพิ่มโอกาสปิดการขายบนหน้าเว็บได้มากกว่าไอคอน') +
        '</div></div>' +
      '</div>';

    $$('[data-k]', el).forEach(function (i) {
      i.onchange = function () {
        var v = i.type === 'number' ? Number(i.value) : i.value;
        DB.state.settings[i.dataset.k] = v; DB.save();
        UI.toast('บันทึกแล้ว', 'ok', 1200); App.applySettings();
      };
    });
    /* คำแปลหลายภาษา */
    $$('[data-i18]', el).forEach(function (i) {
      i.onchange = function () {
        var parts = i.dataset.i18.split('|'), lang = parts[0], key = parts[1];
        if (!S.i18n) S.i18n = {};
        if (!S.i18n[lang]) S.i18n[lang] = {};
        S.i18n[lang][key] = i.value;
        DB.save(); UI.toast('บันทึกคำแปลแล้ว', 'ok', 1200);
      };
    });

    /* จุดเด่น 3 ข้อในหน้าเกี่ยวกับ */
    $$('[data-ap]', el).forEach(function (i) {
      i.onchange = function () {
        var parts = i.dataset.ap.split('|'), idx = +parts[0], key = parts[1];
        if (!Array.isArray(S.aboutPoints)) S.aboutPoints = [];
        while (S.aboutPoints.length <= idx) S.aboutPoints.push({ t: '', d: '' });
        S.aboutPoints[idx][key] = i.value;
        DB.save(); UI.toast('บันทึกแล้ว', 'ok', 1200);
      };
    });
    /* อัปโหลดโลโก้ */
    $('#logoFile').onchange = function () {
      var file = this.files[0]; if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) return UI.toast('ไฟล์ใหญ่เกิน 1.5 MB — ย่อรูปก่อนอัปโหลด', 'err');
      var rd = new FileReader();
      rd.onload = function (e) {
        S.logoUrl = e.target.result; DB.save();
        DB.logAct('เปลี่ยนโลโก้ร้าน', file.name);
        App.applySettings(); App.render();
        UI.toast('เปลี่ยนโลโก้เรียบร้อย', 'ok');
      };
      rd.readAsDataURL(file);
    };
    if ($('#logoReset')) $('#logoReset').onclick = function () {
      S.logoUrl = 'assets/img/logo.png'; DB.save();
      App.applySettings(); App.render();
      UI.toast('กลับไปใช้ไฟล์โลโก้ในโฟลเดอร์แล้ว', 'ok');
    };
    $('#vatOn').onchange = function () { S.vatEnabled = this.checked; DB.save(); UI.toast('บันทึกแล้ว', 'ok', 1200); };
    $('#lowOn').onchange = function () { S.lowStockAlert = this.checked; DB.save(); App.refreshBadges(); };
    $$('#accents .chip').forEach(function (c) {
      c.onclick = function () { S.accent = c.dataset.acc; DB.save(); App.applySettings(); App.render(); UI.toast('เปลี่ยนเฉดสีแล้ว', 'ok', 1400); };
    });
    if ($('#cloudPull')) $('#cloudPull').onclick = function () {
      Cloud.pull().then(function () { Cloud.takeSnapshot(); App.applySettings(); App.render(); UI.toast('ดึงข้อมูลล่าสุดแล้ว', 'ok'); })
        .catch(function (e) { UI.toast('ดึงข้อมูลไม่สำเร็จ: ' + e.message, 'err'); });
    };
    if ($('#cloudPush')) $('#cloudPush').onclick = function () {
      UI.confirmBox('อัปโหลดข้อมูลขึ้นคลาวด์', 'ส่งข้อมูลทุกอย่างในเครื่องนี้ขึ้นฐานข้อมูลกลาง (ทับข้อมูลที่มี id เดียวกัน)<br>' +
        '<span style="font-size:12px;color:var(--muted-2)">ใช้ตอนย้ายข้อมูลจากเครื่องเดิมขึ้นคลาวด์ครั้งแรก</span>', 'อัปโหลด', function () {
          Cloud.push(true).then(function () { UI.toast('อัปโหลดข้อมูลขึ้นคลาวด์แล้ว', 'ok'); })
            .catch(function (e) { UI.toast('อัปโหลดไม่สำเร็จ: ' + e.message, 'err'); });
        });
    };
    $('#catAdd').onclick = function () {
      UI.modal({
        title: 'เพิ่มหมวดหมู่สินค้า',
        body: '<div class="field"><label>ชื่อหมวดหมู่</label><input class="input" id="cn" placeholder="เช่น เครื่องเงิน"></div>',
        onOk: function (ov) {
          var n = $('#cn', ov).value.trim();
          if (!n) return false;
          if (DB.state.categories.indexOf(n) > -1) { UI.toast('มีหมวดหมู่นี้แล้ว', 'warn'); return false; }
          DB.state.categories.push(n); DB.save(); UI.toast('เพิ่มหมวดหมู่แล้ว', 'ok'); App.render();
        }
      });
    };
    $$('[data-catdel]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.catdel, name = DB.state.categories[i];
        if (DB.state.products.some(function (p) { return p.category === name; })) return UI.toast('ยังมีสินค้าอยู่ในหมวดนี้', 'warn');
        DB.state.categories.splice(i, 1); DB.save(); App.render();
      };
    });
    $('#bkExport').onclick = function () {
      UI.downloadBlob('crowscase-backup-' + DB.todayKey(new Date()) + '.json', DB.exportJSON(), 'application/json');
      UI.toast('ดาวน์โหลดไฟล์สำรองแล้ว', 'ok');
    };
    $('#bkImport').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function (e) {
        try { DB.importJSON(e.target.result); UI.toast('นำเข้าข้อมูลสำเร็จ', 'ok'); setTimeout(function () { location.reload(); }, 700); }
        catch (err) { UI.toast('ไฟล์ไม่ถูกต้อง: ' + err.message, 'err'); }
      };
      rd.readAsText(f);
    };
    $('#bkReset').onclick = function () {
      UI.confirmBox('ล้างข้อมูลทั้งหมด', 'ข้อมูลสินค้า การขาย ออเดอร์ และบัญชีพนักงานทั้งหมดจะถูกลบ และกลับไปเป็นข้อมูลตัวอย่างเริ่มต้น<br>' +
        '<b style="color:var(--danger)">การกระทำนี้ย้อนกลับไม่ได้ — ควรดาวน์โหลดไฟล์สำรองก่อน</b>',
        'ล้างข้อมูลทั้งหมด', function () { DB.reset(); location.reload(); }, true);
    };

    function f(label, key, val, type) {
      return '<div class="field"><label>' + esc(label) + '</label>' +
        '<input class="input" data-k="' + key + '" type="' + (type || 'text') + '" value="' + esc(val) + '"></div>';
    }
    /* ช่องกรอกคำแปล: data-i18="lang|key" */
    function ft(label, lang, key, val) {
      return '<div class="field"><label>' + esc(label) + '</label>' +
        '<input class="input" data-i18="' + lang + '|' + key + '" value="' + esc(val || '') + '"></div>';
    }
    function fta(label, lang, key, val, rows) {
      return '<div class="field"><label>' + esc(label) + '</label>' +
        '<textarea class="input" data-i18="' + lang + '|' + key + '" rows="' + rows + '">' + esc(val || '') + '</textarea></div>';
    }
  };

  /* ==========================================================
     บันทึกกิจกรรม
     ========================================================== */
  V.logs = function (el) {
    var acts = DB.state.activity, sl = DB.state.stockLogs;
    el.innerHTML =
      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>กิจกรรมผู้ใช้งานล่าสุด</h3>' +
          '<div class="sp"><span class="badge b-mute">' + acts.length + ' รายการ</span></div></div>' +
          '<div style="max-height:560px;overflow-y:auto">' + (acts.length ? acts.slice(0, 120).map(function (a) {
            return '<div class="rank"><span class="avatar" style="width:28px;height:28px;font-size:12px">' + esc((a.userName || '?').charAt(0)) + '</span>' +
              '<div style="flex:1"><div style="font-size:13px"><b>' + esc(a.userName) + '</b> — ' + esc(a.action) + '</div>' +
              '<div style="font-size:11.5px;color:var(--muted-2)">' + DB.fmtDateTime(a.ts) + (a.detail ? ' • ' + esc(a.detail) : '') + '</div></div></div>';
          }).join('') : UI.empty('⏱', 'ยังไม่มีบันทึกกิจกรรม')) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>ประวัติการเคลื่อนไหวสต๊อก</h3>' +
          '<div class="sp">' + (DB.can('data.export') ? '<button class="btn btn-sm" id="lgExport">⬇ CSV</button>' : '') + '</div></div>' +
          '<div style="max-height:560px;overflow-y:auto">' + (sl.length ? sl.slice(0, 120).map(function (l) {
            return '<div class="rank"><div style="flex:1"><div style="font-size:13px;font-weight:600">' + esc(l.name) + '</div>' +
              '<div style="font-size:11.5px;color:var(--muted-2)">' + DB.fmtDateTime(l.ts) + ' • ' + esc(l.userName) + (l.note ? ' • ' + esc(l.note) : '') + '</div></div>' +
              '<div style="text-align:right"><div style="font-weight:700;color:' + (l.delta >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (l.delta >= 0 ? '+' : '') + l.delta + '</div>' +
              '<div style="font-size:11px;color:var(--muted-2)">เหลือ ' + l.after + '</div></div></div>';
          }).join('') : UI.empty('📦', 'ยังไม่มีความเคลื่อนไหว')) + '</div></div>' +
      '</div>';
    if ($('#lgExport')) $('#lgExport').onclick = function () {
      var rows = [['วันที่', 'สินค้า', 'SKU', 'ประเภท', 'จำนวน', 'คงเหลือหลังทำรายการ', 'ผู้ทำรายการ', 'หมายเหตุ']];
      sl.forEach(function (l) { rows.push([DB.fmtDateTime(l.ts), l.name, l.sku, l.type, l.delta, l.after, l.userName, l.note]); });
      UI.downloadCSV('stock-movement.csv', rows);
    };
  };
})(window);
