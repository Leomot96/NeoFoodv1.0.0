import React from 'react';
import { Sparkles, Plus, Star } from 'lucide-react';
import { getFullImageUrl } from '../utils/imageUrl';
import { formatCOP } from '../utils/currency';
import styles from './FeaturedCarousel.module.css';

export default function FeaturedCarousel({ products = [], onSelectProduct }) {
  if (!products || products.length === 0) return null;

  return (
    <section className={styles.sectionContainer}>
      <div className={styles.sectionHeader}>
        <div className={styles.titleGroup}>
          <Sparkles size={16} className={styles.starIcon} />
          <h2 className={styles.sectionTitle}>Destacados del Chef</h2>
        </div>
        <span className={styles.sectionBadge}>Recomendados</span>
      </div>

      <div className={styles.carouselWrapper}>
        {products.map((product) => {
          const hasImage = Boolean(product.imageUrl);
          const imgUrl = hasImage ? getFullImageUrl(product.imageUrl) : null;
          const hasOptions = (product.modifiers?.length > 0) || (product.additions?.length > 0);

          return (
            <div
              key={product.id}
              className={styles.card}
              onClick={() => onSelectProduct(product)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.imageBox}>
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={product.name}
                    className={styles.cardImg}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.imgPlaceholder}>
                    <span>🍔</span>
                  </div>
                )}
                <span className={styles.priceTag}>
                  {formatCOP(product.price)}
                </span>
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.productName}>{product.name}</h3>
                {product.description && (
                  <p className={styles.productDesc}>{product.description}</p>
                )}

                <div className={styles.cardFooter}>
                  {hasOptions && (
                    <span className={styles.optionsBadge}>Personalizable</span>
                  )}
                  <button
                    className={styles.addBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProduct(product);
                    }}
                    aria-label={`Pedir ${product.name}`}
                  >
                    <Plus size={16} />
                    <span>Pedir</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
