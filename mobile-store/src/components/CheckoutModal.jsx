import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Bike,
  ShoppingBag,
  Utensils,
  CreditCard,
  Banknote,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { storeService } from '../services/api';
import { formatCOP } from '../utils/currency';
import styles from './CheckoutModal.module.css';

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  restaurant,
  paymentMethods = []
}) {
  if (!isOpen) return null;

  // Estado del Formulario
  const [orderType, setOrderType] = useState('DELIVERY'); // 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.name || 'Efectivo');
  const [cashAmount, setCashAmount] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Estados de proceso
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Totales
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
  }, [cartItems]);

  const deliveryCost = orderType === 'DELIVERY' ? (Number(restaurant?.deliveryCost) || 0) : 0;
  const grandTotal = subtotal + deliveryCost;

  // Manejador para enviar el pedido
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validaciones mínimas
    if (!customerName.trim()) {
      setErrorMsg('Por favor escribe tu nombre.');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      setErrorMsg('Por favor ingresa un número de teléfono válido.');
      return;
    }

    if (orderType === 'DELIVERY' && !deliveryAddress.trim()) {
      setErrorMsg('La dirección de entrega es obligatoria para domicilios.');
      return;
    }

    if (orderType === 'DINE_IN' && !tableNumber.trim()) {
      setErrorMsg('Por favor indica tu número de mesa.');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('Tu pedido está vacío.');
      return;
    }

    // Preparar payload para el backend
    const resolvedAddress = orderType === 'DELIVERY'
      ? deliveryAddress.trim()
      : (orderType === 'DINE_IN' ? `Mesa ${tableNumber.trim()}` : 'Para llevar en el local');

    let combinedNotes = orderNotes.trim();
    if (orderType === 'DINE_IN') {
      combinedNotes = `[MESA #${tableNumber.trim()}] ${combinedNotes}`.trim();
    }
    if (paymentMethod.toLowerCase().includes('efectivo') && cashAmount.trim()) {
      combinedNotes = `${combinedNotes} (Paga con: $${cashAmount.trim()})`.trim();
    }

    const payload = {
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: '',
      deliveryAddress: resolvedAddress,
      deliveryNeighborhood: deliveryNeighborhood.trim(),
      paymentMethodName: paymentMethod,
      orderType: orderType === 'TAKEAWAY' || orderType === 'DINE_IN' ? 'TAKEAWAY' : 'DELIVERY',
      notes: combinedNotes,
      items: cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        modifiers: (item.modifiers || []).map(m => ({ optionId: m.optionId })),
        additions: (item.additions || []).map(a => ({ additionId: a.additionId, quantity: 1 })),
        notes: item.specialInstructions || ''
      }))
    };

    try {
      setIsSubmitting(true);
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {}

      const res = await storeService.createPublicOrder('default', payload);
      const createdData = res?.data || res;
      setConfirmedOrder(createdData);

      // Limpiar carrito local
      onClearCart();

      // Construir y disparar enlace de WhatsApp
      const restPhone = (restaurant?.whatsappNumber || restaurant?.whatsapp || restaurant?.phone || '').replace(/\D/g, '');
      const orderNum = createdData?.orderNumber || 'Pendiente';

      let msg = `*NUEVO PEDIDO #${orderNum}* 🍽️\n\n`;
      msg += `👤 *Cliente:* ${customerName.trim()}\n`;
      msg += `📱 *Teléfono:* ${cleanPhone}\n`;
      msg += `📍 *Modalidad:* ${
        orderType === 'DELIVERY'
          ? `Domicilio (${resolvedAddress}${deliveryNeighborhood ? ', ' + deliveryNeighborhood : ''})`
          : (orderType === 'DINE_IN' ? `En Mesa #${tableNumber}` : 'Para Llevar')
      }\n`;
      msg += `💳 *Pago:* ${paymentMethod}${cashAmount ? ` (Paga con: $${cashAmount})` : ''}\n\n`;
      msg += `📝 *DETALLE DEL PEDIDO:*\n`;

      cartItems.forEach(item => {
        msg += `• ${item.quantity}x ${item.name} - ${formatCOP(item.totalPrice)}\n`;
        if (item.modifiers && item.modifiers.length > 0) {
          msg += `   Opciones: ${item.modifiers.map(m => m.optionName).join(', ')}\n`;
        }
        if (item.additions && item.additions.length > 0) {
          msg += `   Adiciones: ${item.additions.map(a => a.name).join(', ')}\n`;
        }
        if (item.specialInstructions) {
          msg += `   Nota: _${item.specialInstructions}_\n`;
        }
      });

      if (deliveryCost > 0) {
        msg += `\n🛵 *Costo Domicilio:* ${formatCOP(deliveryCost)}`;
      }
      msg += `\n💰 *TOTAL A PAGAR:* ${formatCOP(grandTotal)}\n`;

      if (combinedNotes) {
        msg += `\n💬 *Notas:* ${combinedNotes}\n`;
      }

      msg += `\n_Pedido realizado desde la App Móvil NeoFood_`;

      const encodedMsg = encodeURIComponent(msg);
      const waUrl = restPhone
        ? `https://wa.me/57${restPhone.startsWith('57') ? restPhone.slice(2) : restPhone}?text=${encodedMsg}`
        : `https://api.whatsapp.com/send?text=${encodedMsg}`;

      // Abrir WhatsApp automáticamente
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 350);

    } catch (err) {
      console.error('Error al registrar pedido:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'No pudimos registrar tu pedido. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        {/* Encabezado */}
        <div className={styles.header}>
          <div className={styles.titleBox}>
            <ShoppingBag size={20} className={styles.headerIcon} />
            <h2 className={styles.title}>
              {confirmedOrder ? '¡Pedido Confirmado!' : 'Revisar mi Pedido'}
            </h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Cerrar pedido">
            <X size={18} />
          </button>
        </div>

        {/* Pantalla de Éxito / Confirmación */}
        {confirmedOrder ? (
          <div className={styles.successView}>
            <div className={styles.successIconWrapper}>
              <CheckCircle2 size={54} className={styles.successIcon} />
            </div>
            <h3 className={styles.successHeading}>¡Tu pedido fue recibido!</h3>
            <p className={styles.successText}>
              Ya está en la cocina del restaurante. Hemos abierto WhatsApp con el resumen de tu orden <strong>#{confirmedOrder.orderNumber || ''}</strong> para confirmación inmediata.
            </p>

            <button
              onClick={onClose}
              className={styles.backToMenuBtn}
            >
              Volver al Menú
            </button>
          </div>
        ) : (
          /* Formulario de Checkout */
          <form onSubmit={handleConfirmOrder} className={styles.contentBody}>
            {errorMsg && (
              <div className={styles.errorAlert}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Lista de Ítems */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>Platos seleccionados ({cartItems.length})</h3>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    className={styles.clearAllBtn}
                  >
                    Vaciar
                  </button>
                )}
              </div>

              <div className={styles.cartList}>
                {cartItems.map((item, idx) => (
                  <div key={idx} className={styles.cartItemRow}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>
                        <strong>{item.quantity}x</strong> {item.name}
                      </span>
                      {item.modifiers?.length > 0 && (
                        <span className={styles.itemSubDetail}>
                          {item.modifiers.map(m => m.optionName).join(', ')}
                        </span>
                      )}
                      {item.additions?.length > 0 && (
                        <span className={styles.itemSubDetail}>
                          +{item.additions.map(a => a.name).join(', ')}
                        </span>
                      )}
                      {item.specialInstructions && (
                        <span className={styles.itemNote}>
                          "{item.specialInstructions}"
                        </span>
                      )}
                      <span className={styles.itemPrice}>
                        {formatCOP(item.totalPrice)}
                      </span>
                    </div>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, item.quantity - 1)}
                        className={styles.miniQtyBtn}
                        aria-label="Disminuir"
                      >
                        <Minus size={14} />
                      </button>
                      <span className={styles.miniQtyText}>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                        className={styles.miniQtyBtn}
                        aria-label="Aumentar"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        className={styles.deleteBtn}
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Tipo de Pedido (Pestañas) */}
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>¿Cómo deseas recibirlo?</h3>
              <div className={styles.orderTypeTabs}>
                <button
                  type="button"
                  onClick={() => setOrderType('DELIVERY')}
                  className={`${styles.typeTab} ${orderType === 'DELIVERY' ? styles.typeTabActive : ''}`}
                >
                  <Bike size={18} />
                  <span>Domicilio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('TAKEAWAY')}
                  className={`${styles.typeTab} ${orderType === 'TAKEAWAY' ? styles.typeTabActive : ''}`}
                >
                  <ShoppingBag size={18} />
                  <span>Para Llevar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('DINE_IN')}
                  className={`${styles.typeTab} ${orderType === 'DINE_IN' ? styles.typeTabActive : ''}`}
                >
                  <Utensils size={18} />
                  <span>En Mesa</span>
                </button>
              </div>
            </div>

            {/* 3. Datos del Cliente */}
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Datos de contacto</h3>
              <div className={styles.inputsGrid}>
                <div className={styles.fieldBox}>
                  <label className={styles.label}>Tu Nombre *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className={styles.input}
                  />
                </div>

                <div className={styles.fieldBox}>
                  <label className={styles.label}>Celular / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Ej. 300 123 4567"
                    className={styles.input}
                  />
                </div>

                {orderType === 'DELIVERY' && (
                  <>
                    <div className={styles.fieldBox}>
                      <label className={styles.label}>Dirección de Entrega *</label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        placeholder="Ej. Calle 45 # 12-34 Apto 301"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.fieldBox}>
                      <label className={styles.label}>Barrio / Indicaciones</label>
                      <input
                        type="text"
                        value={deliveryNeighborhood}
                        onChange={e => setDeliveryNeighborhood(e.target.value)}
                        placeholder="Ej. Laureles, portón negro"
                        className={styles.input}
                      />
                    </div>
                  </>
                )}

                {orderType === 'DINE_IN' && (
                  <div className={styles.fieldBox}>
                    <label className={styles.label}>Número de Mesa *</label>
                    <input
                      type="number"
                      required
                      value={tableNumber}
                      onChange={e => setTableNumber(e.target.value)}
                      placeholder="Ej. 4"
                      className={styles.input}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Método de Pago */}
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Método de Pago</h3>
              <div className={styles.paymentMethodsList}>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map(pm => {
                    const isSelected = paymentMethod === pm.name;
                    return (
                      <label
                        key={pm.id}
                        className={`${styles.paymentRow} ${isSelected ? styles.paymentRowActive : ''}`}
                        onClick={() => setPaymentMethod(pm.name)}
                      >
                        <div className={styles.paymentLeft}>
                          {pm.name.toLowerCase().includes('efectivo') ? (
                            <Banknote size={18} className={styles.paymentIcon} />
                          ) : (
                            <CreditCard size={18} className={styles.paymentIcon} />
                          )}
                          <span className={styles.paymentName}>{pm.name}</span>
                        </div>
                        <div className={`${styles.radioCircle} ${isSelected ? styles.radioSelected : ''}`}>
                          {isSelected && <div className={styles.radioDot} />}
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <label className={`${styles.paymentRow} ${styles.paymentRowActive}`}>
                    <div className={styles.paymentLeft}>
                      <Banknote size={18} className={styles.paymentIcon} />
                      <span className={styles.paymentName}>Efectivo</span>
                    </div>
                    <div className={`${styles.radioCircle} ${styles.radioSelected}`}>
                      <div className={styles.radioDot} />
                    </div>
                  </label>
                )}
              </div>

              {paymentMethod.toLowerCase().includes('efectivo') && (
                <div className={styles.cashBox}>
                  <label className={styles.label}>¿Con cuánto pagas? (Opcional, para cambio)</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)}
                    placeholder="Ej. 50000"
                    className={styles.input}
                  />
                </div>
              )}
            </div>

            {/* 5. Notas Adicionales */}
            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Notas generales (Opcional)</h3>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Instrucciones para el repartidor o detalles del pedido..."
                rows={2}
                className={styles.textarea}
              />
            </div>

            {/* 6. Desglose de Precios */}
            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span>Subtotal productos</span>
                <span>{formatCOP(subtotal)}</span>
              </div>
              {orderType === 'DELIVERY' && (
                <div className={styles.summaryRow}>
                  <span>Domicilio</span>
                  <span>{deliveryCost > 0 ? formatCOP(deliveryCost) : 'Gratis'}</span>
                </div>
              )}
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total a Pagar</span>
                <span>{formatCOP(grandTotal)}</span>
              </div>
            </div>

            {/* Barra Fija Inferior del Botón Confirmar */}
            <div className={styles.footerBar}>
              <button
                type="submit"
                disabled={isSubmitting || cartItems.length === 0}
                className={styles.submitBtn}
              >
                {isSubmitting ? (
                  <span>Enviando pedido a cocina...</span>
                ) : (
                  <>
                    <MessageCircle size={18} />
                    <span>Confirmar Pedido</span>
                    <span className={styles.btnDot}>•</span>
                    <span className={styles.btnPrice}>{formatCOP(grandTotal)}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
