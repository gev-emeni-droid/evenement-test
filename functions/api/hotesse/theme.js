import { ensureHotesseSchema } from './schema.js';

export const onRequestGet = async ({ env }) => {
  try {
    await ensureHotesseSchema(env.DB);
    
    // Ensure theme settings table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS hotesse_theme_settings (
        calendar_id TEXT PRIMARY KEY,
        theme_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `).run();
    
    // Get first active calendar's theme
    const cal = await env.DB.prepare(
      `SELECT id FROM hotesse_calendars 
       WHERE is_archived = 0 
       ORDER BY created_at ASC LIMIT 1`
    ).first();
    
    if (cal) {
      const theme = await env.DB.prepare(
        'SELECT theme_id FROM hotesse_theme_settings WHERE calendar_id = ?'
      ).bind(cal.id).first();
      
      if (theme?.theme_id) {
        return new Response(
          JSON.stringify({ ok: true, theme_id: theme.theme_id }),
          {
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-store',
              'access-control-allow-origin': '*',
            },
          }
        );
      }
    }
    
    // Default to navy if no theme found
    return new Response(
      JSON.stringify({ ok: true, theme_id: 'navy' }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      }
    );
  } catch (e) {
    console.error('Theme endpoint error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'error', theme_id: 'navy' }),
      { status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }
    );
  }
};
