# 🍽️ NeoFood CRM & POS — Sistema Integral de Gestión Gastronómica

<div align="center">

![NeoFood Banner](https://img.shields.io/badge/NeoFood-POS%20%26%20CRM-4f46e5?style=for-the-badge&logoColor=white)
![Version](https://img.shields.io/badge/Versi%C3%B3n-1.0.0%20Oficial-10b981?style=for-the-badge)
![Status](https://img.shields.io/badge/Estado-Producci%C3%B3n-blue?style=for-the-badge)
![Author](https://img.shields.io/badge/Creador-Leonardo%20Ramirez-8b5cf6?style=for-the-badge)
[![Manual](https://img.shields.io/badge/Manual-de%20Usuario-0284c7?style=for-the-badge)](MANUAL_DE_USUARIO.md)
[![Certificado](https://img.shields.io/badge/Certificado-de%20Autor%C3%ADa-amber?style=for-the-badge)](CERTIFICATE.md)

<br/>

**Plataforma Integral de Punto de Venta (POS), Tienda Virtual Pública con Pedidos por WhatsApp, Pantalla de Cocina (KDS), Control de Caja y Turnos, Gestión de Inventario e Insumos, Sub-recetas y Producción, Compras, Proveedores, Facturación y Reportes Financieros en PDF para restaurantes, cafeterías, bares y establecimientos gastronómicos.**

[Manual de Usuario](MANUAL_DE_USUARIO.md) •
[Certificado de Autoría](CERTIFICATE.md) •
[Módulos](#-módulos-del-sistema) •
[Arquitectura](#-arquitectura-y-stack-tecnológico) •
[Despliegue en Producción](#-despliegue-en-producción-hostinger-vps) •
[Ecosistema Móvil (APKs)](#-ecosistema-móvil-android)

</div>

---

## 🚀 Descripción General

**NeoFood** es una solución de software integral diseñada para automatizar, controlar y elevar la eficiencia operativa de cualquier establecimiento gastronómico. La solución unifica el flujo completo del negocio:
- **Punto de Venta (POS):** Toma ágil de pedidos en salón por mesas y pedidos para llevar.
- **Pantalla Digital de Cocina (KDS):** Monitoreo en tiempo real de preparación y tiempos de despacho.
- **Inventario & Producción:** Costeo automático de insumos con sub-recetas y Costo Medio Ponderado (CMP).
- **Tienda Virtual Pública:** Horarios semanales de doble turno, personalizador de platillos y despacho directo a WhatsApp.
- **Caja & Auditoría:** Apertura de turnos con base, cierres ciegos y arqueos detallados por método de pago.
- **Facturación & Reportes:** Emisión de comprobantes en PDF corporativo y tirillas térmicas para comandas (58mm / 80mm).
- **Ecosistema Móvil Dual:** Aplicación para meseros/cajeros (APK 2) y aplicación de tienda para clientes (APK 1).

Diseñado bajo principios de **arquitectura modular limpia**, **CSS3 Nativo** optimizado (sin dependencias pesadas), máxima velocidad de respuesta e interfaz ejecutiva ultra premium.

---

## 🌟 Características del Sistema

- ⚡ **Rendimiento Ultrarrápido:** Frontend impulsado por **Vite** y **React 18**, con carga instantánea y optimización de chunks.
- 🎨 **Diseño Visual Ejecutivo:** Paleta visual oficial Índigo Corporativo (`#4f46e5`) con acentos Verde Esmeralda (`#10b981`) y modo oscuro nativo.
- 🖥️ **Punto de Venta (POS) en Pantalla Completa:** Experiencia sin scroll exterior de ventana; cuadrícula interactiva y catálogo táctil.
- 📊 **Módulo de Reportes & Exportación PDF:** Generación institucional en PDF de reportes diarios de caja, consolidados mensuales y facturas con el servicio centralizado `reportPdfService`.
- 🛡️ **Seguridad y Permisos:** Autenticación robusta con JSON Web Tokens (JWT), refresh tokens, Bcrypt y control de acceso basado en roles (*Administrador*, *Supervisor*, *Cajero*, *Mesero*).

---

## 🧩 Módulos del Sistema

| Módulo | Ruta | Descripción |
| :--- | :--- | :--- |
| 🛒 **Punto de Venta (POS)** | `/ventas` | Salón interactivo con mesas, venta rápida para llevar, modificadores, notas de cocina y propinas. |
| 🍳 **Cocina Digital (KDS)** | `/cocina` | Monitor de comandas en preparación en tiempo real para cocina y barras. |
| 🏪 **Tienda Virtual** | `/tienda/:slug` | Menú web público para clientes con personalizador de platillos y checkout WhatsApp. |
| 📲 **Pedidos Tienda Web** | `/pedidos-tienda` | Bandeja de órdenes recibidas desde la tienda virtual, cambio de estados y cobro a caja. |
| 💵 **Caja y Turnos** | `/caja` | Apertura de turno con base, arqueos ciegos, ingresos/egresos y desglose de formas de pago. |
| 🧾 **Facturas** | `/facturas` | Historial de comprobantes emitidos, filtro por fechas y exportación en PDF. |
| 📊 **Reportes** | `/reportes` | Analíticas de ventas, comparativas históricas y descarga de balances. |
| 📦 **Inventario e Insumos** | `/inventario` | Control de materias primas, unidades de medida, costos unitarios y recetas. |
| 🏭 **Producción** | `/produccion` | Formulación de sub-recetas y lotes con Costo Medio Ponderado (CMP). |
| 🛍️ **Compras** | `/compras` | Registro de facturas de compra y recepción de insumos. |
| 🏢 **Proveedores** | `/proveedores` | Directorio con NIT, canales de contacto y vinculación a compras. |
| 👥 **Clientes** | `/clientes` | Fichas de clientes, historial de consumo y cartera de créditos/fiados. |
| 🔐 **Usuarios y Roles** | `/usuarios` | Gestión de cuentas de personal con permisos jerárquicos. |
| ⚙️ **Configuración** | `/configuracion` | Configuración de mesas, métodos de cobro, logo, impresora POS y horarios. |
| 📈 **Dashboard** | `/` | Vista gerencial con ventas del día, pedidos activos y métricas clave. |

---

## 📱 Ecosistema Móvil Android

El sistema cuenta con dos aplicaciones móviles nativas creadas con **Capacitor 8**:

1. **`mobile/` (APK 2 - Staff POS):**
   - Diseñada para meseros, cajeros y personal de cocina.
   - Permite tomar pedidos en mesas, enviar a comanda y cobrar en caja con retroalimentación háptica.
   - Incluye selector de servidor configurable para conectarse a cualquier dominio de restaurante.
2. **`mobile-store/` (APK 1 - Tienda Virtual Clientes):**
   - Diseñada para clientes finales.
   - Permite explorar el menú, personalizar platillos y enviar el pedido directo a WhatsApp.

---

## 🛠️ Arquitectura y Stack Tecnológico

```mermaid
graph TD
    ClientWeb[🖥️ Terminal Web POS / Caja / Dashboard] -->|React 18 + Vite| Frontend[🎨 Frontend Web]
    ClientAPK1[📱 APK 1: Tienda Clientes] -->|Capacitor 8 + React 19| API
    ClientAPK2[📱 APK 2: Staff POS Meseros] -->|Capacitor 8 + React 19| API
    Frontend -->|Axios + JWT| API[⚙️ Node.js + Express API]
    API -->|Prisma ORM| Database[(🐬 MySQL 8 Server)]
```

### Backend
- **Entorno:** Node.js (>= 18.x / 20.x LTS)
- **Framework Web:** Express.js
- **Base de Datos:** MySQL
- **ORM:** Prisma ORM
- **Seguridad:** JWT (Access + Refresh Tokens) + Bcrypt + Cors + Helmet + Rate Limiter

### Frontend
- **Librería Principal:** React 18
- **Empaquetador:** Vite 5
- **Estilos:** CSS Modules + Variables CSS Nativas
- **Iconografía:** Lucide React
- **Reportería PDF:** `jspdf` + `jspdf-autotable`

---

## 🚀 Despliegue en Producción (Hostinger VPS)

### 1. Variables de Entorno en Servidor (`Backend/.env`)
```env
PORT=4000
NODE_ENV=production
JWT_SECRET="genera_una_clave_segura_de_64_caracteres"
JWT_REFRESH_SECRET="genera_otra_clave_segura_de_64_caracteres"
DATABASE_URL="mysql://neofood_user:password_seguro@localhost:3306/neofood_db"
FRONTEND_URL="https://tu-restaurante.com"
CORS_ORIGINS="https://tu-restaurante.com,https://pedidos.tu-restaurante.com"
```

### 2. Variables de Entorno en Frontend (`frontend/.env`)
```env
VITE_API_URL=https://api.tu-restaurante.com/api/v1
VITE_BRAND_NAME="NeoFood"
VITE_BRAND_SLUG="neofood"
VITE_BRAND_THEME_PRESET="landing"
VITE_BRAND_PRIMARY="#4f46e5"
VITE_BRAND_SECONDARY="#10b981"
VITE_APP_MODE="auto"
```

### 3. Puesta en Marcha con PM2 y Nginx
```bash
# En el VPS (Hostinger):
# 1. Base de datos e inicialización limpia
cd Backend
npx prisma migrate deploy
npm run seed:clean

# 2. Iniciar Backend con PM2
pm2 start src/server.js --name "neofood-api"
pm2 save

# 3. Compilar Frontend
cd ../frontend
npm run build
# Los archivos de dist/ se sirven con Nginx apuntando al dominio del restaurante
```

### 4. Certificados SSL (HTTPS)
```bash
sudo certbot --nginx -d tu-restaurante.com -d api.tu-restaurante.com
```

---

## 🔑 Credenciales Iniciales de Producción

| Usuario | Contraseña | Rol | Acceso |
| :--- | :--- | :--- | :--- |
| `admin@neofood.com` | `123456` | **Administrador** | Control total del sistema |

> [!IMPORTANT]
> Recuerda cambiar la contraseña del administrador inmediatamente después del primer inicio de sesión desde el módulo `/usuarios`.

---

## 👨‍💻 Autoría y Propiedad Intelectual

<div align="center">

**NeoFood CRM & POS** — Versión **1.0.0 Oficial de Producción**  
Diseñado, Creado y Arquitectado Exclusivamente por **Leonardo Ramirez**  
*Autor y Titular de los Derechos Morales y Patrimoniales de la Obra de Software*  
*Sistema Integral de Gestión Gastronómica &copy; 2026. Todos los derechos reservados.*

[📜 Ver Certificado Oficial de Creación y Propiedad Intelectual](CERTIFICATE.md)

</div>
