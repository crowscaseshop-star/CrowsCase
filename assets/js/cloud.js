/* ============================================================
   cloud.js — ซิงก์ข้อมูลกับ Supabase แบบเรียลไทม์
   ------------------------------------------------------------
   โหมดการทำงาน
     'admin'  : หน้าหลังร้าน (index.html) — ซิงก์ทุกตาราง ต้องล็อกอินก่อน
     'public' : หน้าเว็บลูกค้า — อ่านสินค้า/ตั้งค่า และส่งออเดอร์ใหม่ได้อย่างเดียว
     'local'  : ยังไม่ได้ตั้งค่า config.js → ใช้ข้อมูลในเครื่องเหมือนเดิม

   หลักการซิงก์: เทียบ "ภาพถ่าย" (snapshot) ของข้อมูลก่อน-หลัง
   แล้วส่งเฉพาะแถวที่เปลี่ยนขึ้นคลาวด์ ไม่ต้องแก้โค้ดทุกจุดที่บันทึกข้อมูล
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.CC_CONFIG || {};
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  /* ตารางที่ซิงก์: key ในแอป ↔ ชื่อตารางใน Supabase */
  var TABLES = [
    { key: 'users', table: 'staff' },
    { key: 'products', table: 'products' },
    { key: 'sales', table: 'sales' },
    { key: 'orders', table: 'orders' },
    { key: 'stockLogs', table: 'stock_logs' },
    { key: 'activity', table: 'activity' }
  ];
  var BY_TABLE = {};
  TABLES.forEach(function (t) { BY_TABLE[t.table] = t.key; });

  var sb = null;              // Supabase client
  var mode = 'local';
  var status = 'local';       // local | connecting | online | error | signedout
  var lastError = '';
  var onChange = function () { };
  var onStatus = function () { };
  var snap = {};              // ภาพถ่ายล่าสุดของข้อมูลที่ซิงก์แล้ว
  var pushTimer = null;
  var applying = false;       // กันไม่ให้ข้อมูลที่รับมาจากคลาวด์ถูกส่งกลับไปอีก
  var channel = null;

  function configured() {
    return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && /^https?:\/\//.test(CFG.SUPABASE_URL));
  }
  function setStatus(s, err) {
    status = s; lastError = err || '';
    try { onStatus(s, lastError); } catch (e) { }
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('โหลดไลบรารี Supabase ไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
  }

  /* ---------- เริ่มต้น ---------- */
  async function init(opts) {
    opts = opts || {};
    mode = opts.mode || 'admin';
    onChange = opts.onChange || onChange;
    onStatus = opts.onStatus || onStatus;

    if (!configured()) { setStatus('local'); return 'local'; }
    setStatus('connecting');
    try {
      if (!global.supabase) await loadScript(SDK);
      sb = global.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cc-auth' }
      });
    } catch (e) {
      console.warn('[cloud]', e); setStatus('error', e.message); return status;
    }

    if (mode === 'public') {
      try {
        await pull();
        takeSnapshot();
        subscribe();
        setStatus('online');
      } catch (e) {
        console.warn('[cloud]', e);
        takeSnapshot();               // กันไม่ให้ข้อมูลตัวอย่างในเครื่องถูกส่งขึ้นคลาวด์
        setStatus('error', e.message);
      }
      return status;
    }

    /* โหมดหลังร้าน — ต้องมี session ก่อนจึงจะดึงข้อมูลได้ */
    var ses = null;
    try { ses = await session(); }
    catch (e) { console.warn('[cloud]', e); setStatus('error', e.message); return status; }
    if (!ses) { setStatus('signedout'); return status; }
    return await afterLogin();
  }

  /* เช็คว่าฐานข้อมูลบนคลาวด์ยังว่างอยู่ไหม (ไม่แตะข้อมูลในเครื่อง) */
  async function cloudIsEmpty() {
    var names = TABLES.map(function (t) { return t.table; }).concat('settings');
    for (var i = 0; i < names.length; i++) {
      try {
        var r = await sb.from(names[i]).select('id').limit(1);
        if (!r.error && r.data && r.data.length) return false;
      } catch (e) { /* อ่านไม่ได้ = ถือว่าว่าง */ }
    }
    return true;
  }

  /* อัปโหลดชุดเริ่มต้น: เอาเฉพาะสินค้าและการตั้งค่าเว็บไซต์ขึ้นไป
     ไม่เอายอดขาย/ออเดอร์/บันทึกตัวอย่างที่เป็นข้อมูลสาธิตในเครื่องขึ้นไปด้วย */
  async function pushInitial() {
    var st = DB.state, now = new Date().toISOString();
    var prods = (st.products || []).filter(function (p) { return p && p.id; })
      .map(function (p) { return { id: p.id, data: p, updated_at: now }; });
    if (prods.length) {
      var r = await sb.from('products').upsert(prods);
      if (r.error) throw new Error('อัปโหลดสินค้าไม่สำเร็จ: ' + r.error.message);
    }
    var rs = await sb.from('settings').upsert({
      id: 'main', data: { settings: st.settings, categories: st.categories }, updated_at: now
    });
    if (rs.error) throw new Error('อัปโหลดการตั้งค่าไม่สำเร็จ: ' + rs.error.message);

    /* ล้างข้อมูลสาธิตในเครื่องที่ไม่ได้อัปขึ้นคลาวด์ เพื่อให้ตัวเลขตรงกับของจริง */
    st.sales = []; st.orders = []; st.stockLogs = []; st.activity = [];
    var me = DB.currentUser();
    st.users = (st.users || []).filter(function (u) { return !u.pass; });
    if (me && !st.users.some(function (u) { return u.id === me.id; })) st.users.push(me);
  }

  /* เรียกหลังล็อกอินสำเร็จ: ดึงข้อมูล + เปิดเรียลไทม์ */
  async function afterLogin() {
    try {
      if (await cloudIsEmpty()) {
        /* ใช้งานครั้งแรก — ยกสินค้าและการตั้งค่าจากเครื่องนี้ขึ้นไปตั้งต้น */
        await pushInitial();
        await pull();
      } else {
        await pull();
      }
      takeSnapshot();
      subscribe();
      setStatus('online');
    } catch (e) {
      console.warn('[cloud]', e); setStatus('error', e.message || String(e));
    }
    return status;
  }

  /* ---------- ดึงข้อมูลลงมา ---------- */
  async function pull() {
    var st = DB.state, empty = true;
    var tabs = mode === 'public' ? [{ key: 'products', table: 'products' }] : TABLES;

    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      try {
        var r = await sb.from(t.table).select('id,data');
        if (r.error) { console.warn('[cloud] อ่าน ' + t.table + ' ไม่ได้:', r.error.message); continue; }
        if (r.data.length) empty = false;
        /* หน้าเว็บลูกค้า: ถ้าคลาวด์ยังไม่มีสินค้า ให้ใช้ของที่แคชไว้ในเครื่องต่อไป
           จะได้ไม่เกิดหน้าร้านว่างเปล่าระหว่างที่ทางร้านยังไม่ได้อัปโหลดสินค้า */
        if (mode === 'public' && !r.data.length) continue;
        st[t.key] = r.data.map(function (x) { return x.data; }).filter(Boolean);
      } catch (e) { console.warn('[cloud] อ่าน ' + t.table + ' ล้มเหลว:', e.message); }
    }
    try {
      var s = await sb.from('settings').select('data').eq('id', 'main').maybeSingle();
      if (!s.error && s.data && s.data.data) {
        empty = false;
        if (s.data.data.settings) Object.assign(st.settings, s.data.data.settings);
        if (Array.isArray(s.data.data.categories) && s.data.data.categories.length) st.categories = s.data.data.categories;
      }
    } catch (e) { console.warn('[cloud] อ่าน settings ล้มเหลว:', e.message); }
    sortAll();
    DB.save();
    return { empty: empty };
  }

  function sortAll() {
    var st = DB.state;
    var desc = function (a, b) { return (b.ts || '') < (a.ts || '') ? -1 : 1; };
    if (Array.isArray(st.sales)) st.sales.sort(function (a, b) { return (a.ts || '') < (b.ts || '') ? -1 : 1; });
    ['orders', 'activity', 'stockLogs'].forEach(function (k) {
      if (Array.isArray(st[k])) st[k].sort(desc);
    });
  }

  /* ---------- ภาพถ่ายข้อมูล ---------- */
  function takeSnapshot() {
    var st = DB.state;
    snap = {};
    TABLES.forEach(function (t) {
      var m = {};
      (st[t.key] || []).forEach(function (row) { if (row && row.id) m[row.id] = JSON.stringify(row); });
      snap[t.key] = m;
    });
    snap.__settings = JSON.stringify({ settings: st.settings, categories: st.categories });
  }

  /* ---------- ส่งข้อมูลขึ้น ---------- */
  function schedulePush() {
    if (!sb || applying || status === 'signedout' || status === 'local') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push().catch(function (e) { console.warn('[cloud] push', e); }); }, 450);
  }

  async function push(force) {
    if (!sb) return;
    var st = DB.state, now = new Date().toISOString();
    /* หน้าเว็บลูกค้าเขียนได้เฉพาะออเดอร์ใหม่เท่านั้น */
    var tabs = mode === 'public' ? [{ key: 'orders', table: 'orders' }] : TABLES;

    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i], cur = {}, up = [], prev = snap[t.key] || {};
      (st[t.key] || []).forEach(function (row) {
        if (!row || !row.id) return;
        /* ข้ามบัญชีตัวอย่างในเครื่อง (ยังไม่มีบัญชีจริงใน Supabase Auth) */
        if (t.key === 'users' && row.pass) return;
        var js = JSON.stringify(row);
        cur[row.id] = js;
        if (force || prev[row.id] !== js) up.push({ id: row.id, data: row, updated_at: now });
      });
      if (up.length) {
        /* ฝั่งลูกค้ามีสิทธิ์ "สร้าง" ออเดอร์อย่างเดียว จึงต้องใช้ insert ล้วน
           (upsert = INSERT ... ON CONFLICT UPDATE ซึ่งต้องมีสิทธิ์ UPDATE ด้วย
            ถ้าเปิดสิทธิ์นั้นให้ลูกค้า จะกลายเป็นว่าใครก็แก้ออเดอร์คนอื่นได้) */
        var r = mode === 'public'
          ? await sb.from(t.table).insert(up)
          : await sb.from(t.table).upsert(up);
        if (r.error) { console.warn('[cloud] เขียน ' + t.table + ' ไม่ได้:', r.error.message); continue; }
      }
      if (mode !== 'public') {
        var del = Object.keys(prev).filter(function (id) { return !cur[id]; });
        if (del.length) {
          var d = await sb.from(t.table).delete().in('id', del);
          if (d.error) console.warn('[cloud] ลบใน ' + t.table + ' ไม่ได้:', d.error.message);
        }
      }
      snap[t.key] = cur;
    }

    if (mode !== 'public') {
      var sdata = { settings: st.settings, categories: st.categories };
      var js2 = JSON.stringify(sdata);
      if (force || snap.__settings !== js2) {
        var rs = await sb.from('settings').upsert({ id: 'main', data: sdata, updated_at: now });
        if (rs.error) console.warn('[cloud] เขียน settings ไม่ได้:', rs.error.message);
        else snap.__settings = js2;
      }
    }
  }

  /* ---------- รับความเปลี่ยนแปลงแบบเรียลไทม์ ---------- */
  function subscribe() {
    if (!sb || channel) return;
    var tabs = mode === 'public'
      ? ['products', 'settings']
      : TABLES.map(function (t) { return t.table; }).concat('settings');

    channel = sb.channel('crowscase-sync');
    tabs.forEach(function (tb) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tb }, function (payload) {
        applyRemote(tb, payload);
      });
    });
    channel.subscribe(function (st) {
      if (st === 'SUBSCRIBED') setStatus('online');
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setStatus('error', 'การเชื่อมต่อเรียลไทม์ขัดข้อง');
    });
  }

  function applyRemote(table, payload) {
    var st = DB.state, changed = false;
    applying = true;
    try {
      if (table === 'settings') {
        var d = payload.new && payload.new.data;
        if (d) {
          if (d.settings) Object.assign(st.settings, d.settings);
          if (Array.isArray(d.categories)) st.categories = d.categories;
          snap.__settings = JSON.stringify({ settings: st.settings, categories: st.categories });
          changed = true;
        }
      } else {
        var key = BY_TABLE[table];
        if (!key) return;
        if (!Array.isArray(st[key])) st[key] = [];
        var list = st[key];
        if (payload.eventType === 'DELETE') {
          var oldId = payload.old && payload.old.id;
          if (oldId) {
            var n = list.length;
            st[key] = list.filter(function (r) { return r.id !== oldId; });
            if (snap[key]) delete snap[key][oldId];
            changed = st[key].length !== n;
          }
        } else {
          var row = payload.new && payload.new.data;
          if (row && row.id) {
            var idx = list.findIndex(function (r) { return r.id === row.id; });
            if (idx > -1) list[idx] = row;
            else if (key === 'orders' || key === 'activity' || key === 'stockLogs') list.unshift(row);
            else list.push(row);
            if (!snap[key]) snap[key] = {};
            snap[key][row.id] = JSON.stringify(row);
            changed = true;
          }
        }
      }
      if (changed) { sortAll(); DB.save(); }
    } finally {
      applying = false;
    }
    if (changed) { try { onChange(table, payload); } catch (e) { } }
  }

  /* ---------- ไฟล์รูปภาพ / วิดีโอสินค้า (Supabase Storage) ---------- */
  var BUCKET = 'product-media';

  async function uploadMedia(file, productId) {
    if (!sb) throw new Error('ต้องเชื่อมต่อ Supabase ก่อนจึงจะอัปโหลดไฟล์ได้');
    var ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    var path = 'products/' + (productId || 'misc') + '/' +
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var r = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000', upsert: false, contentType: file.type || undefined
    });
    if (r.error) {
      var m = r.error.message || '';
      if (/Bucket not found/i.test(m)) m = 'ยังไม่มีที่เก็บไฟล์ — กรุณารันไฟล์ supabase/schema.sql ใน SQL Editor อีกครั้ง';
      else if (/exceeded the maximum allowed size|Payload too large/i.test(m)) m = 'ไฟล์ใหญ่เกินที่ระบบอนุญาต (สูงสุด 50 MB)';
      else if (/row-level security|Unauthorized/i.test(m)) m = 'ไม่มีสิทธิ์อัปโหลด — กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานอีกครั้ง';
      throw new Error(m);
    }
    var pub = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: pub.data.publicUrl, path: path };
  }

  async function deleteMedia(path) {
    if (!sb || !path) return;
    try { await sb.storage.from(BUCKET).remove([path]); }
    catch (e) { console.warn('[cloud] ลบไฟล์ไม่สำเร็จ', e); }
  }

  /* ---------- บัญชีผู้ใช้ ---------- */
  async function session() {
    if (!sb) return null;
    var r = await sb.auth.getSession();
    return (r.data && r.data.session) || null;
  }
  async function signIn(email, password) {
    if (!sb) return { ok: false, msg: 'ยังไม่ได้เชื่อมต่อ Supabase' };
    var r = await sb.auth.signInWithPassword({ email: String(email).trim(), password: password });
    if (r.error) {
      var m = r.error.message || '';
      if (/Invalid login/i.test(m)) m = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      else if (/Email not confirmed/i.test(m)) m = 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล';
      return { ok: false, msg: m };
    }
    return { ok: true, user: r.data.user };
  }
  async function signOut() {
    if (!sb) return;
    try { await sb.auth.signOut(); } catch (e) { }
    if (channel) { try { sb.removeChannel(channel); } catch (e) { } channel = null; }
    setStatus('signedout');
  }

  /* สร้างบัญชี auth ให้พนักงานใหม่ โดยไม่หลุด session ของคนที่กำลังล็อกอินอยู่
     (ใช้ client ตัวที่สอง แยก storage และไม่จำ session) */
  async function createAuthUser(email, password) {
    if (!sb) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
    var tmp = global.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'cc-tmp-' + Math.random().toString(36).slice(2) }
    });
    var r = await tmp.auth.signUp({ email: String(email).trim(), password: password });
    if (r.error) {
      var m = r.error.message || '';
      if (/already registered/i.test(m)) m = 'อีเมลนี้ถูกใช้สร้างบัญชีไปแล้ว';
      throw new Error(m);
    }
    if (!r.data || !r.data.user) throw new Error('สร้างบัญชีไม่สำเร็จ');
    return r.data.user.id;
  }

  global.Cloud = {
    get status() { return status; },
    get mode() { return mode; },
    get error() { return lastError; },
    isOn: function () { return status === 'online'; },
    configured: configured,
    init: init, pull: pull, push: push, schedulePush: schedulePush,
    afterLogin: afterLogin, takeSnapshot: takeSnapshot,
    session: session, signIn: signIn, signOut: signOut, createAuthUser: createAuthUser,
    uploadMedia: uploadMedia, deleteMedia: deleteMedia,
    client: function () { return sb; }
  };
})(window);
