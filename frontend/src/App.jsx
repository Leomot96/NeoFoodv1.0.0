import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout y Login
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';

// Landing Page Comercial
const LandingPage = lazy(() => import('./pages/Landing/LandingPage'));

// Importación Lazy para el Dashboard
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Importaciones Lazy para los módulos
const Ventas = lazy(() => import('./pages/Ventas'));
const Cocina = lazy(() => import('./pages/Cocina'));
const StoreOrdersManager = lazy(() => import('./pages/StoreOrdersManager'));
const Caja = lazy(() => import('./pages/Caja'));
const InvoicesManager = lazy(() => import('./pages/InvoicesManager'));
const Nomina = lazy(() => import('./pages/Nomina'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Produccion = lazy(() => import('./pages/Production/ProductionManager'));
const Compras = lazy(() => import('./pages/Compras'));
const SuppliersManager = lazy(() => import('./pages/SuppliersManager'));
const Usuarios = lazy(() => import('./pages/UsersManager'));
const CustomersManager = lazy(() => import('./pages/CustomersManager'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const StoreFront = lazy(() => import('./pages/StoreFront'));
const LegalPages = lazy(() => import('./pages/Legal/LegalPages'));

import CookieBanner from './components/ui/CookieBanner';
import { detectHostRouteMode } from './config/brandConfig';

const LoadingFallback = () => (
  <div className="neo-loading-center">
    <div className="neo-spinner"></div>
  </div>
);

// Listener global para garantizar que ABSOLUTAMENTE TODOS los modales del sistema se cierren con la tecla Escape
const GlobalEscapeModalHandler = () => {
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        const backdrops = Array.from(
          document.querySelectorAll('.neo-modal-backdrop, [class*="modalBackdrop"], [class*="backdrop"], [role="dialog"], .fixed.inset-0')
        );
        if (backdrops.length > 0) {
          const topBackdrop = backdrops[backdrops.length - 1];
          const closeBtn = topBackdrop.querySelector(
            '.neo-modal-close-btn, button[title*="Cerrar"], button[class*="closeBtn"], button:has(svg.lucide-x), button:has(svg[class*="lucide-x"])'
          );
          if (closeBtn) {
            closeBtn.click();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return null;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/ventas" replace />;
};

// Enrutador raíz inteligente por subdominio / modo de despliegue:
// - Si entra por el dominio principal del restaurante (ej: restaurante.com o ?mode=store): "/" muestra directo la Tienda Virtual.
// - Si entra por el subdominio administrativo (ej: panel.restaurante.com o ?mode=panel): "/" pide Login o abre el Dashboard.
// - En entorno comercial NeoFood / localhost: "/" muestra la Landing Page si no hay sesión, o el Dashboard si está autenticado.
const RootRoute = () => {
  const { user } = useAuth();
  const location = useLocation();
  const hostMode = detectHostRouteMode();

  if (location.pathname === '/' && hostMode === 'store') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StoreFront />
      </Suspense>
    );
  }

  if (!user) {
    if (location.pathname === '/' && hostMode !== 'panel') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <LandingPage />
        </Suspense>
      );
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <MainLayout />;
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/landing" element={<Suspense fallback={<LoadingFallback />}><LandingPage /></Suspense>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/tienda" element={<Suspense fallback={<LoadingFallback />}><StoreFront /></Suspense>} />
        <Route path="/tienda/:slug" element={<Suspense fallback={<LoadingFallback />}><StoreFront /></Suspense>} />

        {/* Centro Legal y Normativo */}
        <Route path="/legal" element={<Suspense fallback={<LoadingFallback />}><LegalPages /></Suspense>} />
        <Route path="/terminos" element={<Suspense fallback={<LoadingFallback />}><LegalPages /></Suspense>} />
        <Route path="/privacidad" element={<Suspense fallback={<LoadingFallback />}><LegalPages /></Suspense>} />
        <Route path="/cookies" element={<Suspense fallback={<LoadingFallback />}><LegalPages /></Suspense>} />
        <Route path="/sla" element={<Suspense fallback={<LoadingFallback />}><LegalPages /></Suspense>} />

        {/* Sistema Interno CRM & POS */}
        <Route path="/" element={<RootRoute />}>
          <Route index element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
          <Route path="ventas" element={<Suspense fallback={<LoadingFallback />}><Ventas /></Suspense>} />
          <Route path="cocina" element={<Suspense fallback={<LoadingFallback />}><Cocina /></Suspense>} />
          <Route path="pedidos-tienda" element={<Suspense fallback={<LoadingFallback />}><StoreOrdersManager /></Suspense>} />
          <Route path="caja" element={<Suspense fallback={<LoadingFallback />}><Caja /></Suspense>} />
          <Route path="nomina" element={<Suspense fallback={<LoadingFallback />}><Nomina /></Suspense>} />
          <Route path="facturas" element={<Suspense fallback={<LoadingFallback />}><InvoicesManager /></Suspense>} />
          <Route path="reportes" element={<Suspense fallback={<LoadingFallback />}><Reportes /></Suspense>} />
          <Route path="inventario" element={<Suspense fallback={<LoadingFallback />}><Inventario /></Suspense>} />
          <Route path="produccion" element={<Suspense fallback={<LoadingFallback />}><Produccion /></Suspense>} />
          <Route path="compras" element={<Suspense fallback={<LoadingFallback />}><Compras /></Suspense>} />
          <Route path="proveedores" element={<Suspense fallback={<LoadingFallback />}><SuppliersManager /></Suspense>} />
          <Route path="usuarios" element={<Suspense fallback={<LoadingFallback />}><Usuarios /></Suspense>} />
          <Route path="clientes" element={<Suspense fallback={<LoadingFallback />}><CustomersManager /></Suspense>} />
          <Route path="configuracion" element={<Suspense fallback={<LoadingFallback />}><Configuracion /></Suspense>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <GlobalEscapeModalHandler />
      <CookieBanner />
    </BrowserRouter>
  );
};

export default App;
