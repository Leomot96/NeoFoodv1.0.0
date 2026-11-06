import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingBag,
  MapPin,
  Phone,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Store,
  DollarSign,
  Send,
  Loader2,
  Check,
  UtensilsCrossed,
  Tag
} from 'lucide-react';
import storeService from '../services/store.service';
import { getFullImageUrl } from '../utils/imageUrl';
import { compareCategories } from '../utils/categoryOrder';
import { applyBrandPalette, applyDocumentBranding, DEFAULT_BRAND_CONFIG } from '../config/brandConfig';
import styles from './StoreFront.module.css';

const DEFAULT_WEEKLY_SCHEDULE = [
  { dayIndex: 1, dayName: 'Lunes', isOpen: true, openTime: '11:00', closeTime: '22:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 2, dayName: 'Martes', isOpen: true, openTime: '11:00', closeTime: '22:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 3, dayName: 'Miércoles', isOpen: true, openTime: '11:00', closeTime: '22:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 4, dayName: 'Jueves', isOpen: true, openTime: '11:00', closeTime: '22:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 5, dayName: 'Viernes', isOpen: true, openTime: '11:00', closeTime: '23:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 6, dayName: 'Sábado', isOpen: true, openTime: '11:00', closeTime: '23:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' },
  { dayIndex: 0, dayName: 'Domingo', isOpen: true, openTime: '11:00', closeTime: '22:00', hasSecondShift: false, openTime2: '19:00', closeTime2: '23:00' }
];

const format12h = (time24) => {
  if (!time24) return '';
  const parts = time24.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const isTimeInShift = (currentMin, openStr, closeStr) => {
  if (!openStr || !closeStr) return false;
  const [openH, openM] = openStr.split(':').map(Number);
  const [closeH, closeM] = closeStr.split(':').map(Number);
  const openTotal = openH * 60 + (openM || 0);
  const closeTotal = closeH * 60 + (closeM || 0);
  if (closeTotal > openTotal) {
    return currentMin >= openTotal && currentMin < closeTotal;
  }
  if (closeTotal < openTotal) {
    // Turno trasnochador que cruza medianoche (ej: 18:00 a 02:00)
    return currentMin >= openTotal || currentMin < closeTotal;
  }
  return true;
};

const getStoreScheduleStatus = (scheduleRaw) => {
  let schedule = DEFAULT_WEEKLY_SCHEDULE;

  if (scheduleRaw) {
    try {
      const parsed = JSON.parse(scheduleRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        schedule = parsed;
      }
    } catch (e) {
      // Legacy text
    }
  }

  const now = new Date();
  const currentDayIndex = now.getDay(); // 0 es Domingo
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMin = currentHours * 60 + currentMinutes;

  const todayConfig = schedule.find(s => s.dayIndex === currentDayIndex) || schedule[0];

  if (!todayConfig || !todayConfig.isOpen) {
    return {
      isOpen: false,
      statusLabel: 'Cerrado',
      message: `Hoy ${todayConfig?.dayName || 'hoy'} nos encontramos cerrados para pedidos.`,
      todayDisplay: `Hoy: Cerrado`,
      todayConfig,
      weeklySchedule: schedule
    };
  }

  const inShift1 = isTimeInShift(currentTotalMin, todayConfig.openTime || '11:00', todayConfig.closeTime || '22:00');
  const inShift2 = Boolean(
    todayConfig.hasSecondShift &&
    todayConfig.openTime2 &&
    todayConfig.closeTime2 &&
    isTimeInShift(currentTotalMin, todayConfig.openTime2, todayConfig.closeTime2)
  );

  const isWithinHours = inShift1 || inShift2;

  const shift1Formatted = `${format12h(todayConfig.openTime)} - ${format12h(todayConfig.closeTime)}`;
  const shift2Formatted = todayConfig.hasSecondShift && todayConfig.openTime2 && todayConfig.closeTime2
    ? `${format12h(todayConfig.openTime2)} - ${format12h(todayConfig.closeTime2)}`
    : null;

  const fullScheduleText = shift2Formatted ? `${shift1Formatted} y ${shift2Formatted}` : shift1Formatted;

  if (!isWithinHours) {
    return {
      isOpen: false,
      statusLabel: 'Cerrado',
      message: `Fuera del horario de atención. Hoy atendemos de ${fullScheduleText}.`,
      todayDisplay: `Hoy: ${fullScheduleText}`,
      todayConfig,
      weeklySchedule: schedule
    };
  }

  const activeClosing = inShift2 ? format12h(todayConfig.closeTime2) : format12h(todayConfig.closeTime);

  return {
    isOpen: true,
    statusLabel: 'Abierto para pedidos',
    message: `Abierto hoy hasta las ${activeClosing}`,
    todayDisplay: `Hoy: ${fullScheduleText}`,
    todayConfig,
    weeklySchedule: schedule
  };
};

const StoreFront = () => {
  const { slug: paramSlug } = useParams();
  const slug = paramSlug || DEFAULT_BRAND_CONFIG.brandSlug || 'neofood';

  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Estados de interfaz y filtros
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Timer para actualizar horario en tiempo real cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const scheduleStatus = useMemo(() => {
    return getStoreScheduleStatus(restaurant?.storeSchedule);
  }, [restaurant?.storeSchedule, currentTime]);

  const isStoreOpen = Boolean(restaurant?.isStoreActive) && scheduleStatus.isOpen;

  // Estados del Carrito
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(`neofood_cart_${slug}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal de Personalización de Producto
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [customSelection, setCustomSelection] = useState({
    modifiers: [],
    additions: [],
    notes: '',
    quantity: 1
  });

  // Modal de Checkout con persistencia QoL de datos del cliente
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [checkoutData, setCheckoutData] = useState(() => {
    try {
      const savedCustomer = localStorage.getItem('neofood_customer_profile');
      const parsed = savedCustomer ? JSON.parse(savedCustomer) : {};
      return {
        customerName: parsed.customerName || '',
        customerPhone: parsed.customerPhone || '',
        customerEmail: parsed.customerEmail || '',
        orderType: parsed.orderType || 'DELIVERY', // 'DELIVERY' | 'TAKEAWAY'
        deliveryAddress: parsed.deliveryAddress || '',
        deliveryNeighborhood: parsed.deliveryNeighborhood || '',
        notes: '',
        paymentMethodName: 'Efectivo',
        cashChangeFor: ''
      };
    } catch {
      return {
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        orderType: 'DELIVERY',
        deliveryAddress: '',
        deliveryNeighborhood: '',
        notes: '',
        paymentMethodName: 'Efectivo',
        cashChangeFor: ''
      };
    }
  });

  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Persistir perfil de entrega del cliente automáticamente
  useEffect(() => {
    try {
      const profileToSave = {
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
        customerEmail: checkoutData.customerEmail,
        orderType: checkoutData.orderType,
        deliveryAddress: checkoutData.deliveryAddress,
        deliveryNeighborhood: checkoutData.deliveryNeighborhood
      };
      localStorage.setItem('neofood_customer_profile', JSON.stringify(profileToSave));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, [
    checkoutData.customerName,
    checkoutData.customerPhone,
    checkoutData.customerEmail,
    checkoutData.orderType,
    checkoutData.deliveryAddress,
    checkoutData.deliveryNeighborhood
  ]);

  // Cerrar modales con tecla Escape (QoL)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (customizingProduct) setCustomizingProduct(null);
        else if (isCheckoutOpen && !isSubmittingOrder) setIsCheckoutOpen(false);
        else if (showScheduleModal) setShowScheduleModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customizingProduct, isCheckoutOpen, isSubmittingOrder, showScheduleModal]);

  // Guardar carrito en LocalStorage
  useEffect(() => {
    if (slug) {
      localStorage.setItem(`neofood_cart_${slug}`, JSON.stringify(cart));
    }
  }, [cart, slug]);

  // Habilitar scroll del navegador en la tienda pública
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const rootEl = document.getElementById('root');
    const prevRootOverflow = rootEl ? rootEl.style.overflow : '';

    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    if (rootEl) {
      rootEl.style.overflow = 'visible';
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      if (rootEl) {
        rootEl.style.overflow = prevRootOverflow;
      }
    };
  }, []);

  // Cargar datos de la tienda
  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await storeService.getPublicStore(slug);
        setRestaurant(data.restaurant);
        if (data.restaurant?.primaryColor) {
          applyBrandPalette(data.restaurant.primaryColor, data.restaurant.secondaryColor, true);
        }
        if (data.restaurant?.name) {
          applyDocumentBranding({
            name: data.restaurant.name,
            logoUrl: data.restaurant.logoUrl,
            primaryColor: data.restaurant.primaryColor,
            secondaryColor: data.restaurant.secondaryColor
          });
        }
        const sortedCats = [...(data.categories || [])].sort(compareCategories);
        setCategories(sortedCats);
        
        // Filtrar métodos de pago activos del restaurante excluyendo 'Crédito'
        const validMethods = (data.paymentMethods || []).filter(pm => {
          const lower = (pm.name || '').toLowerCase();
          return !lower.includes('crédito') && !lower.includes('credito');
        }).sort((a, b) => {
          const aIsCash = (a.name || '').toLowerCase().includes('efectivo');
          const bIsCash = (b.name || '').toLowerCase().includes('efectivo');
          if (aIsCash && !bIsCash) return -1;
          if (!aIsCash && bIsCash) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setPaymentMethods(validMethods);
        if (validMethods.length > 0) {
          const cashMethod = validMethods.find(m => (m.name || '').toLowerCase().includes('efectivo'));
          setCheckoutData(prev => ({ 
            ...prev, 
            paymentMethodName: cashMethod ? cashMethod.name : validMethods[0].name 
          }));
        }
      } catch (err) {
        console.error('Error cargando tienda:', err);
        setError(err.response?.data?.message || 'No se pudo cargar la tienda. Verifica la dirección web.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchStore();
  }, [slug]);

  // Filtrado de productos
  const filteredCategories = useMemo(() => {
    let result = [...categories].sort(compareCategories);
    if (selectedCategory !== 'all') {
      result = result.filter(c => c.id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.map(cat => ({
        ...cat,
        products: cat.products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        )
      })).filter(cat => cat.products.length > 0);
    }

    return result;
  }, [categories, selectedCategory, searchQuery]);

  // Totales del carrito
  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const totalCartAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }, [cart]);

  // Formateador de moneda en pesos colombianos (COP)
  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Abrir personalizador o añadir directo
  const handleStartAddProduct = (product) => {
    if (!isStoreOpen) {
      alert(`El restaurante se encuentra cerrado en este momento. ${scheduleStatus.message}`);
      return;
    }

    const hasModifiers = product.modifiers && product.modifiers.length > 0;
    const hasAdditions = product.additions && product.additions.length > 0;

    if (hasModifiers || hasAdditions) {
      // Tiene opciones: abrir modal de personalización
      const initialMods = (product.modifiers || []).map(m => {
        const sortedOptions = [...(m.options || [])].sort(
          (a, b) => (parseFloat(a.priceExtra) || 0) - (parseFloat(b.priceExtra) || 0)
        );
        const defaultOption = sortedOptions[0];
        return {
          modifierId: m.id,
          modifierName: m.name,
          optionId: defaultOption?.id || null,
          optionName: defaultOption?.name || '',
          priceExtra: parseFloat(defaultOption?.priceExtra || 0)
        };
      });

      setCustomSelection({
        modifiers: initialMods,
        additions: [],
        notes: '',
        quantity: 1
      });
      setCustomizingProduct(product);
    } else {
      // Añadir directo
      addToCart({
        id: `${product.id}_direct`,
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        unitPrice: parseFloat(product.price),
        modifiers: [],
        additions: [],
        notes: '',
        quantity: 1
      });
    }
  };

  const toggleCustomAddition = (addition) => {
    setCustomSelection(prev => {
      const existing = prev.additions.find(a => a.id === addition.id);
      if (existing) {
        return {
          ...prev,
          additions: prev.additions.filter(a => a.id !== addition.id)
        };
      } else {
        return {
          ...prev,
          additions: [...prev.additions, { id: addition.id, name: addition.name, price: addition.price, quantity: 1 }]
        };
      }
    });
  };

  const updateCustomAdditionQty = (additionId, delta, e) => {
    if (e) e.stopPropagation();
    setCustomSelection(prev => ({
      ...prev,
      additions: prev.additions.map(a => {
        if (a.id === additionId) {
          const newQty = (a.quantity || 1) + delta;
          return newQty > 0 ? { ...a, quantity: newQty } : null;
        }
        return a;
      }).filter(Boolean)
    }));
  };

  // Total dinámico en vivo del modal de personalización
  const modalLiveTotal = useMemo(() => {
    if (!customizingProduct) return 0;
    const base = parseFloat(customizingProduct.price) || 0;
    const modsExtra = (customSelection.modifiers || []).reduce(
      (sum, m) => sum + (parseFloat(m.priceExtra) || 0), 0
    );
    const addsTotal = (customSelection.additions || []).reduce(
      (sum, a) => sum + ((parseFloat(a.price) || 0) * (a.quantity || 1)), 0
    );
    return (base + modsExtra + addsTotal) * (customSelection.quantity || 1);
  }, [customizingProduct, customSelection]);

  // Confirmar desde modal de personalización
  const handleConfirmCustomization = () => {
    if (!customizingProduct) return;
    if (!isStoreOpen) {
      alert(`El restaurante se encuentra cerrado en este momento. ${scheduleStatus.message}`);
      return;
    }

    // Validar modificadores obligatorios
    for (const mod of customizingProduct.modifiers || []) {
      if (mod.isRequired) {
        const hasChoice = customSelection.modifiers.some(m => m.modifierId === mod.id && m.optionId);
        if (!hasChoice) {
          alert(`Debes seleccionar una opción para: ${mod.name}`);
          return;
        }
      }
    }

    let basePrice = parseFloat(customizingProduct.price) || 0;
    customSelection.modifiers.forEach(m => {
      if (m.priceExtra) basePrice += parseFloat(m.priceExtra);
    });
    customSelection.additions.forEach(a => {
      basePrice += (parseFloat(a.price) * (a.quantity || 1));
    });

    const signature = `${customizingProduct.id}_${JSON.stringify(customSelection.modifiers)}_${JSON.stringify(customSelection.additions)}_${customSelection.notes}`;

    addToCart({
      id: signature,
      productId: customizingProduct.id,
      name: customizingProduct.name,
      imageUrl: customizingProduct.imageUrl,
      unitPrice: basePrice,
      modifiers: customSelection.modifiers,
      additions: customSelection.additions,
      notes: customSelection.notes,
      quantity: customSelection.quantity
    });

    setCustomizingProduct(null);
  };

  const addToCart = (newItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === newItem.id);
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += newItem.quantity;
        return copy;
      }
      return [...prev, newItem];
    });
    if (newItem.productId) {
      setRecentlyAddedId(newItem.productId);
      setTimeout(() => {
        setRecentlyAddedId(prev => (prev === newItem.productId ? null : prev));
      }, 950);
    }
  };

  const updateCartQty = (itemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeCartItem = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  // Enviar pedido y abrir WhatsApp
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (!isStoreOpen) {
      alert(`El restaurante se encuentra cerrado en este momento. ${scheduleStatus.message}`);
      return;
    }

    if (!checkoutData.customerName.trim()) {
      alert('Por favor indica tu nombre completo.');
      return;
    }
    if (!checkoutData.customerPhone.trim()) {
      alert('Por favor indica tu número de celular / WhatsApp.');
      return;
    }
    if (checkoutData.orderType === 'DELIVERY' && !checkoutData.deliveryAddress.trim()) {
      alert('Por favor ingresa la dirección de entrega.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const orderPayload = {
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
        customerEmail: checkoutData.customerEmail,
        orderType: checkoutData.orderType,
        deliveryAddress: checkoutData.deliveryAddress,
        deliveryNeighborhood: checkoutData.deliveryNeighborhood,
        notes: checkoutData.notes,
        paymentMethodName: checkoutData.paymentMethodName,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers,
          additions: item.additions
        }))
      };

      const result = await storeService.createPublicOrder(slug, orderPayload);
      const createdOrder = result?.order || result;
      const targetPhone = result?.whatsappNumber;

      // Limpiar carrito local
      setCart([]);
      localStorage.removeItem(`neofood_cart_${slug}`);

      // Generar mensaje formateado de WhatsApp
      let msg = `🍔 *¡NUEVO PEDIDO VIRTUAL!*\n`;
      msg += `*Pedido:* #${createdOrder.orderNumber}\n`;
      msg += `*Restaurante:* ${result.restaurantName}\n\n`;
      msg += `👤 *Cliente:* ${checkoutData.customerName.trim()}\n`;
      msg += `📱 *Teléfono:* ${checkoutData.customerPhone.trim()}\n`;
      msg += `🛵 *Tipo:* ${checkoutData.orderType === 'DELIVERY' ? 'A Domicilio' : 'Para Retirar en Local'}\n`;
      
      if (checkoutData.orderType === 'DELIVERY') {
        msg += `📍 *Dirección:* ${checkoutData.deliveryAddress.trim()}`;
        if (checkoutData.deliveryNeighborhood?.trim()) {
          msg += ` (${checkoutData.deliveryNeighborhood.trim()})`;
        }
        msg += `\n`;
      }

      msg += `💳 *Método de Pago:* ${checkoutData.paymentMethodName}\n`;
      if (checkoutData.paymentMethodName === 'Efectivo' && checkoutData.cashChangeFor) {
        msg += `💵 *Paga con:* $${checkoutData.cashChangeFor}\n`;
      }

      msg += `\n📋 *DETALLE DEL PEDIDO:*\n`;
      cart.forEach(item => {
        msg += `• *${item.quantity}x ${item.name}* - ${formatMoney(item.unitPrice * item.quantity)}\n`;
        if (item.modifiers && item.modifiers.length > 0) {
          item.modifiers.forEach(m => {
            msg += `   👉 *${m.modifierName}:* ${m.optionName}\n`;
          });
        }
        if (item.additions && item.additions.length > 0) {
          item.additions.forEach(a => {
            msg += `   ➕ *Adición:* ${a.name} (${formatMoney(a.price)})\n`;
          });
        }
        if (item.notes) {
          msg += `   📝 *Nota:* "${item.notes}"\n`;
        }
      });

      msg += `\n💰 *TOTAL A PAGAR: ${formatMoney(totalCartAmount)}*\n`;
      if (checkoutData.notes?.trim()) {
        msg += `\n📌 *Instrucciones adicionales:* ${checkoutData.notes.trim()}\n`;
      }
      msg += `\n_Pedido registrado mediante la tienda web oficial de NeoFood._`;

      // Formatear teléfono para WhatsApp (añadir 57 si es celular colombiano de 10 dígitos)
      let cleanPhone = (targetPhone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
        cleanPhone = '57' + cleanPhone;
      }
      const waUrl = cleanPhone 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
        : '';

      // Guardar orden completada para vista de éxito
      setCompletedOrder({
        orderNumber: createdOrder.orderNumber,
        waUrl,
        total: totalCartAmount,
        targetPhone: cleanPhone,
        restaurantName: result.restaurantName
      });

      // Intentar abrir WhatsApp si hay número configurado
      if (waUrl) {
        window.open(waUrl, '_blank');
      }

    } catch (err) {
      console.error('Error enviando pedido:', err);
      alert(err.response?.data?.message || 'Error al procesar el pedido. Por favor intenta de nuevo.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-4">
        <Loader2 size={36} className="animate-spin text-orange-500" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">Cargando menú del restaurante...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Restaurante no disponible</h1>
        <p className="text-slate-600 max-w-md mb-6">{error || 'El restaurante no existe o se encuentra inactivo.'}</p>
        <Link to="/" className="neo-btn neo-btn-primary px-5 py-2.5 text-sm font-bold">
          Ir a NeoFood
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.storePageWrapper}>

      {/* 1. CABECERA DEL RESTAURANTE (SIN BANNER) */}
      <header className={styles.heroHeader}>
        {/* Anuncio destacado si existe */}
        {restaurant.storeAnnouncement && (
          <div className={styles.announcementBanner}>
            <Sparkles size={17} />
            <span>{restaurant.storeAnnouncement}</span>
          </div>
        )}

        {/* Tarjeta de información del restaurante */}
        <div className={styles.heroContent}>
          <div className={styles.restaurantCardHeader}>
            <div className={styles.logoContainer}>
              {restaurant.logoUrl ? (
                <img
                  src={getFullImageUrl(restaurant.logoUrl)}
                  alt={restaurant.name}
                  className={styles.restaurantLogo}
                />
              ) : (
                <div className={styles.logoPlaceholder}>
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </div>

            <div className={styles.restaurantDetails}>
              <div className={styles.restaurantTitleRow}>
                <h1 className={styles.restaurantName}>{restaurant.name}</h1>
                {isStoreOpen ? (
                  <span className={styles.statusBadgeOpen}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Abierto para pedidos
                  </span>
                ) : (
                  <span className={styles.statusBadgeClosed}>
                    <Clock size={13} /> {restaurant.isStoreActive === false ? 'En pausa' : 'Cerrado en este momento'}
                  </span>
                )}
              </div>

              {restaurant.storeDescription && (
                <p className={styles.restaurantDescription}>{restaurant.storeDescription}</p>
              )}

              <div className={styles.restaurantMeta}>
                {/* Horario con disparador para ver toda la semana */}
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className={styles.metaItem}
                  style={{
                    color: isStoreOpen ? '#0284c7' : '#e11d48',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  title="Haz clic para consultar el horario semanal"
                >
                  <Clock size={15} />
                  <span className="font-bold underline decoration-dotted underline-offset-2">
                    {scheduleStatus.todayDisplay}
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded ml-1 transition-colors">
                    Ver semana
                  </span>
                </button>

                {restaurant.address && (
                  <span className={styles.metaItem}>
                    <MapPin size={15} style={{ color: '#6366f1' }} />
                    <span>{restaurant.address}</span>
                  </span>
                )}

                {restaurant.whatsappNumber && (
                  <a
                    href={`https://wa.me/${restaurant.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.metaItem}
                    style={{ color: '#059669', textDecoration: 'none' }}
                  >
                    <Phone size={15} />
                    <span>WhatsApp: {restaurant.whatsappNumber}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* AVISO DESTACADO SI EL RESTAURANTE ESTÁ CERRADO O EN PAUSA */}
      {!isStoreOpen && (
        <div className="max-w-[1100px] mx-auto px-4 w-full mt-3">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-rose-950">
                  {restaurant.isStoreActive === false
                    ? '🔴 Tienda temporalmente en pausa'
                    : '🔴 Restaurante Cerrado en este momento'}
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  {restaurant.isStoreActive === false
                    ? 'La recepción de pedidos está en pausa. Puedes consultar nuestro catálogo digital.'
                    : `${scheduleStatus.message} Puedes consultar nuestros productos, pero la toma de pedidos está pausada.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="text-xs font-bold bg-white text-rose-700 hover:bg-rose-100 border border-rose-300 px-3 py-1.5 rounded-xl transition-colors shrink-0"
            >
              Ver Horarios de la Semana
            </button>
          </div>
        </div>
      )}

      {/* 2. BARRA STICKY DE CATEGORÍAS & BÚSQUEDA */}
      <div className={styles.stickyNavWrapper}>
        <div className={styles.stickyNavContent}>
          <div className={styles.searchBarBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar platillo, acompañamiento, bebida..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  background: 'rgba(51, 65, 85, 0.5)',
                  border: 'none',
                  borderRadius: '9999px',
                  width: '1.5rem',
                  height: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className={styles.categoriesScroll}>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`${styles.categoryPill} ${selectedCategory === 'all' ? styles.categoryPillActive : ''}`}
            >
              <span>🔥 Todos</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`${styles.categoryPill} ${selectedCategory === cat.id ? styles.categoryPillActive : ''}`}
              >
                <span>{cat.name}</span>
                <span className="text-xs opacity-75 font-normal">({cat.products?.length || 0})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. CATÁLOGO DE PRODUCTOS */}
      <main className={styles.mainContentContainer}>
        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <UtensilsCrossed size={48} className="mb-3 opacity-40 text-orange-500" />
            <p className="text-base font-bold text-slate-200">No encontramos productos en esta búsqueda</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otra palabra o selecciona otra categoría.</p>
          </div>
        ) : (
          filteredCategories.map(cat => (
            <section key={cat.id} className={styles.categorySection}>
              <div className={styles.categoryTitleRow}>
                <h2 className={styles.categorySectionTitle}>{cat.name}</h2>
                <span className={styles.categoryProductCount}>{cat.products.length} disponibles</span>
              </div>

              <div className={styles.productsGrid}>
                {cat.products.map(prod => {
                  const inCartQty = cart
                    .filter(item => item.productId === prod.id)
                    .reduce((sum, item) => sum + item.quantity, 0);
                  const isJustAdded = recentlyAddedId === prod.id;

                  return (
                  <article key={prod.id} className={styles.productCard}>
                    <div className={styles.productImageContainer}>
                      {prod.imageUrl ? (
                        <img
                          src={getFullImageUrl(prod.imageUrl)}
                          alt={prod.name}
                          className={styles.productImage}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.productImagePlaceholder}>
                          <UtensilsCrossed size={36} />
                        </div>
                      )}
                      {prod.isCombo && (
                        <span className={styles.comboBadge}>Combo Especial</span>
                      )}
                      {inCartQty > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '0.65rem',
                            right: '0.65rem',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)'
                          }}
                        >
                          En tu pedido: {inCartQty}
                        </span>
                      )}
                    </div>

                    <div className={styles.productBody}>
                      <h3 className={styles.productName}>{prod.name}</h3>
                      {prod.description && (
                        <p className={styles.productDescription}>{prod.description}</p>
                      )}

                      <div className={styles.productFooter}>
                        <div className="flex flex-col">
                          <span className={styles.productPrice}>{formatMoney(prod.price)}</span>
                          {(prod.modifiers?.length > 0 || prod.additions?.length > 0) && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fb923c' }}>Con opciones</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartAddProduct(prod)}
                          disabled={!isStoreOpen}
                          className={!isStoreOpen ? `${styles.addBtn} opacity-50 cursor-not-allowed` : styles.addBtn}
                          style={isJustAdded ? { background: '#10b981', borderColor: '#10b981', color: '#ffffff' } : undefined}
                          title={!isStoreOpen ? `Restaurante Cerrado (${scheduleStatus.message})` : (prod.modifiers?.length > 0 ? "Personalizar opciones" : "Agregar al pedido")}
                        >
                          {isJustAdded ? <Check size={15} /> : <Plus size={15} />}
                          <span>
                            {!isStoreOpen
                              ? 'Cerrado'
                              : isJustAdded
                                ? '¡Agregado!'
                                : (prod.modifiers?.length > 0 || prod.additions?.length > 0)
                                  ? 'Personalizar'
                                  : 'Agregar'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* 4. BARRA FLOTANTE DEL CARRITO */}
      {cart.length > 0 && (
        <div
          className={styles.floatingCartBar}
          onClick={() => setIsCheckoutOpen(true)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.floatingCartLeft}>
            <div className={styles.cartBadgeCount}>{totalCartCount}</div>
            <div className={styles.cartTotalText}>
              <span className={styles.cartTotalLabel}>Tu Pedido ({totalCartCount} items)</span>
              <span className={styles.cartTotalAmount}>{formatMoney(totalCartAmount)}</span>
            </div>
          </div>
          <button type="button" className={styles.cartViewBtn}>
            <span>Ver Carrito</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* 5. MODAL DE PERSONALIZACIÓN DE PRODUCTO (ESTILO VENTAS/POS) */}
      {customizingProduct && (
        <div className={styles.modalBackdrop}>
          <div className={styles.customizerWindow}>
            {/* CABECERA */}
            <div className={styles.customizerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {customizingProduct.imageUrl ? (
                  <img
                    src={getFullImageUrl(customizingProduct.imageUrl)}
                    alt={customizingProduct.name}
                    style={{
                      width: '3.25rem',
                      height: '3.25rem',
                      borderRadius: '0.75rem',
                      objectFit: 'cover',
                      border: '1.5px solid var(--border-card, #334155)',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(79, 70, 229, 0.15)',
                    color: 'var(--brand-primary, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {customizingProduct.isCombo ? <Sparkles size={22} style={{ color: '#f59e0b' }} /> : <Tag size={22} />}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--text-main, #f8fafc)', margin: 0, lineHeight: 1.2 }}>
                      {customizingProduct.name}
                    </h2>
                    {customizingProduct.isCombo && (
                      <span style={{ fontSize: '0.625rem', backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Combo
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700, margin: '0.2rem 0 0 0' }}>
                    Base: {formatMoney(customizingProduct.price)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className={styles.modalCloseBtn}
                aria-label="Cerrar personalización"
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTENIDO SCROLLABLE */}
            <div className={styles.customizerBody}>
              {/* MODIFICADORES / PASOS DEL PRODUCTO */}
              {(customizingProduct.modifiers || []).map((modifier, modIdx) => (
                <div key={modifier.id || modIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <span className={styles.stepNum}>
                        {modIdx + 1}
                      </span>
                      {modifier.name}
                      {modifier.isRequired && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 900 }}>*</span>}
                    </p>
                    {modifier.isRequired && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Requerido</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                    {[...(modifier.options || [])].sort((a, b) => (parseFloat(a.priceExtra) || 0) - (parseFloat(b.priceExtra) || 0)).map(option => {
                      const isSelected = customSelection.modifiers.some(
                        m => m.modifierId === modifier.id && m.optionId === option.id
                      );
                      const priceExtra = parseFloat(option.priceExtra || 0);

                      return (
                        <div
                          key={option.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setCustomSelection(prev => {
                              const filtered = prev.modifiers.filter(m => m.modifierId !== modifier.id);
                              return {
                                ...prev,
                                modifiers: [
                                  ...filtered,
                                  {
                                    modifierId: modifier.id,
                                    modifierName: modifier.name,
                                    optionId: option.id,
                                    optionName: option.name,
                                    priceExtra: priceExtra
                                  }
                                ]
                              };
                            });
                          }}
                          className={`${styles.posOptionBox} ${isSelected ? styles.posOptionSelected : ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className={`${styles.radioCircle} ${isSelected ? styles.radioCircleActive : ''}`}>
                              {isSelected && <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', backgroundColor: '#ffffff' }}></div>}
                            </div>
                            <div>
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: isSelected ? '#fb923c' : 'var(--text-main, #f8fafc)', display: 'block' }}>
                                {option.name}
                              </span>
                              {option.linkedProductId && (
                                <span style={{ fontSize: '0.6875rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                                  <Sparkles size={11} /> Incluido en el Combo
                                </span>
                              )}
                            </div>
                          </div>

                          {priceExtra > 0 ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fb923c', backgroundColor: 'rgba(79, 70, 229, 0.15)', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                              +{formatMoney(priceExtra)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Incluido</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ADICIONES EXTRAS */}
              {customizingProduct.additions && customizingProduct.additions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle, #1e293b)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                      <Plus size={16} style={{ color: '#10b981' }} />
                      Adiciones Extra
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>Opcionales</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                    {customizingProduct.additions.map(addition => {
                      const selectedItem = customSelection.additions.find(a => a.id === addition.id);
                      const isSelected = Boolean(selectedItem);
                      const price = parseFloat(addition.price || 0);

                      return (
                        <div
                          key={addition.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleCustomAddition(addition)}
                          className={`${styles.posOptionBox} ${isSelected ? styles.posOptionAdditionSelected : ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className={`${styles.checkboxBox} ${isSelected ? styles.checkboxBoxActive : ''}`}>
                              {isSelected && <Check size={14} />}
                            </div>
                            <div>
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: isSelected ? '#34d399' : 'var(--text-main, #f8fafc)', display: 'block' }}>
                                {addition.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                                +{formatMoney(price)} c/u
                              </span>
                            </div>
                          </div>

                          {/* Control de Cantidad de Adición si está seleccionada */}
                          {isSelected ? (
                            <div 
                              className={styles.qtyCtrl}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button 
                                type="button" 
                                onClick={(e) => updateCustomAdditionQty(addition.id, -1, e)}
                                aria-label="Disminuir adición"
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 900, fontSize: '0.8125rem', minWidth: '1.25rem', textAlign: 'center', color: 'var(--text-main, #f8fafc)' }}>
                                {selectedItem.quantity || 1}
                              </span>
                              <button 
                                type="button" 
                                onClick={(e) => updateCustomAdditionQty(addition.id, 1, e)}
                                aria-label="Aumentar adición"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                              + Agregar
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NOTAS PARA LA COCINA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle, #1e293b)' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>
                  Instrucciones para la cocina (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Sin cebolla, salsas aparte, etc."
                  value={customSelection.notes}
                  onChange={(e) => setCustomSelection({ ...customSelection, notes: e.target.value })}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.75rem',
                    border: '1.5px solid var(--border-card, #334155)',
                    backgroundColor: 'var(--bg-input, #020617)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    color: 'var(--text-main, #f8fafc)'
                  }}
                />
              </div>
            </div>

            {/* PIE DEL MODAL CON TOTAL Y AGREGAR */}
            <div className={styles.customizerFooter}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-input, #020617)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.5rem',
                  border: '1.5px solid var(--border-card, #334155)'
                }}>
                  <button
                    type="button"
                    onClick={() => setCustomSelection(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    aria-label="Disminuir cantidad"
                    style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.35rem', border: 'none', background: 'var(--bg-card-secondary, #1e293b)', color: 'var(--text-main, #f8fafc)', cursor: 'pointer', fontWeight: 900 }}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 900, fontSize: '0.875rem', minWidth: '1.5rem', textAlign: 'center', color: 'var(--text-main, #f8fafc)' }}>
                    {customSelection.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomSelection(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                    aria-label="Aumentar cantidad"
                    style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.35rem', border: 'none', background: 'var(--bg-card-secondary, #1e293b)', color: 'var(--text-main, #f8fafc)', cursor: 'pointer', fontWeight: 900 }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmCustomization}
                disabled={!isStoreOpen}
                className="neo-btn neo-btn-primary"
                style={{
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: !isStoreOpen ? 0.6 : 1,
                  cursor: !isStoreOpen ? 'not-allowed' : 'pointer'
                }}
              >
                <span>{!isStoreOpen ? 'Restaurante Cerrado' : 'Agregar al Pedido'}</span>
                {isStoreOpen && (
                  <>
                    <span>•</span>
                    <span>{formatMoney(modalLiveTotal)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE CHECKOUT LLAMATIVO */}
      {isCheckoutOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalWindow} style={{ maxWidth: '620px' }}>
            {completedOrder ? (
              /* PANTALLA DE ÉXITO */
              <div className={styles.successContainer}>
                <div className={styles.successIconBadge}>
                  <CheckCircle2 size={46} />
                </div>
                <h2 className="text-2xl font-black text-slate-100">¡Pedido Registrado con Éxito!</h2>
                <p className="text-xs text-slate-400 max-w-sm">
                  Tu orden <strong className="text-orange-400 font-extrabold">#{completedOrder.orderNumber}</strong> ya fue recibida en la pantalla de pedidos del restaurante.
                </p>

                {/* TARJETA DETALLADA DE TRANSPARENCIA Y DESTINO */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 w-full max-w-md text-left text-xs flex flex-col gap-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-slate-400 font-semibold">Total a Pagar:</span>
                    <strong className="text-sm font-black text-slate-100">{formatMoney(completedOrder.total)}</strong>
                  </div>

                  <div className="flex flex-col gap-1 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Store size={14} className="text-orange-500 shrink-0" />
                      <span><strong>Restaurante Receptor:</strong> {completedOrder.restaurantName || restaurant.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Phone size={14} className="text-emerald-400 shrink-0" />
                      <span>
                        <strong>WhatsApp Oficial de Destino:</strong>{' '}
                        {completedOrder.targetPhone ? (
                          <span className="font-bold text-emerald-400">+{completedOrder.targetPhone}</span>
                        ) : (
                          <span className="text-amber-400 font-medium">(El restaurante aún no configuró su WhatsApp)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                    💡 <strong>¿Cómo se envía el WhatsApp?</strong>
                    <br />
                    El pedido ya está guardado en el sistema interno de NeoFood. Para notificar y confirmar tu entrega por WhatsApp, pulsa el botón verde abajo para abrir el chat directamente con el restaurante y enviar el mensaje con un toque.
                  </div>
                </div>

                {completedOrder.waUrl ? (
                  <a
                    href={completedOrder.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.whatsappSubmitBtn}
                    style={{ textDecoration: 'none' }}
                  >
                    <Send size={18} />
                    <span>Abrir WhatsApp y Enviar Pedido 📲</span>
                  </a>
                ) : (
                  <div className="p-3 bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs rounded-xl text-center">
                    El restaurante no tiene WhatsApp registrado, pero tu pedido ya está guardado en su sistema de cocina.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCompletedOrder(null);
                    setIsCheckoutOpen(false);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-100 pt-1"
                >
                  Volver al Menú
                </button>
              </div>
            ) : (
              /* FORMULARIO DE CHECKOUT */
              <>
                <div className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>
                    <ShoppingBag size={20} style={{ color: 'var(--brand-primary, #4f46e5)' }} />
                    <span>Confirmar tu Pedido</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    className={styles.modalCloseBtn}
                    aria-label="Cerrar confirmación de pedido"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmitOrder} className={styles.modalBody}>
                  {/* Resumen del Carrito */}
                  <div className={styles.checkoutSection}>
                    <h4 className={styles.checkoutSectionTitle}>
                      <span>Tu Canasta ({totalCartCount} productos)</span>
                    </h4>
                    <div className={styles.cartItemsList}>
                      {cart.map(item => (
                        <div key={item.id} className={styles.cartItemRow}>
                          <div className={styles.cartItemInfo}>
                            <span className={styles.cartItemName}>{item.name}</span>
                            {item.modifiers?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.modifiers.map((m, mIdx) => (
                                  <span key={mIdx} style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#c7d2fe', backgroundColor: 'rgba(79, 70, 229, 0.2)', border: '1px solid rgba(79, 70, 229, 0.4)', padding: '0.1rem 0.45rem', borderRadius: '0.35rem' }}>
                                    {m.modifierName}: {m.optionName}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.additions?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.additions.map((a, aIdx) => (
                                  <span key={aIdx} style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6ee7b7', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.1rem 0.45rem', borderRadius: '0.35rem' }}>
                                    + {a.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <span style={{ fontSize: '0.6875rem', color: '#fbbf24', fontStyle: 'italic' }}>"{item.notes}"</span>
                            )}
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.15rem' }}>
                              {formatMoney(item.unitPrice * item.quantity)}
                            </span>
                          </div>

                          <div className={styles.cartItemQtyControl}>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, -1)}
                              className={styles.qtyBtn}
                              aria-label="Disminuir cantidad"
                            >
                              -
                            </button>
                            <span className={styles.qtyNumber}>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, 1)}
                              className={styles.qtyBtn}
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCartItem(item.id)}
                              className="text-red-400 hover:text-red-300 ml-1 p-1"
                              title="Quitar"
                              aria-label="Quitar producto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de Entrega */}
                  <div className={styles.checkoutSection}>
                    <h4 className={styles.checkoutSectionTitle}>
                      <span>¿Cómo deseas recibir tu pedido?</span>
                    </h4>
                    <div className={styles.deliveryTypeGrid}>
                      <div
                        className={`${styles.deliveryTypeCard} ${checkoutData.orderType === 'DELIVERY' ? styles.deliveryTypeCardActive : ''}`}
                        onClick={() => setCheckoutData({ ...checkoutData, orderType: 'DELIVERY' })}
                      >
                        <span className="text-2xl">🛵</span>
                        <span className="text-xs font-black">A Domicilio</span>
                        <span className="text-[10px] text-slate-400">Te lo llevamos a tu puerta</span>
                      </div>
                      <div
                        className={`${styles.deliveryTypeCard} ${checkoutData.orderType === 'TAKEAWAY' ? styles.deliveryTypeCardActive : ''}`}
                        onClick={() => setCheckoutData({ ...checkoutData, orderType: 'TAKEAWAY' })}
                      >
                        <span className="text-2xl">🛍️</span>
                        <span className="text-xs font-black">Para Retirar</span>
                        <span className="text-[10px] text-slate-400">Pasa al restaurante por él</span>
                      </div>
                    </div>
                  </div>

                  {/* Datos del Cliente */}
                  <div className={styles.checkoutSection}>
                    <h4 className={styles.checkoutSectionTitle}>
                      <span>Tus Datos de Contacto</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-300">Nombre Completo *</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej. Juan Pérez"
                          value={checkoutData.customerName}
                          onChange={(e) => setCheckoutData({ ...checkoutData, customerName: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-300">WhatsApp / Celular *</label>
                        <input
                          required
                          type="tel"
                          placeholder="Ej. 3001234567"
                          value={checkoutData.customerPhone}
                          onChange={(e) => setCheckoutData({ ...checkoutData, customerPhone: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {checkoutData.orderType === 'DELIVERY' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-300">Dirección Exacta de Entrega *</label>
                          <input
                            required
                            type="text"
                            placeholder="Calle, Carrera, Número, Casa..."
                            value={checkoutData.deliveryAddress}
                            onChange={(e) => setCheckoutData({ ...checkoutData, deliveryAddress: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-300">Barrio / Apto</label>
                          <input
                            type="text"
                            placeholder="Torre, Apto..."
                            value={checkoutData.deliveryNeighborhood}
                            onChange={(e) => setCheckoutData({ ...checkoutData, deliveryNeighborhood: e.target.value })}
                            className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Forma de Pago */}
                  <div className={styles.checkoutSection}>
                    <h4 className={styles.checkoutSectionTitle}>
                      <span>Forma de Pago</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {((paymentMethods || []).filter(m => !m.name.toLowerCase().includes('crédito') && !m.name.toLowerCase().includes('credito')).map(m => m.name).length > 0
                        ? (paymentMethods || []).filter(m => !m.name.toLowerCase().includes('crédito') && !m.name.toLowerCase().includes('credito')).map(m => m.name)
                        : ['Efectivo', 'Transferencia (Nequi/Daviplata)', 'Datafono']
                      ).map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setCheckoutData({ ...checkoutData, paymentMethodName: name })}
                          style={{
                            padding: '0.65rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                            border: checkoutData.paymentMethodName === name
                              ? '1.5px solid var(--brand-primary, #4f46e5)'
                              : '1px solid var(--border-card, #334155)',
                            backgroundColor: checkoutData.paymentMethodName === name
                              ? 'rgba(79, 70, 229, 0.16)'
                              : 'var(--bg-input, #020617)',
                            color: checkoutData.paymentMethodName === name
                              ? '#fb923c'
                              : 'var(--text-main, #f8fafc)'
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>

                    {checkoutData.paymentMethodName === 'Efectivo' && (
                      <div className="mt-2">
                        <label className="text-[11px] font-bold text-slate-300">¿Con cuánto vas a pagar? (Para llevarte cambio exacto)</label>
                        <input
                          type="text"
                          placeholder="Ej. 50.000"
                          value={checkoutData.cashChangeFor}
                          onChange={(e) => setCheckoutData({ ...checkoutData, cashChangeFor: e.target.value })}
                          className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500 mt-1"
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
                          {[
                            { label: 'Pago Exacto', val: formatMoney(totalCartAmount) },
                            { label: '$20.000', val: '20.000' },
                            { label: '$50.000', val: '50.000' },
                            { label: '$100.000', val: '100.000' },
                          ].map(chip => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => setCheckoutData({ ...checkoutData, cashChangeFor: chip.val })}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                border: checkoutData.cashChangeFor === chip.val ? '1.5px solid var(--brand-primary, #4f46e5)' : '1px solid var(--border-card, #334155)',
                                backgroundColor: checkoutData.cashChangeFor === chip.val ? 'rgba(79, 70, 229, 0.16)' : 'var(--bg-card-secondary, #1e293b)',
                                color: checkoutData.cashChangeFor === chip.val ? '#fb923c' : 'var(--text-muted, #94a3b8)',
                                cursor: 'pointer'
                              }}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  <div className={styles.checkoutSection}>
                    <label className="text-[11px] font-bold text-slate-300">Notas para la entrega / restaurante</label>
                    <input
                      type="text"
                      placeholder="Ej. Timbre dañado, llamar al llegar..."
                      value={checkoutData.notes}
                      onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Resumen Total y Botón */}
                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-300">Total a Pagar:</span>
                      <span className="text-2xl font-black text-orange-400">{formatMoney(totalCartAmount)}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingOrder || cart.length === 0 || !isStoreOpen}
                      className={styles.whatsappSubmitBtn}
                    >
                      {!isStoreOpen ? (
                        <>
                          <Clock size={20} />
                          <span>Restaurante Cerrado en este momento</span>
                        </>
                      ) : isSubmittingOrder ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          <span>Registrando Pedido...</span>
                        </>
                      ) : (
                        <>
                          <Send size={20} />
                          <span>Confirmar y Enviar por WhatsApp 📲</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-center text-slate-400">
                      Al confirmar se registrará el pedido en el restaurante y se abrirá WhatsApp con el resumen listo para enviar.
                    </span>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL HORARIO SEMANAL */}
      {showScheduleModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowScheduleModal(false)}>
          <div
            className={styles.modalWindow}
            style={{ maxWidth: '440px', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <h3 className="font-black text-base text-slate-100">Horarios de Atención</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                aria-label="Cerrar horarios"
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {scheduleStatus.weeklySchedule.map((day) => {
                const isToday = day.dayIndex === new Date().getDay();
                return (
                  <div
                    key={day.dayIndex}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: isToday ? 'rgba(79, 70, 229, 0.14)' : 'var(--bg-input, #020617)',
                      border: isToday ? '1px solid rgba(79, 70, 229, 0.4)' : '1px solid var(--border-subtle, #1e293b)',
                      color: isToday ? '#fb923c' : 'var(--text-main, #f8fafc)',
                      fontWeight: isToday ? 700 : 500
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold">{day.dayName}</span>
                      {isToday && (
                        <span style={{ fontSize: '0.625rem', backgroundColor: 'var(--brand-primary, #4f46e5)', color: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 900 }}>
                          Hoy
                        </span>
                      )}
                    </div>
                    <span className={day.isOpen ? 'text-slate-200 font-semibold text-right' : 'text-slate-500 italic'}>
                      {day.isOpen ? (
                        day.hasSecondShift && day.openTime2 && day.closeTime2 ? (
                          <span className="flex flex-col sm:inline gap-0.5">
                            <span>{format12h(day.openTime)} - {format12h(day.closeTime)}</span>
                            <span className="text-slate-500 sm:mx-1">/</span>
                            <span>{format12h(day.openTime2)} - {format12h(day.closeTime2)}</span>
                          </span>
                        ) : (
                          `${format12h(day.openTime)} - ${format12h(day.closeTime)}`
                        )
                      ) : (
                        'Cerrado'
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-extrabold rounded-xl text-xs transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto pt-8 pb-20 px-4 bg-slate-900 text-slate-400 text-center text-xs border-t border-slate-800 mb-10 sm:mb-14">
        <p className="font-semibold text-slate-300 mb-1">
          {restaurant.name} · Menú y Pedidos Online
        </p>
        <p className="text-[11px] text-slate-500">
          Tecnología y automatización gastronómica impulsada por <strong>NeoFood POS &bull; v1.0.0</strong>
        </p>
      </footer>
    </div>
  );
};

export default StoreFront;
