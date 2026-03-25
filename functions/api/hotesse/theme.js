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
    
    // Get ALL themes for all ACTIVE calendars
    const themes = await env.DB.prepare(
      `SELECT ts.calendar_id, ts.theme_id, ts.updated_at, hc.created_at, hc.updated_at as cal_updated_at
       FROM hotesse_theme_settings ts
       JOIN hotesse_calendars hc ON ts.calendar_id = hc.id
       WHERE hc.is_archived = 0
       ORDER BY ts.updated_at DESC, hc.created_at DESC
       LIMIT 10`
    ).all();
    
    console.log('Found themes:', themes.results?.length, 'results');
    if (themes.results && themes.results.length > 0) {
      const first = themes.results[0];
      console.log(`Returning most recent theme: ${first.theme_id} for calendar ${first.calendar_id}, updated: ${first.updated_at}`);
      return new Response(
        JSON.stringify({ ok: true, theme_id: first.theme_id, source: 'calendar', calendar_id: first.calendar_id }),
        {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'pragma': 'no-cache',
            'expires': '0',
            'access-control-allow-origin': '*',
          },
        }
      );
    }
    
    // If no theme settings found, try to get any theme from any active calendar
    const calendars = await env.DB.prepare(
      `SELECT id FROM hotesse_calendars WHERE is_archived = 0 ORDER BY created_at DESC LIMIT 1`
    ).first();
    
    if (calendars?.id) {
      const theme = await env.DB.prepare(
        'SELECT theme_id FROM hotesse_theme_settings WHERE calendar_id = ?'
      ).bind(calendars.id).first();
      
      if (theme?.theme_id) {
        console.log(`Found theme via fallback: ${theme.theme_id}`);
        return new Response(
          JSON.stringify({ ok: true, theme_id: theme.theme_id, source: 'fallback' }),
          {
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'access-control-allow-origin': '*',
            },
          }
        );
      }
    }
    
    // Default to deep-navy if no theme found
    console.log('No theme found anywhere, returning default deep-navy');
    return new Response(
      JSON.stringify({ ok: true, theme_id: 'deep-navy', source: 'default' }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'pragma': 'no-cache',
          'expires': '0',
          'access-control-allow-origin': '*',
        },
      }
    );
  } catch (e) {
    console.error('Theme endpoint error:', e.message, e.stack);
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'error', theme_id: 'navy', source: 'error' }),
      { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-cache, no-store, must-revalidate', 'access-control-allow-origin': '*' } }
    );
  }
};
