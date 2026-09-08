/*
  i18n.js — language switcher (English / Hindi / Urdu), plain-language
  "what this means for you" insight generator, and a lightweight glossary
  tooltip system.

  Scope note: this translates the site's chrome (nav, hero, section
  headings, the plain-language insight card, glossary terms, buttons) so a
  non-English-reading farmer or official can navigate and get the headline
  meaning. Long-form paragraphs (methodology detail, source descriptions)
  stay in English for now — machine-quality Hindi/Urdu there would need a
  native-speaker review before going live; see README.

  HONESTY NOTE: the Hindi and Urdu strings below were drafted by an AI
  assistant, not reviewed by a native speaker. They should be checked
  before this ships to real farmers or officials — get someone fluent to
  read through them once, especially the Urdu (script correctness matters
  a lot there).
*/

const I18N = {
  en: {
    nav_overview: 'Overview', nav_dashboard: 'Dashboard', nav_links: 'Signal links',
    nav_method: 'Methodology', nav_sources: 'Data sources',
    hero_kicker: 'Early warning for agricultural water stress',
    hero_h1: 'The water table drops months<br>before the mandi price does.',
    hero_lede: "Jal Watch reads CGWB's telemetric groundwater sensors across saffron and apple-growing districts of Jammu & Kashmir, and lines them up against years of Agmarknet mandi records — turning a slow, quiet decline underground into a warning that officials and growers can act on before harvest.",
    hero_cta_primary: 'Open the dashboard', hero_cta_ghost: 'How the index works',
    hero_stat1: 'CGWB DWLR stations nationwide, feeding readings every six hours',
    hero_stat2: 'APMC markets reporting daily in J&K via Agmarknet',
    hero_stat3: 'Signals combined into one district-level stress score',
    glance_water: 'Apple districts, soil moisture', glance_price: 'Apple mandi price',
    glance_forecast: 'Next-season signal',
    overview_kicker: 'Overview', overview_h2: 'Two feeds, one signal, months of lead time',
    dashboard_kicker: 'Dashboard', dashboard_h2: 'District water stress dashboard',
    links_kicker: 'Signal links', links_h2: 'How rainfall, soil moisture, floods, and price connect — right now',
    method_kicker: 'Methodology', method_h2: 'How the stress index is built',
    sources_kicker: 'Data sources', sources_h2: 'Real, public, structured',
    search_placeholder: 'Search district or crop…',
    compare_label: 'Compare with another district',
    export_csv: 'Export CSV',
    footer_text: 'Jal Watch — built for Smart India Hackathon. Prototype uses illustrative data; see README for wiring in live feeds.',
    insight_title: 'What this means for you', insight_listen: 'Listen', insight_share: 'Share on WhatsApp',
    gauge_normal: 'Normal', gauge_watch: 'Watch', gauge_stress: 'Stress', gauge_severe: 'Severe',
    lang_note_short: 'Chrome & key insights translated · long-form sections stay in English for now',
    district_select_label: 'Select a district', metrics_title: 'Current & forecast — key variables',
    metric_soil: 'Soil moisture', metric_groundwater: 'Groundwater depth', metric_rain: 'Rainfall',
    metric_flood: 'Flood situation', metric_demand: 'Demand & supply (mandi)'
  },
  hi: {
    nav_overview: 'विवरण', nav_dashboard: 'डैशबोर्ड', nav_links: 'संकेत संबंध',
    nav_method: 'कार्यप्रणाली', nav_sources: 'डेटा स्रोत',
    hero_kicker: 'कृषि जल संकट के लिए पूर्व चेतावनी',
    hero_h1: 'मंडी भाव गिरने से महीनों पहले<br>भूजल स्तर गिरने लगता है।',
    hero_lede: 'जल वॉच जम्मू-कश्मीर के केसर और सेब उगाने वाले जिलों में CGWB के भूजल सेंसर की रीडिंग को वर्षों के एग्मार्कनेट मंडी आंकड़ों के साथ जोड़ता है — जमीन के नीचे की धीमी गिरावट को एक ऐसी चेतावनी में बदलता है जिस पर अधिकारी और किसान फसल कटने से पहले ही काम कर सकें।',
    hero_cta_primary: 'डैशबोर्ड खोलें', hero_cta_ghost: 'सूचकांक कैसे काम करता है',
    hero_stat1: 'देशभर में CGWB के DWLR स्टेशन, हर छह घंटे में रीडिंग भेजते हैं',
    hero_stat2: 'जम्मू-कश्मीर में रोज़ाना रिपोर्ट करने वाली APMC मंडियां (एग्मार्कनेट)',
    hero_stat3: 'एक जिला-स्तरीय संकट स्कोर में मिलाए गए संकेत',
    glance_water: 'सेब जिले, मिट्टी की नमी', glance_price: 'सेब का मंडी भाव',
    glance_forecast: 'अगले सीज़न का संकेत',
    overview_kicker: 'विवरण', overview_h2: 'दो डेटा स्रोत, एक संकेत, महीनों पहले की चेतावनी',
    dashboard_kicker: 'डैशबोर्ड', dashboard_h2: 'जिलावार जल संकट डैशबोर्ड',
    links_kicker: 'संकेत संबंध', links_h2: 'बारिश, मिट्टी की नमी, बाढ़ और भाव — अभी का हाल',
    method_kicker: 'कार्यप्रणाली', method_h2: 'संकट सूचकांक कैसे बनाया जाता है',
    sources_kicker: 'डेटा स्रोत', sources_h2: 'असली, सार्वजनिक, संरचित डेटा',
    search_placeholder: 'जिला या फसल खोजें…',
    compare_label: 'किसी अन्य जिले से तुलना करें',
    export_csv: 'CSV डाउनलोड करें',
    footer_text: 'जल वॉच — स्मार्ट इंडिया हैकाथॉन के लिए बनाया गया। यह प्रोटोटाइप उदाहरण डेटा उपयोग करता है; असली डेटा जोड़ने के लिए README देखें।',
    insight_title: 'आपके लिए इसका मतलब', insight_listen: 'सुनें', insight_share: 'व्हाट्सऐप पर भेजें',
    gauge_normal: 'सामान्य', gauge_watch: 'नज़र रखें', gauge_stress: 'संकट', gauge_severe: 'गंभीर',
    lang_note_short: 'मुख्य जानकारी हिंदी में · विस्तृत तकनीकी भाग अभी अंग्रेज़ी में हैं',
    district_select_label: 'एक जिला चुनें', metrics_title: 'मुख्य संकेतक — वर्तमान और अनुमान',
    metric_soil: 'मिट्टी की नमी', metric_groundwater: 'भूजल गहराई', metric_rain: 'बारिश',
    metric_flood: 'बाढ़ की स्थिति', metric_demand: 'मांग व आपूर्ति (मंडी)'
  },
  ur: {
    nav_overview: 'جائزہ', nav_dashboard: 'ڈیش بورڈ', nav_links: 'اشارے کا تعلق',
    nav_method: 'طریقہ کار', nav_sources: 'ڈیٹا ذرائع',
    hero_kicker: 'زرعی پانی کے بحران کے لیے پیشگی اطلاع',
    hero_h1: 'منڈی کا بھاؤ گرنے سے مہینوں پہلے<br>زیرِ زمین پانی کی سطح گرنے لگتی ہے۔',
    hero_lede: 'جل واچ جموں و کشمیر کے زعفران اور سیب کے اضلاع میں CGWB کے زیرِ زمین پانی کے سینسرز کی ریڈنگ کو ایگمارکنیٹ منڈی کے کئی سالوں کے ریکارڈ کے ساتھ ملاتا ہے — زمین کے نیچے کی خاموش گراوٹ کو ایک ایسی وارننگ میں بدل دیتا ہے جس پر افسران اور کاشتکار فصل کٹنے سے پہلے ہی عمل کر سکیں۔',
    hero_cta_primary: 'ڈیش بورڈ کھولیں', hero_cta_ghost: 'اشاریہ کیسے کام کرتا ہے',
    hero_stat1: 'ملک بھر میں CGWB کے DWLR اسٹیشنز، ہر چھ گھنٹے بعد ریڈنگ بھیجتے ہیں',
    hero_stat2: 'جموں و کشمیر میں روزانہ رپورٹ کرنے والی APMC منڈیاں (ایگمارکنیٹ)',
    hero_stat3: 'ایک ضلعی سطح کے بحران اسکور میں یکجا کیے گئے اشارے',
    glance_water: 'سیب کے اضلاع، مٹی کی نمی', glance_price: 'سیب کا منڈی بھاؤ',
    glance_forecast: 'اگلے سیزن کا اشارہ',
    overview_kicker: 'جائزہ', overview_h2: 'دو ذرائع، ایک اشارہ، مہینوں پہلے کی اطلاع',
    dashboard_kicker: 'ڈیش بورڈ', dashboard_h2: 'ضلع وار پانی کے بحران کا ڈیش بورڈ',
    links_kicker: 'اشارے کا تعلق', links_h2: 'بارش، مٹی کی نمی، سیلاب اور بھاؤ — ابھی کی صورتحال',
    method_kicker: 'طریقہ کار', method_h2: 'بحران کا اشاریہ کیسے بنایا جاتا ہے',
    sources_kicker: 'ڈیٹا ذرائع', sources_h2: 'حقیقی، عوامی، منظم ڈیٹا',
    search_placeholder: 'ضلع یا فصل تلاش کریں…',
    compare_label: 'کسی دوسرے ضلع سے موازنہ کریں',
    export_csv: 'CSV ڈاؤن لوڈ کریں',
    footer_text: 'جل واچ — اسمارٹ انڈیا ہیکاتھون کے لیے بنایا گیا۔ یہ نمونہ مثالی ڈیٹا استعمال کرتا ہے؛ حقیقی ڈیٹا شامل کرنے کے لیے README دیکھیں۔',
    insight_title: 'اس کا مطلب آپ کے لیے', insight_listen: 'سنیں', insight_share: 'واٹس ایپ پر بھیجیں',
    gauge_normal: 'معمول', gauge_watch: 'نظر رکھیں', gauge_stress: 'بحران', gauge_severe: 'شدید',
    lang_note_short: 'اہم معلومات اردو میں · تفصیلی تکنیکی حصے فی الحال انگریزی میں ہیں',
    district_select_label: 'ایک ضلع منتخب کریں', metrics_title: 'اہم اشارے — موجودہ اور تخمینہ',
    metric_soil: 'مٹی کی نمی', metric_groundwater: 'زیرِ زمین پانی کی گہرائی', metric_rain: 'بارش',
    metric_flood: 'سیلاب کی صورتحال', metric_demand: 'طلب اور رسد (منڈی)'
  }
};

