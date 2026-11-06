import { getFullImageUrl } from '../utils/imageUrl';

/**
 * Configuración Centralizada de Marca, Paletas de Color y Enrutamiento por Dominio
 * Permite configurar un nuevo restaurante vía variables de entorno (.env) o desde el Panel de Configuración.
 */

export const THEME_PRESETS = [
  {
    id: 'landing',
    name: 'NeoFood Original (Landing)',
    desc: 'Índigo Ejecutivo & Verde Esmeralda (Estilo Oficial Landing)',
    primaryColor: '#4f46e5',
    secondaryColor: '#10b981'
  },
  {
    id: 'fuego',
    name: 'Parrilla & Fuego',
    desc: 'Asaderos, Hamburguesas Artesanales & Carnes',
    primaryColor: '#4f46e5',
    secondaryColor: '#f59e0b'
  },
  {
    id: 'rojo',
    name: 'Rojo Pizzería & Burger',
    desc: 'Pizzerías, Comida Rápida & Pollo Broaster',
    primaryColor: '#dc2626',
    secondaryColor: '#f97316'
  },
  {
    id: 'dorado',
    name: 'Dorado Gourmet & Lounge',
    desc: 'Alta Cocina, Gastropubs, Cervecerías & Cafés',
    primaryColor: '#d97706',
    secondaryColor: '#fbbf24'
  },
  {
    id: 'esmeralda',
    name: 'Verde Orgánico & Gastrobar',
    desc: 'Comida Saludable, Mexicana, Bowls & Terraza',
    primaryColor: '#059669',
    secondaryColor: '#10b981'
  },
  {
    id: 'oceano',
    name: 'Azul Marisquería & Pacífico',
    desc: 'Cevicherías, Sushi, Mariscos & Heladerías',
    primaryColor: '#2563eb',
    secondaryColor: '#06b6d4'
  },
  {
    id: 'purpura',
    name: 'Púrpura Nocturno & Bar',
    desc: 'Coctelerías, Rooftops, Alitas & Discotecas',
    primaryColor: '#7c3aed',
    secondaryColor: '#ec4899'
  }
];

export const DEFAULT_BRAND_CONFIG = {
  brandName: import.meta.env.VITE_BRAND_NAME || 'NeoFood',
  brandSlug: import.meta.env.VITE_BRAND_SLUG || 'neofood',
  primaryColor: import.meta.env.VITE_BRAND_PRIMARY || '#4f46e5',
  secondaryColor: import.meta.env.VITE_BRAND_SECONDARY || '#10b981',
  themePreset: import.meta.env.VITE_BRAND_THEME_PRESET || 'landing',
  appMode: import.meta.env.VITE_APP_MODE || 'auto', // 'auto' | 'store' | 'panel' | 'landing'
  panelSubdomainPrefix: import.meta.env.VITE_PANEL_SUBDOMAIN_PREFIX || 'panel'
};

const STORAGE_KEY = 'neofood_brand_theme_v1';
const BRANDING_INFO_KEY = 'neofood_restaurant_branding_v1';

const hexToRgb = (hex) => {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return { r: 79, g: 70, b: 229 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
};

const darkenHex = (hex, factor = 0.82) => {
  const { r, g, b } = hexToRgb(hex);
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n * factor))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Extrae las iniciales o nombre corto del restaurante para el Favicon SVG
 */
export const getRestaurantInitials = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return 'MR';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

/**
 * Genera un Favicon SVG dinámico con el nombre/iniciales y colores del restaurante
 */
export const generateBrandFaviconDataUri = (name, primaryColor, secondaryColor) => {
  const primary = /^#[0-9A-Fa-f]{6}$/.test(String(primaryColor || '').trim())
    ? String(primaryColor).trim()
    : DEFAULT_BRAND_CONFIG.primaryColor;
  const secondary = /^#[0-9A-Fa-f]{6}$/.test(String(secondaryColor || '').trim())
    ? String(secondaryColor).trim()
    : DEFAULT_BRAND_CONFIG.secondaryColor;
  const initials = getRestaurantInitials(name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}" />
        <stop offset="100%" stop-color="${secondary}" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#g)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" letter-spacing="-1">${initials}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Actualiza dinámicamente el <title> de la pestaña superior y el Favicon del navegador
 * (No altera la Landing Page comercial de NeoFood)
 */
export const applyDocumentBranding = ({ name, logoUrl, primaryColor, secondaryColor, suffix = '' } = {}) => {
  if (typeof document === 'undefined') return;
  if (typeof window !== 'undefined') {
    const p = window.location.pathname.toLowerCase();
    if (p === '/' || p === '/landing' || p.startsWith('/landing')) {
      document.title = 'NeoFOOD | POS & CRM Gastronómico';
      let iconLink = document.querySelector("link[rel~='icon']");
      if (iconLink) {
        iconLink.type = 'image/svg+xml';
        iconLink.href = '/isotipo.svg';
      }
      return;
    }
  }

  const cleanName = String(name || '').trim() || DEFAULT_BRAND_CONFIG.brandName;
  document.title = suffix ? `${cleanName} — ${suffix}` : cleanName;

  const resolvedLogo = logoUrl ? getFullImageUrl(logoUrl) : null;
  const faviconHref = resolvedLogo || generateBrandFaviconDataUri(cleanName, primaryColor, secondaryColor);

  let iconLink = document.querySelector("link[rel~='icon']");
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.appendChild(iconLink);
  }
  iconLink.type = resolvedLogo ? 'image/png' : 'image/svg+xml';
  iconLink.href = faviconHref;
};

/**
 * Inyecta dinámicamente las variables CSS globales del restaurante (incluyendo todos los estados :hover, focus y bordes)
 * sin afectar la Landing Page comercial.
 */
