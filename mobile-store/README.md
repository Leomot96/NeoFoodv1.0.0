# 🛍️ NeoFood Store Mobile — APK 1 (Tienda Virtual para Clientes)

Aplicación móvil nativa construida con **Capacitor 8** y **React 19** para el catálogo y pedidos de clientes de **NeoFood**.

---

## 🚀 Funcionalidades Principales
- **Catálogo Digital:** Navegación por categorías y productos destacados.
- **Personalizador de Platillos:** Selección de términos, adiciones y notas especiales.
- **Carrito y Checkout:** Resumen de compra y despacho directo a WhatsApp o pedidos en línea.
- **Soporte Offline & Red Local:** Compatibilidad de tráfico HTTP/HTTPS y sincronización rápida.

---

## 🛠️ Comandos de Compilación y Sincronización

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar bundle web
npm run build

# 3. Sincronizar con el proyecto Android
npm run sync

# 4. Generar APK en Android Studio
npx cap open android
```

---

## ⚙️ Configuración (.env)
```env
VITE_API_URL=https://api.tu-restaurante.com/api/v1
```
