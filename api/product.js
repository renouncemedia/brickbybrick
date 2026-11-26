// Vercel serverless function: lê o nome e o preço de uma página de produto a partir do link.
// Sem variáveis de ambiente. Faz o pedido no servidor (o browser não pode, por causa do CORS).
const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 2 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
  }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}

async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Protocolo inválido');
  const host = u.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Endereço não permitido');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Endereço não permitido');
}

async function fetchHtml(startUrl) {
  let url = new URL(startUrl);
  for (let i = 0; i < 4; i++) {
    await assertPublic(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let r;
    try {
      r = await fetch(url, {
        redirect: 'manual', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.7' }
      });
    } finally { clearTimeout(timer); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      url = new URL(r.headers.get('location'), url);
      continue;
    }
    if (!r.ok) throw new Error('O site respondeu com ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.subarray(0, MAX_BYTES).toString('utf8');
  }
  throw new Error('Demasiados redirecionamentos');
}

function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function meta(html, keys) {
  for (const k of keys) {
    const re1 = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name|itemprop)=["\']' + k + '["\']', 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) return decode(m[1]);
  }
  return '';
}

function toNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : null;
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (ld > -1 && /\.\d{3}$/.test(s) && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) && n >= 0 ? n : null;
}

function walk(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => walk(n, out)); return; }
  const t = [].concat(node['@type'] || []);
  if (t.some(x => /^(Product|ProductGroup|IndividualProduct)$/i.test(x))) out.push(node);
  Object.values(node).forEach(v => walk(v, out));
}

function offerPrice(offers) {
  for (const o of [].concat(offers || [])) {
    if (!o || typeof o !== 'object') continue;
    const spec = [].concat(o.priceSpecification || [])[0] || {};
    const p = toNumber(o.price ?? o.lowPrice ?? spec.price);
    if (p != null) return { price: p, currency: o.priceCurrency || spec.priceCurrency || '' };
    if (o.offers) { const r = offerPrice(o.offers); if (r) return r; }
  }
  return null;
}

function parse(html) {
  let name = '', price = null, currency = '', image = '', source = '';
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let j; try { j = JSON.parse(m[1].trim()); } catch (_) { continue; }
    const prods = []; walk(j, prods);
    for (const p of prods) {
      if (!name && p.name) name = decode(p.name);
      if (!image && p.image) image = [].concat(p.image)[0]?.url || [].concat(p.image)[0] || '';
      if (price == null) {
        const o = offerPrice(p.offers);
        if (o) { price = o.price; currency = o.currency; source = 'json-ld'; }
      }
    }
    if (name && price != null) break;
  }
  if (price == null) {
    const raw = meta(html, ['product:price:amount', 'og:price:amount', 'product:sale_price:amount', 'price', 'twitter:data1']);
    const p = toNumber(raw);
    if (p != null) { price = p; currency = meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency']); source = 'meta'; }
  }
  if (!name) name = meta(html, ['og:title', 'twitter:title']) || decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]);
  if (!image) image = meta(html, ['og:image', 'twitter:image']);
  return { name, price, currency, image, source };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  let target;
  try { target = new URL(String(req.query.url || '')); } catch (_) { return res.status(400).json({ error: 'Link inválido' }); }
  try {
    const html = await fetchHtml(target.href);
    const info = parse(html);
    if (!info.name && info.price == null) return res.status(422).json({ error: 'Não foi possível ler este link' });
    return res.status(200).json(info);
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Erro ao ler o link' });
  }
};
module.exports._parse = parse;
