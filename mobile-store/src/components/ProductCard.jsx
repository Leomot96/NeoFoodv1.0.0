import React from 'react';
import { Plus } from 'lucide-react';
import { getFullImageUrl } from '../utils/imageUrl';
import { formatCOP } from '../utils/currency';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onSelect }) {
  if (!product) return null;

  const hasImage = Boolean(product.imageUrl);
  const imgUrl = hasImage ? getFullImageUrl(product.imageUrl) : null;
  const hasOptions = (product.modifiers?.length > 0) || (product.additions?.length > 0);

  return (
    <div
      className={styles.cardHorizontal}
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
    >
      {/* Columna Izquierda: Información de Texto & Precio */}
      <div className={styles.infoCol}>
        <h3 className={styles.name}>{product.name}</h3>
        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}

        <div className={styles.bottomMeta}>
          <span className={styles.price}>{formatCOP(product.price)}</span>
          {hasOptions && (
            <span className={styles.badgeCustom}>Personalizable</span>
          )}
        </div>
      </div>

      {/* Columna Derecha: Foto Cuadrada con Botón '+' Flotante */}
      <div className={styles.imageCol}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            className={styles.productThumb}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbPlaceholder}>
            <span>🍽️</span>
          </div>
        )}

        <button
          className={styles.plusFloatingBtn}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(product);
          }}
          aria-label={`Agregar ${product.name}`}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
