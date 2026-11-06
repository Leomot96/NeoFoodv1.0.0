import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, User, Server, LogOut, Smartphone, MapPin, Phone, FileText, Clock, Check, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { getFullImageUrl } from '../utils/imageUrl';
import styles from './SettingsScreen.module.css';

export const SettingsScreen = () => {
  const { user, tenant, logout, serverUrl, changeServerUrl, pingServer, triggerHaptic } = useAuth();
  const [storeConfig, setStoreConfig] = useState(null);
  const [editingServer, setEditingServer] = useState(false);
  const [tempUrl, setTempUrl] = useState(serverUrl);
  const [testingPing, setTestingPing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [pingStatus, setPingStatus] = useState(null);

  // Cargar datos completos del restaurante
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const res = await api.get('/store/config').catch(() => null);
        if (res && (res.data?.data || res.data)) {
          setStoreConfig(res.data.data || res.data);
        }
      } catch (e) {}
    };
    fetchStoreData();
  }, []);

  const restaurantData = storeConfig || tenant || user?.restaurant || user?.tenant || {};
  const restaurantName = restaurantData?.name || 'NeoFood';
  const logoUrl = restaurantData?.logoUrl ? getFullImageUrl(restaurantData.logoUrl) : null;
  const initials = restaurantName.slice(0, 2).toUpperCase();

  const handleTestPing = async () => {
    setTestingPing(true);
    setPingStatus(null);
    triggerHaptic();
    const res = await pingServer(tempUrl);
    setTestingPing(false);
    setPingStatus(res);
  };

  const handleSaveUrl = async () => {
    triggerHaptic();
    await changeServerUrl(tempUrl);
    setEditingServer(false);
    setPingStatus(null);
  };

  const handleLogout = () => {
    triggerHaptic();
    if (window.confirm('¿Seguro que deseas cerrar sesión en este dispositivo?')) {
      logout();
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Ajustes & Restaurante</h2>

      {/* 1. Ficha Institucional del Restaurante */}
      <div className={styles.card}>
        <div className={styles.tenantHeader}>
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={restaurantName}
              className={styles.tenantLogo}
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className={styles.tenantLogoFallback}>
              {initials}
            </div>
          )}

          <div className={styles.tenantInfoCol}>
            <span className={styles.tenantTag}>Restaurante Registrado</span>
            <h3 className={styles.tenantName}>{restaurantName}</h3>
            <p className={styles.tenantPlan}>
              Sistema: <span className={styles.planHighlight}>NeoFood POS</span>
            </p>
          </div>
        </div>

        <div className={styles.detailsList}>
          {restaurantData?.document && (
            <div className={styles.cardDividerRow}>
              <div className={styles.detailLabelGroup}>
                <FileText size={14} className={styles.detailIcon} />
                <span>NIT / Identificación:</span>
              </div>
              <span className={styles.detailValue}>{restaurantData.document}</span>
            </div>
          )}

          {restaurantData?.phone && (
            <div className={styles.cardDividerRow}>
              <div className={styles.detailLabelGroup}>
                <Phone size={14} className={styles.detailIcon} />
                <span>Teléfono / WhatsApp:</span>
              </div>
              <span className={styles.detailValue}>{restaurantData.phone}</span>
            </div>
          )}

          {restaurantData?.address && (
            <div className={styles.cardDividerRow}>
              <div className={styles.detailLabelGroup}>
                <MapPin size={14} className={styles.detailIcon} />
                <span>Dirección del Local:</span>
              </div>
              <span className={styles.detailValue}>{restaurantData.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Tarjeta del Usuario Conectado */}
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={styles.userAvatar}>
            <User size={20} color="#ffffff" />
          </div>
          <div>
            <h3 className={styles.userName}>{user?.name || 'Usuario del Sistema'}</h3>
            <p className={styles.userEmail}>{user?.email || ''}</p>
          </div>
        </div>

        <div className={styles.cardDividerRow} style={{ marginTop: 12 }}>
          <span>Rol en el Restaurante:</span>
          <span className={styles.roleBadge}>
            {(typeof user?.role === 'string' ? user.role : user?.role?.name) || 'Mesero / Cajero'}
          </span>
        </div>
      </div>

      {/* 3. Tarjeta de Servidor & Red */}
      <div className={styles.card}>
        <div className={styles.serverHeaderRow}>
          <div className={styles.serverTitleGroup}>
            <Server size={16} color="var(--primary-light, #4f46e5)" />
            <span>Servidor Backend</span>
          </div>

          <button
            onClick={() => {
              triggerHaptic();
              setEditingServer(!editingServer);
            }}
            className={styles.changeIpBtn}
          >
            {editingServer ? 'Cancelar' : 'Cambiar IP'}
          </button>
        </div>

        {editingServer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              className={styles.serverInput}
              placeholder="http://192.168.1.X:4000/api/v1"
            />
            {pingStatus && (
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: pingStatus.ok ? '#10b981' : '#f87171',
                  margin: 0
                }}
              >
                {pingStatus.ok ? '✓ Conexión establecida con éxito' : '✗ No se pudo conectar al servidor'}
              </p>
            )}
            <div className={styles.serverEditGrid}>
              <button
                type="button"
                onClick={handleTestPing}
                disabled={testingPing}
                className={styles.btnTest}
              >
                {testingPing ? 'Probando...' : 'Probar Conexión'}
              </button>
              <button
                type="button"
                onClick={handleSaveUrl}
                className={styles.btnSave}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className={styles.serverIpBox}>
            {serverUrl}
          </p>
        )}
      </div>

      {/* 4. Información de Versión */}
      <div className={styles.versionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={16} color="var(--text-dim, #64748b)" />
          <span>Versión Nativa POS</span>
        </div>
        <span style={{ fontFamily: 'monospace', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
          v1.0.0-staff
        </span>
      </div>

      {/* 5. Botón de Cerrar Sesión */}
      <button
        onClick={handleLogout}
        className={styles.logoutBtn}
      >
        <LogOut size={16} />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  );
};

export default SettingsScreen;