// Short plain-language definitions for jargon terms — shown in a tap/click
// popover. Kept to a sentence or two: the goal is "what does this word
// mean", not a technical spec.
const GLOSSARY = {
  en: {
    dwlr: 'DWLR = Digital Water Level Recorder. A sensor lowered into a well that automatically measures how far down the water is, every few hours.',
    zscore: 'A way of saying "how unusual is this reading compared to normal for this time of year" — 0 means normal, higher numbers mean more unusual (and usually more worrying).',
    soilmoisture: 'How much water is held in the top layer of soil where plant roots sit — measured here from satellite/weather data, not a physical sensor in the ground.',
    agmarknet: 'The government\u2019s public website that publishes daily prices and arrival volumes from mandis (wholesale markets) across India.',
    apmc: 'Agricultural Produce Market Committee — the body that regulates a mandi (market yard) where farmers sell their produce.'
  },
  hi: {
    dwlr: 'DWLR = डिजिटल वॉटर लेवल रिकॉर्डर। एक कुएं में लगा सेंसर, जो हर कुछ घंटों में अपने आप बताता है कि पानी कितनी गहराई पर है।',
    zscore: 'यह बताने का एक तरीका कि "यह रीडिंग सामान्य से कितनी अलग है" — 0 का मतलब सामान्य, ज़्यादा नंबर का मतलब ज़्यादा असामान्य (और आमतौर पर ज़्यादा चिंताजनक)।',
    soilmoisture: 'मिट्टी की ऊपरी परत में कितना पानी है, जहां पौधों की जड़ें होती हैं — यह उपग्रह/मौसम डेटा से नापा जाता है, ज़मीन में लगे किसी सेंसर से नहीं।',
    agmarknet: 'सरकार की वेबसाइट, जो देशभर की मंडियों (थोक बाज़ार) के रोज़ाना भाव और आवक की जानकारी देती है।',
    apmc: 'कृषि उपज मंडी समिति — वह संस्था जो मंडी का संचालन करती है, जहां किसान अपनी उपज बेचते हैं।'
  },
  ur: {
    dwlr: 'DWLR = ڈیجیٹل واٹر لیول ریکارڈر۔ کنویں میں لگا ایک سینسر جو ہر چند گھنٹوں بعد خود بخود بتاتا ہے کہ پانی کتنی گہرائی پر ہے۔',
    zscore: 'یہ بتانے کا ایک طریقہ کہ "یہ ریڈنگ معمول سے کتنی مختلف ہے" — 0 کا مطلب معمول، بڑا نمبر زیادہ غیر معمولی (اور عام طور پر زیادہ تشویشناک)۔',
    soilmoisture: 'مٹی کی اوپری تہہ میں کتنا پانی موجود ہے، جہاں پودوں کی جڑیں ہوتی ہیں — یہ سیٹلائٹ/موسمی ڈیٹا سے ناپا جاتا ہے، زمین میں لگے کسی سینسر سے نہیں۔',
    agmarknet: 'حکومت کی ویب سائٹ جو ملک بھر کی منڈیوں (تھوک بازار) کے روزانہ بھاؤ اور آمد کی تفصیل شائع کرتی ہے۔',
    apmc: 'ایگریکلچرل پروڈیوس مارکیٹ کمیٹی — وہ ادارہ جو منڈی کا نظم کرتا ہے، جہاں کاشتکار اپنی پیداوار بیچتے ہیں۔'
  }
};

