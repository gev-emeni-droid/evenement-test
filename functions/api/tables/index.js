const ensureSchema = async (db) => {
  // Create schema if it does not exist
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS table_params (
      table_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      PRIMARY KEY (table_id, key)
    );
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rows (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS theme_settings (
      table_id TEXT PRIMARY KEY,
      theme_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `).run();
};

export const onRequestGet = async ({ env, request }) => {
  await ensureSchema(env.DB);
  const url = new URL(request.url);
  const archived = url.searchParams.get('archived');
  const where = archived === 'true' ? 'archived_at IS NOT NULL' : archived === 'false' ? 'archived_at IS NULL' : '1=1';
  const stmt = env.DB.prepare(`SELECT id, name, archived_at, created_at, updated_at FROM tables WHERE ${where} ORDER BY created_at DESC`);
  const { results } = await stmt.all();
  return new Response(JSON.stringify(results), { headers: { 'content-type': 'application/json' } });
};

export const onRequestPost = async ({ env, request }) => {
  await ensureSchema(env.DB);
  const body = await request.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = (body.name || '').trim();
  if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });
  await env.DB.prepare('INSERT INTO tables (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(id, name, now, now).run();
  if (body.params && typeof body.params === 'object') {
    for (const [k, v] of Object.entries(body.params)) {
      await env.DB.prepare('INSERT INTO table_params (table_id, key, value_json) VALUES (?, ?, ?)')
        .bind(id, k, JSON.stringify(v)).run();
    }
  }
  if (Array.isArray(body.rows)) {
    for (const r of body.rows) {
      const rid = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO rows (id, table_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(rid, id, JSON.stringify(r), now, now).run();
    }
  }
  return new Response(JSON.stringify({ id }), { headers: { 'content-type': 'application/json' }, status: 201 });
};
