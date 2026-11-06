import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import {
  applyBrandPalette,
  applyDocumentBranding,
  DEFAULT_BRAND_CONFIG,
  loadCachedBrandingInfo,
  saveCachedBrandingInfo,
  loadCachedBrandPalette
} from '../config/brandConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [publicBrand, setPublicBrand] = useState(() => loadCachedBrandingInfo());
  const [loading, setLoading] = useState(true);

  const syncBrandEverything = (brandSource) => {
    if (!brandSource) return;
    const palette = loadCachedBrandPalette();
    let primary = brandSource.primaryColor || palette.primaryColor || DEFAULT_BRAND_CONFIG.primaryColor;
    let secondary = brandSource.secondaryColor || palette.secondaryColor || DEFAULT_BRAND_CONFIG.secondaryColor;

    if (['#ea580c', '#dc2626', '#f97316', '#ef4444', '#f59e0b'].includes(String(primary).toLowerCase())) {
      primary = '#4f46e5';
      secondary = '#10b981';
    }

    applyBrandPalette(primary, secondary, true);
    applyDocumentBranding({
      name: brandSource.name || DEFAULT_BRAND_CONFIG.brandName,
      logoUrl: brandSource.logoUrl,
      primaryColor: primary,
      secondaryColor: secondary
    });
    saveCachedBrandingInfo({
      id: brandSource.id,
      name: brandSource.name || DEFAULT_BRAND_CONFIG.brandName,
      slug: brandSource.slug || DEFAULT_BRAND_CONFIG.brandSlug,
      logoUrl: brandSource.logoUrl,
      phone: brandSource.phone,
      whatsappNumber: brandSource.whatsappNumber,
      address: brandSource.address,
      document: brandSource.document,
      description: brandSource.description,
      primaryColor: primary,
      secondaryColor: secondary,
      themePreset: 'landing'
    });
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Aplicar inmediatamente caché local si existe
    const cached = loadCachedBrandingInfo();
    if (cached) {
      syncBrandEverything(cached);
    }

    // 2. Consultar branding público del restaurante (funciona incluso sin sesión en /login)
    const fetchPublicBranding = async () => {
      try {
        const res = await api.get('/auth/branding');
        const brandData = res.data?.data;
        if (isMounted && brandData) {
          setPublicBrand(brandData);
          syncBrandEverything(brandData);
        }
      } catch {
        // Silencioso si el backend aún está iniciando
      }
    };

    // 3. Verificar sesión autenticada si hay token
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          const userData = response.data?.data?.user || response.data?.data;
          if (isMounted && userData) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            const rest = userData.restaurant || userData.tenant;
            if (rest) {
              setPublicBrand((prev) => ({ ...(prev || {}), ...rest }));
              syncBrandEverything(rest);
            }
          }
        } catch (error) {
          console.error('Token inválido o expirado');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          if (isMounted) setUser(null);
        }
      }
      if (isMounted) setLoading(false);
    };

    fetchPublicBranding();
    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: loggedUser, accessToken, refreshToken } = response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      setUser(loggedUser);

      const rest = loggedUser?.restaurant || loggedUser?.tenant;
      if (rest) {
        setPublicBrand((prev) => ({ ...(prev || {}), ...rest }));
        syncBrandEverything(rest);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión'
      };
    }
  };

  const updateRestaurantState = (updatedFields) => {
    if (!updatedFields || typeof updatedFields !== 'object') return;

    setPublicBrand((prev) => {
      const nextBrand = { ...(prev || {}), ...updatedFields };
      syncBrandEverything(nextBrand);
      return nextBrand;
    });

    setUser((prev) => {
      if (!prev) return prev;
      const mergedRestaurant = { ...(prev.restaurant || prev.tenant || publicBrand || {}), ...updatedFields };
      const next = { ...prev, restaurant: mergedRestaurant, tenant: mergedRestaurant };
      localStorage.setItem('user', JSON.stringify(next));
      syncBrandEverything(mergedRestaurant);
      return next;
    });
  };

  const logout = async () => {
    try {
      if (localStorage.getItem('accessToken')) {
        await api.post('/auth/logout');
      }
    } catch {
      // Continuar con limpieza local aunque falle la red
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const activeRestaurant = {
    name: DEFAULT_BRAND_CONFIG.brandName,
    slug: DEFAULT_BRAND_CONFIG.brandSlug,
    ...(publicBrand || {}),
    ...(user?.restaurant || user?.tenant || {})
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant: activeRestaurant,
        tenant: activeRestaurant,
        login,
        logout,
        loading,
        updateRestaurantState
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
