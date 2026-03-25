// 22 Color Palettes - 11 Classical + 11 Pastel
export const COLOR_PALETTES = [
  // CLASSICAL PALETTES
  {
    id: 'navy',
    name: 'Bleu Marine',
    category: 'Classique',
    primary: '#163667',
    secondary: '#FFFFFF',
    accent: '#E74C3C',
    background: '#F5F5F5'
  },
  {
    id: 'elegant-black',
    name: 'Noir Élégant',
    category: 'Classique',
    primary: '#1A1A1A',
    secondary: '#FFFFFF',
    accent: '#FFD700',
    background: '#F9F9F9'
  },
  {
    id: 'burgundy',
    name: 'Bordeaux',
    category: 'Classique',
    primary: '#8B1538',
    secondary: '#FFFFFF',
    accent: '#F4A460',
    background: '#F8F8F8'
  },
  {
    id: 'gold-luxury',
    name: 'Or Luxe',
    category: 'Classique',
    primary: '#2C1810',
    secondary: '#FAF0E6',
    accent: '#D4AF37',
    background: '#FFFEF7'
  },
  {
    id: 'dark-green',
    name: 'Vert Foncé',
    category: 'Classique',
    primary: '#1B4332',
    secondary: '#FFFFFF',
    accent: '#FFB703',
    background: '#F0F9F6'
  },
  {
    id: 'royal-purple',
    name: 'Pourpre Royal',
    category: 'Classique',
    primary: '#440254',
    secondary: '#FFFFFF',
    accent: '#FDB750',
    background: '#F8F6FB'
  },
  {
    id: 'teal',
    name: 'Teal',
    category: 'Classique',
    primary: '#006064',
    secondary: '#FFFFFF',
    accent: '#FF6B9D',
    background: '#F0F8F9'
  },
  {
    id: 'crimson',
    name: 'Crimson',
    category: 'Classique',
    primary: '#C41E3A',
    secondary: '#FFFFFF',
    accent: '#FFE66D',
    background: '#FEF8F3'
  },
  {
    id: 'charcoal-gray',
    name: 'Gris Charbon',
    category: 'Classique',
    primary: '#36454F',
    secondary: '#ECF0F1',
    accent: '#E8B4B8',
    background: '#F5F7FA'
  },
  {
    id: 'rich-brown',
    name: 'Marron Riche',
    category: 'Classique',
    primary: '#5C4033',
    secondary: '#FFF8DC',
    accent: '#CD853F',
    background: '#FEFBF7'
  },
  {
    id: 'indigo',
    name: 'Indigo',
    category: 'Classique',
    primary: '#4C3C8C',
    secondary: '#FFFFFF',
    accent: '#FF8C42',
    background: '#F7F5FB'
  },

  // PASTEL PALETTES
  {
    id: 'rose-pastel',
    name: 'Rose Pastel',
    category: 'Pastel',
    primary: '#F8BDD0',
    secondary: '#FFFFFF',
    accent: '#D4A5D4',
    background: '#FEF9FB'
  },
  {
    id: 'lavender-soft',
    name: 'Lavande Douce',
    category: 'Pastel',
    primary: '#E6D4E8',
    secondary: '#FFFFFF',
    accent: '#F9D6E3',
    background: '#F9F5FB'
  },
  {
    id: 'mint-fresh',
    name: 'Menthe Fraîche',
    category: 'Pastel',
    primary: '#BFEFB3',
    secondary: '#FFFFFF',
    accent: '#FFD6BA',
    background: '#F5FEFB'
  },
  {
    id: 'apricot-light',
    name: 'Abricot Clair',
    category: 'Pastel',
    primary: '#FFD9B3',
    secondary: '#FFFFFF',
    accent: '#D4A5D4',
    background: '#FFFAF5'
  },
  {
    id: 'sky-blue',
    name: 'Bleu Ciel',
    category: 'Pastel',
    primary: '#B8D8E8',
    secondary: '#FFFFFF',
    accent: '#F8BDD0',
    background: '#F8FAFC'
  },
  {
    id: 'peach-soft',
    name: 'Pêche Douce',
    category: 'Pastel',
    primary: '#F5D9CC',
    secondary: '#FFFFFF',
    accent: '#D4D4E8',
    background: '#FFFAF7'
  },
  {
    id: 'lemon-pale',
    name: 'Citron Pâle',
    category: 'Pastel',
    primary: '#F5E6CC',
    secondary: '#FFFFFF',
    accent: '#E8D4D9',
    background: '#FFFBF5'
  },
  {
    id: 'lilac-light',
    name: 'Lilas Clair',
    category: 'Pastel',
    primary: '#E8D4E8',
    secondary: '#FFFFFF',
    accent: '#F5D9CC',
    background: '#F9F5FB'
  },
  {
    id: 'sage-pastel',
    name: 'Sage Pastel',
    category: 'Pastel',
    primary: '#D4E6D4',
    secondary: '#FFFFFF',
    accent: '#E8D4D9',
    background: '#F8FBFA'
  },
  {
    id: 'sky-soft',
    name: 'Ciel Doux',
    category: 'Pastel',
    primary: '#D9E8F5',
    secondary: '#FFFFFF',
    accent: '#F8BDD0',
    background: '#F8F9FC'
  },
  {
    id: 'coral-pastel',
    name: 'Corail Pastel',
    category: 'Pastel',
    primary: '#F5D4CC',
    secondary: '#FFFFFF',
    accent: '#D4E6D4',
    background: '#FFFAF8'
  }
];

export const getThemeById = (id) => {
  return COLOR_PALETTES.find(palette => palette.id === id) || COLOR_PALETTES[0];
};

export const applyTheme = (palette) => {
  if (!palette) return;
  
  const root = document.documentElement;
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-secondary', palette.secondary);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-background', palette.background);
  
  // Store in localStorage for persistence
  localStorage.setItem('selectedTheme', palette.id);
};

export const getStoredTheme = () => {
  const themeId = localStorage.getItem('selectedTheme');
  return themeId ? getThemeById(themeId) : COLOR_PALETTES[0];
};
