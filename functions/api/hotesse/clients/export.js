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
  const db = context.env.DB;
  
  try {
    await ensureSchema(db);
  } catch (error) {
    console.error('Error ensuring schema:', error);
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get all clients
    const result = await db.prepare(
      `SELECT id, prenom, nom, telephone, mail, adresse_postale, entreprise, created_at, updated_at
       FROM hotesse_clients
       ORDER BY nom ASC, prenom ASC`
    ).all();

    const clients = result.results || [];

    // Build CSV
    const headers = ['ID', 'Prénom', 'Nom', 'Téléphone', 'Mail', 'Adresse', 'Entreprise', 'Créé le', 'Modifié le'];
    const csv = [headers.join(',')];

    for (const client of clients) {
      const row = [
        client.id,
        escapeCsv(client.prenom),
        escapeCsv(client.nom),
        escapeCsv(client.telephone),
        escapeCsv(client.mail || ''),
        escapeCsv(client.adresse_postale || ''),
        escapeCsv(client.entreprise || ''),
        new Date(client.created_at).toLocaleDateString('fr-FR'),
        new Date(client.updated_at).toLocaleDateString('fr-FR')
      ];
      csv.push(row.join(','));
    }

    const csvContent = csv.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clients_${timestamp}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting clients:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function escapeCsv(value) {
  if (!value) return '';
  if (typeof value !== 'string') value = String(value);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