export const applyBrandPalette = (primaryColor, secondaryColor, persist = true) => {
  if (typeof document === 'undefined') return;

  let primary = /^#[0-9A-Fa-f]{6}$/.test(String(primaryColor || '').trim())
    ? String(primaryColor).trim().toLowerCase()
    : DEFAULT_BRAND_CONFIG.primaryColor;

  let secondary = /^#[0-9A-Fa-f]{6}$/.test(String(secondaryColor || '').trim())
    ? String(secondaryColor).trim().toLowerCase()
    : DEFAULT_BRAND_CONFIG.secondaryColor;

  // Purga y normalización inmediata: El sistema siempre adopta por defecto los colores de la Landing
  if (['#ea580c', '#dc2626', '#f97316', '#ef4444', '#f59e0b'].includes(primary)) {
    primary = '#4f46e5';
    secondary = '#10b981';
  }

  const hover = darkenHex(primary, 0.82);
  const { r, g, b } = hexToRgb(primary);
  const { r: r2, g: g2, b: b2 } = hexToRgb(secondary);

  const glow = `rgba(${r}, ${g}, ${b}, 0.28)`;
  const hoverBg = `rgba(${r}, ${g}, ${b}, 0.12)`;
  const subtleBg = `rgba(${r}, ${g}, ${b}, 0.16)`;
  const borderSubtle = `rgba(${r}, ${g}, ${b}, 0.40)`;
  const secondaryGlow = `rgba(${r2}, ${g2}, ${b2}, 0.16)`;
  const gradient = `linear-gradient(135deg, ${primary} 0%, #3b82f6 50%, ${secondary} 100%)`;
  const gradientHover = `linear-gradient(135deg, ${hover} 0%, #2563eb 50%, ${primary} 100%)`;

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-primary-hover', hover);
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-gradient', gradient);
  root.style.setProperty('--brand-gradient-hover', gradientHover);
  root.style.setProperty('--brand-glow', glow);
  root.style.setProperty('--brand-hover-bg', hoverBg);
  root.style.setProperty('--brand-subtle-bg', subtleBg);
  root.style.setProperty('--brand-border-subtle', borderSubtle);
  root.style.setProperty('--brand-secondary-glow', secondaryGlow);

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', hover);
  root.style.setProperty('--primary-light', subtleBg);
  root.style.setProperty('--primary-light-text', secondary);
  root.style.setProperty('--primary-shadow', glow);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--border-focus', primary);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor: primary, secondaryColor: secondary }));
    } catch {}
  }
};

export const loadCachedBrandPalette = () => {
  // Ecosistema completamente unificado y bloqueado con la identidad oficial de la Landing
  return {
    primaryColor: '#4f46e5',
    secondaryColor: '#10b981'
  };
};

export const saveCachedBrandingInfo = (info) => {
  if (!info || typeof info !== 'object') return;
  try {
    const current = loadCachedBrandingInfo();
    const merged = { ...current, ...info };
    localStorage.setItem(BRANDING_INFO_KEY, JSON.stringify(merged));
  } catch {}
};

export const loadCachedBrandingInfo = () => {
  try {
    const raw = localStorage.getItem(BRANDING_INFO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (['#ea580c', '#dc2626', '#f97316', '#ef4444'].includes(String(parsed.primaryColor).toLowerCase())) {
          parsed.primaryColor = '#4f46e5';
          parsed.secondaryColor = '#10b981';
          try {
            localStorage.setItem(BRANDING_INFO_KEY, JSON.stringify(parsed));
          } catch {}
        }
        return parsed;
      }
    }
  } catch {}
  return null;
};

// Auto-limpieza en carga de script
if (typeof window !== 'undefined') {
  try {
    const themeRaw = localStorage.getItem(STORAGE_KEY);
    if (themeRaw) {
      const parsed = JSON.parse(themeRaw);
      if (['#ea580c', '#dc2626', '#f97316', '#ef4444'].includes(String(parsed?.primaryColor).toLowerCase())) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor: '#4f46e5', secondaryColor: '#10b981' }));
      }
    }
  } catch {}
}

/**
 * Detecta automáticamente qué debe mostrar la ruta raíz "/" según el dominio o subdominio:
 * - Si entra por "panel.restaurante.com" (o admin. / pos. o VITE_APP_MODE=panel) -> 'panel' (Login / Dashboard)
 * - Si entra por el dominio propio del restaurante "restaurante.com" (o VITE_APP_MODE=store) -> 'store' (Tienda Virtual directa)
 * - Si entra por localhost o el dominio comercial de NeoFood -> 'default' (Landing Page comercial / Dashboard)
 */
export const detectHostRouteMode = () => {
  const envMode = String(DEFAULT_BRAND_CONFIG.appMode || 'auto').toLowerCase();
  if (envMode === 'store' || envMode === 'panel' || envMode === 'landing') {
    return envMode;
  }

  if (typeof window === 'undefined') return 'default';

  const hostname = (window.location.hostname || '').toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const queryMode = params.get('mode');
  if (queryMode === 'store' || queryMode === 'panel') return queryMode;

  const panelPrefix = `${DEFAULT_BRAND_CONFIG.panelSubdomainPrefix}.`;
  if (
    hostname.startsWith(panelPrefix) ||
    hostname.startsWith('panel.') ||
    hostname.startsWith('admin.') ||
    hostname.startsWith('pos.')
  ) {
    return 'panel';
  }

  const isLocalOrNeoFood =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.includes('neofood');

  if (!isLocalOrNeoFood && hostname.includes('.')) {
    return 'store';
  }

  return 'default';
};
