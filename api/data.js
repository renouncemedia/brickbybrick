// Vercel serverless function: armazenamento do estado partilhado do orçamento.
// Configure SUPABASE_URL e SUPABASE_SECRET_KEY nas variáveis de ambiente do Vercel.
const TABLE = 'orcamento_partilhado';
const BACKUP_TABLE = 'orcamento_historico';
const BACKUP_MIN_INTERVAL_MS = 5 * 60 * 1000;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = secretKey || legacyServiceRoleKey;
  if (!url || !key) return res.status(500).json({ error: 'Falta configurar Supabase no Vercel' });
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${TABLE}`;
  const headers = {
    apikey: key,
    'Content-Type': 'application/json'
  };
  // As chaves secretas novas (sb_secret_...) não são JWTs; não as enviar como Bearer.
  // A chave antiga service_role (JWT) precisa do cabeçalho Authorization.
  if (!secretKey && legacyServiceRoleKey) headers.Authorization = `Bearer ${legacyServiceRoleKey}`;
  try {
    if (req.method === 'GET') {
      const r = await fetch(`${endpoint}?id=eq.1&select=data,updated_at`, { headers });
      const body = await r.text();
      if (!r.ok) return res.status(502).json({ error: 'Erro ao ler a base de dados', detail: body });
      const rows = JSON.parse(body || '[]');
      return res.status(200).json({ data: rows.length ? rows[0].data : null, version: rows.length ? rows[0].updated_at : null });
    }
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    const base = req.body && req.body.base ? String(req.body.base) : null;
    const baseUrl = url.replace(/\/$/, '') + '/rest/v1/';
    const cur = await fetch(`${endpoint}?id=eq.1&select=data,updated_at`, { headers });
    const curBody = await cur.text();
    if (!cur.ok) return res.status(502).json({ error: 'Erro ao ler a base de dados', detail: curBody });
    const curRows = JSON.parse(curBody || '[]');
    const conflict = () => res.status(409).json({
      error: 'Os dados foram alterados noutro dispositivo',
      data: curRows.length ? curRows[0].data : null,
      version: curRows.length ? curRows[0].updated_at : null
    });
    const now = new Date().toISOString();

    if (!curRows.length) {
      // Primeira gravação: só é aceite se o cliente também não tinha versão.
      if (base) return conflict();
      const ins = await fetch(`${endpoint}?on_conflict=id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ id: 1, data, updated_at: now })
      });
      const insBody = await ins.text();
      if (!ins.ok) return res.status(502).json({ error: 'Erro ao guardar na base de dados', detail: insBody });
      const insRows = JSON.parse(insBody || '[]');
      if (!insRows.length) return conflict();
      return res.status(200).json({ ok: true, version: insRows[0].updated_at || now });
    }

    // Controlo de versão: o cliente tem de ter lido a versão atual.
    const sameVersion = (a, b) => a && b && Date.parse(a) === Date.parse(b);
    if (!sameVersion(base, curRows[0].updated_at)) return conflict();

    // Cópia de segurança do estado anterior (best-effort: se a tabela não existir, ignora).
    try {
      if (JSON.stringify(curRows[0].data) !== JSON.stringify(data)) {
        const last = await fetch(`${baseUrl}${BACKUP_TABLE}?select=saved_at&order=saved_at.desc&limit=1`, { headers });
        const lastRows = last.ok ? JSON.parse((await last.text()) || '[]') : null;
        const lastAt = lastRows && lastRows.length ? Date.parse(lastRows[0].saved_at) : 0;
        if (lastRows && Date.now() - lastAt > BACKUP_MIN_INTERVAL_MS) {
          await fetch(`${baseUrl}${BACKUP_TABLE}`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({ data: curRows[0].data })
          });
        }
      }
    } catch (_) { /* a cópia de segurança nunca bloqueia o guardar */ }

    // Atualização condicionada à versão lida (atómica): se mudou entretanto, não escreve.
    const upd = await fetch(`${endpoint}?id=eq.1&updated_at=eq.${encodeURIComponent(curRows[0].updated_at)}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ data, updated_at: now })
    });
    const updBody = await upd.text();
    if (!upd.ok) return res.status(502).json({ error: 'Erro ao guardar na base de dados', detail: updBody });
    const updRows = JSON.parse(updBody || '[]');
    if (!updRows.length) return conflict();
    return res.status(200).json({ ok: true, version: updRows[0].updated_at });
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno ao aceder à base de dados' });
  }
};
