export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  
  // Extraire privId du path: /api/hotesse/privatisations/PRIVID/client-info
  // Index positions: ['', 'api', 'hotesse', 'privatisations', 'PRIVID', 'client-info']
  const privId = pathParts[4];

  if (!privId) {
    return new Response(JSON.stringify({ error: 'priv_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = context.env.DB;

  if (request.method === 'GET') {
    try {
      const clientInfo = await db.prepare(
        `SELECT * FROM hotesse_privatisations_client_info WHERE priv_id = ?`
      ).bind(privId).first();

      return new Response(JSON.stringify(clientInfo || {}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching client info:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.json();
      const { nom, prenom, mail, telephone, adresse_postale } = body;
      const now = new Date().toISOString();

      // Check if exists
      const existing = await db.prepare(
        `SELECT priv_id FROM hotesse_privatisations_client_info WHERE priv_id = ?`
      ).bind(privId).first();

      if (existing) {
        // Update
        await db.prepare(
          `UPDATE hotesse_privatisations_client_info 
           SET nom = ?, prenom = ?, mail = ?, telephone = ?, adresse_postale = ?, updated_at = ?
           WHERE priv_id = ?`
        ).bind(nom, prenom, mail, telephone, adresse_postale, now, privId).run();
      } else {
        // Insert
        await db.prepare(
          `INSERT INTO hotesse_privatisations_client_info 
           (priv_id, nom, prenom, mail, telephone, adresse_postale, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(privId, nom, prenom, mail, telephone, adresse_postale, now, now).run();
      }

      return new Response(JSON.stringify({ success: true, priv_id: privId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error saving client info:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'DELETE') {
    try {
      await db.prepare(
        `DELETE FROM hotesse_privatisations_client_info WHERE priv_id = ?`
      ).bind(privId).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error deleting client info:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}