let currentLang = localStorage.getItem('jw_lang') || 'en';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || '';
}

// ---------------------------------------------------------------
// Apply the current language to every [data-i18n] / [data-i18n-html]
// element, flip document direction for Urdu, and update the switcher UI.
// ---------------------------------------------------------------
function applyLanguage(lang) {
  if (!I18N[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('jw_lang', lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  document.body.classList.toggle('lang-ur', lang === 'ur');
  document.body.classList.toggle('lang-hi', lang === 'hi');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const val = t(key);
    if (val) el.innerHTML = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val) el.placeholder = val;
  });

  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  const note = document.getElementById('langNote');
  if (note) note.textContent = lang === 'en' ? '' : t('lang_note_short');

  // Re-render language-dependent dynamic content (plain-language card,
  // gauge labels) for whichever district is currently selected.
  if (typeof window.selectDistrict === 'function' && window.currentSelectedId) {
    renderPlainInsight(districtById(window.currentSelectedId));
    if (typeof renderMetricsGrid === 'function') renderMetricsGrid(districtById(window.currentSelectedId));
  }
}

function initLangSwitcher() {
  const wrap = document.getElementById('langSwitch');
  if (!wrap) return;
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    applyLanguage(btn.dataset.lang);
  });
}

// ---------------------------------------------------------------
// Plain-language "what this means for you" card. Turns the technical
// status/idx into a short sentence a non-specialist can act on, plus a
// listen (text-to-speech) and WhatsApp-share button — the two channels
// people in these districts are most likely to actually use.
// ---------------------------------------------------------------
const PLAIN_TEMPLATES = {
  stress: {
    en: (n, c) => `Water levels near ${n} are well below normal for this time of year. In similar past dips, ${c.toLowerCase()} supply at the mandi dropped within a few months and prices moved. If you farm here, consider water-saving irrigation now and check in with your local agriculture office.`,
    hi: (n, c) => `${n} के आसपास पानी का स्तर इस मौसम के हिसाब से सामान्य से काफी कम है। पहले ऐसी गिरावट में कुछ महीनों में मंडी में ${c} की आवक कम हुई और भाव बदले। अगर आप यहां खेती करते हैं, तो अभी पानी बचाने वाली सिंचाई अपनाएं और अपने कृषि कार्यालय से संपर्क करें।`,
    ur: (n, c) => `${n} کے آس پاس پانی کی سطح اس موسم کے لحاظ سے معمول سے کافی کم ہے۔ پہلے ایسی کمی میں چند مہینوں میں منڈی میں ${c} کی آمد کم ہوئی اور بھاؤ بدلا۔ اگر آپ یہاں کاشتکاری کرتے ہیں تو ابھی پانی بچانے والی آبپاشی اپنائیں اور اپنے زرعی دفتر سے رابطہ کریں۔`
  },
  watch: {
    en: (n) => `Water levels near ${n} are a little below normal. It's not urgent yet — worth keeping an eye on over the next few weeks, especially if rainfall stays low.`,
    hi: (n) => `${n} के आसपास पानी का स्तर सामान्य से थोड़ा कम है। अभी घबराने की बात नहीं है — अगले कुछ हफ्तों में नज़र बनाए रखें, खासकर अगर बारिश कम रहे।`,
    ur: (n) => `${n} کے آس پاس پانی کی سطح معمول سے تھوڑی کم ہے۔ ابھی فکر کی بات نہیں — اگلے چند ہفتوں میں نظر رکھیں، خاص طور پر اگر بارش کم رہے۔`
  },
  normal: {
    en: (n) => `Water levels near ${n} are close to what's expected for this time of year. No action needed right now.`,
    hi: (n) => `${n} के आसपास पानी का स्तर इस मौसम के लिए सामान्य के करीब है। अभी कोई कार्रवाई ज़रूरी नहीं है।`,
    ur: (n) => `${n} کے آس پاس پانی کی سطح اس موسم کے لیے متوقع سطح کے قریب ہے۔ ابھی کوئی کارروائی ضروری نہیں۔`
  }
};
const STATUS_ICON = { stress: '🔴', watch: '🟡', normal: '🟢' };

