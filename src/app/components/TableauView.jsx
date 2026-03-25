import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from './Header.jsx';
import ReservationModal from './ReservationModal.jsx';
import SettingsModal from './SettingsModal.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const formatCurrency = (value) => {
  const num = Number(String(value || '0').replace(',', '.'));
  return isFinite(num) ? num.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '0,00 €';
};

const SortableHeader = ({ label, sortKey, sortConfig, requestSort }) => {
  const sortIndicator = sortConfig && sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
  return (
    <th scope="col" className="px-2 py-3 whitespace-nowrap th-sortable" onClick={() => requestSort(sortKey)}>
      {label} <span className="sort-indicator">{sortIndicator}</span>
    </th>
  );
};

const KPI = ({ label, value }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
    <div className="text-sm text-gray-500">{label}</div>
    <div className="text-2xl font-bold text-[#163667] mt-1">{value}</div>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    try { console.error('SettingsModal error', error, info); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 text-center">
            <div className="text-red-600 font-semibold mb-4">Un problème est survenu dans la fenêtre Paramètres.</div>
            <button onClick={this.props.onClose} className="px-5 py-2 rounded-xl bg-[#163667] text-white font-semibold hover:bg-opacity-90">Fermer</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TableauView = ({ allTables, updateTable, onLogout, updateTableTitle }) => {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const currentTable = useMemo(() => allTables.find(t => t.id === tableId), [allTables, tableId]);

  const [reservations, setReservations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [priseParOptions, setPriseParOptions] = useLocalStorage('priseParOptions_v1', ['Emeni', 'Alexandre', 'Camille']);
  const [encaisserParOptions, setEncaisserParOptions] = useLocalStorage('encaisserParOptions_v1', ['Emeni', 'Alexandre', 'Camille', 'Manager']);

  useEffect(() => {
    if (!currentTable) {
      navigate('/');
      return;
    }
    document.title = currentTable.title;
    (async () => {
      try {
        const res = await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}`);
        if (res.ok) {
          const data = await res.json();
          const rows = Array.isArray(data.rows) ? data.rows : [];
          const incoming = rows.map(r => ({ id: r.id, ...Object(r) }));
          // Ne pas écraser des réservations déjà modifiées côté client pendant le chargement :
          // on fusionne en priorisant les entrées déjà présentes dans l'état.
          setReservations(prev => {
            if (!prev || !prev.length) return incoming;
            const byId = new Map(prev.map(r => [r.id, r]));
            for (const r of incoming) {
              if (!byId.has(r.id)) byId.set(r.id, r);
            }
            return Array.from(byId.values());
          });
        } else {
          setReservations(currentTable.reservations || []);
        }
      } catch (e) {
        setReservations(currentTable.reservations || []);
      }
    })();
    // Charger settings (prise_par, encaisser_par)
    (async () => {
      try {
        const s = await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}/settings`, { cache: 'no-store' });
        if (s.ok) {
          const js = await s.json();
          const st = js && js.settings ? js.settings : {};
          if (Array.isArray(st.prise_par) && st.prise_par.length) setPriseParOptions(st.prise_par);
          if (Array.isArray(st.encaisser_par) && st.encaisser_par.length) setEncaisserParOptions(st.encaisser_par);
        }
      } catch (_) {}
    })();
  }, [currentTable, navigate]);

  const filteredReservations = useMemo(() => {
    if (!searchQuery) return reservations;
    const lowercasedQuery = searchQuery.toLowerCase();
    return reservations.filter(res => (
      Object.values(res).some(value => String(value).toLowerCase().includes(lowercasedQuery))
    ));
  }, [reservations, searchQuery]);

  const sortedReservations = useMemo(() => {
    let sortableItems = [...filteredReservations];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const getSortableValue = (item, key) => {
          switch (key) {
            case 'cvt': return (item.ad || 0) + (item.enf || 0);
            case 'montantAd': return (item.ad || 0) * (item.tarifad || 0);
            case 'montantEnf': return (item.enf || 0) * (item.tarifenf || 0);
            case 'prixTotal': return ((item.ad || 0) * (item.tarifad || 0)) + ((item.enf || 0) * (item.tarifenf || 0));
            case 'reste': {
              const total = ((item.ad || 0) * (item.tarifad || 0)) + ((item.enf || 0) * (item.tarifenf || 0));
              const paid = (item.cb || 0) + (item.amex || 0) + (item.espece || 0) + (item.cheque || 0) + (item.zen || 0) + (item.virm || 0);
              return total - paid;
            }
            default: return item[key];
          }
        };
        const valA = getSortableValue(a, sortConfig.key);
        const valB = getSortableValue(b, sortConfig.key);
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA < valB ? -1 : 1) * (sortConfig.direction === 'ascending' ? 1 : -1);
        }
        return String(valA).localeCompare(String(valB), 'fr', { numeric: true }) * (sortConfig.direction === 'ascending' ? 1 : -1);
      });
    }
    return sortableItems;
  }, [filteredReservations, sortConfig]);

  // Sauvegarde des settings (en dehors du useMemo)
  const handleSaveSettings = async ({ prise_par, encaisser_par }) => {
    if (!currentTable) return;
    try {
      await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prise_par, encaisser_par })
      });
      if (Array.isArray(prise_par)) setPriseParOptions(prise_par);
      if (Array.isArray(encaisser_par)) setEncaisserParOptions(encaisser_par);
    } catch (_) {}
  };

  const handleSaveTheme = async (themeId) => {
    if (!currentTable) return;
    try {
      await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}/theme`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme_id: themeId })
      });
    } catch (_) {}
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };


  const handleSaveReservation = useCallback(async (reservation) => {
    console.log('[TableauView.jsx] handleSaveReservation', reservation);
    if (!currentTable) return;
    let saved = { ...reservation };
    try {
      const existsInState = reservation.id && reservations.find(r => r.id === reservation.id);
      const isTempId = reservation.id && String(reservation.id).startsWith('res_');

      if (existsInState && !isTempId) {
        console.log('PATCH /api/rows/', reservation.id);
        await fetch(`/api/rows/${encodeURIComponent(reservation.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: reservation })
        });
      } else {
        console.log('POST /api/tables/', currentTable.id, '/rows');
        const res = await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}/rows`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: reservation })
        });
        if (res.ok) {
          const data = await res.json();
          saved.id = data.id || saved.id;
        }
      }
    } catch (e) {
      console.error('[TableauView.jsx] save error', e);
    }

    // Après sauvegarde côté serveur, recharger les lignes depuis la DB (source de vérité)
    if (!currentTable) return;
    try {
      const bust = Date.now();
      const res = await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}?t=${bust}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data.rows) ? data.rows : [];
        const normalized = rows.map((r) => ({ id: r.id, ...Object(r) }));
        setReservations(normalized);
        updateTable(currentTable.id, normalized);
      }
    } catch (e) {
      console.warn('[TableauView.jsx] refetch after save failed', e);
    }
  }, [reservations, currentTable, updateTable]);

  const handleDeleteReservation = useCallback(async (reservationId) => {
    if (!currentTable) return;
    if (window.confirm('Supprimer cette réservation ?')) {
      // 1) Suppression optimiste immédiate (UX)
      const optimistic = reservations.filter(r => r.id !== reservationId);
      setReservations(optimistic);
      updateTable(currentTable.id, optimistic);

      // 2) Appel DELETE serveur
      try {
        const delRes = await fetch(`/api/rows/${encodeURIComponent(reservationId)}`, { method: 'DELETE', cache: 'no-store', headers: { 'cache-control': 'no-store' } });
        let delBody = null;
        try { delBody = await delRes.clone().json(); } catch (_) {}
        console.log('[DELETE row]', reservationId, delRes.status, delBody);
      } catch (e) {
        console.warn('[DELETE row] network error', e);
      }

      // 3) Recharge depuis D1 (source de vérité)
      try {
        const bust = Date.now();
        const res = await fetch(`/api/tables/${encodeURIComponent(currentTable.id)}?t=${bust}`, { cache: 'no-store', headers: { 'cache-control': 'no-store' } });
        let data = null;
        try { data = await res.clone().json(); } catch (_) {}
        console.log('[GET table rows]', currentTable.id, res.status, data && { count: Array.isArray(data.rows) ? data.rows.length : null });
        if (res.ok && data) {
          const rows = Array.isArray(data.rows) ? data.rows : [];
          // Filtrage forcé au cas où la ligne persisterait dans la réponse
          const normalized = rows.map(r => ({ id: r.id, ...Object(r) })).filter(r => r.id !== reservationId);
          setReservations(normalized);
          updateTable(currentTable.id, normalized);
        }
      } catch (_) {}
    }
  }, [reservations, currentTable, updateTable]);

  const handleDeleteAll = async () => {
    if (!currentTable) return;
    if (window.confirm(`Supprimer TOUTES les données du tableau "${currentTable?.title}" ? Cette action est irréversible.`)) {
      try { await Promise.all(reservations.map(r => fetch(`/api/rows/${encodeURIComponent(r.id)}`, { method: 'DELETE' }))); } catch (e) {}
      setReservations([]);
      updateTable(currentTable.id, []);
    }
  };

  const totals = useMemo(() => {
    return sortedReservations.reduce((acc, res) => {
      const mAd = (res.ad || 0) * (res.tarifad || 0);
      const mEnf = (res.enf || 0) * (res.tarifenf || 0);
      acc.ad += res.ad || 0;
      acc.enf += res.enf || 0;
      acc.cvt += (res.ad || 0) + (res.enf || 0);
      acc.mAd += mAd;
      acc.mEnf += mEnf;
      acc.prix += mAd + mEnf;
      acc.cb += res.cb || 0;
      acc.amex += res.amex || 0;
      acc.espece += res.espece || 0;
      acc.cheque += res.cheque || 0;
      acc.zen += res.zen || 0;
      acc.virm += res.virm || 0;
      return acc;
    }, { ad: 0, enf: 0, cvt: 0, mAd: 0, mEnf: 0, prix: 0, cb: 0, amex: 0, espece: 0, cheque: 0, zen: 0, virm: 0 });
  }, [sortedReservations]);

  // Fermer le menu ⋯ lorsqu'on clique en dehors
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const totalPaid = totals.cb + totals.amex + totals.espece + totals.cheque + totals.zen + totals.virm;
  const totalReste = totals.prix - totalPaid;

  const tableWrapperRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const scrollThumbRef = useRef(null);
  const menuRef = useRef(null);

  // Export Excel (XLSX) avec titre et totaux
  const exportExcel = useCallback(async () => {
    if (!currentTable) return;
    // Charger SheetJS dynamiquement si absent
    const ensureXLSX = () => new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const XLSX = await ensureXLSX();

    // Construire les données: titre, en-têtes, lignes, totaux
    const headers = [
      'NOM','PRÉNOM','TÉLÉPHONE','HEURE','DATE CRÉATION','DATE PAIEMENT','AD.','ENF.','CVT.','TARIF AD.','TARIF ENF.','MONTANT AD.','MONTANT ENF.','PRIX TOTAL','CB','AMEX','ESPECE','CHEQUE','ZEN','VIRM','RESTE À PAYER','PRISE PAR','ENCAISSER PAR','COMMENTAIRE'
    ];

    const rows = sortedReservations.map(res => {
      const montantAd = (res.ad||0) * (res.tarifad||0);
      const montantEnf = (res.enf||0) * (res.tarifenf||0);
      const prixTotal = montantAd + montantEnf;
      const totalPaye = (res.cb||0)+(res.amex||0)+(res.espece||0)+(res.cheque||0)+(res.zen||0)+(res.virm||0);
      const resteAPayer = prixTotal - totalPaye;
      const fmtDate = d => (String(d||'').split('-').reverse().join('/'));
      return [
        (res.nom||'').toUpperCase(),
        (res.prenom||'').toLowerCase(),
        res.tel||'',
        res.heure||'',
        fmtDate(res.creation),
        fmtDate(res.paiement),
        res.ad||0,
        res.enf||0,
        (res.ad||0)+(res.enf||0),
        res.tarifad||0,
        res.tarifenf||0,
        montantAd,
        montantEnf,
        prixTotal,
        res.cb||0,
        res.amex||0,
        res.espece||0,
        res.cheque||0,
        res.zen||0,
        res.virm||0,
        resteAPayer,
        res.prisepar||'',
        res.encaisserpar||'',
        res.comment||''
      ];
    });

    const titleRow = [currentTable.title];
    const blank = [];
    const totalsRow = [
      'Totaux (filtrés):', '', '', '', '', '',
      totals.ad, totals.enf, totals.cvt,
      '', '',
      totals.mAd, totals.mEnf, totals.prix,
      totals.cb, totals.amex, totals.espece, totals.cheque, totals.zen, totals.virm,
      totalReste,
      '', '', ''
    ];

    const aoa = [titleRow, blank, headers, ...rows, blank, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Si on a au moins une ligne, remplacer les totaux par des formules Excel SUM()
    if (rows.length > 0) {
      const dataStartRow = 4; // après le titre, la ligne vide et les en-têtes
      const dataEndRow = 3 + rows.length;
      const totalRowIndex = dataEndRow + 2; // ligne vide + ligne totaux

      const makeSum = (col) => `SUM(${col}${dataStartRow}:${col}${dataEndRow})`;

      // Colonnes numériques à sommer: AD(G), ENF(H), CVT(I), MONTANT AD(L), MONTANT ENF(M), PRIX TOTAL(N),
      // CB(O), AMEX(P), ESPECE(Q), CHEQUE(R), ZEN(S), VIRM(T), RESTE À PAYER(U)
      ws[`G${totalRowIndex}`] = { t: 'n', f: makeSum('G') };
      ws[`H${totalRowIndex}`] = { t: 'n', f: makeSum('H') };
      ws[`I${totalRowIndex}`] = { t: 'n', f: makeSum('I') };
      ws[`L${totalRowIndex}`] = { t: 'n', f: makeSum('L') };
      ws[`M${totalRowIndex}`] = { t: 'n', f: makeSum('M') };
      ws[`N${totalRowIndex}`] = { t: 'n', f: makeSum('N') };
      ws[`O${totalRowIndex}`] = { t: 'n', f: makeSum('O') };
      ws[`P${totalRowIndex}`] = { t: 'n', f: makeSum('P') };
      ws[`Q${totalRowIndex}`] = { t: 'n', f: makeSum('Q') };
      ws[`R${totalRowIndex}`] = { t: 'n', f: makeSum('R') };
      ws[`S${totalRowIndex}`] = { t: 'n', f: makeSum('S') };
      ws[`T${totalRowIndex}`] = { t: 'n', f: makeSum('T') };
      ws[`U${totalRowIndex}`] = { t: 'n', f: makeSum('U') };
    }

    // Style de base: largeur des colonnes approximative
    const colWidths = headers.map(() => ({ wch: 14 }));
    colWidths[0] = { wch: 18 }; // NOM
    colWidths[2] = { wch: 16 }; // TEL
    colWidths[23] = { wch: 28 }; // COMMENTAIRE
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réservations');
    const fileName = `${currentTable.title.replace(/[^\w\-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [currentTable, sortedReservations, totals, totalReste]);

  useEffect(() => {
    const tableWrapper = tableWrapperRef.current;
    const scrollTrack = scrollTrackRef.current;
    const scrollThumb = scrollThumbRef.current;
    if (!tableWrapper || !scrollTrack || !scrollThumb) return;

    const handleScroll = () => {
      const scrollWidth = tableWrapper.scrollWidth;
      const clientWidth = tableWrapper.clientWidth;
      const thumbWidthRatio = clientWidth / scrollWidth;
      const thumbWidth = Math.max(40, Math.floor((scrollTrack.clientWidth - 4) * thumbWidthRatio));
      scrollThumb.style.width = `${thumbWidth}px`;
      const maxScrollLeft = scrollWidth - clientWidth;
      const scrollRatio = maxScrollLeft ? tableWrapper.scrollLeft / maxScrollLeft : 0;
      const maxThumbLeft = scrollTrack.clientWidth - 4 - thumbWidth;
      scrollThumb.style.left = `${2 + Math.floor(maxThumbLeft * scrollRatio)}px`;
    };

    handleScroll();
    tableWrapper.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    let isDragging = false;
    let startX = 0;
    let startLeft = 0;

    const handleMouseDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startLeft = parseInt(scrollThumb.style.left || '2');
      scrollThumb.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const handleMouseUp = () => {
      isDragging = false;
      scrollThumb.style.cursor = 'grab';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const thumbWidth = scrollThumb.offsetWidth;
      const maxThumbLeft = scrollTrack.clientWidth - 4 - thumbWidth;
      const newLeft = Math.max(2, Math.min(2 + maxThumbLeft, startLeft + dx));
      scrollThumb.style.left = `${newLeft}px`;
      const scrollRatio = (newLeft - 2) / maxThumbLeft;
      const maxScrollLeft = tableWrapper.scrollWidth - tableWrapper.clientWidth;
      tableWrapper.scrollLeft = Math.floor(maxScrollLeft * scrollRatio);
    };

    scrollThumb.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      tableWrapper.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      scrollThumb.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [sortedReservations]);

  if (!currentTable) {
    return <div className="p-8 text-center">Chargement ou tableau non trouvé...</div>;
  }

  const tableHeaders = [
    { label: 'NOM', key: 'nom' },
    { label: 'PRÉNOM', key: 'prenom' },
    { label: 'TÉLÉPHONE', key: 'tel' },
    { label: 'HEURE', key: 'heure' },
    { label: 'DATE CRÉATION', key: 'creation' },
    { label: 'DATE PAIEMENT', key: 'paiement' },
    { label: 'AD.', key: 'ad' },
    { label: 'ENF.', key: 'enf' },
    { label: 'CVT.', key: 'cvt' },
    { label: 'TARIF AD.', key: 'tarifad' },
    { label: 'TARIF ENF.', key: 'tarifenf' },
    { label: 'MONTANT AD.', key: 'montantAd' },
    { label: 'MONTANT ENF.', key: 'montantEnf' },
    { label: 'PRIX TOTAL', key: 'prixTotal' },
    { label: 'CB', key: 'cb' },
    { label: 'AMEX', key: 'amex' },
    { label: 'ESPECE', key: 'espece' },
    { label: 'CHEQUE', key: 'cheque' },
    { label: 'ZEN', key: 'zen' },
    { label: 'VIRM', key: 'virm' },
    { label: 'RESTE À PAYER', key: 'reste' },
    { label: 'PRISE PAR', key: 'prisepar' },
    { label: 'ENCAISSER PAR', key: 'encaisserpar' },
    { label: 'COMMENTAIRE', key: 'comment' },
    { label: 'ACTION', key: 'action' }
  ];

  const printTable = () => {
    document.body.classList.add('print-table-only');
    window.print();
    document.body.classList.remove('print-table-only');
  };

  const handleAddReservation = () => {
    setIsSettingsOpen(false);
    setEditingReservation(null);
    setIsModalOpen(true);
  };

  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation);
    setIsModalOpen(true);
  };

  return (
    <>
      <Header title={currentTable.title} onLogout={onLogout} />
      <main className="max-w-screen-2xl mx-auto px-2">
        <div className="mb-4 text-center back-link">
          <button onClick={() => navigate('/')} className="text-sm text-[#163667] hover:underline">← Retour à la liste des tableaux</button>
        </div>

        {/* Titre dédié impression */}
        <div id="print-title" className="print-only" aria-hidden="true">
          <h2 className="text-xl font-extrabold text-[#163667]">{currentTable.title}</h2>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 panel-controls">
          <div className="flex justify-center mb-4">
            <input id="global-search" placeholder="Rechercher une réservation (Nom, téléphone, etc.)" className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg bg-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {currentTable.isActive && (
              <button className="bg-[#163667] text-white font-semibold py-2 px-5 rounded-lg hover:bg-opacity-90" onClick={handleAddReservation}>➕ Nouvelle réservation</button>
            )}
            <div className="menu-wrap" ref={menuRef}>
              <button className="btn-more" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-haspopup="true" aria-expanded={isMenuOpen}>⋯</button>
              {isMenuOpen && (
                <div className="menu-panel open">
                  <button className="menu-item" onClick={() => { exportExcel(); setIsMenuOpen(!isMenuOpen); }}>Exporter Excel</button>
                  <button className="menu-item" onClick={() => { printTable(); setIsMenuOpen(!isMenuOpen); }}>Exporter PDF / Imprimer</button>
                  <div className="menu-sep"></div>
                  <button className="menu-item" onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(!isMenuOpen); }}>Paramètres</button>
                  {currentTable.isActive && (
                    <>
                      <div className="menu-sep"></div>
                      <button className="menu-item danger" onClick={() => { handleDeleteAll(); setIsMenuOpen(!isMenuOpen); }}>Supprimer les données</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 kpis">
          <KPI label="Total couverts" value={totals.cvt.toString()} />
          <KPI label="Total encaissements" value={formatCurrency(totalPaid)} />
          <KPI label="Total CA théorique" value={formatCurrency(totals.prix)} />
          <KPI label="Total reste à payer" value={formatCurrency(totalReste)} />
        </section>

        <section id="print-panel" className="bg-white border border-gray-200 rounded-xl p-1 md:p-4">
          <div className="table-wrap" ref={tableWrapperRef}>
            <table className="w-full text-xs text-left" style={{ minWidth: '2800px' }}>
              <thead className="text-xs text-gray-700 uppercase bg-indigo-100">
                <tr>
                  {tableHeaders.map(header => (
                    header.key === 'action'
                      ? <th key={header.key} scope="col" className="px-2 py-3">{header.label}</th>
                      : <SortableHeader key={header.key} label={header.label} sortKey={header.key} sortConfig={sortConfig} requestSort={requestSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedReservations.map(res => {
                  const montantAd = res.ad * res.tarifad;
                  const montantEnf = res.enf * res.tarifenf;
                  const prixTotal = montantAd + montantEnf;
                  const totalPaye = res.cb + res.amex + res.espece + res.cheque + res.zen + res.virm;
                  const resteAPayer = prixTotal - totalPaye;
                  return (
                    <tr key={res.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">{res.nom?.toUpperCase()}</td>
                      <td className="px-2 py-2 capitalize">{(res.prenom || '').toLowerCase()}</td>
                      <td className="px-2 py-2">{res.tel}</td>
                      <td className="px-2 py-2">{res.heure}</td>
                      <td className="px-2 py-2">{(res.creation || '').split('-').reverse().join('/')}</td>
                      <td className="px-2 py-2">{(res.paiement || '').split('-').reverse().join('/')}</td>
                      <td className="px-2 py-2 text-center">{res.ad}</td>
                      <td className="px-2 py-2 text-center">{res.enf}</td>
                      <td className="px-2 py-2 text-center">{(res.ad || 0) + (res.enf || 0)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.tarifad)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.tarifenf)}</td>
                      <td className="px-2 py-2">{formatCurrency(montantAd)}</td>
                      <td className="px-2 py-2">{formatCurrency(montantEnf)}</td>
                      <td className="px-2 py-2 font-semibold">{formatCurrency(prixTotal)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.cb)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.amex)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.espece)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.cheque)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.zen)}</td>
                      <td className="px-2 py-2">{formatCurrency(res.virm)}</td>
                      <td className={`px-2 py-2 font-bold whitespace-nowrap ${resteAPayer > 0 ? 'text-red-600' : 'text-green-600'}`} data-sort={resteAPayer}>{formatCurrency(resteAPayer)}</td>
                      <td className="px-2 py-2">{res.prisepar}</td>
                      <td className="px-2 py-2">{res.encaisserpar}</td>
                      <td className="px-2 py-2 max-w-xs truncate">{res.comment}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 mr-3"
                          onClick={() => handleEditReservation(res)}
                          aria-label="Modifier la réservation"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        {currentTable.isActive && (
                          <button
                            className="inline-flex items-center justify-center text-red-600 hover:text-red-800"
                            onClick={() => handleDeleteReservation(res.id)}
                            aria-label="Supprimer la réservation"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="font-bold bg-green-100 text-sm">
                <tr className="totals-row">
                  <td className="px-2 py-3 text-green-800">Totaux (filtrés):</td>
                  <td colSpan={5}></td>
                  <td className="px-2 py-3 text-center">{totals.ad}</td>
                  <td className="px-2 py-3 text-center">{totals.enf}</td>
                  <td className="px-2 py-3 text-center">{totals.cvt}</td>
                  <td></td>
                  <td></td>
                  <td className="px-2 py-3">{formatCurrency(totals.mAd)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.mEnf)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.prix)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.cb)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.amex)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.espece)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.cheque)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.zen)}</td>
                  <td className="px-2 py-3">{formatCurrency(totals.virm)}</td>
                  <td className="px-2 py-3">{formatCurrency(totalReste)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="hscroll" id="hscroll" aria-hidden="true" ref={scrollTrackRef}>
            <div className="thumb" id="hthumb" ref={scrollThumbRef}></div>
          </div>
        </section>

        <div className="detail mt-4 p-3 rounded-lg bg-blue-100 border border-blue-200 text-blue-800 text-center text-sm" id="detail-encaiss">
          Détail des encaissements (filtrés) : CB: {formatCurrency(totals.cb)} • AMEX: {formatCurrency(totals.amex)} • ESPECE: {formatCurrency(totals.espece)} • CHEQUE: {formatCurrency(totals.cheque)} • ZEN: {formatCurrency(totals.zen)} • VIRM: {formatCurrency(totals.virm)}
        </div>

        {currentTable.isActive && <button id="fab-add" aria-label="Ajouter une réservation" onClick={handleAddReservation}>+</button>}

        {isModalOpen && (
          <ReservationModal
            reservation={editingReservation}
            onSave={handleSaveReservation}
            onClose={() => setIsModalOpen(false)}
            isArchived={!currentTable.isActive}
            priseParOptions={priseParOptions}
            encaisserParOptions={encaisserParOptions}
          />
        )}
        {isSettingsOpen && currentTable && (
          <ErrorBoundary onClose={() => setIsSettingsOpen(false)}>
            <SettingsModal
              onClose={() => setIsSettingsOpen(false)}
              prisePar={priseParOptions}
              setPrisePar={setPriseParOptions}
              encaisserPar={encaisserParOptions}
              setEncaisserPar={setEncaisserParOptions}
              currentTitle={currentTable.title}
              onSaveTitle={(title) => updateTableTitle(currentTable.id, title)}
              onSaveSettings={handleSaveSettings}
              tableId={currentTable.id}
              onSaveTheme={handleSaveTheme}
            />
          </ErrorBoundary>
        )}
      </main>
    </>
  );
};

export default TableauView;
