const ensureSchema = async (db) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS hotesse_clients (
      id TEXT PRIMARY KEY,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      telephone TEXT NOT NULL,
      mail TEXT,
      adresse_postale TEXT,
      entreprise TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(prenom, nom, telephone)
    );
  `).run();
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const { searchParams } = url;
  
  const db = context.env.DB;
  
  try {
    await ensureSchema(db);
  } catch (error) {
    console.error('Error ensuring schema:', error);
  }

  const method = request.method.toUpperCase();
  
  if (method === 'GET') {
    return handleGet(db, searchParams);
  }
  
  if (method === 'POST' || method === 'PUT') {
    return handlePost(db, request);
  }
  
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGet(db, searchParams) {
  try {
    const page = parseInt(searchParams.get('page')) || 1;
    const search = searchParams.get('search')?.toLowerCase() || '';
    const limit = 30;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `WHERE LOWER(prenom) LIKE ? OR LOWER(nom) LIKE ? OR LOWER(telephone) LIKE ? OR LOWER(mail) LIKE ? OR LOWER(entreprise) LIKE ?`;
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM hotesse_clients ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.count || 0;

    // Get paginated results
    const query = `
      SELECT id, prenom, nom, telephone, mail, adresse_postale, entreprise, created_at, updated_at
      FROM hotesse_clients
      ${whereClause}
      ORDER BY nom ASC, prenom ASC
      LIMIT ? OFFSET ?
    `;
    
    const result = await db.prepare(query).bind(...params, limit, offset).all();
    const clients = result.results || [];

    return new Response(JSON.stringify({
      clients,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handlePost(db, request) {
  try {
    const body = await request.json();
    const { prenom, nom, telephone, mail, adresse_postale, entreprise } = body;

    if (!prenom || !nom || !telephone) {
      return new Response(JSON.stringify({ error: 'prenom, nom, and telephone are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date().toISOString();

    // Check if exists
    const existing = await db.prepare(
      `SELECT id FROM hotesse_clients WHERE prenom = ? AND nom = ? AND telephone = ?`
    ).bind(prenom, nom, telephone).first();

    if (existing) {
      // Update
      await db.prepare(
        `UPDATE hotesse_clients 
         SET mail = ?, adresse_postale = ?, entreprise = ?, updated_at = ?
         WHERE id = ?`
      ).bind(mail, adresse_postale, entreprise, now, existing.id).run();

      return new Response(JSON.stringify({ success: true, id: existing.id, action: 'updated' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Insert
      const id = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO hotesse_clients 
         (id, prenom, nom, telephone, mail, adresse_postale, entreprise, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, prenom, nom, telephone, mail, adresse_postale, entreprise, now, now).run();

      return new Response(JSON.stringify({ success: true, id, action: 'created' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error saving client:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