function renderPlainInsight(d) {
  const box = document.getElementById('plainInsight');
  if (!box || !d) return;
  window.currentSelectedId = d.id;

  const name = d.name.split(',')[0];
  const tmpl = (PLAIN_TEMPLATES[d.status] || PLAIN_TEMPLATES.normal)[currentLang] || PLAIN_TEMPLATES[d.status].en;
  const sentence = tmpl(name, d.crop);

  document.getElementById('plainInsightIcon').textContent = STATUS_ICON[d.status] || '🟢';
  document.getElementById('plainInsightTitle').textContent = t('insight_title');
  document.getElementById('plainInsightBody').textContent = sentence;

  const listenBtn = document.getElementById('plainInsightListen');
  listenBtn.textContent = '🔊 ' + t('insight_listen');
  listenBtn.onclick = () => speakText(sentence);

  const shareBtn = document.getElementById('plainInsightShare');
  shareBtn.textContent = '📤 ' + t('insight_share');
  shareBtn.href = 'https://wa.me/?text=' + encodeURIComponent(sentence + '\n\n' + location.href);

  renderGauge(d);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'ur' ? 'ur-PK' : 'en-IN';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// ---------------------------------------------------------------
// Segmented risk gauge — Normal / Watch / Stress / Severe — with a
// marker positioned by the district's current index. Thresholds are the
// same rough bands the sidebar/status pill colours already imply.
// ---------------------------------------------------------------
const GAUGE_MAX = 2.6;
function renderGauge(d) {
  const marker = document.getElementById('gaugeMarker');
  const labels = document.querySelectorAll('.gauge-seg-label');
  if (!marker) return;
  const keys = ['gauge_normal', 'gauge_watch', 'gauge_stress', 'gauge_severe'];
  labels.forEach((el, i) => { el.textContent = t(keys[i]); });
  const pct = Math.max(2, Math.min(98, (d.idx / GAUGE_MAX) * 100));
  marker.style.left = pct + '%';
  marker.title = `Index ${d.idx.toFixed(1)}`;
}

// ---------------------------------------------------------------
// Glossary popovers — click/tap a term to see a one-line plain-language
// definition. One shared popover element, repositioned per click.
// ---------------------------------------------------------------
function initGlossary() {
  let popover = document.getElementById('glossaryPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'glossaryPopover';
    popover.className = 'glossary-popover';
    document.body.appendChild(popover);
  }
  document.addEventListener('click', e => {
    const term = e.target.closest('.glossary');
    if (term) {
      const key = term.dataset.term;
      const text = (GLOSSARY[currentLang] && GLOSSARY[currentLang][key]) || GLOSSARY.en[key];
      if (!text) return;
      popover.textContent = text;
      const r = term.getBoundingClientRect();
      popover.style.left = Math.min(window.innerWidth - 300, Math.max(12, r.left)) + 'px';
      popover.style.top = (r.bottom + window.scrollY + 8) + 'px';
      popover.classList.add('visible');
      e.stopPropagation();
    } else if (!e.target.closest('.glossary-popover')) {
      popover.classList.remove('visible');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLangSwitcher();
  initGlossary();
  applyLanguage(currentLang);
});
