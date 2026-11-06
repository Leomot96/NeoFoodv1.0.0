import React, { useRef, useEffect } from 'react';
import { Flame, UtensilsCrossed, Pizza, Coffee, Beer, Sparkles } from 'lucide-react';
import styles from './CategoryNav.module.css';

const getCategoryIcon = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('hamburguesa') || lower.includes('burger')) return '🍔';
  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('bebida') || lower.includes('jugo') || lower.includes('gaseosa')) return '🥤';
  if (lower.includes('cerveza') || lower.includes('licor') || lower.includes('bar')) return '🍺';
  if (lower.includes('postre') || lower.includes('helado') || lower.includes('dulce')) return '🍰';
  if (lower.includes('adicion') || lower.includes('salsa') || lower.includes('extra')) return '🍟';
  if (lower.includes('pollo') || lower.includes('alita')) return '🍗';
  if (lower.includes('carne') || lower.includes('asado') || lower.includes('parrilla')) return '🥩';
  if (lower.includes('combo') || lower.includes('especial')) return '⭐';
  return '🍽️';
};

export default function CategoryNav({
  categories = [],
  activeCategory,
  onSelectCategory
}) {
  const containerRef = useRef(null);

  // Auto-scroll para centrar el chip seleccionado
  useEffect(() => {
    if (!containerRef.current) return;
    const activeBtn = containerRef.current.querySelector(`.${styles.chipActive}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeCategory]);

  return (
    <nav className={styles.stickyNav} aria-label="Categorías del menú">
      <div className={styles.scrollWrapper} ref={containerRef}>
        {/* Chip 'Todos' */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`${styles.chip} ${activeCategory === 'all' ? styles.chipActive : ''}`}
        >
          <span className={styles.chipIcon}>🔥</span>
          <span className={styles.chipLabel}>Todos</span>
        </button>

        {/* Chips de Categorías dinámicas */}
        {categories.map((cat) => {
          const isActive = activeCategory === String(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(String(cat.id))}
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
            >
              <span className={styles.chipIcon}>{getCategoryIcon(cat.name)}</span>
              <span className={styles.chipLabel}>{cat.name}</span>
              {cat.products?.length > 0 && (
                <span className={styles.chipBadge}>{cat.products.length}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
