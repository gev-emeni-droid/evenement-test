import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from './Header.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { COLOR_PALETTES, applyTheme } from '../themes.js';

const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const getDaysInMonth = (monthIndex, year) => {
  const days = [];
  const date = new Date(year, monthIndex, 1);
  while (date.getMonth() === monthIndex) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const getPeopleCount = (list) => {
  if (!Array.isArray(list)) return 0;
  return list.reduce((acc, name) => {
    const match = name.match(/^(\d+) LBE$/);
    return acc + (match ? parseInt(match[1], 10) : 1);
  }, 0);
};

const HotesseTables = ({ onLogout, archivesMode = false }) => {
  const navigate = useNavigate();
  const { calendarId } = useParams();

  const [calendars, setCalendars] = useLocalStorage('hotesse_calendars_v1', []);
  const [hasPrefetchedPrivs, setHasPrefetchedPrivs] = useState(false);
  const [hostessOptions, setHostessOptions] = useLocalStorage('hotesse_hostess_options_v1', []);
  const [priseParOptions, setPriseParOptions] = useLocalStorage('hotesse_prise_par_options_v1', []);
  const [notifContacts, setNotifContacts] = useLocalStorage('hotesse_notif_contacts_v1', []);
  const [customLogo, setCustomLogo] = useState(null);

  const firstActiveCalendarId = calendars.find(c => !c.isArchived)?.id || null;
  const [selectedCalendarId, setSelectedCalendarId] = useState(calendarId || firstActiveCalendarId);

  const isFullPage = Boolean(calendarId);

  // Modals / panneaux
  const [isCreateCalOpen, setIsCreateCalOpen] = useState(false);
  const [isPrivModalOpen, setIsPrivModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'weekly'
  const [weekIndex, setWeekIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('profil'); // 'profil' or 'staff'
  const [selectedTheme, setSelectedTheme] = useState('navy');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Form state pour créer un calendrier
  const [newMonth, setNewMonth] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());

  // Form state pour ajout d'options paramétrables (dans Paramètres)
  const [newHostess, setNewHostess] = useState('');
  const [newPrisePar, setNewPrisePar] = useState('');

  // Form state pour ajouter / modifier une privat
  const [privName, setPrivName] = useState('');
  const [privPeople, setPrivPeople] = useState('');
  const [privHostesses, setPrivHostesses] = useState([]);
  const [privStart, setPrivStart] = useState('');
  const [privEnd, setPrivEnd] = useState('');
  const [privPrisePar, setPrivPrisePar] = useState('');
  const [privDate, setPrivDate] = useState('');
  const [privColor, setPrivColor] = useState('bleu'); // 'bleu' | 'violet'
  const [privComment, setPrivComment] = useState('');

  // Ref pour le calcul différentiel du "Nombre d'hôtesses nécessaire"
  const prevHostessCountRef = useRef(0);

  // Effet pour ajuster automatiquement le nombre nécessaire
  useEffect(() => {
    if (!isPrivModalOpen) return;
    const currentCount = getPeopleCount(privHostesses);
    const diff = currentCount - prevHostessCountRef.current;

    if (diff !== 0) {
      setPrivComment(prev => {
        const currentVal = parseInt(prev) || 0;
        // On ne descend pas en dessous de 0
        return String(Math.max(0, currentVal - diff));
      });
      prevHostessCountRef.current = currentCount;
    }
  }, [privHostesses, isPrivModalOpen]);

  const [editingPriv, setEditingPriv] = useState(null);

  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId) || null;
  const isReadOnly = archivesMode || (selectedCalendar && selectedCalendar.isArchived);

  const activeCalendars = calendars.filter(c => !c.isArchived);
  const archivedCalendars = calendars.filter(c => c.isArchived);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBleu, setFilterBleu] = useState(true);
  const [filterViolet, setFilterViolet] = useState(true);
  const archivedSectionRef = useRef(null);
  const selectedCalendarSectionRef = useRef(null);

  // Notifications de MAJ
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState([]);
  const [newNotifName, setNewNotifName] = useState('');
  const [newNotifEmail, setNewNotifEmail] = useState('');
  const [newNotifPhone, setNewNotifPhone] = useState('');
  const [notifChannelById, setNotifChannelById] = useState({});
  const [editingNotifId, setEditingNotifId] = useState(null);

  // Paramètres : préfixe du titre du calendrier sélectionné
  const [settingsTitlePrefix, setSettingsTitlePrefix] = useState('');

  // Load and apply theme for selected calendar
  useEffect(() => {
    if (selectedCalendar && selectedCalendar.id) {
      (async () => {
        try {
          const res = await fetch(`/api/hotesse/calendars/${encodeURIComponent(selectedCalendar.id)}/theme`);
          const data = await res.json();
          if (data.ok && data.theme_id) {
            setSelectedTheme(data.theme_id);
            const palette = COLOR_PALETTES.find(p => p.id === data.theme_id);
            if (palette) {
              applyTheme(palette);
            }
          }
        } catch (_) {}
      })();
    }
  }, [selectedCalendar?.id]);

  // Load custom logo and other settings from DB on app startup
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/hotesse/settings');
        const data = await res.json();
        if (data.ok && data.settings) {
          if (data.settings.custom_logo) {
            setCustomLogo(data.settings.custom_logo);
          }
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    })();
  }, []);

  // Helper pour filtrer les privatisations selon les filtres couleur
  const filterPrivatisations = (privs) => {
    return (privs || []).filter(p => {
      if (p.color === 'violet' && !filterViolet) return false;
      if (p.color !== 'violet' && !filterBleu) return false;
      return true;
    });
  };

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

  useEffect(() => {
    if (!selectedCalendarId) return;
    if (selectedCalendarSectionRef.current) {
      selectedCalendarSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCalendarId]);

  const filteredActiveCalendars = useMemo(() => {
    if (!searchQuery.trim()) return activeCalendars;
    const q = searchQuery.toLowerCase();
    return activeCalendars.filter(c => (c.title || '').toLowerCase().includes(q));
  }, [activeCalendars, searchQuery]);

  const filteredArchivedCalendars = useMemo(() => {
    if (!searchQuery.trim()) return archivedCalendars;
    const q = searchQuery.toLowerCase();
    return archivedCalendars.filter(c => (c.title || '').toLowerCase().includes(q));
  }, [archivedCalendars, searchQuery]);

  // Chargement initial depuis l'API D1 (calendriers + options + settings hotesse)
  useEffect(() => {
    (async () => {
      try {
        const [calRes, hostRes, priseRes, settingsRes] = await Promise.all([
          fetch('/api/hotesse/calendars', { cache: 'no-store' }),
          fetch('/api/hotesse/options/hostesses', { cache: 'no-store' }),
          fetch('/api/hotesse/options/prise-par', { cache: 'no-store' }),
          fetch('/api/hotesse/settings', { cache: 'no-store' }),
        ]);
        if (calRes.ok) {
          const list = await calRes.json();
          if (Array.isArray(list) && list.length) {
            setCalendars(list.map(c => ({
              ...c,
              // Normaliser le flag d'archive côté front
              isArchived: typeof c.is_archived === 'number'
                ? c.is_archived === 1
                : !!c.isArchived,
              // Normaliser la date de création côté front
              createdAt: c.createdAt || c.created_at || null,
              privatisations: c.privatisations || [],
            })));
          }
        }
        if (hostRes.ok) {
          const names = await hostRes.json();
          if (Array.isArray(names)) setHostessOptions(names);
        }
        if (priseRes.ok) {
          const names = await priseRes.json();
          if (Array.isArray(names)) setPriseParOptions(names);
        }
        if (settingsRes.ok) {
          const js = await settingsRes.json();
          const st = js && js.settings ? js.settings : {};
          if (Array.isArray(st.notif_contacts)) setNotifContacts(st.notif_contacts);
        }
      } catch (e) { }
    })();
  }, []);

  // Précharger les privatisations des calendriers ayant un priv_count > 0 mais pas encore de liste détaillée,
  // pour que les compteurs globaux soient corrects dès l'arrivée sur la page.
  useEffect(() => {
    if (hasPrefetchedPrivs) return;
    if (!calendars || calendars.length === 0) return;

    const candidates = calendars.filter((c) => {
      const hasPrivCount = typeof c.priv_count === 'number' && c.priv_count > 0;
      const hasList = Array.isArray(c.privatisations) && c.privatisations.length > 0;
      return hasPrivCount && !hasList;
    });

    if (candidates.length === 0) return;

    setHasPrefetchedPrivs(true);

    (async () => {
      for (const cal of candidates) {
        try {
          // refetchCalendar mettra à jour calendars avec les privatisations détaillées
          // ce qui actualisera automatiquement les compteurs globaux via useMemo.
          // eslint-disable-next-line no-await-in-loop
          await refetchCalendar(cal.id);
        } catch (e) {
          // on ignore les erreurs ici, les compteurs resteront basés sur priv_count
        }
      }
    })();
  }, [calendars, hasPrefetchedPrivs]);

  // Synchroniser la sélection avec l'URL (/hotesse ou /hotesse/:calendarId)
  useEffect(() => {
    if (calendarId) {
      setSelectedCalendarId(calendarId);
      return;
    }
    setSelectedCalendarId(null);
  }, [calendarId]);

  // Si le calendrier sélectionné est supprimé en vue plein écran, revenir à la liste
  useEffect(() => {
    if (!calendarId) return;
    if (!selectedCalendarId) return;
    const current = calendars.find(c => c.id === selectedCalendarId);
    if (!current) {
      navigate('/hotesse');
    }
  }, [calendars, selectedCalendarId, calendarId, navigate]);

  // Charger les privatisations du calendrier sélectionné quand on ouvre le calendrier en vue plein écran
  useEffect(() => {
    if (!isFullPage || !selectedCalendarId) return;
    refetchCalendar(selectedCalendarId);
  }, [selectedCalendarId, isFullPage]);

  const scrollToSelectedCalendar = () => {
    if (selectedCalendarSectionRef.current) {
      selectedCalendarSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Recharger les données du calendrier sélectionné depuis l'API
  const refetchCalendar = async (calId) => {
    if (!calId) return;
    console.log('=== refetchCalendar START ===');
    console.log('Calendar ID:', calId);
    console.log('Current calendars state before refetch:', calendars);

    try {
      const url = `/api/hotesse/calendars/${calId}`;
      console.log('Fetching from:', url);
      const res = await fetch(url, { cache: 'no-store' });
      console.log('API response status:', res.status);

      if (res.ok) {
        const updated = await res.json();
        console.log('API returned data:', updated);
        console.log('API returned privatisations:', updated.privatisations);
        console.log('Privatisations count from API:', (updated.privatisations || []).length);

        // Normaliser les privatisations (prise_par -> prisePar)
        const normalizedPrivs = (updated.privatisations || []).map((p) => ({
          ...p,
          prisePar: p.prise_par ?? p.prisePar ?? null,
        }));

        setCalendars(prev => {
          const next = prev.map(c => {
            if (c.id === calId) {
              const merged = {
                ...c,
                ...updated,
                // Normaliser la date de création lors du refetch
                createdAt: updated.createdAt || updated.created_at || c.createdAt || null,
                privatisations: normalizedPrivs,
              };
              console.log('Merged calendar object:', merged);
              return merged;
            }
            return c;
          });
          console.log('Updated calendars state:', next);
          return next;
        });
        console.log('=== refetchCalendar COMPLETED ===');
      } else {
        console.error('Refetch failed with status:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
      }
    } catch (e) {
      console.error('Failed to refetch calendar - exception:', e);
    }
  };

  const handleCreateCalendar = (e) => {
    e.preventDefault();
    if (!newMonth || !newYear) return;
    const monthIndex = parseInt(newMonth, 10);
    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return;
    const monthLabel = MONTHS[monthIndex];
    const title = `${monthLabel} ${newYear}`;

    const createdAt = new Date().toISOString();
    const calendar = { month: monthIndex, year: Number(newYear), title };

    (async () => {
      try {
        const res = await fetch('/api/hotesse/calendars', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(calendar),
        });
        if (res.ok) {
          const saved = await res.json();
          const fullCal = {
            ...saved,
            // Normaliser la date de création renvoyée par l'API
            createdAt: saved.createdAt || saved.created_at || createdAt,
            privatisations: [],
          };
          setCalendars(prev => [...prev, fullCal]);
          setSelectedCalendarId(saved.id);
        }
      } catch (err) {
        const id = `cal_${Date.now()}`;
        const fallback = { id, month: monthIndex, year: Number(newYear), title, createdAt, privatisations: [] };
        setCalendars(prev => [...prev, fallback]);
        setSelectedCalendarId(id);
      } finally {
        setIsCreateCalOpen(false);
        setTimeout(scrollToSelectedCalendar, 0);
      }
    })();
  };

  const handleAddHostess = (e) => {
    e.preventDefault();
    const name = newHostess.trim();
    if (!name) return;
    (async () => {
      try {
        await fetch('/api/hotesse/options/hostesses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } catch (e2) { }
      setHostessOptions(prev => prev.includes(name) ? prev : [...prev, name]);
      setNewHostess('');
    })();
  };

  const handleAddPrisePar = (e) => {
    e.preventDefault();
    const name = newPrisePar.trim();
    if (!name) return;
    (async () => {
      try {
        await fetch('/api/hotesse/options/prise-par', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } catch (e2) { }
      setPriseParOptions(prev => prev.includes(name) ? prev : [...prev, name]);
      setNewPrisePar('');
    })();
  };

  const handleDeleteHostess = (name) => {
    if (!window.confirm(`Supprimer l'hôtesse "${name}" ?`)) return;
    setHostessOptions(prev => prev.filter(h => h !== name));
    (async () => {
      try {
        await fetch('/api/hotesse/options/hostesses', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } catch (e2) { }
    })();
  };

  const handleDeletePrisePar = (name) => {
    if (!window.confirm(`Supprimer l'option "${name}" ?`)) return;
    setPriseParOptions(prev => prev.filter(p => p !== name));
    (async () => {
      try {
        await fetch('/api/hotesse/options/prise-par', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } catch (e2) { }
    })();
  };

  const handleSaveTheme = async (themeId) => {
    if (!selectedCalendar) return;
    try {
      await fetch(`/api/hotesse/calendars/${encodeURIComponent(selectedCalendar.id)}/theme`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme_id: themeId })
      });
      setSelectedTheme(themeId);
      const palette = COLOR_PALETTES.find(p => p.id === themeId);
      if (palette) {
        applyTheme(palette);
      }
    } catch (_) {}
  };

  // Gestion des contacts de notification (Paramètres)
  const handleAddNotifContact = (e) => {
    e.preventDefault();
    const name = newNotifName.trim();
    const email = newNotifEmail.trim();
    const phone = newNotifPhone.trim();
    if (!name || (!email && !phone)) return;

    let nextList;
    if (editingNotifId) {
      nextList = notifContacts.map((c) => (
        c.id === editingNotifId
          ? { ...c, name, email: email || null, phone: phone || null }
          : c
      ));
    } else {
      const id = `contact_${Date.now()}`;
      const contact = { id, name, email: email || null, phone: phone || null };
      nextList = [...notifContacts, contact];
    }
    setNotifContacts(nextList);
    setNewNotifName('');
    setNewNotifEmail('');
    setNewNotifPhone('');
    setEditingNotifId(null);

    (async () => {
      try {
        await fetch('/api/hotesse/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notif_contacts: nextList }),
        });
      } catch (e2) { }
    })();
  };

  const handleRemoveNotifContact = (id) => {
    const nextList = notifContacts.filter((c) => c.id !== id);
    setNotifContacts(nextList);
    setSelectedNotifIds((prev) => prev.filter((cid) => cid !== id));

    (async () => {
      try {
        await fetch('/api/hotesse/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notif_contacts: nextList }),
        });
      } catch (e2) { }
    })();
  };

  const handleOpenNotifModal = () => {
    if (!selectedCalendar) return;
    setSelectedNotifIds([]);
    setNotifChannelById({});
    setIsNotifModalOpen(true);
  };

  // Helpers pour extraire / reconstruire le titre (préfixe + "Mois Année")
  const getCalendarSuffix = (calendar) => {
    if (!calendar) return '';
    return `${MONTHS[calendar.month]} ${calendar.year}`;
  };

  const getTitlePrefixFromCalendar = (calendar) => {
    if (!calendar || !calendar.title) return 'Privatisation du mois de';
    const suffix = getCalendarSuffix(calendar);
    if (!suffix) return calendar.title;
    if (calendar.title.endsWith(suffix)) {
      const rawPrefix = calendar.title.slice(0, calendar.title.length - suffix.length).trim();
      return rawPrefix || 'Privatisation du mois de';
    }
    return calendar.title;
  };

  const handleSaveTitlePrefix = async () => {
    if (!selectedCalendar) return;
    const suffix = getCalendarSuffix(selectedCalendar);
    const prefix = settingsTitlePrefix.trim() || 'Privatisation du mois de';
    const fullTitle = `${prefix} ${suffix}`.trim();

    try {
      const res = await fetch(`/api/hotesse/calendars/${selectedCalendar.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: fullTitle }),
      });
      if (!res.ok) {
        console.error('Failed to update calendar title', await res.text());
        return;
      }
      const updated = await res.json();
      setCalendars((prev) => prev.map((c) => (
        c.id === selectedCalendar.id ? { ...c, title: updated.title } : c
      )));
    } catch (e) {
      console.error('Error updating calendar title', e);
    }
  };

  const handleUploadLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limiter la taille à 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (max 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Créer un canvas pour compresser l'image
          const canvas = document.createElement('canvas');
          const maxWidth = 120;
          const maxHeight = 120;
          let width = img.width;
          let height = img.height;

          // Calculer les nouvelles dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en Base64 avec qualité réduite pour email
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
          setCustomLogo(compressedBase64);
          // Sauvegarder en BD
          saveLogo(compressedBase64);
        };
        img.src = event.target?.result;
      } catch (err) {
        console.error('Error reading file', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveLogo = async (logoData) => {
    try {
      const res = await fetch('/api/hotesse/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notif_contacts: notifContacts,
          custom_logo: logoData
        })
      });
      if (!res.ok) {
        console.error('Failed to save logo');
      }
    } catch (e) {
      console.error('Error saving logo', e);
    }
  };

  const handleRemoveLogo = async () => {
    setCustomLogo(null);
    // Supprimer en BD
    try {
      const res = await fetch('/api/hotesse/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notif_contacts: notifContacts,
          custom_logo: null
        })
      });
      if (!res.ok) {
        console.error('Failed to remove logo');
      }
    } catch (e) {
      console.error('Error removing logo', e);
    }
  };

  const handleSendNotifications = async () => {
    if (!selectedCalendar) {
      setIsNotifModalOpen(false);
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const calendarUrl = `${baseUrl}/hotesse/${selectedCalendar.id}`;
    const title = selectedCalendar.title || `Calendrier ${selectedCalendar.month + 1}/${selectedCalendar.year}`;
    const message = `Le calendrier "${title}" vient d'être mis à jour.`;
    const whatsappMessage = `Le calendrier "${title}" vient d'être mis à jour.\n\nLien : ${calendarUrl}`;

    notifContacts
      .filter((c) => selectedNotifIds.includes(c.id))
      .forEach(async (contact) => {
        const channel = notifChannelById[contact.id] || 'auto';
        if (channel === 'auto' || channel === 'whatsapp') {
          if (contact.phone) {
            const waUrl = `https://wa.me/${encodeURIComponent(contact.phone)}?text=${encodeURIComponent(whatsappMessage)}`;
            if (typeof window !== 'undefined') {
              window.open(waUrl, '_blank', 'noopener,noreferrer');
            }
          }
        }
        if (channel === 'auto' || channel === 'email') {
          if (contact.email) {
            const subject = `Calendrier mis à jour - ${title}`;
            try {
              await fetch('/api/hotesse/send-notification', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  email: contact.email,
                  subject: subject,
                  message: message,
                  calendarUrl: calendarUrl,
                  logo: customLogo,
                }),
              });
            } catch (error) {
              console.error(`Failed to send email to ${contact.email}:`, error);
            }
          }
        }
      });

    setIsNotifModalOpen(false);
  };

  const handleArchiveCalendar = (calendarId) => {
    // Optimistic update
    setCalendars(prev => prev.map(c => (
      c.id === calendarId ? { ...c, isArchived: true } : c
    )));

    (async () => {
      try {
        await fetch(`/api/hotesse/calendars/${calendarId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ is_archived: 1 }),
        });
      } catch (e) {
        console.error('Failed to archive calendar', e);
      }
    })();
  };

  const handleUnarchiveCalendar = (calendarId) => {
    // Optimistic update
    setCalendars(prev => prev.map(c => (
      c.id === calendarId ? { ...c, isArchived: false } : c
    )));

    (async () => {
      try {
        await fetch(`/api/hotesse/calendars/${calendarId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ is_archived: 0 }),
        });
      } catch (e) {
        console.error('Failed to unarchive calendar', e);
      }
    })();
  };

  const handleDeleteCalendar = (calendarId) => {
    if (!window.confirm('Supprimer définitivement ce calendrier et toutes ses privatisations ?')) return;
    setCalendars(prev => prev.filter(c => c.id !== calendarId));
    if (selectedCalendarId === calendarId) {
      const nextActive = calendars.filter(c => c.id !== calendarId).find(c => !c.isArchived);
      setSelectedCalendarId(nextActive ? nextActive.id : null);
    }

    (async () => {
      try {
        const res = await fetch(`/api/hotesse/calendars/${calendarId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          console.error('Failed to delete calendar on server', await res.text());
        }
      } catch (e) {
        console.error('Error deleting calendar on server', e);
      }
    })();
  };

  const handleAddPrivatisation = (e) => {
    e.preventDefault();
    if (!selectedCalendar) return;

    const name = privName.trim();
    const people = privPeople ? Number(privPeople) : null;
    const date = privDate.trim();

    console.log('=== handleAddPrivatisation started ===');
    console.log('Name:', name);
    console.log('People:', people);
    console.log('Date raw value:', privDate);
    console.log('Date after trim:', date);
    console.log('selectedCalendar:', selectedCalendar);

    if (!name || !date) {
      console.error('Missing required fields - name:', name, 'date:', date);
      return;
    }

    // Déterminer automatiquement le créneau (midi / soir) à partir de l'heure de début
    let computedPeriod = 'midi';
    if (privStart) {
      const [hStr, mStr] = privStart.split(':');
      const h = Number(hStr);
      const m = Number(mStr || '0');
      if ((h > 14) || (h === 14 && m > 0)) {
        computedPeriod = 'soir';
      }
    }

    const privId = editingPriv?.id || `priv_${Date.now()}`;

    const commentNumber = Number(privComment);
    const commentValue = Number.isFinite(commentNumber) && commentNumber > 0
      ? `${commentNumber} Hôtesse`
      : null;

    const priv = {
      id: privId,
      name,
      people,
      hostess: Array.isArray(privHostesses) && privHostesses.length === 1 ? privHostesses[0] : null,
      hostesses: Array.isArray(privHostesses) ? privHostesses : [],
      start: privStart || null,
      end: privEnd || null,
      prisePar: privPrisePar || null,
      date,
      color: privColor === 'violet' ? 'violet' : 'bleu',
      period: computedPeriod,
      commentaire: commentValue,
    };

    console.log('Priv object created:', priv);

    // Optimistic update — mise à jour immédiate de l'UI (privatisations + compteur)
    setCalendars(prev => prev.map(c => {
      if (c.id !== selectedCalendar.id) return c;
      const existing = c.privatisations || [];
      const updatedList = editingPriv
        ? existing.map(p => (p.id === privId ? priv : p))
        : [...existing, priv];

      const baseCount = typeof c.priv_count === 'number' ? c.priv_count : existing.length;
      const nextPrivCount = editingPriv ? baseCount : baseCount + 1;

      console.log('Optimistic update - new list:', updatedList, 'nextPrivCount:', nextPrivCount);
      return { ...c, privatisations: updatedList, priv_count: nextPrivCount };
    }));

    // Réinitialiser le formulaire immédiatement
    setPrivName('');
    setPrivPeople('');
    setPrivHostesses([]);
    setPrivStart('');
    setPrivEnd('');
    setPrivPrisePar('');
    setPrivDate('');
    setPrivColor('bleu');
    setPrivComment('');
    setEditingPriv(null);
    setIsPrivModalOpen(false);

    // Puis synchroniser avec l'API
    (async () => {
      const payload = {
        id: privId,
        calendar_id: selectedCalendar.id,
        name,
        people,
        date,
        start: privStart || null,
        end: privEnd || null,
        period: computedPeriod,
        color: privColor === 'violet' ? 'violet' : 'bleu',
        prise_par: privPrisePar || null,
        commentaire: commentValue,
        hostesses: Array.isArray(privHostesses) ? privHostesses : [],
      };

      console.log('=== Sending API request ===');
      console.log('Payload:', payload);
      console.log('Date in payload:', date);

      try {
        const res = await fetch('/api/hotesse/privatisations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('API response data:', data);
          console.log('=== Starting refetch ===');
          console.log('Refetching calendar ID:', selectedCalendar.id);
          // Recharger les données du calendrier depuis l'API pour être en sync
          await refetchCalendar(selectedCalendar.id);
          console.log('=== Refetch completed ===');
        } else {
          console.error('API error - status:', res.status);
          const errorText = await res.text();
          console.error('Error response:', errorText);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    })();
  };

  const handleEditPrivatisation = (priv) => {
    const hostesses = Array.isArray(priv.hostesses)
      ? priv.hostesses
      : (priv.hostess ? [priv.hostess] : []);

    setEditingPriv(priv);
    setPrivName(priv.name || '');
    setPrivPeople(priv.people != null ? String(priv.people) : '');
    setPrivHostesses(hostesses);
    setPrivStart(priv.start || '');
    setPrivEnd(priv.end || '');
    setPrivPrisePar(priv.prisePar || '');
    setPrivDate(priv.date || '');
    setPrivColor(priv.color === 'violet' ? 'violet' : 'bleu');
    const rawComment = priv.commentaire || '';
    const matchNumber = rawComment.match(/(\d+)/);
    setPrivComment(matchNumber ? matchNumber[1] : '');


    // Init ref pour éviter le saut au chargement
    prevHostessCountRef.current = getPeopleCount(hostesses);

    setIsPrivModalOpen(true);
  };

  const handleDeletePrivatisation = (privId) => {
    if (!selectedCalendar) return;
    if (!window.confirm('Supprimer cette privatisation ?')) return;
    console.log('handleDeletePrivatisation called with ID:', privId);
    // Optimistic update : retirer la privatisation et décrémenter le compteur
    setCalendars(prev => prev.map(c => {
      if (c.id !== selectedCalendar.id) return c;
      const existing = c.privatisations || [];
      const updatedList = existing.filter(p => p.id !== privId);
      const baseCount = typeof c.priv_count === 'number' ? c.priv_count : existing.length;
      const nextPrivCount = Math.max(0, baseCount - 1);
      return { ...c, privatisations: updatedList, priv_count: nextPrivCount };
    }));

    (async () => {
      try {
        console.log('Sending DELETE request for:', privId);
        const res = await fetch(`/api/hotesse/privatisations/delete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: privId }),
        });
        console.log('DELETE response status:', res.status);
        if (res.ok) {
          // Recharger les données après suppression
          await refetchCalendar(selectedCalendar.id);
        } else {
          const error = await res.text();
          console.error('Delete failed:', error);
        }
      } catch (e2) {
        console.error('Delete error:', e2);
      }
    })();
  };

  // Export Excel du calendrier sélectionné
  const exportExcel = useCallback(async () => {
    if (!selectedCalendar) return;

    const ensureXLSX = () => new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const XLSX = await ensureXLSX();

    const days = getDaysInMonth(selectedCalendar.month, selectedCalendar.year);
    const firstWeekDay = (days[0].getDay() + 6) % 7; // Lundi=0

    const dayHeaders = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

    // Construire la matrice en respectant la maquette
    const grid = [];

    // Ligne 0 : réservée au logo (vide mais grande hauteur / fusionnée ensuite)
    grid.push(new Array(7).fill(''));

    // Ligne 1 : "PRIVATISATION DU MOIS DE"
    grid.push(['PRIVATISATION DU MOIS DE', '', '', '', '', '', '']);

    // Ligne 2 : mois + année (ex : "janvier 2026")
    const monthLabel = MONTHS[selectedCalendar.month].toLowerCase();
    grid.push([`${monthLabel} ${selectedCalendar.year}`, '', '', '', '', '', '']);

    // Ligne 3 : séparateur vide
    grid.push(new Array(7).fill(''));

    // Ligne 4 : entêtes des jours
    grid.push(dayHeaders);

    // Lignes suivantes : semaines du mois
    let weekRow = new Array(7).fill('');
    let currentRowIndex = grid.length; // index de la prochaine ligne de jour

    // Première ligne de jours : décalage avant le 1er
    for (let i = 0; i < firstWeekDay; i += 1) {
      weekRow[i] = '';
    }

    const rowsForWeeks = [];

    for (const day of days) {
      const dayOfWeek = (day.getDay() + 6) % 7; // Lundi=0
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const dayPrivs = (selectedCalendar.privatisations || []).filter((p) => p.date === dateStr);

      // Contenu : date + éventuelles privatisations
      const privTexts = dayPrivs.map((p) => {
        const periodLabel = p.period === 'soir' ? 'Soir' : 'Midi';
        const parts = [];
        parts.push(p.name || '');
        parts.push(`${periodLabel}`);
        if (p.start || p.end) {
          parts.push(`${p.start || '--:--'}-${p.end || '--:--'}`);
        }
        if (p.people) {
          parts.push(`${p.people} pers`);
        }
        if (Array.isArray(p.hostesses) && p.hostesses.length > 0) {
          parts.push(`H: ${p.hostesses.join(', ')}`);
        }
        if (p.commentaire) {
          parts.push(`${p.commentaire}`);
        }
        if (p.prisePar) {
          parts.push(`Par: ${p.prisePar}`);
        }
        return parts.join(' \n ');
      });

      let cellContent = `${day.getDate()}`;
      if (privTexts.length > 0) {
        cellContent += `\n${privTexts.join('\n')}`;
      }

      weekRow[dayOfWeek] = cellContent;

      if (dayOfWeek === 6) {
        rowsForWeeks.push(weekRow);
        weekRow = new Array(7).fill('');
      }
    }

    if (weekRow.some((v) => v)) {
      rowsForWeeks.push(weekRow);
    }

    // Ajouter les lignes de semaines au grid
    for (const row of rowsForWeeks) {
      grid.push(row);
    }

    // Ligne vide avant les bandeaux bas
    grid.push(new Array(7).fill(''));

    // Ligne des bandeaux bas : texte dans la première et la dernière zone
    const bottomRowIndex = grid.length;
    const bottomRow = new Array(7).fill('');
    bottomRow[0] = 'Polpo Restaurant';
    bottomRow[4] = 'Polpo Nord';
    grid.push(bottomRow);

    const ws = XLSX.utils.aoa_to_sheet(grid);

    // Largeur des colonnes
    ws['!cols'] = Array(7).fill({ wch: 18 });

    // Hauteur des lignes (ajuster certaines clés)
    const rowHeights = [];
    for (let r = 0; r < grid.length; r += 1) {
      if (r === 0) {
        // ligne logo
        rowHeights.push({ hpx: 80 });
      } else if (r === 1 || r === 2) {
        rowHeights.push({ hpx: 24 });
      } else if (r === 4) {
        rowHeights.push({ hpx: 20 });
      } else if (r === bottomRowIndex) {
        rowHeights.push({ hpx: 24 });
      } else {
        rowHeights.push({ hpx: 60 });
      }
    }
    ws['!rows'] = rowHeights;

    // Merges
    const merges = [];
    // Logo : ligne 0, colonnes 0-6
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });
    // Titre : ligne 1, colonnes 0-6
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });
    // Mois : ligne 2, colonnes 0-6
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 6 } });
    // Bandeau bas gauche : ligne bottomRowIndex, colonnes 0-2
    merges.push({ s: { r: bottomRowIndex, c: 0 }, e: { r: bottomRowIndex, c: 2 } });
    // Bandeau bas droite : ligne bottomRowIndex, colonnes 4-6
    merges.push({ s: { r: bottomRowIndex, c: 4 }, e: { r: bottomRowIndex, c: 6 } });

    ws['!merges'] = merges;

    // Styles
    const setCell = (r, c, updater) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref] = updater(ws[ref]);
    };

    // Ligne titre
    for (let c = 0; c < 7; c += 1) {
      setCell(1, c, (cell) => ({
        ...cell,
        v: c === 0 ? 'PRIVATISATION DU MOIS DE' : '',
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      }));
    }

    // Ligne mois
    for (let c = 0; c < 7; c += 1) {
      setCell(2, c, (cell) => ({
        ...cell,
        v: c === 0 ? `${monthLabel} ${selectedCalendar.year}` : '',
        font: { bold: true, italic: true, sz: 16 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      }));
    }

    // En-têtes des jours (ligne 4)
    for (let c = 0; c < 7; c += 1) {
      setCell(4, c, (cell) => ({
        ...cell,
        v: dayHeaders[c],
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'FF92D050' } }, // vert soutenu
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        },
      }));
    }

    // Fond vert clair + bordures pour les cases de jours
    const firstDayRow = 5;
    const lastDayRow = bottomRowIndex - 2; // juste avant la ligne vide + bandeau

    for (let r = firstDayRow; r <= lastDayRow; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        setCell(r, c, (cell) => ({
          ...cell,
          fill: { fgColor: { rgb: 'FFEBF1DE' } }, // vert très clair
          alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          },
        }));
      }
    }

    // Bandeaux bas
    // Gauche : Polpo Restaurant (0-2)
    for (let c = 0; c <= 2; c += 1) {
      setCell(bottomRowIndex, c, (cell) => ({
        ...cell,
        v: c === 0 ? 'Polpo Restaurant' : '',
        fill: { fgColor: { rgb: 'FF6B8CCB' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }));
    }

    // Droite : Polpo Nord (4-6)
    for (let c = 4; c <= 6; c += 1) {
      setCell(bottomRowIndex, c, (cell) => ({
        ...cell,
        v: c === 4 ? 'Polpo Nord' : '',
        fill: { fgColor: { rgb: 'FFB28AD8' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calendrier');
    const fileName = `${selectedCalendar.title.replace(/[^\w\-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [selectedCalendar]);

  const printCalendar = () => {
    document.body.classList.add('print-table-only');
    window.print();
    document.body.classList.remove('print-table-only');
  };

  // Jours du calendrier pour le calendrier sélectionné
  const calendarDays = useMemo(() => {
    if (!selectedCalendar) return [];
    const days = getDaysInMonth(selectedCalendar.month, selectedCalendar.year);
    const firstWeekDay = (days[0].getDay() + 6) % 7; // Lundi=0
    const grid = [];
    let week = [];
    // cases vides avant le 1er
    for (let i = 0; i < firstWeekDay; i += 1) {
      week.push(null);
    }
    days.forEach((d) => {
      week.push(d);
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    });
    if (week.length) {
      while (week.length < 7) week.push(null);
      grid.push(week);
    }
    return grid;
  }, [selectedCalendar]);

  // Statistiques globales pour la page "Calendriers actifs"
  const totalPrivatisationsAll = useMemo(() => {
    const getPrivCount = (c) => {
      if (typeof c.priv_count === 'number') {
        return c.priv_count;
      }
      if (Array.isArray(c.privatisations)) {
        return c.privatisations.length;
      }
      return 0;
    };
    return calendars.reduce((acc, c) => acc + getPrivCount(c), 0);
  }, [calendars]);

  const totalPrivRestaurantAll = useMemo(() => (
    calendars.reduce((acc, c) => {
      if (!Array.isArray(c.privatisations)) return acc;
      const count = c.privatisations.filter((p) => p.color !== 'violet').length;
      return acc + count;
    }, 0)
  ), [calendars]);

  const totalPrivPlageAll = useMemo(() => (
    calendars.reduce((acc, c) => {
      if (!Array.isArray(c.privatisations)) return acc;
      const count = c.privatisations.filter((p) => p.color === 'violet').length;
      return acc + count;
    }, 0)
  ), [calendars]);

  const activeCalendarsCount = useMemo(
    () => calendars.filter((c) => !c.isArchived).length,
    [calendars],
  );

  const archivedCalendarsCount = useMemo(
    () => calendars.filter((c) => c.isArchived).length,
    [calendars],
  );

  const selectedPrivStats = useMemo(() => {
    if (!selectedCalendar || !Array.isArray(selectedCalendar.privatisations)) {
      return { total: 0, restaurant: 0, plage: 0 };
    }
    const list = selectedCalendar.privatisations;
    const plage = list.filter((p) => p.color === 'violet').length;
    const restaurant = list.filter((p) => p.color !== 'violet').length;
    return {
      total: list.length,
      restaurant,
      plage,
    };
  }, [selectedCalendar]);

  // Titre principal : identique au titre du calendrier sélectionné en vue plein écran
  const headerTitle = isFullPage && selectedCalendar
    ? (selectedCalendar.title || '')
    : (archivesMode ? 'Calendriers archivés' : 'Calendriers actifs');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={headerTitle} onLogout={onLogout} customLogo={customLogo} />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {isFullPage && selectedCalendar && (
          <>
            <div className="flex justify-center mb-1 print:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Privat Restaurant</div>
                  <div className="mt-0.5 text-xl font-bold text-[#163667]">
                    {selectedPrivStats.restaurant}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Privat Plage</div>
                  <div className="mt-0.5 text-xl font-bold text-[#163667]">
                    {selectedPrivStats.plage}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Privat Total</div>
                  <div className="mt-0.5 text-xl font-bold text-[#163667]">
                    {selectedPrivStats.total}
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-3 text-center back-link print:hidden">
              <button
                type="button"
                className="text-xs text-[#163667] hover:text-[#0f2851] font-medium transition-colors"
                onClick={() => {
                  setSelectedCalendarId(null);
                  navigate('/hotesse');
                  setEditingPriv(null);
                  setIsPrivModalOpen(false);
                }}
              >
                ← Retour au générateur de calendriers
              </button>
            </div>
          </>
        )}
        {/* Modal notification de mise à jour */}
        {isNotifModalOpen && selectedCalendar && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
              {notifContacts.length === 0 ? (
                <div className="text-sm text-gray-600 mb-4">
                  Aucun contact n'est configuré pour les notifications. Ajoutez des contacts dans l'onglet Paramètres, puis réessayez.
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-3">
                    Sélectionnez les personnes à prévenir. Elles recevront un message pré-rempli (email et/ou WhatsApp) indiquant que le calendrier a été mis à jour, avec le lien du site.
                  </p>
                  <div className="max-h-52 overflow-auto border border-gray-200 rounded-lg divide-y">
                    {notifContacts.map((c) => {
                      const checked = selectedNotifIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-3 w-3"
                            checked={checked}
                            onChange={() => {
                              setSelectedNotifIds((prev) => (
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id]
                              ));
                            }}
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-700">{c.name}</div>
                            <div className="text-[11px] text-gray-500">
                              {c.email && <span>Email : {c.email}</span>}
                              {c.email && c.phone && <span> · </span>}
                              {c.phone && <span>WhatsApp : {c.phone}</span>}
                            </div>
                          </div>
                          {checked && (
                            <div className="mt-1 text-[11px] text-gray-600 flex flex-wrap items-center gap-2">
                              {(c.email && c.phone) && (
                                <>
                                  <span>Canal :</span>
                                  <select
                                    className="border border-gray-300 rounded px-1 py-0.5 bg-white text-[11px]"
                                    value={notifChannelById[c.id] || 'auto'}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setNotifChannelById((prev) => ({ ...prev, [c.id]: value }));
                                    }}
                                  >
                                    <option value="auto">WhatsApp + Email</option>
                                    <option value="whatsapp">WhatsApp uniquement</option>
                                    <option value="email">Email uniquement</option>
                                  </select>
                                </>
                              )}
                              {(!c.email || !c.phone) && (
                                <span className="text-gray-500">
                                  {c.phone && !c.email && 'Envoi par WhatsApp (email manquant)'}
                                  {c.email && !c.phone && 'Envoi par email (WhatsApp manquant)'}
                                </span>
                              )}
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 mt-4 text-sm">
                <button
                  type="button"
                  onClick={() => setIsNotifModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={notifContacts.length === 0 || selectedNotifIds.length === 0}
                  onClick={handleSendNotifications}
                  className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors ${notifContacts.length === 0 || selectedNotifIds.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-[#163667] hover:bg-[#0f2851]'
                    }`}
                >
                  Envoyer les notifications
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Générateur de calendriers (page actifs) */}
        {!isFullPage && !archivesMode && (
          <section className="mt-4">
            <div className="flex flex-col items-center mb-6 gap-5">
              <div className="flex justify-center items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsCreateCalOpen(true)}
                  className="text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                >
                  Créer un nouveau calendrier
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/hotesse-archives')}
                  className="bg-white font-semibold py-2 px-5 rounded-lg shadow-sm hover:bg-gray-50 transition-all duration-200 text-sm"
                  style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                >
                  Accéder aux archives
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 w-full">
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200">
                  <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">
                    Calendriers actifs
                  </div>
                  <div className="mt-1 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{activeCalendarsCount}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200">
                  <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Calendriers archivés</div>
                  <div className="mt-1 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{archivedCalendarsCount}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200">
                  <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Privatisations totales</div>
                  <div className="mt-1 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{totalPrivatisationsAll}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200">
                  <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Privat Restaurant</div>
                  <div className="mt-1 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{totalPrivRestaurantAll}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200">
                  <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Privat Plage</div>
                  <div className="mt-1 text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{totalPrivPlageAll}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 px-4">
              <input
                type="text"
                placeholder="Rechercher un calendrier..."
                className="w-full max-w-lg mx-auto block px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 transition-colors"
                style={{ '--tw-ring-color': 'var(--color-primary)' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {calendars.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-700">Aucun calendrier</h3>
                <p className="text-gray-500 mt-2">Commencez par créer un nouveau calendrier pour gérer vos privatisations.</p>
              </div>
            ) : filteredActiveCalendars.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-700">Aucun calendrier trouvé</h3>
                <p className="text-gray-500 mt-2">Votre recherche pour "{searchQuery}" n'a retourné aucun résultat.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                <p className="text-sm font-semibold text-gray-700">Calendriers actifs</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredActiveCalendars.map((c) => {
                    const createdAt = c.createdAt ? new Date(c.createdAt) : new Date(c.year, c.month || 0, 1);
                    const createdLabel = `Créé le: ${createdAt.toLocaleDateString('fr-FR')}`;
                    const privCount = typeof c.priv_count === 'number'
                      ? c.priv_count
                      : (Array.isArray(c.privatisations) ? c.privatisations.length : 0);
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300"
                      >
                        <div className="p-5">
                          <h3 className="text-lg font-semibold truncate" style={{ color: '#000000' }} title={c.title}>{c.title}</h3>
                          <p className="text-xs text-gray-500 mt-1.5">{createdLabel}</p>
                          <div className="mt-3 space-y-0.5 text-gray-700">
                            <p className="text-sm"><strong className="font-semibold">Privatisations :</strong> {privCount}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/hotesse/${c.id}`);
                            }}
                            className="font-semibold py-1.5 px-3 rounded-lg transition-colors text-xs"
                            style={{
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-text-on-primary)'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                          >
                            Ouvrir
                          </button>
                          <div className="flex items-center gap-4 text-xs">
                            <button
                              type="button"
                              onClick={() => handleArchiveCalendar(c.id)}
                              className="font-medium transition-colors"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              Archiver
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCalendar(c.id)}
                              className="font-medium text-red-600 hover:text-red-700 transition-colors"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Page "Calendriers archivés" */}
        {!isFullPage && archivesMode && (
          <section className="mt-6">
            <div className="flex justify-center items-center mb-8 gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/hotesse')}
                className="font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200 text-lg"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-on-primary)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'var(--color-primary-dark)';
                  e.target.style.boxShadow = '0 10px 15px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'var(--color-primary)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
              >
                ← Retour aux calendriers actifs
              </button>
            </div>

            <div className="mb-8 px-4">
              <input
                type="text"
                placeholder="Rechercher un calendrier archivé..."
                className="w-full max-w-lg mx-auto block px-4 py-2 border border-gray-300 rounded-lg bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredArchivedCalendars.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-700">Aucun calendrier archivé</h3>
                <p className="text-gray-500 mt-2">Vous n'avez pas encore d'archives.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-gray-600">Calendriers archivés</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredArchivedCalendars.map((c) => {
                    const createdLabel = c.createdAt
                      ? `Créé le: ${new Date(c.createdAt).toLocaleDateString('fr-FR')}`
                      : 'Calendrier sans date de création';
                    const privCount = typeof c.priv_count === 'number'
                      ? c.priv_count
                      : (Array.isArray(c.privatisations) ? c.privatisations.length : 0);
                    return (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
                      >
                        <div className="p-6 bg-gray-50">
                          <h3 className="text-2xl font-bold text-gray-600 truncate" title={c.title}>{c.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">{createdLabel}</p>
                          <div className="mt-4 space-y-1 text-gray-700">
                            <p className="text-sm"><strong>Privatisations :</strong> {privCount}</p>
                          </div>
                        </div>
                        <div className="bg-gray-100 px-6 py-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => navigate(`/hotesse/${c.id}`)}
                            className="bg-white text-gray-800 font-semibold py-2 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
                          >
                            Consulter
                          </button>
                          <div className="flex items-center gap-3 text-sm">
                            <button
                              type="button"
                              onClick={() => handleUnarchiveCalendar(c.id)}
                              className="font-medium text-gray-600 hover:text-gray-900"
                            >
                              Réactiver
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCalendar(c.id)}
                              className="font-medium text-red-600 hover:text-red-800"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Barre d'actions du calendrier sélectionné (Filtres / vue / ajout / notifications / export / paramètres) */}
        {isFullPage && selectedCalendar && (
          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 panel-controls">
            <div className="flex justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setFilterBleu(!filterBleu)}
                    className="px-3 py-2 text-sm transition-colors"
                    style={filterBleu ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-on-primary)'
                    } : {
                      color: '#374151'
                    }}
                  >
                    Restaurant
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterViolet(!filterViolet)}
                    className="px-3 py-2 text-sm transition-colors"
                    style={filterViolet ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-on-primary)'
                    } : {
                      color: '#374151'
                    }}
                  >
                    Plage
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => { setViewMode('monthly'); setWeekIndex(0); }}
                    className="px-3 py-2 text-sm transition-colors"
                    style={viewMode === 'monthly' ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-on-primary)'
                    } : {
                      color: '#374151'
                    }}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewMode('weekly'); setWeekIndex(0); }}
                    className="px-3 py-2 text-xs font-medium transition-colors rounded-lg"
                    style={viewMode === 'weekly' ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-on-primary)'
                    } : {
                      color: '#374151'
                    }}
                  >
                    Hebdo
                  </button>
                </div>
                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditingPriv(null); setIsPrivModalOpen(true); setIsSettingsOpen(false); }}
                      className="font-semibold py-2 px-4 rounded-lg transition-colors text-xs"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-on-primary)'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                    >
                      Ajouter une privatisation
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenNotifModal}
                      className="font-semibold py-2 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-xs"
                      style={{
                        color: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)'
                      }}
                    >
                      Envoyer une notification
                    </button>
                  </>
                )}
              </div>
              <div className="menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="btn-more"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  ⋯
                </button>
                {isMenuOpen && (
                  <div className="menu-panel open">
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => { printCalendar(); setIsMenuOpen(false); }}
                    >
                      Exporter PDF / Imprimer
                    </button>
                    {!isReadOnly && (
                      <>
                        <div className="menu-sep" />
                        <button
                          type="button"
                          className="menu-item"
                          onClick={() => {
                            if (selectedCalendar) {
                              setSettingsTitlePrefix(getTitlePrefixFromCalendar(selectedCalendar));
                            }
                            setIsSettingsOpen(true);
                            setIsMenuOpen(false);
                          }}
                        >
                          Paramètres
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Détails du calendrier sélectionné */}
        {isFullPage && selectedCalendar && (
          <section
            ref={selectedCalendarSectionRef}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            {/* Calendrier (mensuel / hebdo) */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* week selector for weekly view */}
              {viewMode === 'weekly' && (
                <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                  <div className="text-sm font-medium text-gray-700">Semaine</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
                      className="px-2 py-1 rounded border bg-white"
                    >
                      ←
                    </button>
                    <div className="text-sm text-gray-600">{`Semaine ${weekIndex + 1} / ${calendarDays.length}`}</div>
                    <button
                      type="button"
                      onClick={() => setWeekIndex((w) => Math.min(calendarDays.length - 1, w + 1))}
                      className="px-2 py-1 rounded border bg-white"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}

              <div className="print:hidden">
                {/* En-têtes jours */}
                <div className="grid grid-cols-7 text-xs bg-gray-100 text-gray-600">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <div
                      key={d}
                      className="px-2 py-1 text-center font-semibold border-b border-gray-200"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grille mensuelle / hebdomadaire */}
                <div className="grid grid-cols-7 text-xs">
                  {viewMode === 'monthly' ? (
                    // Monthly: render all weeks
                    calendarDays.map((week, wi) =>
                      week.map((day, di) => {
                        if (!day) {
                          return (
                            <div
                              key={`${wi}-${di}`}
                              className="min-h-[8rem] border-b border-r border-gray-100 bg-gray-50"
                            />
                          );
                        }
                        const dateStr = `${day.getFullYear()}-${String(
                          day.getMonth() + 1,
                        ).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const allPrivs = filterPrivatisations(
                          (selectedCalendar.privatisations || []).filter(
                            (p) => p.date === dateStr,
                          ),
                        );
                        const midiPrivs = allPrivs.filter((p) => p.period !== 'soir');
                        const soirPrivs = allPrivs.filter((p) => p.period === 'soir');

                        return (
                          <div
                            key={`${wi}-${di}`}
                            className="min-h-[8rem] border-b border-r border-gray-100 p-2 align-top break-words"
                          >
                            <div className="text-[11px] font-semibold text-gray-700 mb-1">
                              {day.getDate()}
                            </div>
                            <div className="flex flex-col divide-y divide-white/20">
                              {/* Midi */}
                              <div className="space-y-2">
                                {midiPrivs.map((priv) => {
                                  const hostesses = Array.isArray(priv.hostesses)
                                    ? priv.hostesses
                                    : priv.hostess
                                      ? [priv.hostess]
                                      : [];
                                  return (
                                    <div
                                      key={priv.id}
                                      className={`w-full rounded-md px-2 py-1 text-[12px] text-white text-center relative ${priv.color === 'violet'
                                        ? 'bg-purple-500'
                                        : 'bg-blue-500'
                                        } break-words`}
                                    >
                                      {!isReadOnly && (
                                        <div className="absolute top-1 right-1 flex gap-1 text-[10px]">
                                          <button
                                            type="button"
                                            className="text-white/80 hover:text-white"
                                            onClick={() => handleEditPrivatisation(priv)}
                                            aria-label="Modifier la privatisation"
                                          >
                                            ✎
                                          </button>
                                          <button
                                            type="button"
                                            className="text-white/80 hover:text-white"
                                            onClick={() => handleDeletePrivatisation(priv.id)}
                                            aria-label="Supprimer la privatisation"
                                          >
                                            🗑
                                          </button>
                                        </div>
                                      )}
                                      <div className="font-semibold pr-8">{priv.name}</div>
                                      <div>
                                        <span className="font-medium">Midi</span>
                                        {` · ${(priv.start || '--:--')} - ${priv.end || '--:--'
                                          } · ${priv.people || 0} pers`}
                                      </div>
                                      {hostesses.length > 0 && (
                                        <div>Hôtesses: {hostesses.join(', ')}</div>
                                      )}
                                      {priv.prisePar && (
                                        <div>Prise par: {priv.prisePar}</div>
                                      )}
                                      {priv.commentaire && (
                                        <div>{priv.commentaire}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Soir */}
                              <div className="space-y-2 pt-2">
                                {soirPrivs.map((priv) => {
                                  const hostesses = Array.isArray(priv.hostesses)
                                    ? priv.hostesses
                                    : priv.hostess
                                      ? [priv.hostess]
                                      : [];
                                  return (
                                    <div
                                      key={priv.id}
                                      className={`w-full rounded-md px-2 py-1 text-[12px] text-white text-center relative ${priv.color === 'violet'
                                        ? 'bg-purple-500'
                                        : 'bg-blue-500'
                                        } break-words`}
                                    >
                                      {!isReadOnly && (
                                        <div className="absolute top-1 right-1 flex gap-1 text-[10px]">
                                          <button
                                            type="button"
                                            className="text-white/80 hover:text-white"
                                            onClick={() => handleEditPrivatisation(priv)}
                                            aria-label="Modifier la privatisation"
                                          >
                                            ✎
                                          </button>
                                          <button
                                            type="button"
                                            className="text-white/80 hover:text-white"
                                            onClick={() => handleDeletePrivatisation(priv.id)}
                                            aria-label="Supprimer la privatisation"
                                          >
                                            🗑
                                          </button>
                                        </div>
                                      )}
                                      <div className="font-semibold pr-8">{priv.name}</div>
                                      <div>
                                        <span className="font-medium">Soir</span>
                                        {` · ${(priv.start || '--:--')} - ${priv.end || '--:--'
                                          } · ${priv.people || 0} pers`}
                                      </div>
                                      {hostesses.length > 0 && (
                                        <div>Hôtesses: {hostesses.join(', ')}</div>
                                      )}
                                      {priv.prisePar && (
                                        <div>Prise par: {priv.prisePar}</div>
                                      )}
                                      {priv.commentaire && (
                                        <div>{priv.commentaire}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      }),
                    )
                  ) : (
                    // Weekly: render only selected week
                    (calendarDays[weekIndex] || []).map((day, di) => {
                      if (!day) {
                        return (
                          <div
                            key={`w-${di}`}
                            className="min-h-[10rem] border-b border-r border-gray-100 bg-gray-50"
                          />
                        );
                      }
                      const dateStr = `${day.getFullYear()}-${String(
                        day.getMonth() + 1,
                      ).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                      const dayPrivs = filterPrivatisations(
                        (selectedCalendar.privatisations || []).filter(
                          (p) => p.date === dateStr,
                        ),
                      );

                      return (
                        <div
                          key={`w-${di}`}
                          className="min-h-[10rem] border-b border-r border-gray-100 p-2 align-top break-words"
                        >
                          <div className="text-[11px] font-semibold text-gray-700 mb-1">
                            {day.getDate()}
                          </div>
                          <div className="space-y-3">
                            {dayPrivs.map((priv) => {
                              const hostesses = Array.isArray(priv.hostesses)
                                ? priv.hostesses
                                : priv.hostess
                                  ? [priv.hostess]
                                  : [];
                              return (
                                <div
                                  key={priv.id}
                                  className={`w-full rounded-md px-3 py-2 text-[13px] text-white text-center relative ${priv.color === 'violet'
                                    ? 'bg-purple-500'
                                    : 'bg-blue-500'
                                    } break-words`}
                                >
                                  {!isReadOnly && (
                                    <div className="absolute top-2 right-2 flex gap-2 text-[11px]">
                                      <button
                                        type="button"
                                        className="text-white/90"
                                        onClick={() => handleEditPrivatisation(priv)}
                                      >
                                        ✎
                                      </button>
                                      <button
                                        type="button"
                                        className="text-white/90"
                                        onClick={() => handleDeletePrivatisation(priv.id)}
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  )}
                                  <div className="font-semibold pr-10">{priv.name}</div>
                                  <div>
                                    {(priv.start || '--:--')}
                                    {' - '}
                                    {(priv.end || '--:--')}
                                    {` · ${priv.people || 0} pers`}
                                  </div>
                                  {hostesses.length > 0 && (
                                    <div>Hôtesses: {hostesses.join(', ')}</div>
                                  )}
                                  {priv.prisePar && (
                                    <div>Prise par: {priv.prisePar}</div>
                                  )}
                                  {priv.commentaire && (
                                    <div>{priv.commentaire}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Panel caché pour l'impression du calendrier */}
              <div
                id="print-calendar-panel"
                className="hidden print:block print:w-full print:p-0 print:m-0"
              >
                {/* En-tête imprimé */}
                <div className="print:mb-4 print:pb-4 print:border-b-2 print:border-black print:text-center">
                  <div className="print:text-xs print:tracking-wide print:uppercase print:text-gray-700">
                    PRIVATISATION DU MOIS DE
                  </div>
                  <div className="print:text-2xl print:font-bold print:text-[#163667] print:m-0 print:tracking-tight">
                    {`${MONTHS[selectedCalendar.month]} ${selectedCalendar.year}`}
                  </div>
                </div>

                {/* Grille du calendrier pour impression */}
                <div className="grid grid-cols-7 gap-0.5 text-xs print:gap-0.5">
                  {/* En-têtes des jours */}
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <div
                      key={d}
                      className="font-bold text-center bg-[#163667] text-white p-2 print:bg-[#163667] print:text-white print:p-1.5 print:text-[8px]"
                    >
                      {d}
                    </div>
                  ))}

                  {/* Jours du calendrier */}
                  {calendarDays.map((week, wi) =>
                    week.map((day, di) => {
                      if (!day) {
                        return (
                          <div
                            key={`${wi}-${di}`}
                            className="bg-gray-100 border-l border-b border-gray-300 p-1 print:bg-gray-50 print:border print:border-gray-300 print:p-0.5 print:min-h-[60px]"
                          />
                        );
                      }
                      const dateStr = `${day.getFullYear()}-${String(
                        day.getMonth() + 1,
                      ).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                      const dayPrivs = filterPrivatisations(
                        (selectedCalendar.privatisations || []).filter(
                          (p) => p.date === dateStr,
                        ),
                      );

                      return (
                        <div
                          key={`${wi}-${di}`}
                          className="border-l border-b border-gray-300 p-1 print:border print:border-gray-300 print:p-1 print:text-[14px] print:min-h-[60px] bg-white print:bg-white overflow-hidden"
                        >
                          <div className="font-bold text-gray-700 print:text-gray-800 print:mb-1 print:text-[12px]">
                            {day.getDate()}
                          </div>
                          <div className="space-y-0.5 print:space-y-0.5">
                            {dayPrivs.map((priv) => {
                              const hostesses = Array.isArray(priv.hostesses)
                                ? priv.hostesses
                                : priv.hostess
                                  ? [priv.hostess]
                                  : [];
                              const isViolet = priv.color === 'violet';
                              const bgColor = isViolet
                                ? 'print:bg-purple-100'
                                : 'print:bg-blue-100';
                              const borderColor = isViolet
                                ? 'print:border-purple-500'
                                : 'print:border-blue-500';
                              const textColor = isViolet
                                ? 'print:text-purple-900'
                                : 'print:text-blue-900';

                              return (
                                <div
                                  key={priv.id}
                                  className={`text-[9px] print:text-[8px] bg-blue-50 print:text-blue-900 ${bgColor} ${textColor} p-0.5 print:p-1 rounded-sm print:rounded-sm border-l-2 print:border-l-2 border-blue-400 ${borderColor} print:leading-tight print-priv`}
                                >
                                  <div className="font-semibold">
                                    {priv.name}{' '}
                                    {priv.period === 'soir' && (
                                      <span className="text-red-600 print:text-red-600">
                                        (S)
                                      </span>
                                    )}
                                  </div>
                                  {priv.start && priv.end && (
                                    <div className="print:text-[8px]">
                                      {priv.start}-{priv.end}
                                    </div>
                                  )}
                                  {priv.people && (
                                    <div className="print:text-[8px]">
                                      {priv.people} pers
                                    </div>
                                  )}
                                  {hostesses.length > 0 && (
                                    <div className="print:text-[8px]">
                                      H: {hostesses.join(', ')}
                                    </div>
                                  )}
                                  {priv.prisePar && (
                                    <div className="print:text-[8px]">
                                      Par: {priv.prisePar}
                                    </div>
                                  )}
                                  {priv.commentaire && (
                                    <div className="print:text-[8px]">
                                      {priv.commentaire}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Modal création calendrier */}
        {isCreateCalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
              <h3 className="text-lg font-semibold text-[#163667] mb-4">Créer un Calendrier Privat</h3>
              <form onSubmit={handleCreateCalendar} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Mois</label>
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                  >
                    <option value="">Sélectionner</option>
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Année</label>
                  <input
                    type="number"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                  />
                </div>
              </form>
              <div className="flex justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setIsCreateCalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateCalendar}
                  className="px-4 py-2 rounded-lg bg-[#163667] text-white font-semibold hover:bg-[#0f2851] transition-colors"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ajout privatisation */}
        {isPrivModalOpen && selectedCalendar && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-[#163667] mb-4">{editingPriv ? 'Modifier la privatisation' : 'Ajouter une privatisation'}</h3>
              <form onSubmit={handleAddPrivatisation} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Nom de la privat</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privName}
                    onChange={(e) => setPrivName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Nombre de personnes</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privPeople}
                    onChange={(e) => setPrivPeople(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Nombre d'hôtesses LBE</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    min="0"
                    value={(() => {
                      const lbeEntry = privHostesses.find(h => /^\d+ LBE$/.test(h));
                      return lbeEntry ? parseInt(lbeEntry, 10) : '';
                    })()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const count = isNaN(val) ? 0 : val;
                      setPrivHostesses(prev => {
                        const others = prev.filter(h => !/^\d+ LBE$/.test(h));
                        return count > 0 ? [...others, `${count} LBE`] : others;
                      });
                    }}
                    placeholder="Ex: 5"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Hôtesses</label>
                  <div className="border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white max-h-24 overflow-auto space-y-1.5">
                    {hostessOptions.length === 0 && (
                      <div className="text-[11px] text-gray-400">Aucune hôtesse configurée.</div>
                    )}
                    {hostessOptions.map((name) => {
                      const checked = privHostesses.includes(name);
                      return (
                        <label key={name} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={checked}
                            onChange={() => {
                              setPrivHostesses(prev => (
                                prev.includes(name)
                                  ? prev.filter(h => h !== name)
                                  : [...prev, name]
                              ));
                            }}
                          />
                          <span className="text-xs">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Prise par</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privPrisePar}
                    onChange={(e) => setPrivPrisePar(e.target.value)}
                  >
                    <option value="">Sélectionner</option>
                    {priseParOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Heure début</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privStart}
                    onChange={(e) => setPrivStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Heure fin</label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privEnd}
                    onChange={(e) => setPrivEnd(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privDate}
                    min={`${selectedCalendar.year}-${String(selectedCalendar.month + 1).padStart(2, '0')}-01`}
                    max={`${selectedCalendar.year}-${String(selectedCalendar.month + 1).padStart(2, '0')}-${String(getDaysInMonth(selectedCalendar.month, selectedCalendar.year).length).padStart(2, '0')}`}
                    onChange={(e) => setPrivDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Couleur</label>
                  <div className="flex items-center gap-4 text-xs text-gray-700">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priv-color"
                        value="bleu"
                        checked={privColor === 'bleu'}
                        onChange={(e) => setPrivColor(e.target.value)}
                      />
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        Bleu
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priv-color"
                        value="violet"
                        checked={privColor === 'violet'}
                        onChange={(e) => setPrivColor(e.target.value)}
                      />
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-purple-500" />
                        Violet
                      </span>
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-700 mb-2 font-medium">Nombre d'hôtesses nécessaire</label>
                  <input
                    type="number"
                    min="0"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#163667]"
                    value={privComment}
                    onChange={(e) => setPrivComment(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2 text-sm pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsPrivModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="bg-[#163667] text-white text-sm font-semibold py-2 px-5 rounded-lg hover:bg-[#0f2851] transition-colors"
                  >
                    {editingPriv ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Bouton flottant pour ajouter une privat, comme le FAB de réservation */}
        {selectedCalendar && !isReadOnly && (
          <button
            id="fab-add"
            aria-label="Ajouter une privatisation"
            onClick={() => {
              setEditingPriv(null);
              setPrivHostesses([]);
              prevHostessCountRef.current = 0;
              setIsPrivModalOpen(true);
              setIsSettingsOpen(false);
            }}
          >
            +
          </button>
        )}

        {/* Modal Paramètres (hôtesses et prise par) */}
        {isSettingsOpen && !isReadOnly && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-40"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>Paramètres des calendriers</h3>
              {/* Onglets */}
              <div className="flex gap-1 border-b border-gray-200 mb-4">
                <button
                  onClick={() => setSettingsActiveTab('profil')}
                  className="px-4 py-2.5 font-medium text-sm border-b-2 transition-colors"
                  style={settingsActiveTab === 'profil' ? {
                    borderBottomColor: 'var(--color-primary)',
                    color: 'var(--color-primary)'
                  } : {
                    borderBottomColor: 'transparent',
                    color: '#4B5563'
                  }}
                >
                  Profil
                </button>
                <button
                  onClick={() => setSettingsActiveTab('staff')}
                  className="px-4 py-2.5 font-medium text-sm border-b-2 transition-colors"
                  style={settingsActiveTab === 'staff' ? {
                    borderBottomColor: 'var(--color-primary)',
                    color: 'var(--color-primary)'
                  } : {
                    borderBottomColor: 'transparent',
                    color: '#4B5563'
                  }}
                >
                  Hôtesses & Commercial
                </button>
              </div>

              {/* Onglet Profil */}
              {settingsActiveTab === 'profil' && (
                <div className="space-y-4 mb-4">
                  {selectedCalendar && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Titre du calendrier</h4>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                            value={settingsTitlePrefix}
                            onChange={(e) => setSettingsTitlePrefix(e.target.value)}
                            placeholder="Ex : Privatisation du mois de"
                          />
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {getCalendarSuffix(selectedCalendar)}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveTitlePrefix}
                            className="text-xs font-semibold py-1.5 px-3 rounded-lg"
                            style={{
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-text-on-primary)'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                          >
                            Enregistrer le titre
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logo personnalisé */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Logo personnalisé</h4>
                    <div className="flex flex-col gap-3">
                      {customLogo && (
                        <div className="flex items-center gap-3">
                          <img 
                            src={customLogo} 
                            alt="Logo preview" 
                            className="h-16 w-auto object-contain rounded border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-xs font-semibold py-1.5 px-3 rounded-lg"
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#FFFFFF'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#991b1b'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                          >
                            Supprimer le logo
                          </button>
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadLogo}
                          className="hidden"
                        />
                        <span className="text-xs font-semibold py-1.5 px-3 rounded-lg inline-block"
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text-on-primary)'
                          }}
                          onMouseEnter={(e) => e.style.backgroundColor = 'var(--color-primary-dark)'}
                          onMouseLeave={(e) => e.style.backgroundColor = 'var(--color-primary)'}
                        >
                          {customLogo ? 'Changer le logo' : 'Ajouter un logo'}
                        </span>
                      </label>
                      <p className="text-xs text-gray-500">Max 2MB • PNG, JPG, GIF</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Palette de couleurs</h4>
                    
                    {/* Grille de palettes modernes */}
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Thèmes Modernes</p>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PALETTES.filter(p => p.category === 'Moderne').map(palette => (
                          <button
                            key={palette.id}
                            onClick={() => handleSaveTheme(palette.id)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-1 hover:shadow-md ${
                              selectedTheme === palette.id 
                                ? 'border-gray-900 shadow-lg' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            style={selectedTheme === palette.id ? { 
                              boxShadow: `0 0 0 2px var(--color-primary)`
                            } : {}}
                            title={palette.name}
                          >
                            <div 
                              className="w-12 h-12 rounded-md border border-gray-300 shadow-sm"
                              style={{ backgroundColor: palette.primary }}
                            />
                            <span className="text-xs font-semibold text-gray-700 text-center leading-tight line-clamp-2">
                              {palette.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Onglet Hôtesses & Commercial */}
              {settingsActiveTab === 'staff' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Noms des hôtesses</h4>
                    <form onSubmit={handleAddHostess} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={newHostess}
                        onChange={(e) => setNewHostess(e.target.value)}
                        placeholder="Ajouter un nom d'hôtesse"
                      />
                      <button
                        type="submit"
                        className="text-xs font-semibold py-2 px-3 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-on-primary)'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                      >
                        Ajouter
                      </button>
                    </form>
                    <div className="flex flex-wrap gap-1">
                      {hostessOptions.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs border border-gray-200"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => handleDeleteHostess(name)}
                            className="text-red-500 hover:text-red-700 font-bold px-1"
                            title="Supprimer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {hostessOptions.length === 0 && (
                        <span className="text-xs text-gray-400">Aucune hôtesse définie pour le moment.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Prise par</h4>
                    <form onSubmit={handleAddPrisePar} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={newPrisePar}
                        onChange={(e) => setNewPrisePar(e.target.value)}
                        placeholder="Ajouter un nom (prise par)"
                      />
                      <button
                        type="submit"
                        className="text-xs font-semibold py-2 px-3 rounded-lg"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-on-primary)'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                      >
                        Ajouter
                      </button>
                    </form>
                    <div className="flex flex-wrap gap-1">
                      {priseParOptions.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs border border-gray-200"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => handleDeletePrisePar(name)}
                            className="text-red-500 hover:text-red-700 font-bold px-1"
                            title="Supprimer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {priseParOptions.length === 0 && (
                        <span className="text-xs text-gray-400">Aucune option prise par pour le moment.</span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 mt-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Contacts de notification</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-xs">
                    <div className="md:col-span-1">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
                        value={newNotifName}
                        onChange={(e) => setNewNotifName(e.target.value)}
                        placeholder="Nom (ex : Emeni)"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <input
                        type="email"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
                        value={newNotifEmail}
                        onChange={(e) => setNewNotifEmail(e.target.value)}
                        placeholder="Email (optionnel)"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white"
                        value={newNotifPhone}
                        onChange={(e) => setNewNotifPhone(e.target.value)}
                        placeholder="Téléphone WhatsApp (format international)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mb-3">
                    <button
                      type="button"
                      onClick={handleAddNotifContact}
                      className="bg-[#163667] text-white text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-opacity-90"
                    >
                      Ajouter le contact
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-auto text-xs">
                    {notifContacts.length === 0 && (
                      <span className="text-xs text-gray-400">Aucun contact configuré pour les notifications.</span>
                    )}
                    {notifContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-gray-50 border border-gray-200"
                      >
                        <div className="flex-1 mr-2">
                          <div className="font-semibold text-gray-700 truncate">{c.name}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {c.email && <span>Email : {c.email}</span>}
                            {c.email && c.phone && <span> · </span>}
                            {c.phone && <span>WhatsApp : {c.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-[#163667] hover:underline"
                            onClick={() => {
                              setEditingNotifId(c.id);
                              setNewNotifName(c.name || '');
                              setNewNotifEmail(c.email || '');
                              setNewNotifPhone(c.phone || '');
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveNotifContact(c.id)}
                            className="text-[11px] text-red-600 hover:text-red-800"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                  </div>
              )}

              <div className="flex justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}


      </main>
    </div>
  );
};

export default HotesseTables;
