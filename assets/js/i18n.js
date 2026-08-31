/* ============================================================
   i18n.js — ระบบหลายภาษาของหน้าเว็บลูกค้า (ไทย / English / 中文)
   - ข้อความประจำหน้าเว็บ: แปลไว้ในไฟล์นี้
   - เนื้อหาที่ตั้งค่าในแดชบอร์ด (หัวข้อหน้าแรก / เกี่ยวกับ):
     ใช้คำแปลจาก settings.i18n[lang] ถ้ากรอกไว้ ไม่งั้นใช้ภาษาไทยเป็นค่าสำรอง
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'crowscase_lang';

  var LANGS = [
    { id: 'th', short: 'ไทย', label: 'ภาษาไทย', htmlLang: 'th' },
    { id: 'en', short: 'EN', label: 'English', htmlLang: 'en' },
    { id: 'zh', short: '中文', label: '简体中文', htmlLang: 'zh-Hans' }
  ];

  var DICT = {
    th: {
      navHome: 'หน้าแรก', navShop: 'เลือกซื้อ', navAbout: 'เกี่ยวกับ', navContact: 'ติดต่อ',

      previewBtn: 'ดูตัวอย่าง',
      pvLoading: 'กำลังโหลดวิดีโอ…',
      pvPlay: 'เล่นวิดีโอตัวอย่าง',
      pvVideoErr: 'เล่นวิดีโอในหน้านี้ไม่ได้',
      pvVideoSlow: 'วิดีโอโหลดช้ากว่าปกติ',
      pvOpenNew: 'เปิดวิดีโอในแท็บใหม่ →',
      pvTitle: 'ตัวอย่างสินค้า',
      pvStock: 'คงเหลือ',
      pvNoMedia: 'ยังไม่มีรูปตัวอย่างสำหรับสินค้านี้',
      pvVideo: 'วิดีโอ',
      heroReady: 'พร้อมส่ง', heroSoldOut: 'สินค้าหมดชั่วคราว', heroViewAll: 'ดูสินค้าทั้งหมด →',
      heroCode: 'รหัส',

      trust1T: 'คัดวัสดุเกรดพรีเมียม',
      trust1D: 'อะคริลิกใสพิเศษ กันรอยและตัดแสง UV รักษาสีงานพิมพ์ให้คมชัดในระยะยาว',
      trust2T: 'ตรวจทุกชิ้นก่อนส่ง',
      trust2D: 'ขอบเรียบสนิท ไม่บาดมือ ไม่บาดการ์ด ทุกชิ้นผ่านการตรวจด้วยมือ',
      trust3T: 'ยืนยันก่อนชำระเงินเสมอ',
      trust3D: 'สั่งผ่านเว็บได้เลย ทางร้านโทรกลับยืนยันรายการก่อนทุกครั้ง ไม่ต้องโอนก่อน',

      shopKicker: 'Shop', shopTitle: 'เลือกซื้อสินค้า',
      shopDesc: 'เคสและอุปกรณ์ปกป้องการ์ดสะสมที่ทางร้านคัดมาแล้ว พร้อมราคาชัดเจนทุกชิ้น',
      searchPh: 'ค้นหาสินค้า…', catAll: 'ทั้งหมด',
      btnBuy: 'เลือกซื้อ', btnPicked: '✓ เลือกแล้ว', btnSoldOut: 'สินค้าหมด',
      tagRecommend: 'แนะนำ', tagSoldOut: 'สินค้าหมด',
      noResult: 'ไม่พบสินค้าที่ค้นหา', noResultSub: 'ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่น',

      stepsTitle: 'ขั้นตอนการสั่งซื้อ',
      step1T: 'เลือกสินค้า', step1D: 'กดปุ่ม “เลือกซื้อ” ที่สินค้าที่สนใจ เลือกได้หลายรายการ',
      step2T: 'ฝากชื่อและเบอร์โทร', step2D: 'กรอกชื่อ เบอร์ติดต่อกลับ และรายละเอียดเพิ่มเติมที่ต้องการ',
      step3T: 'ทางร้านติดต่อกลับ', step3D: 'ทีมงานจะโทรยืนยันรายการและแจ้งวิธีชำระเงินภายใน 24 ชม.',

      aboutKicker: 'About Us', aboutEst: 'ก่อตั้งเมื่อปี {year}',

      contactKicker: 'Contact', contactTitle: 'ติดต่อเรา',
      contactDesc: 'สอบถามสินค้า เช็กสต๊อก หรือขอคำแนะนำในการเลือกเคส ทักมาได้ทุกช่องทาง ยินดีตอบทุกคำถาม',
      ctLineLb: 'LINE Official', ctLineSb: 'ทักแชตสอบถาม / สั่งซื้อได้ทันที',
      ctFbLb: 'Facebook', ctFbSb: 'ดูสินค้าใหม่และรีวิวจากลูกค้า',
      ctPhoneLb: 'โทรศัพท์', ctPhoneSb: 'โทรคุยกับทีมงานโดยตรง',
      ctMailLb: 'อีเมล', ctMailSb: 'สำหรับงานขายส่ง / ธุรกิจ',
      ctFbFallback: 'เพจของเรา',
      infoAddr: 'ที่ตั้งร้าน', infoHours: 'เวลาทำการ', infoOnline: 'การสั่งซื้อออนไลน์',
      infoOnlineV: 'สั่งผ่านหน้าเว็บได้ตลอด 24 ชม. ทีมงานจะติดต่อกลับเพื่อยืนยันรายการภายใน 1 วันทำการ',
      openMap: 'เปิดแผนที่ →',

      cartFab: 'ตะกร้า', cartTitle: 'รายการที่เลือก & ข้อมูลติดต่อกลับ',
      cartItems: 'สินค้าที่คุณเลือก', cartTotal: 'ยอดรวมโดยประมาณ', cartInfo: 'ข้อมูลสำหรับติดต่อกลับ',
      fName: 'ชื่อผู้สั่งซื้อ', fNamePh: 'ชื่อ-นามสกุล',
      fPhone: 'เบอร์โทรติดต่อกลับ', fPhonePh: '08X-XXX-XXXX',
      fNote: 'รายละเอียดเพิ่มเติม', fNotePh: 'เช่น ช่วงเวลาที่สะดวกให้ติดต่อกลับ / ต้องการดูสินค้าจริงก่อน',
      privacy: 'ข้อมูลของคุณใช้สำหรับติดต่อยืนยันคำสั่งซื้อเท่านั้น ทางร้านจะโทรกลับภายใน 24 ชั่วโมง <b>ยังไม่มีการเรียกเก็บเงินในขั้นตอนนี้</b>',
      submitOrder: 'ส่งคำสั่งซื้อ ให้ร้านติดต่อกลับ', btnCancel: 'ยกเลิก',

      errName: 'กรุณากรอกชื่อผู้สั่งซื้อ', errPhone: 'กรุณากรอกเบอร์โทรให้ถูกต้อง',
      addedToast: 'เพิ่ม {name} แล้ว', soldOutToast: 'สินค้าชิ้นนี้หมดชั่วคราว',

      thanksTitle: 'ได้รับคำสั่งซื้อของคุณแล้ว', thanksHi: 'ขอบคุณ คุณ{name}',
      thanksOrderNo: 'หมายเลขคำสั่งซื้อของคุณคือ', thanksCallback: 'ทางร้านจะติดต่อกลับที่เบอร์ {phone} ภายใน 24 ชั่วโมง',
      thanksTotal: 'ยอดรวมโดยประมาณ', thanksUrgent: 'หากต้องการสอบถามเร่งด่วน โทร', thanksBtn: 'เลือกซื้อสินค้าต่อ'
    },

    en: {
      navHome: 'Home', navShop: 'Shop', navAbout: 'About', navContact: 'Contact',

      previewBtn: 'Preview',
      pvLoading: 'Loading video…',
      pvPlay: 'Play preview video',
      pvVideoErr: 'This video cannot play here',
      pvVideoSlow: 'The video is loading slowly',
      pvOpenNew: 'Open video in a new tab →',
      pvTitle: 'Product preview',
      pvStock: 'In stock',
      pvNoMedia: 'No preview media for this item yet',
      pvVideo: 'Video',
      heroReady: 'In stock', heroSoldOut: 'Temporarily out of stock', heroViewAll: 'Browse all products →',
      heroCode: 'SKU',

      trust1T: 'Premium-grade materials',
      trust1D: 'Ultra-clear, scratch-resistant acrylic with UV filtering that keeps print colours sharp for years.',
      trust2T: 'Every piece hand-checked',
      trust2D: 'Smooth edges that never cut your hands or your cards — each item is inspected before it ships.',
      trust3T: 'We confirm before you pay',
      trust3D: 'Order right here on the site. We always call to confirm your order first — no upfront transfer needed.',

      shopKicker: 'Shop', shopTitle: 'Browse our products',
      shopDesc: 'Hand-picked cases and accessories for protecting collectible cards, with clear pricing on every item.',
      searchPh: 'Search products…', catAll: 'All',
      btnBuy: 'Add to list', btnPicked: '✓ Selected', btnSoldOut: 'Out of stock',
      tagRecommend: 'Featured', tagSoldOut: 'Out of stock',
      noResult: 'No products found', noResultSub: 'Try a different keyword or category',

      stepsTitle: 'How ordering works',
      step1T: 'Pick your items', step1D: 'Tap “Add to list” on anything you like — choose as many items as you want.',
      step2T: 'Leave your name & phone', step2D: 'Give us your name, a callback number, and any details you need.',
      step3T: 'We call you back', step3D: 'Our team calls to confirm your order and payment details within 24 hours.',

      aboutKicker: 'About Us', aboutEst: 'Established {year}',

      contactKicker: 'Contact', contactTitle: 'Get in touch',
      contactDesc: 'Questions about a product, stock availability, or which case suits your cards? Reach us on any channel — we answer them all.',
      ctLineLb: 'LINE Official', ctLineSb: 'Chat with us or order instantly',
      ctFbLb: 'Facebook', ctFbSb: 'New arrivals and customer reviews',
      ctPhoneLb: 'Phone', ctPhoneSb: 'Talk to our team directly',
      ctMailLb: 'Email', ctMailSb: 'Wholesale and business enquiries',
      ctFbFallback: 'Our page',
      infoAddr: 'Store location', infoHours: 'Opening hours', infoOnline: 'Ordering online',
      infoOnlineV: 'Order through the website any time. Our team will contact you to confirm within one business day.',
      openMap: 'Open map →',

      cartFab: 'My list', cartTitle: 'Your selection & callback details',
      cartItems: 'Items you selected', cartTotal: 'Estimated total', cartInfo: 'Callback details',
      fName: 'Your name', fNamePh: 'Full name',
      fPhone: 'Callback phone number', fPhonePh: '+66 8X XXX XXXX',
      fNote: 'Additional details', fNotePh: 'e.g. best time to call / would like to see the item in person first',
      privacy: 'Your details are used only to confirm this order. We will call you back within 24 hours. <b>Nothing is charged at this step.</b>',
      submitOrder: 'Send order & request a callback', btnCancel: 'Cancel',

      errName: 'Please enter your name', errPhone: 'Please enter a valid phone number',
      addedToast: '{name} added', soldOutToast: 'This item is temporarily out of stock',

      thanksTitle: 'We have received your order', thanksHi: 'Thank you, {name}',
      thanksOrderNo: 'Your order number is', thanksCallback: 'We will call you back on {phone} within 24 hours',
      thanksTotal: 'Estimated total', thanksUrgent: 'For urgent enquiries, call', thanksBtn: 'Keep browsing'
    },

    zh: {
      navHome: '首页', navShop: '选购', navAbout: '关于我们', navContact: '联系我们',

      previewBtn: '查看详情',
      pvLoading: '正在加载视频…',
      pvPlay: '播放预览视频',
      pvVideoErr: '此视频无法在页面内播放',
      pvVideoSlow: '视频加载较慢',
      pvOpenNew: '在新标签页打开视频 →',
      pvTitle: '商品预览',
      pvStock: '库存',
      pvNoMedia: '该商品暂无预览图片',
      pvVideo: '视频',
      heroReady: '现货', heroSoldOut: '暂时售罄', heroViewAll: '查看全部商品 →',
      heroCode: '货号',

      trust1T: '精选优质材料',
      trust1D: '特级透明亚克力，防刮并阻隔紫外线，长久保持印刷色彩清晰。',
      trust2T: '出货前逐件检查',
      trust2D: '边缘平滑，不刮手也不伤卡，每一件都经过人工检验。',
      trust3T: '先确认再付款',
      trust3D: '可直接在网站下单，我们会先致电确认订单，无需预先转账。',

      shopKicker: 'Shop', shopTitle: '选购商品',
      shopDesc: '本店精心挑选的卡牌保护壳与配件，每件均标明价格。',
      searchPh: '搜索商品…', catAll: '全部',
      btnBuy: '加入选购', btnPicked: '✓ 已选', btnSoldOut: '售罄',
      tagRecommend: '推荐', tagSoldOut: '售罄',
      noResult: '未找到相关商品', noResultSub: '请更换关键词或选择其他分类',

      stepsTitle: '下单步骤',
      step1T: '选择商品', step1D: '点击心仪商品的「加入选购」，可同时选择多件。',
      step2T: '留下姓名与电话', step2D: '填写姓名、回电号码以及其他需求。',
      step3T: '我们主动联系您', step3D: '客服将在 24 小时内致电确认订单并告知付款方式。',

      aboutKicker: 'About Us', aboutEst: '创立于 {year} 年',

      contactKicker: 'Contact', contactTitle: '联系我们',
      contactDesc: '咨询商品、查询库存，或需要选购建议，欢迎通过任一渠道联系我们，我们都会一一回复。',
      ctLineLb: 'LINE 官方账号', ctLineSb: '可直接聊天咨询与下单',
      ctFbLb: 'Facebook', ctFbSb: '查看新品与顾客评价',
      ctPhoneLb: '电话', ctPhoneSb: '直接与我们的团队通话',
      ctMailLb: '电子邮件', ctMailSb: '批发与商务合作',
      ctFbFallback: '我们的主页',
      infoAddr: '店铺地址', infoHours: '营业时间', infoOnline: '网上下单',
      infoOnlineV: '网站 24 小时开放下单，我们将在一个工作日内联系您确认订单。',
      openMap: '打开地图 →',

      cartFab: '选购清单', cartTitle: '已选商品与回电信息',
      cartItems: '您选择的商品', cartTotal: '预估总额', cartInfo: '回电联系方式',
      fName: '订购人姓名', fNamePh: '姓名',
      fPhone: '回电号码', fPhonePh: '+66 8X XXX XXXX',
      fNote: '其他需求', fNotePh: '例如：方便接听电话的时段／希望先看实物',
      privacy: '您的信息仅用于确认本次订单，我们将在 24 小时内回电。<b>此步骤不会收取任何费用。</b>',
      submitOrder: '提交订单，等待联系', btnCancel: '取消',

      errName: '请填写订购人姓名', errPhone: '请填写正确的电话号码',
      addedToast: '已加入 {name}', soldOutToast: '该商品暂时售罄',

      thanksTitle: '已收到您的订单', thanksHi: '感谢您，{name}',
      thanksOrderNo: '您的订单编号为', thanksCallback: '我们将在 24 小时内致电 {phone} 与您确认',
      thanksTotal: '预估总额', thanksUrgent: '如需紧急咨询，请拨打', thanksBtn: '继续选购'
    }
  };

  /* เนื้อหาจากแดชบอร์ดที่รองรับหลายภาษา */
  var TRANSLATABLE = ['heroBadge', 'heroTitle', 'heroText', 'heroCta', 'aboutTitle', 'aboutText'];

  var cur = 'th';
  try { cur = localStorage.getItem(KEY) || 'th'; } catch (e) { }
  if (!DICT[cur]) cur = 'th';

  function apply() {
    var l = LANGS.find(function (x) { return x.id === cur; }) || LANGS[0];
    document.documentElement.lang = l.htmlLang;
  }
  function set(id) {
    if (!DICT[id]) return;
    cur = id;
    try { localStorage.setItem(KEY, id); } catch (e) { }
    apply();
  }
  function get() { return cur; }

  /* แปลข้อความประจำหน้าเว็บ — t('key', {name:'…'}) */
  function t(key, vars) {
    var d = DICT[cur] || DICT.th;
    var s = d[key] !== undefined ? d[key] : DICT.th[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(vars[k]);
      });
    }
    return s;
  }

  /* เนื้อหาจากแดชบอร์ด — ใช้คำแปลถ้ากรอกไว้ ไม่งั้นใช้ค่าภาษาไทย */
  function s(key) {
    var S = DB.state.settings;
    if (cur !== 'th' && S.i18n && S.i18n[cur] && String(S.i18n[cur][key] || '').trim()) {
      return S.i18n[cur][key];
    }
    return S[key];
  }

  apply();
  global.I18N = { LANGS: LANGS, TRANSLATABLE: TRANSLATABLE, set: set, get: get, t: t, s: s };
})(window);
