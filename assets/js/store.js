/* ============================================================
   store.js — ชั้นข้อมูลกลาง (localStorage) + ระบบสิทธิ์
   ใช้ร่วมกันทั้ง index.html (หลังร้าน) และ order.html (หน้าร้าน)
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'crowscase_pos_v1';

  /* ---------- Utilities ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function nowISO() { return new Date().toISOString(); }
  function todayKey(d) {
    var x = d ? new Date(d) : new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function money(n) {
    n = Number(n) || 0;
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyShort(n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + ' ล้าน';
    return n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }
  /* แฮชอย่างง่ายสำหรับรหัสผ่าน (ป้องกันการอ่านตรง ๆ เท่านั้น — ไม่ใช่ระบบความปลอดภัยระดับ production) */
  function hash(str) {
    var h = 5381, i;
    str = 'cc$' + String(str);
    for (i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- นิยามเมนู & สิทธิ์ ---------- */
  var MENUS = [
    { id: 'overview', name: 'ภาพรวม', icon: '◆', group: 'ขาย' },
    { id: 'pos', name: 'รายการขาย', icon: '▣', group: 'ขาย' },
    { id: 'history', name: 'ประวัติการขาย', icon: '≡', group: 'ขาย' },
    { id: 'stock', name: 'สต๊อกสินค้า', icon: '▤', group: 'คลัง' },
    { id: 'orders', name: 'Order Online', icon: '✦', group: 'คลัง' },
    { id: 'staff', name: 'จัดการพนักงาน', icon: '☗', group: 'ระบบ' },
    { id: 'settings', name: 'จัดการเว็บไซต์', icon: '⚙', group: 'ระบบ' },
    { id: 'logs', name: 'บันทึกกิจกรรม', icon: '⏱', group: 'ระบบ' }
  ];

  var ACTIONS = [
    { id: 'product.create', name: 'เพิ่มสินค้าใหม่', desc: 'สร้างรายการสินค้าเข้าระบบ' },
    { id: 'product.edit', name: 'แก้ไขข้อมูลสินค้า', desc: 'ชื่อ / หมวด / รูป / ขั้นต่ำ' },
    { id: 'product.price', name: 'แก้ไขราคา & ต้นทุน', desc: 'ข้อมูลเชิงลึก — ควรให้เฉพาะผู้จัดการขึ้นไป' },
    { id: 'product.delete', name: 'ลบสินค้า', desc: 'ข้อมูลเชิงลึก — ลบออกจากระบบถาวร' },
    { id: 'stock.adjust', name: 'รับเข้า / ปรับสต๊อก', desc: 'เพิ่ม-ลดจำนวนคงเหลือ' },
    { id: 'sale.discount', name: 'ให้ส่วนลดในบิล', desc: 'ลดราคาตอนขายหน้าร้าน' },
    { id: 'sale.void', name: 'ยกเลิก / คืนบิล', desc: 'ข้อมูลเชิงลึก — คืนสต๊อกและตัดยอดขาย' },
    { id: 'order.manage', name: 'จัดการออเดอร์ออนไลน์', desc: 'เปลี่ยนสถานะ / ติดต่อลูกค้า' },
    { id: 'report.cost', name: 'ดูต้นทุนและกำไร', desc: 'ข้อมูลเชิงลึก — ตัวเลขกำไรขั้นต้น' },
    { id: 'data.export', name: 'ส่งออก / สำรองข้อมูล', desc: 'ดาวน์โหลด CSV และไฟล์สำรอง' }
  ];

  var ROLES = {
    owner: {
      name: 'เจ้าของร้าน', color: 'b-gold',
      menus: MENUS.map(function (m) { return m.id; }),
      actions: ACTIONS.map(function (a) { return a.id; })
    },
    manager: {
      name: 'ผู้จัดการ', color: 'b-info',
      menus: ['overview', 'pos', 'history', 'stock', 'orders', 'logs'],
      actions: ['product.create', 'product.edit', 'product.price', 'stock.adjust', 'sale.discount', 'sale.void', 'order.manage', 'report.cost', 'data.export']
    },
    cashier: {
      name: 'พนักงานขาย', color: 'b-ok',
      menus: ['overview', 'pos', 'history', 'orders'],
      actions: ['sale.discount', 'order.manage']
    },
    stock: {
      name: 'พนักงานคลัง', color: 'b-warn',
      menus: ['overview', 'stock', 'orders'],
      actions: ['product.create', 'product.edit', 'stock.adjust', 'order.manage']
    },
    custom: { name: 'กำหนดเอง', color: 'b-mute', menus: ['overview'], actions: [] }
  };

  var ORDER_STATUS = {
    'new':      { name: 'ใหม่ — รอติดต่อ', cls: 'b-warn' },
    'contacted':{ name: 'ติดต่อแล้ว',      cls: 'b-info' },
    'confirmed':{ name: 'ยืนยันออเดอร์',   cls: 'b-gold' },
    'done':     { name: 'ปิดการขายแล้ว',   cls: 'b-ok' },
    'cancel':   { name: 'ยกเลิก',          cls: 'b-danger' }
  };

  var PAY_METHODS = ['เงินสด', 'โอน/พร้อมเพย์', 'บัตรเครดิต', 'e-Wallet'];
  var CHANNELS = ['หน้าร้าน', 'ออนไลน์', 'เดลิเวอรี่'];

  /* ---------- Seed ---------- */
  function seedProducts() {
    var raw = [
      ['CRW-001', 'Crow’s Case Signature — Magnetic Holder 35pt', 'Magnetic Holder', 210, 490, 24, 6, '🖤'],
      ['CRW-002', 'Magnetic Holder 55pt กันรอย UV', 'Magnetic Holder', 240, 550, 18, 6, '🧲'],
      ['CRW-003', 'Magnetic Holder 130pt สำหรับการ์ดหนา', 'Magnetic Holder', 320, 690, 9, 4, '💠'],
      ['CRW-004', 'Toploader ใสพิเศษ 35pt (แพ็ค 25 ชิ้น)', 'Toploader', 95, 249, 40, 10, '📇'],
      ['CRW-005', 'Toploader ขอบทอง Limited (แพ็ค 10 ชิ้น)', 'Toploader', 180, 420, 12, 5, '✨'],
      ['CRW-006', 'Perfect Fit Sleeve ใส (แพ็ค 100 ใบ)', 'Sleeve', 60, 159, 60, 15, '🗂'],
      ['CRW-007', 'Premium Matte Sleeve ดำ (แพ็ค 100 ใบ)', 'Sleeve', 110, 259, 35, 10, '🃏'],
      ['CRW-008', 'กล่องเก็บการ์ด 1,000 ใบ ฝาแม่เหล็ก', 'Storage Box', 480, 990, 8, 3, '📦'],
      ['CRW-009', 'กล่องอะคริลิกโชว์การ์ด Slab', 'Storage Box', 650, 1390, 5, 3, '🧳'],
      ['CRW-010', 'ขาตั้งโชว์การ์ดอะคริลิก (คู่)', 'Display Stand', 90, 229, 30, 8, '🪞'],
      ['CRW-011', 'ขาตั้งโชว์ไม้วอลนัท งานคราฟต์', 'Display Stand', 380, 890, 4, 3, '🪵'],
      ['CRW-012', 'ชุดผ้าเช็ดไมโครไฟเบอร์ + ถุงมือ', 'อุปกรณ์เสริม', 70, 189, 0, 6, '🧤']
    ];
    return raw.map(function (r) {
      return {
        id: uid('p'), sku: r[0], name: r[1], category: r[2],
        cost: r[3], price: r[4], qty: r[5], minQty: r[6],
        image: r[7], imageType: 'emoji', unit: 'ชิ้น', active: true, createdAt: nowISO()
      };
    });
  }

  function seedSales(products, users) {
    var sales = [], i, d, n, k, p, items, subtotal, discount, vat, s;
    var seller = users.filter(function (u) { return u.role !== 'owner'; });
    for (i = 29; i >= 0; i--) {
      d = new Date(); d.setDate(d.getDate() - i);
      n = 1 + Math.floor(Math.random() * 4);
      for (k = 0; k < n; k++) {
        items = []; subtotal = 0;
        var cnt = 1 + Math.floor(Math.random() * 3);
        for (var j = 0; j < cnt; j++) {
          p = products[Math.floor(Math.random() * products.length)];
          var q = 1 + Math.floor(Math.random() * 2);
          if (items.some(function (it) { return it.pid === p.id; })) continue;
          items.push({ pid: p.id, sku: p.sku, name: p.name, image: p.image, imageType: p.imageType, price: p.price, cost: p.cost, qty: q });
          subtotal += p.price * q;
        }
        if (!items.length) continue;
        discount = Math.random() < 0.25 ? Math.round(subtotal * 0.05 / 10) * 10 : 0;
        vat = 0;
        d.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
        var u = seller.length ? seller[Math.floor(Math.random() * seller.length)] : users[0];
        s = {
          id: uid('s'), code: 'INV' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(sales.length + 1).padStart(3, '0'),
          ts: d.toISOString(), items: items,
          subtotal: subtotal, discount: discount, vat: vat, total: subtotal - discount,
          method: PAY_METHODS[Math.floor(Math.random() * PAY_METHODS.length)],
          channel: Math.random() < 0.75 ? 'หน้าร้าน' : 'ออนไลน์',
          staffId: u.id, staffName: u.name, customer: '', note: '', status: 'completed'
        };
        sales.push(s);
      }
    }
    return sales;
  }

  function defaultState() {
    var admin = {
      id: uid('u'), username: 'admin', name: 'ผู้ดูแลระบบ', pass: hash('1234'),
      role: 'owner', menus: ROLES.owner.menus.slice(), actions: ROLES.owner.actions.slice(),
      phone: '', active: true, createdAt: nowISO(), lastLogin: null
    };
    var mgr = {
      id: uid('u'), username: 'manager', name: 'สมชาย ผู้จัดการ', pass: hash('1234'),
      role: 'manager', menus: ROLES.manager.menus.slice(), actions: ROLES.manager.actions.slice(),
      phone: '081-000-0002', active: true, createdAt: nowISO(), lastLogin: null
    };
    var cash = {
      id: uid('u'), username: 'staff', name: 'มานี พนักงานขาย', pass: hash('1234'),
      role: 'cashier', menus: ROLES.cashier.menus.slice(), actions: ROLES.cashier.actions.slice(),
      phone: '081-000-0003', active: true, createdAt: nowISO(), lastLogin: null
    };
    var users = [admin, mgr, cash];
    var products = seedProducts();

    return {
      version: 1,
      settings: {
        shopName: "Crow's Case",
        tagline: 'PREMIUM CARD PROTECTION',
        logo: '♛',
        logoUrl: 'assets/img/logo.png',
        phone: '02-000-0000',
        line: '@crowscase',
        lineUrl: '',
        facebook: 'Crow’s Case',
        facebookUrl: '',
        email: '',
        address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
        mapUrl: '',
        openHours: 'ทุกวัน 10:00 - 20:00 น.',
        currency: '฿',
        vatRate: 7,
        vatEnabled: false,
        lowStockAlert: true,

        /* ---- หน้าแรก (Hero) ---- */
        featuredId: products[0].id,
        heroBadge: 'สินค้าแนะนำประจำเดือน',
        heroTitle: 'ปกป้องการ์ดใบโปรด ด้วยงานคราฟต์ระดับพรีเมียม',
        heroText: 'Crow’s Case คัดสรรวัสดุและงานประกอบอย่างพิถีพิถัน เพื่อให้การ์ดสะสมของคุณคงสภาพสมบูรณ์ที่สุดในทุกการเก็บรักษาและทุกการเดินทาง',
        heroCta: 'ดูรายละเอียดสินค้า',

        /* ---- เกี่ยวกับเรา ---- */
        aboutTitle: 'ก่อนจะมาเป็น Crow’s Case',
        aboutText: 'เราเริ่มต้นจากนักสะสมการ์ดกลุ่มเล็ก ๆ ที่เจ็บใจทุกครั้งเมื่อการ์ดใบสำคัญมีรอยขนแมว มุมช้ำ หรือซีดจากแสงแดด เราจึงลงมือหาวัสดุและออกแบบเคสด้วยตัวเอง ทดสอบซ้ำแล้วซ้ำเล่านับร้อยครั้ง จนได้เคสที่เรากล้าใส่การ์ดใบที่หวงที่สุดของตัวเอง\n\nชื่อ Crow’s Case มาจากนิสัยของอีกา — นกที่ขึ้นชื่อเรื่องการเก็บสะสมของมีค่าและปกป้องรังของมันอย่างที่สุด เช่นเดียวกับที่เราตั้งใจปกป้องของสะสมของคุณ',
        aboutPoints: [
          { t: 'วัสดุคัดเกรด', d: 'อะคริลิกใสพิเศษกันรอยและตัดแสง UV คงความคมชัดของงานพิมพ์ในระยะยาว' },
          { t: 'งานประกอบมือ', d: 'ตรวจสอบทุกชิ้นก่อนส่ง ขอบเรียบสนิท ไม่บาดมือ ไม่บาดการ์ด' },
          { t: 'ดูแลหลังการขาย', d: 'มีปัญหาทักได้ตลอด เปลี่ยนคืนได้ภายใน 7 วันหากสินค้าไม่สมบูรณ์' }
        ],
        founded: '2024',

        orderFooter: 'ขอบคุณที่ไว้วางใจ Crow’s Case',

        /* ---- คำแปลเนื้อหาหน้าเว็บ (เว้นว่างได้ = ใช้ภาษาไทย) ---- */
        i18n: {
          en: {
            heroBadge: 'Featured this month',
            heroTitle: 'Protect the cards you love, with premium craftsmanship',
            heroText: 'Crow’s Case selects every material and assembles every piece with care, so your collection stays in the best possible condition — in storage and on the road.',
            heroCta: 'View product details',
            aboutTitle: 'Before there was Crow’s Case',
            aboutText: 'We started as a small group of collectors who winced every time an important card picked up a hairline scratch, a bumped corner, or faded under sunlight. So we went looking for the right materials and designed a case ourselves, testing it hundreds of times over — until we had something we trusted with the card we treasure most.\n\nThe name Crow’s Case comes from the bird itself: crows are famous for collecting what they value and defending their nest fiercely. That is exactly how we treat your collection.'
          },
          zh: {
            heroBadge: '本月推荐',
            heroTitle: '以精湛工艺，守护你心爱的卡牌',
            heroText: 'Crow’s Case 精挑每一种材料、细致完成每一道工序，让你的收藏无论是长期存放还是随身携带，都能保持最佳状态。',
            heroCta: '查看商品详情',
            aboutTitle: '关于 Crow’s Case 的由来',
            aboutText: '我们最初只是一群卡牌收藏者。每当重要的卡片出现细小划痕、卡角磕碰，或因阳光照射而褪色时，都让人心疼不已。于是我们亲自寻找材料、自行设计保护壳，反复测试上百次，直到做出连自己最珍视的卡片都敢放进去的产品。\n\nCrow’s Case 这个名字来自乌鸦——它以收藏珍贵之物、竭力守护巢穴而闻名。我们守护你的收藏，也是同样的心情。'
          }
        }
      },
      users: users,
      categories: ['Magnetic Holder', 'Toploader', 'Sleeve', 'Storage Box', 'Display Stand', 'อุปกรณ์เสริม'],
      products: products,
      sales: seedSales(products, users),
      orders: [
        {
          id: uid('o'), code: 'OD-1001', ts: new Date(Date.now() - 3600e3 * 5).toISOString(),
          name: 'คุณพิมพ์ชนก ศรีสุข', phone: '089-123-4567', note: 'ขอดูสินค้าจริงก่อนตัดสินใจ ติดต่อหลัง 18:00 น.',
          items: [{ pid: products[0].id, name: products[0].name, image: products[0].image, imageType: 'emoji', price: products[0].price, qty: 1 }],
          total: products[0].price, status: 'new', handledBy: '', handledAt: null
        },
        {
          id: uid('o'), code: 'OD-1002', ts: new Date(Date.now() - 3600e3 * 26).toISOString(),
          name: 'คุณธนกฤต วงศ์ทอง', phone: '086-777-1122', note: '',
          items: [
            { pid: products[2].id, name: products[2].name, image: products[2].image, imageType: 'emoji', price: products[2].price, qty: 1 },
            { pid: products[8].id, name: products[8].name, image: products[8].image, imageType: 'emoji', price: products[8].price, qty: 2 }
          ],
          total: products[2].price + products[8].price * 2, status: 'contacted', handledBy: 'สมชาย ผู้จัดการ', handledAt: nowISO()
        }
      ],
      stockLogs: [],
      activity: [],
      session: null
    };
  }

  /* ---------- State ---------- */
  var state = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        // เติมฟิลด์ที่อาจขาดหลังอัปเดตเวอร์ชัน
        var d = defaultState();
        Object.keys(d.settings).forEach(function (k) {
          if (state.settings[k] === undefined) state.settings[k] = d.settings[k];
        });
        ['users', 'products', 'sales', 'orders', 'stockLogs', 'activity', 'categories'].forEach(function (k) {
          if (!Array.isArray(state[k])) state[k] = d[k];
        });
        return state;
      }
    } catch (e) { console.warn('อ่านข้อมูลเดิมไม่สำเร็จ, สร้างใหม่', e); }
    state = defaultState();
    save();
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('บันทึกข้อมูลไม่สำเร็จ', e); }
  }

  function reset() { localStorage.removeItem(KEY); state = defaultState(); save(); }

  /* ---------- Auth ---------- */
  function login(username, password) {
    var u = state.users.find(function (x) {
      return x.username.toLowerCase() === String(username).trim().toLowerCase();
    });
    if (!u) return { ok: false, msg: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' };
    if (!u.active) return { ok: false, msg: 'บัญชีนี้ถูกระงับการใช้งาน' };
    if (u.pass !== hash(password)) return { ok: false, msg: 'รหัสผ่านไม่ถูกต้อง' };
    u.lastLogin = nowISO();
    state.session = { userId: u.id, at: nowISO() };
    log(u, 'เข้าสู่ระบบ', '');
    save();
    return { ok: true, user: u };
  }
  function logout() {
    var u = currentUser();
    if (u) log(u, 'ออกจากระบบ', '');
    state.session = null; save();
  }
  function currentUser() {
    if (!state.session) return null;
    return state.users.find(function (u) { return u.id === state.session.userId && u.active; }) || null;
  }
  function can(action) {
    var u = currentUser();
    if (!u) return false;
    if (u.role === 'owner') return true;
    return (u.actions || []).indexOf(action) > -1;
  }
  function canSee(menuId) {
    var u = currentUser();
    if (!u) return false;
    if (u.role === 'owner') return true;
    return (u.menus || []).indexOf(menuId) > -1;
  }

  /* ---------- Logs ---------- */
  function log(user, action, detail) {
    state.activity.unshift({
      id: uid('a'), ts: nowISO(),
      userId: user ? user.id : '', userName: user ? user.name : 'ระบบ',
      action: action, detail: detail || ''
    });
    if (state.activity.length > 500) state.activity.length = 500;
  }
  function logAct(action, detail) { log(currentUser(), action, detail); save(); }

  function stockLog(product, type, delta, note) {
    var u = currentUser();
    state.stockLogs.unshift({
      id: uid('sl'), ts: nowISO(), pid: product.id, sku: product.sku, name: product.name,
      type: type, delta: delta, after: product.qty,
      userId: u ? u.id : '', userName: u ? u.name : 'ระบบ', note: note || ''
    });
    if (state.stockLogs.length > 800) state.stockLogs.length = 800;
  }

  /* ---------- Business helpers ---------- */
  function product(id) { return state.products.find(function (p) { return p.id === id; }); }

  function activeSales() { return state.sales.filter(function (s) { return s.status !== 'void'; }); }

  function salesBetween(fromISO, toISO) {
    return activeSales().filter(function (s) { return s.ts >= fromISO && s.ts <= toISO; });
  }
  function sumTotal(list) { return list.reduce(function (a, s) { return a + s.total; }, 0); }
  function sumProfit(list) {
    return list.reduce(function (a, s) {
      var c = s.items.reduce(function (x, i) { return x + (i.cost || 0) * i.qty; }, 0);
      return a + (s.total - c);
    }, 0);
  }
  function lowStock() {
    return state.products.filter(function (p) { return p.active && p.qty <= p.minQty; })
      .sort(function (a, b) { return a.qty - b.qty; });
  }
  function newOrders() { return state.orders.filter(function (o) { return o.status === 'new'; }); }

  /* สินค้าเด่นที่โชว์บนหน้าแรกของเว็บ (ตั้งค่าได้ในแดชบอร์ด) */
  function featured() {
    var live = state.products.filter(function (p) { return p.active; });
    return live.find(function (p) { return p.id === state.settings.featuredId; }) || live[0] || null;
  }

  function nextInvoice() {
    var d = new Date();
    var pre = 'INV' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var n = state.sales.filter(function (s) { return s.code.indexOf(pre) === 0; }).length + 1;
    return pre + '-' + String(n).padStart(3, '0');
  }
  function nextOrderCode() {
    return 'OD-' + String(1000 + state.orders.length + 1);
  }

  /* บันทึกการขาย + ตัดสต๊อก */
  function commitSale(payload) {
    var u = currentUser();
    var sale = {
      id: uid('s'), code: nextInvoice(), ts: nowISO(),
      items: payload.items, subtotal: payload.subtotal, discount: payload.discount,
      vat: payload.vat, total: payload.total, method: payload.method,
      channel: payload.channel || 'หน้าร้าน', received: payload.received || payload.total,
      change: Math.max(0, (payload.received || payload.total) - payload.total),
      staffId: u ? u.id : '', staffName: u ? u.name : 'ระบบ',
      customer: payload.customer || '', note: payload.note || '', status: 'completed'
    };
    sale.items.forEach(function (it) {
      var p = product(it.pid);
      if (p) { p.qty = Math.max(0, p.qty - it.qty); stockLog(p, 'sale', -it.qty, 'ขาย ' + sale.code); }
    });
    state.sales.push(sale);
    log(u, 'บันทึกการขาย', sale.code + ' • ' + money(sale.total) + ' บาท');
    save();
    return sale;
  }

  /* ยกเลิกบิล + คืนสต๊อก */
  function voidSale(saleId, reason) {
    var s = state.sales.find(function (x) { return x.id === saleId; });
    if (!s || s.status === 'void') return false;
    s.status = 'void'; s.voidReason = reason || ''; s.voidAt = nowISO();
    s.items.forEach(function (it) {
      var p = product(it.pid);
      if (p) { p.qty += it.qty; stockLog(p, 'return', it.qty, 'คืนจากการยกเลิก ' + s.code); }
    });
    logAct('ยกเลิกบิล', s.code + (reason ? ' • เหตุผล: ' + reason : ''));
    return true;
  }

  /* สร้างออเดอร์ออนไลน์ (เรียกจากหน้าร้าน) */
  function placeOrder(data) {
    load();
    var o = {
      id: uid('o'), code: nextOrderCode(), ts: nowISO(),
      name: data.name, phone: data.phone, note: data.note || '',
      items: data.items, total: data.items.reduce(function (a, i) { return a + i.price * i.qty; }, 0),
      status: 'new', handledBy: '', handledAt: null
    };
    state.orders.unshift(o);
    log(null, 'ออเดอร์ออนไลน์ใหม่', o.code + ' • ' + o.name + ' • ' + o.phone);
    save();
    return o;
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    var d = JSON.parse(text);
    if (!d || !Array.isArray(d.users) || !Array.isArray(d.products)) throw new Error('ไฟล์ไม่ถูกต้อง');
    state = d; save(); return true;
  }

  global.DB = {
    KEY: KEY, MENUS: MENUS, ACTIONS: ACTIONS, ROLES: ROLES,
    ORDER_STATUS: ORDER_STATUS, PAY_METHODS: PAY_METHODS, CHANNELS: CHANNELS,
    get state() { return state; },
    load: load, save: save, reset: reset,
    login: login, logout: logout, currentUser: currentUser, can: can, canSee: canSee, hash: hash,
    logAct: logAct, stockLog: stockLog,
    product: product, activeSales: activeSales, salesBetween: salesBetween,
    sumTotal: sumTotal, sumProfit: sumProfit, lowStock: lowStock, newOrders: newOrders, featured: featured,
    commitSale: commitSale, voidSale: voidSale, placeOrder: placeOrder,
    exportJSON: exportJSON, importJSON: importJSON,
    uid: uid, nowISO: nowISO, todayKey: todayKey,
    money: money, moneyShort: moneyShort, fmtDate: fmtDate, fmtDateTime: fmtDateTime, esc: esc
  };
})(window);
