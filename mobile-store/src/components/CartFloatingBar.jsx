import React from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { formatCOP } from '../utils/currency';
import styles from './CartFloatingBar.module.css';

export default function CartFloatingBar({
  cartItems = [],
  onOpenCheckout
}) {
  if (!cartItems || cartItems.length === 0) return null;

  const totalItems = cartItems.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
  const totalPrice = cartItems.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);

  const handleClick = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
    onOpenCheckout();
  };

  return (
    <div className={styles.barContainer}>
      <button
        onClick={handleClick}
        className={styles.floatingBtn}
        aria-label={`Ver pedido con ${totalItems} productos por ${formatCOP(totalPrice)}`}
      >
        {/* Izquierda: Icono + Contador */}
        <div className={styles.leftGroup}>
          <div className={styles.bagWrapper}>
            <ShoppingBag size={20} className={styles.bagIcon} />
            <span className={styles.itemBadge}>{totalItems}</span>
          </div>
          <span className={styles.viewOrderText}>Ver mi pedido</span>
        </div>

        {/* Derecha: Total en COP + Flecha */}
        <div className={styles.rightGroup}>
          <span className={styles.totalAmount}>{formatCOP(totalPrice)}</span>
          <div className={styles.chevronWrapper}>
            <ChevronRight size={18} />
          </div>
        </div>
      </button>
    </div>
  );
}
