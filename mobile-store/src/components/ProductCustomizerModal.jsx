import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Minus, Check, AlertCircle } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getFullImageUrl } from '../utils/imageUrl';
import { formatCOP } from '../utils/currency';
import styles from './ProductCustomizerModal.module.css';

export default function ProductCustomizerModal({
  product,
  onClose,
  onAddToCart
}) {
  if (!product) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({}); // { [modifierId]: optionId }
  const [selectedAdditions, setSelectedAdditions] = useState({}); // { [additionId]: boolean }
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [validationError, setValidationError] = useState('');

  const hasImage = Boolean(product.imageUrl);
  const imgUrl = hasImage ? getFullImageUrl(product.imageUrl) : null;

  // Seleccionar automáticamente la primera opción si un modificador obligatorio tiene opciones y no está seleccionado
  useEffect(() => {
    const initialMods = {};
    if (product.modifiers && product.modifiers.length > 0) {
      product.modifiers.forEach((mod) => {
        if (mod.isRequired && mod.options && mod.options.length > 0) {
          initialMods[mod.id] = mod.options[0].id;
        }
      });
    }
    setSelectedModifiers(initialMods);
  }, [product]);

  // Manejo de cambio de modificador (Radio)
  const handleModifierChange = (modifierId, optionId) => {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setSelectedModifiers(prev => ({
      ...prev,
      [modifierId]: optionId
    }));
    setValidationError('');
  };

  // Manejo de cambio de adición (Checkbox)
  const handleAdditionToggle = (additionId) => {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setSelectedAdditions(prev => ({
      ...prev,
      [additionId]: !prev[additionId]
    }));
  };

  // Control de cantidad
  const handleIncrease = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setQuantity(q => q + 1);
  };

  const handleDecrease = () => {
    if (quantity <= 1) return;
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setQuantity(q => q - 1);
  };

  // Cálculo del precio unitario base + extras
  const unitPrice = useMemo(() => {
    let total = Number(product.price) || 0;

    // Sumar extras de modificadores seleccionados
    if (product.modifiers && product.modifiers.length > 0) {
      product.modifiers.forEach((mod) => {
        const selectedOptId = selectedModifiers[mod.id];
        if (selectedOptId) {
          const opt = mod.options?.find(o => o.id === selectedOptId);
          if (opt && opt.priceExtra) {
            total += Number(opt.priceExtra);
          }
        }
      });
    }

    // Sumar adiciones marcadas
    if (product.additions && product.additions.length > 0) {
      product.additions.forEach((add) => {
        if (selectedAdditions[add.id]) {
          total += Number(add.price) || 0;
        }
      });
    }

    return total;
  }, [product, selectedModifiers, selectedAdditions]);

  const totalPrice = unitPrice * quantity;

  // Validación de modificadores obligatorios
  const isValid = useMemo(() => {
    if (!product.modifiers || product.modifiers.length === 0) return true;
    for (const mod of product.modifiers) {
      if (mod.isRequired && !selectedModifiers[mod.id]) {
        return false;
      }
    }
    return true;
  }, [product, selectedModifiers]);

  // Agregar al carrito
  const handleAdd = () => {
    // Validar modificadores obligatorios
    if (product.modifiers && product.modifiers.length > 0) {
      for (const mod of product.modifiers) {
        if (mod.isRequired && !selectedModifiers[mod.id]) {
          setValidationError(`Por favor selecciona una opción en "${mod.name}"`);
          try {
            Haptics.notification({ type: 'warning' });
          } catch (e) {}
          return;
        }
      }
    }

    // Recolectar detalles de las opciones seleccionadas
    const chosenModifiers = [];
    if (product.modifiers && product.modifiers.length > 0) {
      product.modifiers.forEach(mod => {
        const optId = selectedModifiers[mod.id];
        if (optId) {
          const opt = mod.options?.find(o => o.id === optId);
          if (opt) {
            chosenModifiers.push({
              modifierId: mod.id,
              modifierName: mod.name,
              optionId: opt.id,
              optionName: opt.name,
              priceExtra: Number(opt.priceExtra) || 0
            });
          }
        }
      });
    }

    const chosenAdditions = [];
    if (product.additions && product.additions.length > 0) {
      product.additions.forEach(add => {
        if (selectedAdditions[add.id]) {
          chosenAdditions.push({
            additionId: add.id,
            name: add.name,
            price: Number(add.price) || 0
          });
        }
      });
    }

    const cartItem = {
      product,
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice,
      totalPrice,
      quantity,
      modifiers: chosenModifiers,
      additions: chosenAdditions,
      specialInstructions: specialInstructions.trim()
    };

    try {
      Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}

    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.bottomSheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Botón flotante X */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar personalizador"
        >
          <X size={20} />
        </button>

        {/* Contenido con Scroll */}
        <div className={styles.scrollBody}>
          {/* Cabecera con Imagen Grande */}
          <div className={styles.imageHeader}>
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={product.name}
                className={styles.headerImg}
              />
            ) : (
              <div className={styles.headerImgPlaceholder}>
                <span>🍔</span>
              </div>
            )}
          </div>

          <div className={styles.infoContent}>
            <div className={styles.titleRow}>
              <h2 className={styles.productTitle}>{product.name}</h2>
              <span className={styles.basePriceBadge}>
                {formatCOP(product.price)}
              </span>
            </div>

            {product.description && (
              <p className={styles.productDescription}>{product.description}</p>
            )}

            {/* Mensaje de error de validación */}
            {validationError && (
              <div className={styles.errorAlert}>
                <AlertCircle size={16} />
                <span>{validationError}</span>
              </div>
            )}

            {/* 1. Grupos de Modificadores (Opciones) */}
            {product.modifiers && product.modifiers.length > 0 && (
              <div className={styles.modifiersSection}>
                {product.modifiers.map((mod) => (
                  <div key={mod.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <div>
                        <h3 className={styles.groupTitle}>{mod.name}</h3>
                        <span className={styles.groupSubtitle}>
                          {mod.isRequired ? 'Selecciona 1 opción obligatoria' : 'Opcional'}
                        </span>
                      </div>
                      <span
                        className={`${styles.tagRequirement} ${
                          mod.isRequired ? styles.tagRequired : styles.tagOptional
                        }`}
                      >
                        {mod.isRequired ? 'Obligatorio' : 'Opcional'}
                      </span>
                    </div>

                    <div className={styles.optionsList}>
                      {mod.options?.map((opt) => {
                        const isSelected = selectedModifiers[mod.id] === opt.id;
                        return (
                          <label
                            key={opt.id}
                            className={`${styles.optionRow} ${
                              isSelected ? styles.optionRowSelected : ''
                            }`}
                            onClick={() => handleModifierChange(mod.id, opt.id)}
                          >
                            <div className={styles.optionInfo}>
                              <span className={styles.optionName}>{opt.name}</span>
                              {Number(opt.priceExtra) > 0 && (
                                <span className={styles.optionExtraPrice}>
                                  +{formatCOP(opt.priceExtra)}
                                </span>
                              )}
                            </div>
                            <div
                              className={`${styles.radioCircle} ${
                                isSelected ? styles.radioSelected : ''
                              }`}
                            >
                              {isSelected && <div className={styles.radioInnerDot} />}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Adiciones / Toppings Extra */}
            {product.additions && product.additions.length > 0 && (
              <div className={styles.modifiersSection}>
                <div className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div>
                      <h3 className={styles.groupTitle}>¿Deseas agregar adiciones?</h3>
                      <span className={styles.groupSubtitle}>
                        Elige las que quieras para acompañar tu plato
                      </span>
                    </div>
                    <span className={`${styles.tagRequirement} ${styles.tagOptional}`}>
                      Opcional
                    </span>
                  </div>

                  <div className={styles.optionsList}>
                    {product.additions.map((add) => {
                      const isChecked = Boolean(selectedAdditions[add.id]);
                      return (
                        <label
                          key={add.id}
                          className={`${styles.optionRow} ${
                            isChecked ? styles.optionRowSelected : ''
                          }`}
                          onClick={() => handleAdditionToggle(add.id)}
                        >
                          <div className={styles.optionInfo}>
                            <span className={styles.optionName}>{add.name}</span>
                            <span className={styles.optionExtraPrice}>
                              +{formatCOP(add.price)}
                            </span>
                          </div>
                          <div
                            className={`${styles.checkboxBox} ${
                              isChecked ? styles.checkboxChecked : ''
                            }`}
                          >
                            {isChecked && <Check size={14} color="#ffffff" strokeWidth={3} />}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Instrucciones Especiales */}
            <div className={styles.instructionsBox}>
              <label className={styles.instructionsLabel}>
                Instrucciones especiales para cocina
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Ej. Sin cebolla, la salsa aparte, término bien cocido..."
                maxLength={200}
                rows={2}
                className={styles.instructionsTextarea}
              />
              <span className={styles.charCount}>
                {specialInstructions.length}/200
              </span>
            </div>
          </div>
        </div>

        {/* Barra Fija Inferior con Selector y Botón Agregar */}
        <div className={styles.footerBar}>
          {/* Selector [-] 1 [+] */}
          <div className={styles.quantityPicker}>
            <button
              onClick={handleDecrease}
              disabled={quantity <= 1}
              className={`${styles.qtyBtn} ${quantity <= 1 ? styles.qtyBtnDisabled : ''}`}
              aria-label="Disminuir cantidad"
            >
              <Minus size={16} />
            </button>
            <span className={styles.qtyDisplay}>{quantity}</span>
            <button
              onClick={handleIncrease}
              className={styles.qtyBtn}
              aria-label="Aumentar cantidad"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Botón de Agregar con Total Recalculado */}
          <button
            onClick={handleAdd}
            className={`${styles.addCartBtn} ${!isValid ? styles.addCartBtnInvalid : ''}`}
          >
            <span>Agregar</span>
            <span className={styles.btnDot}>•</span>
            <span className={styles.btnPrice}>{formatCOP(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
