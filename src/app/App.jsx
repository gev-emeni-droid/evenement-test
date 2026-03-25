import React, { useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { getStoredTheme, applyTheme } from './themes.js';
import Dashboard from './components/Dashboard.jsx';
import Archives from './components/Archives.jsx';
import TableauView from './components/TableauView.jsx';
import HotesseTables from './components/HotesseTables.jsx';

const App = () => {
    // Toujours en mode hotesse - pas de portail de connexion
    const authRole = 'hotesse';
    const [tables, setTables] = useLocalStorage("all_tables_v1", []);
    const navigate = useNavigate();

    // Load and apply theme on mount
    useEffect(() => {
        const theme = getStoredTheme();
        applyTheme(theme);
    }, []);

    const handleLogout = useCallback(() => {
        window.location.href = 'https://polpo.connexion.l-iamani.com/';
    }, []);

    const handleCreateTable = useCallback(async (title) => {
        const name = String(title || '').trim();
        if (!name) return;
        let id = `table_${Date.now()}`;
        let createdAt = new Date().toISOString();
        try {
            const res = await fetch('/api/tables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
            if (res.ok) {
                const data = await res.json();
                id = data.id || id;
            }
        } catch (e) {}
        const newTable = { id, title: name, isActive: true, createdAt, reservations: [] };
        setTables(prevTables => [...prevTables, newTable]);
        navigate(`/table/${newTable.id}`);
    }, [setTables, navigate]);
    
    const updateTableReservations = useCallback((tableId, reservations) => {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, reservations } : t));
    }, [setTables, authRole]);

    const updateTableTitle = useCallback(async (tableId, title) => {
        const name = String(title || '').trim();
        if (!name) return;
        try {
            await fetch(`/api/tables/${encodeURIComponent(tableId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
        } catch (e) {}
        setTables(prev => prev.map(t => (t.id === tableId) ? { ...t, title: name } : t));
    }, [setTables]);

    const handleToggleArchive = useCallback(async (tableId) => {
        const table = tables.find(t => t.id === tableId);
        try {
            if (table && table.isActive) {
                await fetch(`/api/tables/${encodeURIComponent(tableId)}/archive`, { method: 'POST' });
            } else {
                await fetch(`/api/tables/${encodeURIComponent(tableId)}/unarchive`, { method: 'POST' });
            }
        } catch (e) {}
        setTables(prevTables =>
            prevTables.map(t =>
                t.id === tableId ? { ...t, isActive: !t.isActive } : t
            )
        );
    }, [tables, setTables]);

    const handleDeleteTable = useCallback(async (tableId) => {
        try {
            await fetch(`/api/tables/${encodeURIComponent(tableId)}`, { method: 'DELETE' });
        } catch (e) {}
        setTables(prevTables => prevTables.filter(t => t.id !== tableId));
        if (location.pathname === `/table/${tableId}`) {
            navigate('/');
        }
    }, [setTables, navigate]);

    useEffect(() => {
      if (authRole !== 'manager') return;
      (async () => {
        try {
          const [actRes, arcRes] = await Promise.all([
            fetch('/api/tables?archived=false', { cache: 'no-store' }),
            fetch('/api/tables?archived=true', { cache: 'no-store' })
          ]);
          const act = actRes.ok ? await actRes.json() : [];
          const arc = arcRes.ok ? await arcRes.json() : [];
          const toLocal = (arr, isActive) => arr.map(t => ({ id: t.id, title: t.name, isActive, createdAt: t.created_at || new Date().toISOString(), reservations: [] }));
          const combined = [...toLocal(act, true), ...toLocal(arc, false)];
          if (!combined.length) return;

          // Préparer les rows pour les tableaux actifs
          const activeOnly = combined.filter(t => t.isActive);
          const rowsById = new Map();
          if (activeOnly.length) {
            const results = await Promise.all(activeOnly.map(async (t) => {
              try {
                const r = await fetch(`/api/tables/${encodeURIComponent(t.id)}`, { cache: 'no-store', headers: { 'cache-control': 'no-store' } });
                if (r.ok) {
                  const d = await r.json();
                  const rows = Array.isArray(d.rows) ? d.rows.map(x => {
                    const o = { ...x };
                    const toNum = (v) => isFinite(Number(v)) ? Number(v) : 0;
                    o.ad = toNum(o.ad);
                    o.enf = toNum(o.enf);
                    o.tarifad = toNum(o.tarifad);
                    o.tarifenf = toNum(o.tarifenf);
                    o.cb = toNum(o.cb);
                    o.amex = toNum(o.amex);
                    o.espece = toNum(o.espece);
                    o.cheque = toNum(o.cheque);
                    o.zen = toNum(o.zen);
                    o.virm = toNum(o.virm);
                    return o;
                  }) : [];
                  return { id: t.id, rows };
                }
              } catch (e) {}
              return { id: t.id, rows: [] };
            }));
            results.forEach(x => rowsById.set(x.id, x.rows));
          }

          // Toujours prendre les réservations depuis la DB (source de vérité)
          const finalTables = combined.map(t => ({ ...t, reservations: rowsById.get(t.id) || [] }));
          setTables(finalTables);
        } catch (e) {}
      })();
    }, [setTables, authRole]);

    // Vue dédiée pour les hôtesses : générateur de calendriers + vue plein écran d'un calendrier + page d'archives
    if (authRole === 'hotesse') {
      return (
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/hotesse" element={<HotesseTables onLogout={handleLogout} />} />
            <Route path="/hotesse/:calendarId" element={<HotesseTables onLogout={handleLogout} />} />
            <Route path="/hotesse-archives" element={<HotesseTables onLogout={handleLogout} archivesMode />} />
            <Route path="/" element={<Navigate to="/hotesse" />} />
            <Route path="*" element={<Navigate to="/hotesse" />} />
          </Routes>
        </div>
      );
    }

    const activeTables = tables.filter(t => t.isActive);
    const archivedTables = tables.filter(t => !t.isActive);

    return (
        <div className="min-h-screen bg-gray-50">
            <Routes>
                <Route path="/" element={<Dashboard tables={activeTables} onCreateTable={handleCreateTable} onLogout={handleLogout} onArchive={handleToggleArchive} onDelete={handleDeleteTable} />} />
                <Route path="/archives" element={<Archives tables={archivedTables} onUnarchive={handleToggleArchive} onLogout={handleLogout} onDelete={handleDeleteTable} />} />
                <Route path="/table/:tableId" element={<TableauView allTables={tables} updateTable={updateTableReservations} onLogout={handleLogout} updateTableTitle={updateTableTitle} />} />
                <Route path="/login" element={<Navigate to="/" />} />
            </Routes>
        </div>
    );
};

export default App;
