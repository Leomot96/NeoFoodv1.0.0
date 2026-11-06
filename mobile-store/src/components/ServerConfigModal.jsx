import React, { useState, useEffect } from 'react';
import { Settings, X, Server, Check, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { getServerUrl, setServerUrl, normalizeServerUrl } from '../services/api';
import styles from './ServerConfigModal.module.css';

export default function ServerConfigModal({ isOpen, onClose, onUrlUpdated }) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getServerUrl().then(url => {
        setCurrentUrl(url);
        setInputUrl(url);
        setSavedSuccess(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (urlToSave = inputUrl) => {
    const finalUrl = await setServerUrl(urlToSave);
    setCurrentUrl(finalUrl);
    setInputUrl(finalUrl);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (onUrlUpdated) onUrlUpdated(finalUrl);
      onClose();
    }, 600);
  };

  const handleQuickPreset = (presetUrl) => {
    setInputUrl(presetUrl);
    handleSave(presetUrl);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.titleGroup}>
            <Server size={20} className={styles.headerIcon} />
            <h3 className={styles.modalTitle}>Conexión con el Servidor</h3>
          </div>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.helperText}>
            Configura la dirección IP o dominio de tu servidor backend de NeoFood.
          </p>

          <div className={styles.inputBox}>
            <label className={styles.label}>URL Base de la API</label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://192.168.1.X:4000/api/v1"
              className={styles.inputField}
            />
          </div>

          <div className={styles.presetsGroup}>
            <span className={styles.presetsTitle}>Accesos Rápidos:</span>
            <div className={styles.presetButtons}>
              <button
                type="button"
                onClick={() => handleQuickPreset('http://192.168.0.16:4000/api/v1')}
                className={styles.presetBtn}
              >
                <Monitor size={14} />
                <span>🏠 Mi PC en Red Local (192.168.0.16)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('http://localhost:4000/api/v1')}
                className={styles.presetBtn}
              >
                <Monitor size={14} />
                <span>Navegador (localhost:4000)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('http://10.0.2.2:4000/api/v1')}
                className={styles.presetBtn}
              >
                <Smartphone size={14} />
                <span>Emulador Android (10.0.2.2:4000)</span>
              </button>
            </div>
          </div>

          <div className={styles.alertNote}>
            💡 <strong>¿Pruebas en celular físico?</strong> Asegúrate de que el celular esté en la misma red Wi-Fi de tu computador e ingresa: <code>http://192.168.0.16:4000/api/v1</code>.
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancelar
          </button>
          <button
            onClick={() => handleSave()}
            className={`${styles.saveBtn} ${savedSuccess ? styles.savedSuccess : ''}`}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>¡Guardado!</span>
              </>
            ) : (
              <span>Guardar y Reconectar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
