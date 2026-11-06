import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md', // sm, md, lg, xl, xxl
  maxWidth,
  style = {},
  className = '',
  headerStyle = {},
  titleStyle = {},
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = styles[size] || styles.md;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div 
        className={`${styles.modal} ${sizeClass} ${className}`.trim()}
        style={{
          ...(maxWidth ? { maxWidth } : {}),
          ...style,
        }}
      >
        {(title || icon) ? (
          <div className={styles.header} style={headerStyle}>
            <div>
              <h2 className={styles.title} style={titleStyle}>
                {icon && <span>{icon}</span>}
                {title}
              </h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={styles.closeBtn}
                title="Cerrar (Esc)"
              >
                <X size={20} />
              </button>
            )}
          </div>
        ) : (
          onClose && (
            <button
              type="button"
              onClick={onClose}
              className={styles.closeBtn}
              style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          )
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
