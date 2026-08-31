/* ============================================================
   ui.js — helper สำหรับ toast / modal / กราฟ / ตัวช่วย DOM
   ============================================================ */
(function (global) {
  'use strict';

  var esc = DB.esc;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Toast ---------- */
  function toast(msg, type, ms) {
    var box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
    var ico = { ok: '✓', err: '✕', warn: '!', info: 'i' }[type || 'info'];
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<b style="color:var(--gold)">' + ico + '</b><span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = '.25s'; el.style.opacity = '0'; el.style.transform = 'translateX(40px)';
      setTimeout(function () { el.remove(); }, 260);
    }, ms || 2600);
  }

  /* ---------- Modal ---------- */
  var modalCb = null;
  function modal(opts) {
    var ov = $('#overlay');
    ov.innerHTML =
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '">' +
        '<div class="modal-head"><h3>' + esc(opts.title) + '</h3>' +
        '<button class="x-btn" data-close>✕</button></div>' +
        '<div class="modal-body">' + opts.body + '</div>' +
        (opts.foot === false ? '' : '<div class="modal-foot">' +
          (opts.footHtml || ('<button class="btn btn-ghost" data-close>ยกเลิก</button>' +
            '<button class="btn btn-gold" id="mdOk">' + esc(opts.okText || 'บันทึก') + '</button>')) +
        '</div>') +
      '</div>';
    ov.classList.add('open');
    modalCb = opts.onOk || null;
    if (opts.onRender) opts.onRender(ov);
    var ok = $('#mdOk', ov);
    if (ok) ok.onclick = function () { if (modalCb) { if (modalCb(ov) !== false) closeModal(); } else closeModal(); };
    $$('[data-close]', ov).forEach(function (b) { b.onclick = closeModal; });
  }
  function closeModal() {
    var ov = $('#overlay');
    ov.classList.remove('open'); ov.innerHTML = ''; modalCb = null;
  }
  function confirmBox(title, text, okText, onOk, danger) {
    modal({
      title: title,
      body: '<p style="color:var(--muted);line-height:1.7">' + text + '</p>',
      footHtml: '<button class="btn btn-ghost" data-close>ยกเลิก</button>' +
        '<button class="btn ' + (danger ? 'btn-danger' : 'btn-gold') + '" id="mdOk">' + esc(okText || 'ยืนยัน') + '</button>',
      onOk: onOk
    });
  }

  /* ---------- รูปสินค้า ---------- */
  function imgHtml(item, cls) {
    if (item && item.imageType === 'url' && item.image) {
      return '<span class="' + (cls || 'thumb') + '"><img src="' + esc(item.image) + '" alt=""></span>';
    }
    return '<span class="' + (cls || 'thumb') + '">' + esc((item && item.image) || '📦') + '</span>';
  }

  /* ---------- กราฟแท่ง SVG ---------- */
  function barChart(data, opts) {
    opts = opts || {};
    var W = 760, H = 220, pad = { l: 46, r: 10, t: 14, b: 26 };
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var bw = iw / data.length;
    var bars = data.map(function (d, i) {
      var h = Math.max(2, (d.v / max) * ih);
      var x = pad.l + i * bw + bw * 0.18, y = pad.t + ih - h, w = bw * 0.64;
      return '<rect class="bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
        '" height="' + h.toFixed(1) + '" rx="3"><title>' + esc(d.label) + ' : ' + DB.money(d.v) + '</title></rect>';
    }).join('');
    var step = Math.ceil(data.length / 8);
    var labels = data.map(function (d, i) {
      if (i % step !== 0 && i !== data.length - 1) return '';
      var x = pad.l + i * bw + bw / 2;
      return '<text class="axis-l" x="' + x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
    }).join('');
    var grid = [0, .25, .5, .75, 1].map(function (t) {
      var y = pad.t + ih - ih * t;
      return '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="rgba(255,255,255,.05)"/><text class="axis-l" x="' + (pad.l - 7) + '" y="' + (y + 3).toFixed(1) +
        '" text-anchor="end">' + DB.moneyShort(max * t) + '</text>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="goldgrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f2dc93"/><stop offset="100%" stop-color="#8a6f22"/></linearGradient></defs>' +
      grid + bars + labels + '</svg>';
  }

  /* ---------- กราฟโดนัท ---------- */
  function donut(parts, size) {
    size = size || 150;
    var total = parts.reduce(function (a, p) { return a + p.v; }, 0) || 1;
    var r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, off = 0;
    var segs = parts.map(function (p) {
      var len = (p.v / total) * C;
      var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + p.color +
        '" stroke-width="14" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"><title>' +
        esc(p.label) + ' ' + Math.round(p.v / total * 100) + '%</title></circle>';
      off += len; return s;
    }).join('');
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + segs +
      '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" fill="#eceae4" font-size="15" font-weight="700">' +
      DB.moneyShort(total) + '</text></svg>';
  }

  /* ---------- Export CSV ---------- */
  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        c = String(c === undefined || c === null ? '' : c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
    downloadBlob(filename, '﻿' + csv, 'text/csv;charset=utf-8;');
  }
  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function empty(icon, text, sub) {
    return '<div class="empty"><span class="ico">' + icon + '</span><div>' + esc(text) + '</div>' +
      (sub ? '<div style="font-size:12px;margin-top:5px">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function tip(text) {
    return '<div class="tip"><span class="i">💡</span><div>' + text + '</div></div>';
  }

  global.UI = {
    $: $, $$: $$, toast: toast, modal: modal, closeModal: closeModal, confirmBox: confirmBox,
    barChart: barChart, donut: donut, downloadCSV: downloadCSV, downloadBlob: downloadBlob,
    empty: empty, tip: tip, imgHtml: imgHtml
  };
})(window);
