// Extrai a imagem pública de uma página de produto sem depender de uma loja específica.
const dns = require('node:dns').promises;
const net = require('node:net');

function isPublicAddress(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return !(p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127));
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' ? false :
      !(v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:') || v.startsWith('::ffff:'));
  }
  return false;
}
async function validateHost(url) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL não permitida');
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new Error('Destino não permitido');
}
function decode(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function findImage(html, pageUrl) {
  const candidates = [];
  const meta = /<meta\b[^>]*(?:property|name)\s*=\s*["'](og:image|og:image:url|twitter:image|twitter:image:src)["'][^>]*>/gi;
  let match;
  while ((match = meta.exec(html))) {
    const tag = match[0];
    const content = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
    if (content) candidates.push(content[2]);
  }
  const link = html.match(/<link\b(?=[^>]*\brel=["'][^"']*image_src[^"']*["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  if (link) candidates.push(link[1]);
  const jsonLd = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLd.exec(html))) {
    try {
      const data = JSON.parse(match[1]);
      const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (typeof value.image === 'string') candidates.push(value.image);
        else if (Array.isArray(value.image)) value.image.forEach(x => typeof x === 'string' ? candidates.push(x) : x?.url && candidates.push(x.url));
        else if (value.image?.url) candidates.push(value.image.url);
        if (Array.isArray(value)) value.forEach(visit);
        else Object.values(value).forEach(visit);
      };
      visit(data);
    } catch (_) {}
  }
  for (const candidate of candidates) {
    try {
      const url = new URL(decode(candidate), pageUrl);
      if (['http:', 'https:'].includes(url.protocol)) return url.href;
    } catch (_) {}
  }
  return '';
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const raw = req.body?.url;
  if (typeof raw !== 'string' || raw.length > 2048) return res.status(400).json({ error: 'Link inválido' });
  let current;
  try { current = new URL(raw); await validateHost(current); }
  catch (_) { return res.status(400).json({ error: 'O link não é válido ou aponta para um destino não permitido.' }); }
  try {
    let response, html = '';
    for (let redirects = 0; redirects <= 3; redirects++) {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(9000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrickByBrickProductImage/1.0)', Accept: 'text/html,application/xhtml+xml' }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects === 3) break;
        current = new URL(location, current);
        await validateHost(current);
        continue;
      }
      if (!response.ok) break;
      const type = response.headers.get('content-type') || '';
      if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) break;
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > 1200000) break;
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 1200000) { await reader.cancel(); throw new Error('Página demasiado grande'); }
        chunks.push(Buffer.from(part.value));
      }
      html = Buffer.concat(chunks).toString('utf8');
      break;
    }
    if (!html) return res.status(422).json({ error: 'Não foi possível ler a página desta loja. Pode bloquear consultas automáticas.' });
    const image = findImage(html, current.href);
    if (!image) return res.status(404).json({ error: 'A página não disponibiliza uma imagem de produto reconhecível.' });
    return res.status(200).json({ image, page: current.origin });
  } catch (_) {
    return res.status(502).json({ error: 'Não foi possível obter a imagem deste link.' });
  }
};
