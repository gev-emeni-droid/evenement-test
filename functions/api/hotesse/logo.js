import { ensureHotesseSchema } from './schema.js';

export const onRequestGet = async ({ env }) => {
  try {
    await ensureHotesseSchema(env.DB);
    const row = await env.DB.prepare(
      'SELECT custom_logo FROM hotesse_settings WHERE id = ?'
    ).bind('global').first();

    const logo = row?.custom_logo;
    if (!logo) {
      return new Response('No logo found', { status: 404 });
    }

    // Si c'est du Base64 data:image/...;base64,xxx, on le convertit en fichier
    if (logo.startsWith('data:')) {
      const [header, data] = logo.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      
      // Convertir Base64 en Uint8Array (compatible Cloudflare Workers)
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new Response(bytes, {
        headers: {
          'content-type': mimeType,
          'cache-control': 'max-age=86400', // Cache 24h
          'access-control-allow-origin': '*',
        },
      });
    }

    // Si ce n'est pas du Base64, le retourner tel quel
    return new Response(logo, {
      headers: {
        'content-type': 'text/plain',
        'access-control-allow-origin': '*',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'Error fetching logo' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
