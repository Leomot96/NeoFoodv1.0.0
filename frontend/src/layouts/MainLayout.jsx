import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  Wallet,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Building2,
  BarChart3,
  ShoppingBag,
  Bell,
  ChefHat,
  Factory,
  UserCheck,
  DollarSign,
  Calendar
} from 'lucide-react';
import storeService from '../services/store.service';
import dashboardService from '../services/dashboard.service';
import { getFullImageUrl } from '../utils/imageUrl';
import { applyDocumentBranding } from '../config/brandConfig';
import styles from './MainLayout.module.css';

const MainLayout = () => {
  const { user, restaurant, logout, updateRestaurantState } = useAuth();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Logotipo dinámico del restaurante sincronizado en tiempo real
  const [restaurantLogo, setRestaurantLogo] = useState(
    restaurant?.logoUrl || user?.restaurant?.logoUrl || user?.tenant?.logoUrl || null
  );
  const [headerLogoError, setHeaderLogoError] = useState(false);

  useEffect(() => {
    const currentLogo = restaurant?.logoUrl !== undefined
      ? restaurant.logoUrl
      : (user?.restaurant?.logoUrl || user?.tenant?.logoUrl || null);
    setRestaurantLogo(currentLogo);
    setHeaderLogoError(false);
  }, [restaurant?.logoUrl, user?.restaurant?.logoUrl, user?.tenant?.logoUrl]);

  useEffect(() => {
    storeService.getStoreConfig()
      .then(cfg => {
        if (cfg) {
          setRestaurantLogo(cfg.logoUrl || null);
          if (updateRestaurantState) {
            updateRestaurantState({
              name: cfg.name,
              logoUrl: cfg.logoUrl || null,
              primaryColor: cfg.primaryColor,
              secondaryColor: cfg.secondaryColor,
              themePreset: cfg.themePreset
            });
          }
        }
      })
      .catch(() => { });
  }, []);

  // Ventas de hoy para la cabecera rápida
  const [todaySales, setTodaySales] = useState(0);

  useEffect(() => {
    dashboardService.getDashboardData()
      .then(data => {
        const dailyVal = data?.kpis?.dailySales ?? data?.summary?.todaySales;
        if (dailyVal !== undefined) {
          setTodaySales(dailyVal);
        }
      })
      .catch(() => {});
  }, [location.pathname]);

  const currentDate = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getInitials = (name) => {
    if (!name) return 'EB';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'ADMIN':
      case 'Administrador':
        return 'Administrador';
      case 'CASHIER':
      case 'Cajero':
        return 'Caja & Atención';
      case 'KITCHEN':
      case 'Cocina':
      case 'Cocinero':
        return 'Jefe de Cocina';
      case 'MESERO':
      case 'Mesero':
        return 'Servicio & Mesero';
      default:
        return role || 'Colaborador';
    }
  };

  // Alerta en tiempo real de Pedidos de la Tienda
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newOrderToast, setNewOrderToast] = useState(null);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  // Sonido sintético de campana suave (Web Audio API)
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 800);
    } catch {
      // Ignorar si el navegador bloquea audio antes de interacción
    }
  };

  // Sondeo periódico para pedidos pendientes de la Tienda Virtual (cada 20s)
  useEffect(() => {
    let lastKnownCount = null;

    const checkPendingOrders = async () => {
      try {
        const orders = await (storeService.getStoreOrders ? storeService.getStoreOrders({ status: 'ACTIVE' }) : storeService.getAdminOrders());
        const list = Array.isArray(orders) ? orders : [];
        const pending = list.filter(o => o.status === 'PENDING');
        const count = pending.length;

        setPendingOrdersCount(count);

        if (lastKnownCount !== null && count > lastKnownCount) {
          const newestOrder = pending[0];
          playAlertSound();
          setNewOrderToast({
            orderNumber: newestOrder?.orderNumber || 'Nuevo',
            customerName: newestOrder?.customerName || 'Cliente Web',
            total: newestOrder?.totalAmount || 0
          });
        }
        lastKnownCount = count;
      } catch {
        // En caso de error de red, no interrumpir el layout
      }
    };

    checkPendingOrders();
    const interval = setInterval(checkPendingOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  // Navegación agrupada por dominios operativos del restaurante
  const navSections = [
    {
      id: 'operaciones',
      title: 'Operaciones',
      items: [
        { path: '/', name: 'Dashboard', icon: LayoutDashboard },
        { path: '/ventas', name: 'Ventas (POS)', icon: ShoppingCart },
        { path: '/cocina', name: 'Cocina', icon: ChefHat },
        {
          path: '/pedidos-tienda',
          name: 'Tienda Virtual',
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : null
        },
        { path: '/caja', name: 'Caja', icon: Wallet },
      ]
    },
    {
      id: 'stock',
      title: 'Inventario & Stock',
      items: [
        { path: '/inventario', name: 'Inventario', icon: Package },
        { path: '/produccion', name: 'Producción', icon: Factory },
        { path: '/compras', name: 'Compras', icon: Store },
        { path: '/proveedores', name: 'Proveedores', icon: Building2 },
      ]
    },
    {
      id: 'finanzas',
      title: 'Finanzas & Reportes',
      items: [
        { path: '/nomina', name: 'Nómina', icon: DollarSign },
        { path: '/facturas', name: 'Facturas', icon: FileText },
        { path: '/reportes', name: 'Reportes', icon: BarChart3 },
      ]
    },
    {
      id: 'admin',
      title: 'Administración',
      items: [
        { path: '/clientes', name: 'Clientes', icon: UserCheck },
        { path: '/usuarios', name: 'Usuarios', icon: Users },
        { path: '/configuracion', name: 'Configuración', icon: Settings },
      ]
    }
  ];

  const allNavItems = navSections.flatMap(s => s.items);
  const currentRouteName = allNavItems.find(item => item.path === location.pathname)?.name || 'Panel';
  const restaurantName = restaurant?.name || user?.restaurant?.name || 'NeoFood';

  useEffect(() => {
    applyDocumentBranding({
      name: restaurantName,
      logoUrl: restaurantLogo,
      primaryColor: restaurant?.primaryColor,
      secondaryColor: restaurant?.secondaryColor
    });
  }, [restaurantName, restaurantLogo, restaurant?.primaryColor, restaurant?.secondaryColor]);

  return (
    <div className={styles.appContainer}>

      {/* 1. Header / Navbar Superior que ocupa TODO el ancho */}
      <header className={styles.layoutHeader}>
        <div className={styles.brandGroup}>
          {/* Toggle móvil */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={styles.mobileMenuBtn}
            title="Alternar menú"
            aria-label="Alternar menú de navegación"
            aria-expanded={isSidebarOpen}
          >
            <Menu size={20} />
          </button>

          <div className={styles.brandLogoWrapper}>
            {restaurantLogo && !headerLogoError ? (
              <img
                src={getFullImageUrl(restaurantLogo)}
                alt={`Logo ${restaurantName}`}
                className={styles.brandLogoImg}
                onError={() => setHeaderLogoError(true)}
              />
            ) : (
              <div className={styles.brandLogoFallback}>
                {restaurantName ? restaurantName.slice(0, 2).toUpperCase() : 'NF'}
              </div>
            )}
          </div>
          <div className={styles.brandTextGroup}>
            <h1 className={styles.brandTitle}>
              <span className={styles.brandNameText}>{restaurantName.toUpperCase()}</span>
              <span className={styles.badgePro}>v1.0.0</span>
            </h1>
            <p className={styles.dateSubtitle}>
              <Calendar size={12} className={styles.dateIcon} />
              <span>{currentDate}</span>
            </p>
          </div>
        </div>

        <div className={styles.rightGroup}>
          {/* Quick Sales Badge */}
          <div className={styles.salesBadge}>
            <div className={styles.salesIconWrapper}>
              <DollarSign size={16} />
            </div>
            <div>
              <div className={styles.salesLabel}>Ventas de Hoy</div>
              <div className={styles.salesAmount}>
                ${Number(todaySales || 0).toLocaleString('es-CO')} COP
              </div>
            </div>
          </div>

          {/* Botón Alerta Pedidos Tienda */}
          <Link
            to="/pedidos-tienda"
            className={`${styles.headerWebOrdersBtn} ${pendingOrdersCount > 0 ? styles.headerWebOrdersBtnActive : ''}`}
            title="Ver pedidos de la Tienda Virtual"
          >
            <Bell size={16} className={styles.headerWebOrdersIcon} />
            <span className={styles.headerWebOrdersText}>Pedidos Web</span>
            {pendingOrdersCount > 0 && (
              <span className={styles.headerWebOrdersBadge}>
                {pendingOrdersCount}
              </span>
            )}
          </Link>

          {/* User Info & Logout */}
          <div className={styles.userProfile}>
            <div className={styles.avatar}>
              {getInitials(user?.name)}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>
                {user?.name || 'Usuario'}
              </div>
              <div className={styles.userRole}>
                {getRoleLabel(user?.role?.name || user?.role)}
              </div>
            </div>

            <button
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className={styles.logoutBtn}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Disposición debajo del Header: Sidebar a la izquierda y Contenido a la derecha */}
      <div className={styles.mainBodyLayout}>

        {/* Overlay para móvil */}
        {isSidebarOpen && (
          <div
            className={styles.layoutMobileOverlay}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar sin nada arriba, comenzando directamente con los módulos */}
        <aside className={`${styles.layoutSidebar} ${isSidebarOpen ? styles.layoutSidebarOpen : ''} ${isCollapsed ? `${styles.layoutSidebarCollapsed || ''} ${styles.isCollapsed || ''}` : ''}`}>

          {/* Botón cerrar para vista móvil */}
          <div className={styles.mobileCloseRow}>
            <span className={styles.mobileSectionTitle}>Módulos Operativos</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className={styles.sidebarCloseBtn}
              title="Cerrar menú"
              aria-label="Cerrar menú lateral"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navegación Principal Agrupada */}
          <nav className={styles.sidebarNav}>
            {navSections.map((section, idx) => (
              <div key={section.id} className={styles.sidebarNavGroup}>
                {!isCollapsed ? (
                  <div className={styles.sidebarSectionHeader}>
                    <span>{section.title}</span>
                  </div>
                ) : (
                  idx > 0 && <div className={styles.sidebarSectionDivider} />
                )}

                <div className={styles.sidebarGroupItems}>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      title={isCollapsed ? item.name : undefined}
                      className={({ isActive }) => `${styles.sidebarNavItem} ${isActive ? styles.active : ''} ${isCollapsed ? styles.isCollapsed : ''}`}
                    >
                      <div className={styles.sidebarIconWrapper}>
                        <item.icon size={18} />
                        {item.badge && isCollapsed && (
                          <span className={styles.sidebarBadgeDot} />
                        )}
                      </div>
                      {!isCollapsed && (
                        <div className={styles.sidebarItemRow}>
                          <span className={styles.sidebarNavItemText}>{item.name}</span>
                          {item.badge && (
                            <span className={styles.sidebarItemBadge}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer Sidebar (Sync Card & Estado del Sistema) */}
          <div className={styles.sidebarFooter}>
            <div className={styles.syncCard}>
              <div className={styles.syncTitle}>{restaurantName}</div>
              <div className={styles.syncVersion}>NeoFood &bull; v1.0.0</div>
              <div className={styles.syncStatus}>
                <span className={styles.pulseDot} />
                Sistema en Línea
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={styles.layoutMain}>

          {/* TOAST ALERTA NUEVO PEDIDO */}
          {newOrderToast && (
            <div style={{
              position: 'fixed',
              top: '5rem',
              right: '1.5rem',
              zIndex: 9999,
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '1rem 1.25rem',
              borderRadius: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              border: '2px solid var(--brand-primary, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              maxWidth: '380px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.75rem',
                backgroundColor: 'var(--brand-subtle-bg, rgba(79, 70, 229, 0.2))',
                color: 'var(--brand-primary, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Bell size={22} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fde68a' }}>
                  ¡Nuevo Pedido Web #{newOrderToast.orderNumber}!
                </span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                  Cliente: <strong>{newOrderToast.customerName}</strong>
                </span>
              </div>
              <Link
                to="/pedidos-tienda"
                onClick={() => setNewOrderToast(null)}
                style={{
                  backgroundColor: 'var(--brand-primary, #4f46e5)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  flexShrink: 0
                }}
              >
                Atender
              </Link>
              <button
                onClick={() => setNewOrderToast(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.2rem'
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Contenedor de Páginas */}
          <div className={`${styles.layoutContentView} ${location.pathname === '/ventas' ? styles.isPosView : ''}`}>
            <div className={`${styles.layoutPageBody} ${location.pathname === '/ventas' ? styles.isPosPageBody : ''}`}>
              <Outlet />
            </div>
          </div>

          {/* Footer General del Sistema */}
          <footer className={styles.layoutFooter}>
            <div className={styles.layoutFooterLeft}>
              <img src="/isotipo.svg" alt="NeoFood" className={styles.layoutFooterLogo} />
              <span className={styles.layoutFooterBrand}>NeoFood</span>
              <span className={styles.layoutFooterSep}>&bull;</span>
              <span className={styles.layoutFooterDesc}>Sistema Integral de Gestión Gastronómica</span>
              <span className={styles.layoutFooterSep}>&bull;</span>
              <span className={styles.layoutFooterVersion}>v1.0.0</span>
            </div>

            <div className={styles.layoutFooterRight}>
              <div className={styles.layoutFooterStatus}>
                <span className={styles.layoutStatusDot}></span>
                <span>Servidor Conectado</span>
              </div>
              <span className={styles.layoutFooterSep}>&bull;</span>
              <span className={styles.layoutFooterAuthor}>
                Diseñado por <strong>Leonardo Ramirez</strong>
              </span>
              <span className={styles.layoutFooterSep}>&bull;</span>
              <span className={styles.layoutFooterCopy}>
                &copy; {new Date().getFullYear()} NeoFood. Todos los derechos reservados.
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
