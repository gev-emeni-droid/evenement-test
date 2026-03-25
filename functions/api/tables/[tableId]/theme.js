export const onRequestGet = async ({ env, params }) => {
  const { tableId } = params;
  
  try {
    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS theme_settings (
        table_id TEXT PRIMARY KEY,
        theme_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `).run();

    // Get theme for this table
    const row = await env.DB.prepare(
      'SELECT theme_id FROM theme_settings WHERE table_id = ?'
    ).bind(tableId).first();

    const themeId = row ? row.theme_id : 'navy'; // default theme

    return new Response(
      JSON.stringify({ ok: true, theme_id: themeId }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};

export const onRequestPut = async ({ env, params, request }) => {
  const { tableId } = params;

  try {
    // Ensure table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS theme_settings (
        table_id TEXT PRIMARY KEY,
        theme_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `).run();

    const body = await request.json().catch(() => ({}));
    const themeId = body.theme_id || 'navy';
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO theme_settings (table_id, theme_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(table_id) DO UPDATE SET
        theme_id = excluded.theme_id,
        updated_at = excluded.updated_at
    `).bind(tableId, themeId, now).run();

    return new Response(
      JSON.stringify({ ok: true, theme_id: themeId }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
