import React, { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getStoredTheme, applyTheme } from './themes.js';
import HotesseTables from './components/HotesseTables.jsx';

const App = () => {
    // Load and apply theme on mount
    useEffect(() => {
        const theme = getStoredTheme();
        applyTheme(theme);
    }, []);

    const handleLogout = useCallback(() => {
        window.location.href = 'https://polpo.connexion.l-iamani.com/';
    }, []);

    // Vue dédiée pour les hôtesses : générateur de calendriers + vue plein écran d'un calendrier + page d'archives
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
};

export default App;
