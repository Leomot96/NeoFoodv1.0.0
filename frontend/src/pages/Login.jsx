import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Utensils, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { getFullImageUrl } from '../utils/imageUrl';
import { applyDocumentBranding } from '../config/brandConfig';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const { login, restaurant } = useAuth();
  const navigate = useNavigate();

  const restaurantName = restaurant?.name || 'NeoFood';
  const logoUrl = restaurant?.logoUrl ? getFullImageUrl(restaurant.logoUrl) : null;

  useEffect(() => {
    setLogoError(false);
  }, [restaurant?.logoUrl]);

  useEffect(() => {
    applyDocumentBranding({
      name: restaurantName,
      logoUrl: restaurant?.logoUrl,
      primaryColor: '#4f46e5',
      secondaryColor: '#10b981'
    });
  }, [restaurantName, restaurant?.logoUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.glowTopLeft} />
      <div className={styles.glowBottomRight} />

      <div className={styles.loginCard}>

        <div className={styles.loginLogoBox}>
          <img src="/isotipo.svg" alt="NeoFood" className={styles.loginIsotipoImg} />
          <img src="/logo_blanco.svg" alt="NeoFood" className={styles.loginLogoTextImg} />
        </div>
        <div className={styles.brandHeader}>
          <p className={styles.brandSubtitle}>
            Panel de Control & Punto de Venta Web
          </p>
        </div>
        {/* Cabecera de Marca del Restaurante */}
        {/*
        <div className={styles.brandHeader}>
          <div className={styles.brandLogoBox}>
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={`Logo ${restaurantName}`}
                className={styles.brandLogoImg}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className={styles.brandLogoPlaceholder}>
                <Utensils size={36} color="#ffffff" strokeWidth={2.2} />
              </div>
            )}
          </div>
          <h1 className={styles.brandTitle}>{restaurantName}</h1>
          <p className={styles.brandSubtitle}>
            {restaurant?.description || 'Panel de Control & Punto de Venta'}
          </p>
        </div>
        */}

        {/* Tarjeta Principal del Formulario */}
        <div className={styles.formBox}>
          {error && (
            <div className={styles.errorAlert}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Correo Electrónico</label>
              <div className={styles.inputWrapper}>
                <div className={styles.inputIcon}>
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.inputField}
                  placeholder="admin@restaurante.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <div className={styles.inputIcon}>
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.inputField}
                  style={{ paddingRight: '2.75rem' }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.submitBtn}
            >
              {isSubmitting ? (
                <div className={styles.spinner} />
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerBrandRow}>
          <img src="/isotipo.svg" alt="NeoFood" className={styles.footerIsotipo} />
          <img src="/logo_blanco.svg" alt="NeoFood" className={styles.footerLogo} />
        </div>
        <p className={styles.footerTagline}>Sistema Integral de Gestión Gastronómica</p>
        <p className={styles.footerText}>
          © {new Date().getFullYear()} {restaurantName} • Powered by <strong>NeoFood v1.0.0</strong>
        </p>
      </footer>
    </div>
  );
}
