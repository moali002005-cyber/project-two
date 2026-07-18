// Vercel Serverless Function: /api/reef
// محرّك محتوى عطور ريف: يسحب الكتالوج من متجر Salla، يقترح توجّهات، ويولّد بريفات فيديو TikTok.
// Actions: catalog | product | plan | generate
// المفاتيح السرّية من بيئة Vercel فقط. ANTHROPIC_API_KEY مطلوب لِ plan/generate.

const STORE = 'https://reefperfumes.com';
const MODEL = process.env.REEF_MODEL || 'claude-haiku-4-5-20251001';
const UA = 'Mozilla/5.0 (compatible; ReefStudioBot/1.0; +content-engine)';

// ---------- helpers ----------
function decodeSlugName(url) {
  try {
    // ‎/ar/<slug>/p<id>‎  →  اسم مقروء من الـslug
    const m = url.match(/\/ar\/([^/]+)\/p\d+/);
    if (!m) return null;
    let name = decodeURIComponent(m[1]);
    name = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return name;
  } catch { return null; }
}
function productIdFromUrl(url) {
  const m = url.match(/\/p(\d+)(?:$|[/?#])/);
  return m ? m[1] : null;
}
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
  if (!r.ok) throw new Error('fetch ' + r.status + ' ' + url);
  return r.text();
}
function matchAll(re, s) { const out = []; let m; while ((m = re.exec(s))) out.push(m); return out; }

// يجمع كل روابط الخرائط الفرعية (عدا المدوّنة)، ثم يستخرج المنتجات من كل واحدة
async function getCatalog() {
  const idxXml = await fetchText(`${STORE}/sitemap.xml`);
  const subs = matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g, idxXml)
    .map(m => m[1])
    .filter(u => /sitemap-\d+\.xml/i.test(u) && !/blog/i.test(u));
  const seen = new Set();
  const items = [];
  for (const sub of subs) {
    let xml;
    try { xml = await fetchText(sub); } catch { continue; }
    // كل عنصر <url> فيه <loc> و (اختياري) <image:loc>
    const urlBlocks = xml.split(/<url>/i).slice(1);
    for (const block of urlBlocks) {
      const locM = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
      if (!locM) continue;
      const url = locM[1];
      if (!/\/ar\/[^/]+\/p\d+/.test(url)) continue;      // منتجات عربية فقط
      const id = productIdFromUrl(url);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = decodeSlugName(url) || ('منتج ' + id);
      const imgM = block.match(/<image:loc>\s*([^<\s]+)\s*<\/image:loc>/i);
      items.push({ id, name, url, image: imgM ? imgM[1] : null });
    }
  }
  return items;
}

// يجلب تفاصيل منتج واحد من صفحته (JSON-LD + OpenGraph)
async function getProduct(url) {
  if (!/^https:\/\/reefperfumes\.com\//.test(url)) throw new Error('bad url');
  const html = await fetchText(url);
  const out = { url, name: decodeSlugName(url), description: '', price: null, currency: 'SAR', images: [] };

  // JSON-LD
  const scripts = matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, html);
  for (const s of scripts) {
    let data; try { data = JSON.parse(s[1].trim()); } catch { continue; }
    const arr = Array.isArray(data) ? data : (data['@graph'] || [data]);
    for (const node of arr) {
      if (!node || typeof node !== 'object') continue;
      const t = node['@type'];
      const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
      if (!isProduct) continue;
      if (node.name) out.name = String(node.name).trim();
      if (node.description) out.description = String(node.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
      const imgs = node.image ? (Array.isArray(node.image) ? node.image : [node.image]) : [];
      out.images.push(...imgs.filter(Boolean));
      const offers = node.offers ? (Array.isArray(node.offers) ? node.offers : [node.offers]) : [];
      for (const of of offers) {
        if (of && of.price != null && out.price == null) out.price = String(of.price);
        if (of && of.priceCurrency) out.currency = of.priceCurrency;
      }
    }
  }
  // OpenGraph fallback
  if (!out.description) {
    const d = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (d) out.description = d[1].replace(/\s+/g, ' ').trim().slice(0, 1200);
  }
  const ogImgs = matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi, html).map(m => m[1]);
  out.images.push(...ogImgs);
  out.images = [...new Set(out.images.filter(u => /^https?:\/\//.test(u)))].slice(0, 8);
  return out;
}

// ---------- Anthropic ----------
async function askClaude(apiKey, system, user, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 2000, system, messages: [{ role: 'user', content: user }] })
  });
  if (!r.ok) { console.error('claude', r.status, await r.text()); throw new Error('claude ' + r.status); }
  const j = await r.json();
  return (j.content && j.content[0] && j.content[0].text) ? j.content[0].text : '';
}
function parseJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  const c = t.indexOf('['); const d = t.lastIndexOf(']');
  let slice = t;
  if (c !== -1 && (a === -1 || c < a)) slice = t.slice(c, d + 1);
  else if (a !== -1) slice = t.slice(a, b + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

const CTX = (p) => `الباقة: ${p.name || 'باقة ريف'}
${p.price ? 'السعر: ' + p.price + ' ' + (p.currency || 'ريال') : ''}
${p.description ? 'الوصف: ' + p.description : ''}
العلامة: عطور ريف (REEF) — علامة سعودية فاخرة للعطور والعناية.`;

// ---------- handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // حماية اختيارية: لو REEF_STUDIO_KEY مضبوط بالبيئة، لازم يطابق ترويسة x-studio-key
  const gate = process.env.REEF_STUDIO_KEY;
  if (gate) {
    const sent = req.headers['x-studio-key'] || '';
    if (sent !== gate) return res.status(401).json({ error: 'رمز الدخول غير صحيح' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === 'catalog') {
      const items = await getCatalog();
      return res.status(200).json({ ok: true, count: items.length, items });
    }

    if (action === 'product') {
      const url = String(body.url || '');
      if (!url) return res.status(400).json({ error: 'رابط الباقة مفقود' });
      const p = await getProduct(url);
      return res.status(200).json({ ok: true, product: p });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'المولّد غير مهيّأ (ANTHROPIC_API_KEY مفقود)' });

    if (action === 'plan') {
      const p = body.product || {};
      const count = Math.max(1, Math.min(10, parseInt(body.count, 10) || 3));
      const system = `أنت مخرج محتوى سوشال ميديا سعودي محترف متخصّص في تيك توك للعطور الفاخرة.
مهمتك: تقترح توجّهات (زوايا) إبداعية متنوّعة لفيديوهات قصيرة عن باقة عطر، ثم تحدّد أهم الأسئلة اللي تحتاجها لتفصيل الفيديوهات.
أعطِ ${count} توجّهات مختلفة فعلاً (مو تكرار)، مناسبة لتيك توك السعودي/الخليجي (خطّاف قوي أول ٣ ثواني، إيقاع سريع، عاطفة/فضول).
أرجع JSON فقط بهذا الشكل بدون أي نص خارجه:
{"directions":[{"title":"اسم التوجّه","angle":"وصف الزاوية بسطر","hook_example":"مثال خطّاف واقعي بالخليجي"}],
"questions":[{"key":"seconds","label":"كم ثانية لكل فيديو؟","type":"choice","options":["10","15","20","30"],"default":"15"},
{"key":"dialect","label":"اللهجة","type":"choice","options":["سعودي بيضاء","خليجي","فصحى مبسّطة"],"default":"سعودي بيضاء"},
{"key":"audience","label":"الجمهور المستهدف","type":"text","placeholder":"مثال: شباب ٢٠-٣٥، هدايا، مناسبات"},
{"key":"focus","label":"أهم ميزة نركّز عليها","type":"text","placeholder":"مثال: ثبات العطر، الفخامة، السعر/العرض"},
{"key":"music","label":"جو الموسيقى","type":"choice","options":["فخم هادئ","إيقاع ترند سريع","إحساسي رومانسي","بدون موسيقى (صوت فقط)"],"default":"إيقاع ترند سريع"},
{"key":"cta","label":"الإجراء المطلوب (CTA)","type":"text","placeholder":"مثال: اطلبه الحين من ريف، الرابط بالبايو"}]}`;
      const user = `${CTX(p)}\nعدد الفيديوهات المطلوبة: ${count}\nاقترح ${count} توجّهات + الأسئلة.`;
      const txt = await askClaude(apiKey, system, user, 1800);
      const data = parseJson(txt);
      if (!data || !data.directions) return res.status(502).json({ error: 'تعذّر توليد التوجّهات، جرّب مرة ثانية' });
      return res.status(200).json({ ok: true, ...data });
    }

    if (action === 'generate') {
      const p = body.product || {};
      const count = Math.max(1, Math.min(10, parseInt(body.count, 10) || (body.directions || []).length || 3));
      const answers = body.answers || {};
      const directions = body.directions || [];
      const seconds = answers.seconds || '15';
      const system = `أنت مخرج ومونتير محتوى تيك توك سعودي محترف للعطور الفاخرة (علامة ريف).
اكتب لكل فيديو "بريف إنتاجي" جاهز للتصوير/التركيب، دقيق وقابل للتنفيذ، بالعربي، ومناسب لتيك توك السعودي.
راعِ: مدة كل فيديو ~${seconds} ثانية، خطّاف يشدّ أول ٣ ثواني، إيقاع سريع، استخدام صور/لقطات الباقة الحقيقية، وإنهاء بـCTA.
أرجع JSON فقط بهذا الشكل بدون أي نص خارجه:
{"videos":[{
"index":1,
"direction":"اسم التوجّه",
"title":"عنوان الفيديو",
"duration_sec":${seconds},
"hook":"الخطّاف (أول ٣ ثواني) نص يُقال/يظهر",
"script":"السكربت/النص الصوتي كامل",
"onscreen_text":["نص شاشة 1","نص شاشة 2"],
"shotlist":[{"t":"0-3s","shot":"وصف اللقطة","asset":"أي صورة/مقطع من الباقة نستخدم"}],
"caption":"كابشن المنشور بالخليجي",
"hashtags":["#عطور_ريف","#..."],
"audio":"وصف/اقتراح الصوت أو الموسيقى",
"cta":"الدعوة للإجراء"
}]}`;
      const user = `${CTX(p)}
عدد الفيديوهات: ${count}
التوجّهات المختارة: ${JSON.stringify(directions.slice(0, count))}
تفاصيل المستخدم: ${JSON.stringify(answers)}
اكتب ${count} بريفات كاملة (واحد لكل توجّه، وإن نقصت التوجّهات كمّل بتوجّهات مناسبة).`;
      const txt = await askClaude(apiKey, system, user, 4000);
      const data = parseJson(txt);
      if (!data || !data.videos) return res.status(502).json({ error: 'تعذّر توليد البريفات، جرّب مرة ثانية' });
      return res.status(200).json({ ok: true, ...data });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (e) {
    console.error('reef api error:', e);
    return res.status(500).json({ error: 'خطأ غير متوقّع: ' + (e.message || 'حاول مرة ثانية') });
  }
}
