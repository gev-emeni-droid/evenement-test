import React, { useState, useEffect } from 'react';

export default function ClientsPage({ selectedTheme, COLOR_PALETTES }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const themeColor = COLOR_PALETTES.find(p => p.id === selectedTheme)?.colors?.primary || '#163667';

  // Fetch clients list
  useEffect(() => {
    fetchClients(1);
  }, [search]);

  const fetchClients = async (pageNum) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum);
      if (search) params.append('search', search);

      const response = await fetch(`/api/hotesse/clients?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      setClients(data.clients || []);
      setTotalPages(data.totalPages || 1);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching clients:', error);
      alert('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientDetails = async (clientId) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/hotesse/clients/${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client details');

      const data = await response.json();
      setClientDetails(data);
      setSelectedClient(clientId);
    } catch (error) {
      console.error('Error fetching client details:', error);
      alert('Erreur lors du chargement des détails du client');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/hotesse/clients/export');
      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting clients:', error);
      alert('Erreur lors de l\'export');
    }
  };

  if (selectedClient && clientDetails) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <button
          onClick={() => {
            setSelectedClient(null);
            setClientDetails(null);
          }}
          className="mb-4 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          ← Retour à la liste
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            {clientDetails.client.prenom} {clientDetails.client.nom}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-500">Téléphone</label>
              <p className="font-medium">{clientDetails.client.telephone}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Mail</label>
              <p className="font-medium">{clientDetails.client.mail || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Entreprise</label>
              <p className="font-medium">{clientDetails.client.entreprise || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-500">Adresse</label>
              <p className="font-medium">{clientDetails.client.adresse_postale || '-'}</p>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-4">Historique des privatisations ({clientDetails.privatisations.length})</h3>
        
        {clientDetails.privatisations.length === 0 ? (
          <p className="text-gray-500">Aucune privatisation pour ce client</p>
        ) : (
          <div className="space-y-4">
            {clientDetails.privatisations.map((priv) => (
              <div key={priv.id} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Nom</label>
                    <p className="font-medium">{priv.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Date</label>
                    <p className="font-medium">{priv.date}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Personnes</label>
                    <p className="font-medium">{priv.people || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Période</label>
                    <p className="font-medium">{priv.period}</p>
                  </div>
                </div>

                {priv.documents.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Documents ({priv.documents.length})
                    </label>
                    <div className="space-y-2">
                      {priv.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700">{doc.file_name}</span>
                          <span className="text-xs text-gray-500">{(doc.file_size / 1024).toFixed(2)} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fichiers Clients</h1>
        <button
          onClick={handleExport}
          style={{ backgroundColor: themeColor }}
          className="px-4 py-2 text-white rounded hover:opacity-90"
        >
          📥 Exporter CSV
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Rechercher par nom, prénom, téléphone, mail, entreprise..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2"
          style={{ '--focus-ring-color': themeColor }}
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Chargement...</p>
      ) : clients.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Aucun client trouvé</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prénom</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Téléphone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mail</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Entreprise</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{client.prenom}</td>
                    <td className="px-4 py-3 text-sm font-medium">{client.nom}</td>
                    <td className="px-4 py-3 text-sm">{client.telephone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{client.mail || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{client.entreprise || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => fetchClientDetails(client.id)}
                        style={{ backgroundColor: themeColor }}
                        className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
                        disabled={loadingDetails}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchClients(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ← Précédent
              </button>
              <button
                onClick={() => fetchClients(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Suivant →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
