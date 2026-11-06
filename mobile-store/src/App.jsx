import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AlertCircle, RefreshCw, ShoppingBag, Utensils } from 'lucide-react';
import { storeService } from './services/api';
import { getStoreScheduleStatus } from './utils/schedule';
import Header from './components/Header';
import CategoryNav from './components/CategoryNav';
import FeaturedCarousel from './components/FeaturedCarousel';
import ProductCard from './components/ProductCard';
import ProductCustomizerModal from './components/ProductCustomizerModal';
import CartFloatingBar from './components/CartFloatingBar';
import CheckoutModal from './components/CheckoutModal';
import ServerConfigModal from './components/ServerConfigModal';
import styles from './App.module.css';

export default function App() {
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Estados de navegación y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Estado para el modal de personalización (Paso 2)
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Estado del Carrito
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('neofood_store_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Guardar carrito en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('neofood_store_cart', JSON.stringify(cartItems));
    } catch (e) {}
  }, [cartItems]);

  const handleAddToCart = (newItem) => {
    setCartItems(prev => [...prev, newItem]);
  };

  const handleUpdateCartQuantity = (index, newQty) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (item) {
        updated[index] = {
          ...item,
          quantity: newQty,
          totalPrice: item.unitPrice * newQty
        };
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index) => {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    try {
      localStorage.removeItem('neofood_store_cart');
    } catch (e) {}
    setCartItems([]);
  };

  // Inicialización de Capacitor UI
  useEffect(() => {
    const initUI = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0B0F19' });
        await SplashScreen.hide();
      } catch (e) {
        // En navegador
      }
    };
    initUI();
  }, []);

  // Carga de catálogo desde el backend
  const loadStore = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await storeService.getPublicStore('default');
      setStoreData(data);
    } catch (err) {
      console.error('Error al cargar tienda:', err);
      setError('No pudimos cargar el menú. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  const restaurant = storeData?.restaurant;
  const categories = useMemo(() => storeData?.categories || [], [storeData]);

  // Horario del restaurante
  const scheduleStatus = useMemo(() => {
    return getStoreScheduleStatus(restaurant?.storeSchedule || restaurant?.schedule);
  }, [restaurant?.storeSchedule, restaurant?.schedule]);

  // Productos destacados para el carrusel superior (primeros 5 o marcados)
  const featuredProducts = useMemo(() => {
    const allProds = categories.flatMap(c => c.products || []);
    return allProds.slice(0, 5);
  }, [categories]);

  // Manejador del toque en un producto con microvibración háptica
  const handleSelectProduct = (product) => {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Navegador
    }
    setSelectedProduct(product);
  };

  // Filtrado reactivo de productos por búsqueda y por categoría
  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return categories
      .map(cat => {
        // Filtrar por categoría seleccionada
        if (activeCategory !== 'all' && String(cat.id) !== activeCategory) {
          return null;
        }

        // Filtrar productos por término de búsqueda
        const filteredProducts = (cat.products || []).filter(prod => {
          if (!query) return true;
          const matchName = prod.name?.toLowerCase().includes(query);
          const matchDesc = prod.description?.toLowerCase().includes(query);
          return matchName || matchDesc;
        });

        if (filteredProducts.length === 0) return null;

        return {
          ...cat,
          products: filteredProducts
        };
      })
      .filter(Boolean);
  }, [categories, activeCategory, searchTerm]);

  return (
    <div className={styles.appContainer}>
      {/* 1. Header Minimalista con Buscador */}
      <Header
        restaurant={restaurant}
        scheduleStatus={scheduleStatus}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* 2. Selector Sticky de Categorías */}
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={(catId) => {
          try {
            Haptics.impact({ style: ImpactStyle.Light });
          } catch (e) {}
          setActiveCategory(catId);
        }}
      />

      {/* 3. Contenido Principal */}
      <main className={styles.mainContent}>
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Cargando delicias del menú...</p>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>
            <AlertCircle size={44} className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={loadStore} className={styles.retryBtn}>
                <RefreshCw size={16} />
                <span>Reintentar</span>
              </button>
              <button
                onClick={() => setIsConfigOpen(true)}
                className={styles.configServerBtn}
              >
                Configurar Servidor
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Carrusel de Destacados (solo si no hay búsqueda activa) */}
            {!searchTerm && activeCategory === 'all' && (
              <FeaturedCarousel
                products={featuredProducts}
                onSelectProduct={handleSelectProduct}
              />
            )}

            {/* Listado de Productos Organizado por Categorías */}
            <div className={styles.catalogSection}>
              {filteredCategories.length === 0 ? (
                <div className={styles.emptySearchBox}>
                  <Utensils size={36} className={styles.emptyIcon} />
                  <p className={styles.emptyTitle}>No encontramos resultados</p>
                  <p className={styles.emptySubtitle}>
                    Intenta con otra palabra o categoría.
                  </p>
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <section key={cat.id} className={styles.categoryBlock}>
                    <div className={styles.categoryHeader}>
                      <h2 className={styles.categoryTitle}>{cat.name}</h2>
                      <span className={styles.categoryCount}>
                        {cat.products.length} {cat.products.length === 1 ? 'plato' : 'platos'}
                      </span>
                    </div>

                    <div className={styles.productList}>
                      {cat.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onSelect={handleSelectProduct}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* 4. Barra Flotante Canasta Rappi (Paso 3) */}
      <CartFloatingBar
        cartItems={cartItems}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* 5. Bottom Sheet de Personalización del Plato (Paso 2) */}
      {selectedProduct && (
        <ProductCustomizerModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* 6. Modal / Drawer de Checkout Express con WhatsApp (Paso 3) */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        restaurant={restaurant}
        paymentMethods={storeData?.paymentMethods || []}
      />

      {/* 7. Modal de Configuración de Servidor */}
      <ServerConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onUrlUpdated={() => loadStore()}
      />
    </div>
  );
}
