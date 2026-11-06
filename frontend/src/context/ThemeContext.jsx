import React, { createContext, useEffect, useState, useContext, useCallback } from 'react';
import { applyBrandPalette, loadCachedBrandPalette, DEFAULT_BRAND_CONFIG } from '../config/brandConfig';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [brandTheme, setBrandTheme] = useState(() => loadCachedBrandPalette());

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    applyBrandPalette(brandTheme.primaryColor, brandTheme.secondaryColor, false);
  }, []);

  const updateBrandTheme = useCallback((primaryColor, secondaryColor, persist = true) => {
    const nextPrimary = primaryColor || DEFAULT_BRAND_CONFIG.primaryColor;
    const nextSecondary = secondaryColor || DEFAULT_BRAND_CONFIG.secondaryColor;
    setBrandTheme({ primaryColor: nextPrimary, secondaryColor: nextSecondary });
    applyBrandPalette(nextPrimary, nextSecondary, persist);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode: true,
        toggleTheme: () => {},
        brandTheme,
        updateBrandTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
