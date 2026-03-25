export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const { searchParams } = url;
  
  // Extraire privId du path: /api/hotesse/privatisations/PRIVID/documents
  const privId = pathParts[4];
  const docId = searchParams.get('doc_id');

  if (!privId) {
    return new Response(JSON.stringify({ error: 'priv_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = context.env.DB;

  if (request.method === 'GET') {
    try {
      const documents = await db.prepare(
        `SELECT id, file_name, mime_type, file_size, uploaded_at, uploaded_by
         FROM hotesse_privatisations_documents 
         WHERE priv_id = ?
         ORDER BY uploaded_at DESC`
      ).bind(privId).all();

      return new Response(JSON.stringify(documents.results || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { file_name, file_data, mime_type, uploaded_by } = body;

      if (!file_name || !file_data) {
        return new Response(JSON.stringify({ error: 'file_name and file_data are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const file_size = file_data.length; // Base64 string length

      await db.prepare(
        `INSERT INTO hotesse_privatisations_documents 
         (id, priv_id, file_name, file_data, mime_type, file_size, uploaded_at, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, privId, file_name, file_data, mime_type, file_size, now, uploaded_by || 'unknown').run();

      return new Response(JSON.stringify({ 
        success: true, 
        id,
        file_name,
        uploaded_at: now
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'DELETE') {
    if (!docId) {
      return new Response(JSON.stringify({ error: 'doc_id is required for deletion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      await db.prepare(
        `DELETE FROM hotesse_privatisations_documents 
         WHERE id = ? AND priv_id = ?`
      ).bind(docId, privId).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error deleting document:', error);
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
