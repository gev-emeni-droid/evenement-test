import React, { useState, useEffect } from 'react';
import { COLOR_PALETTES, applyTheme } from '../themes.js';

const SettingsModal = ({ onClose, prisePar, setPrisePar, encaisserPar, setEncaisserPar, currentTitle, onSaveTitle, onSaveSettings, tableId, onSaveTheme }) => {
  const initialPrise = Array.isArray(prisePar) ? prisePar : [];
  const initialEncaisse = Array.isArray(encaisserPar) ? encaisserPar : [];
  const [priseParStr, setPriseParStr] = useState(initialPrise.join(', '));
  const [encaisserParStr, setEncaisserParStr] = useState(initialEncaisse.join(', '));
  const [title, setTitle] = useState(typeof currentTitle === 'string' ? currentTitle : '');
  const [selectedTheme, setSelectedTheme] = useState('navy');

  // Load current theme from DB
  useEffect(() => {
    if (tableId) {
      (async () => {
        try {
          const res = await fetch(`/api/tables/${encodeURIComponent(tableId)}/theme`);
          const data = await res.json();
          if (data.ok && data.theme_id) {
            setSelectedTheme(data.theme_id);
          }
        } catch (_) {}
      })();
    }
  }, [tableId]);

  const handleSave = () => {
    const newPrise = priseParStr.split(',').map(s => s.trim()).filter(Boolean);
    const newEncaisse = encaisserParStr.split(',').map(s => s.trim()).filter(Boolean);
    try { if (typeof setPrisePar === 'function') setPrisePar(newPrise); } catch {}
    try { if (typeof setEncaisserPar === 'function') setEncaisserPar(newEncaisse); } catch {}
    try { if (title.trim() && typeof onSaveTitle === 'function' && title.trim() !== (currentTitle || '')) onSaveTitle(title.trim()); } catch {}
    try { if (typeof onSaveSettings === 'function') onSaveSettings({ prise_par: newPrise, encaisser_par: newEncaisse }); } catch {}
    try { if (typeof onSaveTheme === 'function' && tableId) onSaveTheme(selectedTheme); } catch {}
    try { if (typeof onClose === 'function') onClose(); } catch {}
  };

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId);
    const palette = COLOR_PALETTES.find(p => p.id === themeId);
    if (palette) {
      applyTheme(palette);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop" onClick={onClose}>
      <div className="modal bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold">Paramètres du tableau</h3>
          <button onClick={onClose} className="text-2xl leading-none">&times;</button>
        </header>
        <div className="p-6 space-y-4 content">
          <div>
            <label htmlFor="table-title-input" className="block text-sm font-medium text-gray-700">Titre du tableau</label>
            <input id="table-title-input" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white" />
          </div>

          <div>
            <label htmlFor="theme-select" className="block text-sm font-medium text-gray-700">Palette de couleurs</label>
            <select 
              id="theme-select" 
              value={selectedTheme} 
              onChange={e => handleThemeChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white"
            >
              {/* Classical Palettes */}
              <optgroup label="Classique">
                {COLOR_PALETTES.filter(p => p.category === 'Classique').map(palette => (
                  <option key={palette.id} value={palette.id}>{palette.name}</option>
                ))}
              </optgroup>
              {/* Pastel Palettes */}
              <optgroup label="Pastel">
                {COLOR_PALETTES.filter(p => p.category === 'Pastel').map(palette => (
                  <option key={palette.id} value={palette.id}>{palette.name}</option>
                ))}
              </optgroup>
            </select>
            
            {/* Theme Preview */}
            {(() => {
              const palette = COLOR_PALETTES.find(p => p.id === selectedTheme);
              return palette ? (
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 p-3 rounded border" style={{ backgroundColor: palette.primary }}>
                    <div className="text-xs text-white">Primary</div>
                  </div>
                  <div className="flex-1 p-3 rounded border" style={{ backgroundColor: palette.secondary, color: palette.primary }}>
                    <div className="text-xs">Secondary</div>
                  </div>
                  <div className="flex-1 p-3 rounded border" style={{ backgroundColor: palette.accent, color: '#ffffff' }}>
                    <div className="text-xs">Accent</div>
                  </div>
                  <div className="flex-1 p-3 rounded border" style={{ backgroundColor: palette.background }}>
                    <div className="text-xs">BG</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          <div>
            <label htmlFor="settings-prise" className="block text-sm font-medium text-gray-700">Prénoms « Prise par » (séparés par des virgules)</label>
            <input id="settings-prise" value={priseParStr} onChange={e => setPriseParStr(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white" />
          </div>
          <div>
            <label htmlFor="settings-encaisse" className="block text-sm font-medium text-gray-700">Prénoms « Encaisser par » (séparés par des virgules)</label>
            <input id="settings-encaisse" value={encaisserParStr} onChange={e => setEncaisserParStr(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-white" />
          </div>
        </div>
        <footer className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-[#163667] text-white font-semibold hover:bg-opacity-90">Annuler</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-[#163667] text-white font-semibold hover:bg-opacity-90">Enregistrer</button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
