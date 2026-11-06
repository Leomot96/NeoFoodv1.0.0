import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Users, Plus, Edit, Trash2, Search,
  Eye, EyeOff, UserCheck, UserX, Phone
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';
import { validatePassword } from '../utils/passwordValidator';
import styles from './UsersManager.module.css';

const UsersManager = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Estado para modal de confirmación de eliminación
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', roleId: '', isActive: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles')
      ]);
      setUsers(usersRes.data?.data || []);
      setRoles(rolesRes.data?.data || []);
    } catch (err) {
      console.error('Error al cargar datos de usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ 
        name: user.name, 
        email: user.email, 
        phone: user.phone || '', 
        password: '', 
        roleId: user.roleId, 
        isActive: user.isActive 
      });
    } else {
      setEditingUser(null);
      setFormData({ 
        name: '', 
        email: '', 
        phone: '', 
        password: '', 
        roleId: roles.length > 0 ? roles[0].id : '', 
        isActive: true 
      });
    }
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.roleId) return alert("Debes seleccionar un rol válido.");

    if (!editingUser || (formData.password && formData.password.trim() !== '')) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        alert(passwordValidation.message);
        return;
      }
    }

    try {
      const payload = { ...formData };
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al guardar usuario');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/users/${userToDelete.id}`);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar usuario');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getRoleBadge = (roleName) => {
    const name = roleName?.toUpperCase() || 'DESCONOCIDO';
    if (name.includes('ADMIN')) return <span className={`${styles.roleBadge} ${styles.roleBadgeAdmin}`}>{name}</span>;
    if (name.includes('SUPERVISOR')) return <span className={`${styles.roleBadge} ${styles.roleBadgeSupervisor}`}>{name}</span>;
    if (name.includes('CAJA') || name.includes('CAJERO')) return <span className={`${styles.roleBadge} ${styles.roleBadgeCaja}`}>{name}</span>;
    return <span className={`${styles.roleBadge} ${styles.roleBadgeDefault}`}>{name}</span>;
  };

  const filteredUsers = users.filter(user => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = user.name?.toLowerCase().includes(q);
      const matchEmail = user.email?.toLowerCase().includes(q);
      const matchPhone = user.phone?.toLowerCase().includes(q);
      const matchRole = user.role?.name?.toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchRole;
    }
    return true;
  });

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={styles.usersPage}>
      {/* HEADER */}
      <div className={styles.usersHeader}>
        <div>
          <h1 className={styles.usersTitle}>
            <Users style={{ color: 'var(--primary)' }} /> Personal y Accesos
          </h1>
          <p className={styles.usersSubtitle}>
            Gestiona los usuarios del sistema y sus niveles de permiso
          </p>
        </div>
        <button 
          onClick={() => openModal()} 
          className="neo-btn neo-btn-primary"
          title="Crear nuevo usuario"
        >
          <Plus size={20} /> Nuevo Usuario
        </button>
      </div>

      {/* BARRA DE FILTROS & BÚSQUEDA */}
      <div className={styles.usersFiltersBar}>
        <div className={styles.usersFiltersLeft}>
          <div className={styles.usersSearchBox}>
            <Search size={18} className={styles.usersSearchIcon} />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o rol..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.usersSearchInput}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className={styles.clearSearchBtn}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="neo-table-card">
        <div className="neo-table-responsive">
          <table className="neo-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario / Correo</th>
                <th>Celular / Teléfono</th>
                <th className="text-center">Rol</th>
                <th className="text-center">Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <UserX size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }} />
                      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {searchTerm
                          ? 'No se encontraron usuarios coincidentes'
                          : 'No hay usuarios registrados'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Crea nuevos usuarios y asígnales roles en el sistema.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.map(user => (
                <tr key={user.id} style={{ opacity: !user.isActive ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {user.phone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={13} style={{ color: 'var(--text-muted)' }} /> {user.phone}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No registrado</span>
                    )}
                  </td>

                  {/* Rol */}
                  <td className="text-center">{getRoleBadge(user.role?.name)}</td>

                  {/* Estado */}
                  <td className="text-center">
                    {user.isActive ? (
                      <span className="neo-badge neo-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <UserCheck size={12} /> Activo
                      </span>
                    ) : (
                      <span className="neo-badge neo-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <UserX size={12} /> Inactivo
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="text-right">
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openModal(user)}
                        className="neo-btn-icon neo-btn-icon-primary"
                        title="Editar usuario"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteModalOpen(true);
                        }}
                        disabled={currentUser?.id === user.id}
                        className="neo-btn-icon neo-btn-icon-danger"
                        title={currentUser?.id === user.id ? "No puedes eliminar tu propia cuenta en uso" : "Eliminar definitivamente"}
                        style={currentUser?.id === user.id ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        {filteredUsers.length > pageSize && (
          <div className="neo-table-pagination">
            <span>
              Mostrando {Math.min(filteredUsers.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredUsers.length, currentPage * pageSize)} de {filteredUsers.length} usuarios
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {Array.from({ length: Math.ceil(filteredUsers.length / pageSize) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`neo-pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR */}
      {isModalOpen && (
        <div className="neo-modal-backdrop">
          <div className="neo-modal" style={{ maxWidth: '36rem' }}>
            <div className="neo-modal-header">
              <h2 className="neo-modal-title">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="neo-modal-close-btn">✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="neo-form-group" style={{ marginBottom: 0 }}>
                    <label className="neo-label">Nombre Completo *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="neo-input"
                    />
                  </div>

                  <div className="neo-form-group" style={{ marginBottom: 0 }}>
                    <label className="neo-label">Correo Electrónico *</label>
                    <input
                      required
                      type="email"
                      placeholder="ejemplo@restaurante.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="neo-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div className="neo-form-group" style={{ marginBottom: 0 }}>
                    <label className="neo-label">Número de Celular / Teléfono</label>
                    <input
                      type="tel"
                      placeholder="Ej. 300 123 4567"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="neo-input"
                    />
                  </div>

                  <div className="neo-form-group" style={{ marginBottom: 0 }}>
                    <label className="neo-label">Rol en el sistema *</label>
                    <CustomSelect
                      value={formData.roleId}
                      onChange={val => setFormData({ ...formData, roleId: val })}
                      options={roles.map(r => ({ value: r.id, label: r.name }))}
                      placeholder="Selecciona..."
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: editingUser ? 'repeat(2, 1fr)' : '1fr', gap: '1rem' }}>
                  <div className="neo-form-group" style={{ marginBottom: 0 }}>
                    <label className="neo-label">
                      Contraseña {editingUser ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Dejar en blanco para conservar)</span> : '*'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        required={!editingUser}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={editingUser ? '••••••••' : 'Mínimo 8 caracteres (A-Z, a-z, 0-9, @#$)'}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="neo-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {formData.password && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem 0.6rem',
                        marginTop: '0.4rem',
                        fontSize: '0.72rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        padding: '0.4rem 0.6rem'
                      }}>
                        <span style={{ color: validatePassword(formData.password).checks.length ? '#16a34a' : '#94a3b8', fontWeight: 500 }}>
                          {validatePassword(formData.password).checks.length ? '✓' : '○'} Mín. 8 caracteres
                        </span>
                        <span style={{ color: validatePassword(formData.password).checks.uppercase ? '#16a34a' : '#94a3b8', fontWeight: 500 }}>
                          {validatePassword(formData.password).checks.uppercase ? '✓' : '○'} Mayúscula (A-Z)
                        </span>
                        <span style={{ color: validatePassword(formData.password).checks.lowercase ? '#16a34a' : '#94a3b8', fontWeight: 500 }}>
                          {validatePassword(formData.password).checks.lowercase ? '✓' : '○'} Minúscula (a-z)
                        </span>
                        <span style={{ color: validatePassword(formData.password).checks.number ? '#16a34a' : '#94a3b8', fontWeight: 500 }}>
                          {validatePassword(formData.password).checks.number ? '✓' : '○'} Número (0-9)
                        </span>
                        <span style={{ color: validatePassword(formData.password).checks.special ? '#16a34a' : '#94a3b8', fontWeight: 500 }}>
                          {validatePassword(formData.password).checks.special ? '✓' : '○'} Especial (!@#$...)
                        </span>
                      </div>
                    )}
                  </div>

                  {editingUser && (
                    <div className="neo-form-group" style={{ marginBottom: 0 }}>
                      <label className="neo-label">Estado de la cuenta</label>
                      <CustomSelect
                        value={formData.isActive ? 'true' : 'false'}
                        onChange={val => setFormData({ ...formData, isActive: val === 'true' })}
                        options={[
                          { value: 'true', label: 'Activo (Acceso permitido)' },
                          { value: 'false', label: 'Inactivo (Bloqueado)' }
                        ]}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="neo-modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="neo-btn neo-btn-secondary">Cancelar</button>
                <button type="submit" className="neo-btn neo-btn-primary">Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {isDeleteModalOpen && userToDelete && (
        <div className="neo-modal-backdrop">
          <div className="neo-modal" style={{ maxWidth: '32rem' }}>
            <div className="neo-modal-header">
              <h2 className="neo-modal-title" style={{ color: '#ef4444' }}>
                <Trash2 size={20} /> Eliminar Usuario Definitivamente
              </h2>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="neo-modal-close-btn"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                ¿Estás seguro de que deseas eliminar permanentemente al usuario <strong>"{userToDelete.name}"</strong> (<code>{userToDelete.email}</code>)?
              </p>

              <div style={{
                padding: '0.85rem 1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.65rem',
                color: '#991b1b',
                fontSize: '0.825rem',
                lineHeight: 1.4
              }}>
                <strong>Atención:</strong> Esta acción es irreversible y eliminará al usuario junto con todos sus registros vinculados en el sistema.
              </div>
            </div>

            <div className="neo-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                disabled={deleteLoading}
                className="neo-btn neo-btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.65rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {deleteLoading ? 'Eliminando...' : 'Sí, Eliminar Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManager;
