import React from 'react';
import { Search, X, Utensils, Settings } from 'lucide-react';
import { getFullImageUrl } from '../utils/imageUrl';
import styles from './Header.module.css';

export default function Header({
  restaurant,
  scheduleStatus,
  searchTerm,
  setSearchTerm,
  onOpenConfig
}) {
  const restaurantName = restaurant?.name || 'Mi Restaurante';
  const logoUrl = restaurant?.logoUrl ? getFullImageUrl(restaurant.logoUrl) : null;
  const initials = restaurantName.slice(0, 2).toUpperCase();

  return (
    <header className={styles.headerContainer}>
      {/* Fila Superior: Logo + Nombre + Estado + Botón Configuración */}
      <div className={styles.topRow}>
        <div className={styles.brandBox}>
          <div className={styles.logoWrapper}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={restaurantName}
                className={styles.logoImg}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={styles.logoFallback}
              style={{ display: logoUrl ? 'none' : 'flex' }}
            >
              {initials}
            </div>
          </div>
          <div className={styles.infoBox}>
            <h1 className={styles.restaurantTitle}>{restaurantName}</h1>
            <div className={styles.statusRow}>
              <span
                className={`${styles.statusDot} ${
                  scheduleStatus?.isOpen ? styles.dotOpen : styles.dotClosed
                }`}
              />
              <span className={styles.statusText}>
                {scheduleStatus?.badgeText || 'Servicio activo'}
              </span>
              {scheduleStatus?.detailText && (
                <span className={styles.statusDetail}>
                  • {scheduleStatus.detailText}
                </span>
              )}
            </div>
          </div>
        </div>

        {onOpenConfig && (
          <button
            onClick={onOpenConfig}
            className={styles.configBtn}
            title="Configurar servidor"
            aria-label="Configurar conexión con el servidor"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Barra de Búsqueda Prominente */}
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar hamburguesas, pizzas, bebidas..."
            className={styles.searchInput}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className={styles.clearBtn}
              aria-label="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
