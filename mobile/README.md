# 📱 NeoFood Staff POS — APK 2 (Meseros, Cajeros y KDS)

Aplicación móvil nativa construida con **Capacitor 8** y **React 19** para la operación en salón y cocina de **NeoFood**.

---

## 🚀 Funcionalidades Principales
- **Toma de Pedidos en Mesas:** Selección de mesas, productos, adiciones y notas de cocina.
- **Cobro Rápido y Cierre:** Liquidación directa de cuentas y comanderas.
- **Pantalla de Cocina Móvil (KDS):** Visualización y despacho de comandas en preparación.
- **Configuración Dinámica de Servidor:** Selector de URL de servidor (`https://api.tu-restaurante.com`) con guardado permanente en el dispositivo.
- **Feedback Sensorial:** Vibración háptica semántica en operaciones clave.

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
