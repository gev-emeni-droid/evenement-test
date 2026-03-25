export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const { searchParams } = url;
  
  // Extraire privId du path: /api/hotesse/privatisations/PRIVID/document
  const privId = pathParts[4];
  const docId = searchParams.get('doc_id');

  if (!privId || !docId) {
    return new Response(JSON.stringify({ error: 'priv_id and doc_id are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = context.env.DB;

  if (request.method === 'GET') {
    try {
      const document = await db.prepare(
        `SELECT id, file_name, file_data, mime_type 
         FROM hotesse_privatisations_documents 
         WHERE id = ? AND priv_id = ?`
      ).bind(docId, privId).first();

      if (!document) {
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Return the document with file_data for client-side download
      return new Response(JSON.stringify({
        id: document.id,
        file_name: document.file_name,
        file_data: document.file_data,
        mime_type: document.mime_type
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error fetching document:', error);
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
