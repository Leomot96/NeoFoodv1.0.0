import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Users,
  Wallet,
  CreditCard,
  Plus,
  Search,
  Printer,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  UserCheck,
  Calendar
} from 'lucide-react';
import Datepicker from 'react-tailwindcss-datepicker';
import expenseService from '../services/expense.service';
import printerService from '../services/printerService';
import Modal from '../components/ui/Modal/Modal';
import styles from './Nomina.module.css';

const PRESET_CONCEPTS = [
  'Turno Diario / Jornal',
  'Quincena (1ra Quincena)',
  'Quincena (2da Quincena)',
  'Salario Mensual',
  'Horas Extras / Refuerzo',
  'Propinas Repartidas',
  'Adelanto / Préstamo',
  'Liquidación / Bono',
  'Otro'
];

export default function Nomina() {
  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [kpis, setKpis] = useState({
    totalPaid: 0,
    cashPaid: 0,
    transferPaid: 0,
    paymentsCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('month'); // 'today' | 'week' | 'month' | 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedbackToast, setFeedbackToast] = useState(null);

  const showFeedback = (message, type = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

  // Estado del Formulario
  const [workerType, setWorkerType] = useState('registered'); // 'registered' | 'manual'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [manualName, setManualName] = useState('');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('Turno Diario / Jornal');
  const [customConcept, setCustomConcept] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo (Caja)');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Inicializar rango de fechas según preset
  const applyPresetDates = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const toYMD = (d) => d.toISOString().slice(0, 10);

    if (preset === 'today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const day = now.getDay() || 7; // Lunes = 1
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(toYMD(mon));
      setEndDate(toYMD(sun));
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(lastDay));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    applyPresetDates('month');
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const staff = await expenseService.getStaffList();
      setStaffList(staff);
      if (staff.length > 0) {
        setSelectedUserId(staff[0].id);
      }
    } catch (err) {
      console.error('Error cargando colaboradores:', err);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await expenseService.getPayrollPayments({
        startDate,
        endDate,
        search
      });
      setPayments(data.records || []);
      setKpis(data.kpis || { totalPaid: 0, cashPaid: 0, transferPaid: 0, paymentsCount: 0 });
    } catch (err) {
      console.error('Error cargando nómina:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadPayments();
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(num);
  };

  const resetForm = () => {
    setWorkerType('registered');
    if (staffList.length > 0) setSelectedUserId(staffList[0].id);
    setManualName('');
    setAmount('');
    setConcept('Turno Diario / Jornal');
    setCustomConcept('');
    setPaymentMethod('Efectivo (Caja)');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError('');
  };

  const handleOpenNewModal = () => {
    resetForm();
    setIsNewModalOpen(true);
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setFormError('');

    let recipient = '';
    if (workerType === 'registered') {
      const found = staffList.find(s => s.id === selectedUserId);
      recipient = found ? found.name : '';
    } else {
      recipient = manualName.trim();
    }

    if (!recipient) {
      setFormError('Por favor indica el nombre del trabajador o beneficiario.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    const finalConcept = concept === 'Otro' ? (customConcept.trim() || 'Otro Pago') : concept;
    const isCash = paymentMethod.includes('Caja') || paymentMethod.toLowerCase() === 'efectivo';

    setIsSubmitting(true);
    try {
      await expenseService.createPayrollPayment({
        recipientName: recipient,
        amount: numAmount,
        concept: finalConcept,
        paymentMethod,
        paidFromCash: isCash,
        date: paymentDate,
        notes
      });

      setIsNewModalOpen(false);
      resetForm();
      await loadPayments();
      showFeedback('¡Comprobante de nómina registrado con éxito!');
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error registrando el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de pago para "${name}"?`)) {
      return;
    }
    try {
      await expenseService.deletePayrollPayment(id);
      await loadPayments();
      showFeedback('Registro de nómina eliminado correctamente.');
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Error eliminando el registro', 'error');
    }
  };

  const handlePrintVoucher = (voucher) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Pago - ${voucher.parsedDetails?.recipientName}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; font-size: 13px; color: #000; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 12px; }
          .header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }
          .header p { margin: 3px 0 0; font-size: 11px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .label { font-weight: bold; }
          .amount-box { margin: 15px 0; padding: 10px; border: 2px dashed #000; text-align: center; font-size: 18px; font-weight: bold; }
          .sign-box { margin-top: 35px; border-top: 1px solid #000; padding-top: 5px; text-align: center; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>COMPROBANTE DE NÓMINA</h2>
          <p>NeoFood POS & Gestión Gastronómica</p>
          <p>Fecha: ${new Date(voucher.date).toLocaleDateString('es-CO')} ${new Date(voucher.date).toLocaleTimeString('es-CO')}</p>
        </div>
        <div class="row"><span class="label">Beneficiario:</span><span>${voucher.parsedDetails?.recipientName}</span></div>
        <div class="row"><span class="label">Concepto:</span><span>${voucher.parsedDetails?.concept}</span></div>
        <div class="row"><span class="label">Método:</span><span>${voucher.parsedDetails?.paymentMethod}</span></div>
        <div class="row"><span class="label">Registrado por:</span><span>${voucher.user?.name || 'Administrador'}</span></div>
        ${voucher.parsedDetails?.notes ? `<div class="row"><span class="label">Nota:</span><span>${voucher.parsedDetails.notes}</span></div>` : ''}

        <div class="amount-box">
          TOTAL PAGADO: ${formatCurrency(voucher.amount)}
        </div>

        <div class="sign-box">
          Firma de Recibido a Conformidad<br>
          C.C. _______________________________
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  };

  return (
    <div className={styles.container}>
      {/* Toast Notificación QoL */}
      {feedbackToast && (
        <div className={`${styles.toastFeedback} ${feedbackToast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {feedbackToast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* 1. Header con Título y Acción Principal */}
      <section className={styles.headerSection}>
        <div className={styles.headerTitleBox}>
          <div className={styles.headerIcon}>
            <DollarSign size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className={styles.title}>Nómina & Pagos de Personal</h1>
            <p className={styles.subtitle}>
              Registra pagos de turnos, quincenas o extras, descuéntalos de caja y consolídalos en gastos.
            </p>
          </div>
        </div>

        <button onClick={handleOpenNewModal} className={styles.primaryBtn}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Registrar Pago de Nómina</span>
        </button>
      </section>

      {/* 2. Tarjetas de Resumen (KPIs) */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTotal}`}>
            <DollarSign size={24} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Nómina (Período)</span>
            <span className={styles.kpiValue}>{formatCurrency(kpis.totalPaid)}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconCash}`}>
            <Wallet size={24} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Pagado en Efectivo (Caja)</span>
            <span className={styles.kpiValue} style={{ color: '#34d399' }}>{formatCurrency(kpis.cashPaid)}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconBank}`}>
            <CreditCard size={24} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Transferencia / Bancos</span>
            <span className={styles.kpiValue} style={{ color: '#93c5fd' }}>{formatCurrency(kpis.transferPaid)}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconCount}`}>
            <Users size={24} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Comprobantes Emitidos</span>
            <span className={styles.kpiValue}>{kpis.paymentsCount || 0}</span>
          </div>
        </div>
      </section>

      {/* 3. Filtros y Búsqueda */}
      <section className={styles.filterCard}>
        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador o concepto..."
            className={styles.searchInput}
          />
        </form>

        <div className={styles.dateFilterGroup}>
          <div className={styles.presetGroup}>
            <button
              type="button"
              onClick={() => applyPresetDates('today')}
              className={`${styles.presetBtn} ${datePreset === 'today' ? styles.presetBtnActive : ''}`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => applyPresetDates('week')}
              className={`${styles.presetBtn} ${datePreset === 'week' ? styles.presetBtnActive : ''}`}
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => applyPresetDates('month')}
              className={`${styles.presetBtn} ${datePreset === 'month' ? styles.presetBtnActive : ''}`}
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => applyPresetDates('all')}
              className={`${styles.presetBtn} ${datePreset === 'all' ? styles.presetBtnActive : ''}`}
            >
              Todos
            </button>
          </div>

          <div style={{ width: '16.5rem', position: 'relative', zIndex: 20 }}>
            <Datepicker
              primaryColor="indigo"
              useRange={true}
              value={{ startDate: startDate || null, endDate: endDate || null }}
              onChange={(val) => {
                setStartDate(val?.startDate || '');
                setEndDate(val?.endDate || '');
                setDatePreset('custom');
              }}
              displayFormat="DD/MM/YYYY"
              placeholder="Rango de fechas"
              inputClassName="neo-input"
            />
          </div>
        </div>
      </section>

      {/* 4. Tabla de Comprobantes de Nómina */}
      <section className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: '120px' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Fecha</th>
                <th>Colaborador</th>
                <th>Concepto</th>
                <th>Método de Pago</th>
                <th>Registrado Por</th>
                <th style={{ width: '135px', textAlign: 'right' }}>Monto Pagado</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="neo-loading-center">
                      <div className="neo-spinner neo-spinner-lg" />
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <Users size={40} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                      <h3 className={styles.emptyStateTitle}>No hay pagos de nómina en este período</h3>
                      <p className={styles.emptyStateDesc}>
                        Haz clic en <strong>"Registrar Pago de Nómina"</strong> para asentar los jornales o salarios de tus empleados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isCash = p.parsedDetails?.paidFromCash;
                  return (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700 }}>
                          {new Date(p.date).toLocaleDateString('es-CO')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(p.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <div className={styles.workerName}>
                          <UserCheck size={16} style={{ color: '#818cf8' }} />
                          <span>{p.parsedDetails?.recipientName || 'Colaborador'}</span>
                        </div>
                        {p.parsedDetails?.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                            "{p.parsedDetails.notes}"
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={styles.conceptBadge}>
                          {p.parsedDetails?.concept || 'Salario'}
                        </span>
                      </td>
                      <td>
                        {isCash ? (
                          <span className={styles.methodBadgeCash}>
                            <Wallet size={12} />
                            <span>Efectivo (Caja)</span>
                          </span>
                        ) : (
                          <span className={styles.methodBadgeBank}>
                            <CreditCard size={12} />
                            <span>{p.parsedDetails?.paymentMethod || 'Transferencia'}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {p.user?.name || 'Administrador'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={styles.amount}>
                          {formatCurrency(p.amount)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtnGroup} style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedVoucher(p)}
                            className={styles.iconBtn}
                            title="Ver Comprobante"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintVoucher(p)}
                            className={styles.iconBtn}
                            title="Imprimir Recibo"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.parsedDetails?.recipientName)}
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            title="Eliminar registro"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Modal: Registrar Pago de Nómina */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Registrar Pago de Nómina & Salario"
          subtitle="Registra el valor pagado a un colaborador para descontarlo de gastos"
          size="xl"
          maxWidth="980px"
        >
          {formError && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreatePayment}>
            {/* Fila 1: Selección y Nombre del Trabajador en 2 Columnas */}
            <div className={styles.modalGrid2Col}>
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Tipo de Registro</label>
                <div className={styles.toggleTypeRow}>
                  <button
                    type="button"
                    onClick={() => setWorkerType('registered')}
                    className={`${styles.toggleTypeBtn} ${workerType === 'registered' ? styles.toggleTypeBtnActive : ''}`}
                  >
                    <Users size={15} />
                    <span>Personal Registrado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerType('manual')}
                    className={`${styles.toggleTypeBtn} ${workerType === 'manual' ? styles.toggleTypeBtnActive : ''}`}
                  >
                    <UserCheck size={15} />
                    <span>Manual / Externo</span>
                  </button>
                </div>
              </div>

              <div className={styles.modalFormGroup}>
                {workerType === 'registered' ? (
                  <>
                    <label className={styles.modalLabel}>Colaborador del Sistema *</label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className={styles.modalInput}
                      required
                    >
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.role?.name || 'Personal'})
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className={styles.modalLabel}>Nombre del Trabajador / Refuerzo *</label>
                    <input
                      type="text"
                      required
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Ej. Carlos Mendoza (Refuerzo)"
                      className={styles.modalInput}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Fila 2: Valor a Pagar ($) y Concepto del Pago en 2 Columnas */}
            <div className={styles.modalGrid2Col}>
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Valor a Pagar ($) *</label>
                <div className={styles.amountInputWrapper}>
                  <span className={styles.currencyPrefix}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={styles.amountInput}
                  />
                </div>
              </div>

              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Concepto del Pago</label>
                <select
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className={styles.modalInput}
                >
                  {PRESET_CONCEPTS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {concept === 'Otro' && (
                  <input
                    type="text"
                    required
                    value={customConcept}
                    onChange={(e) => setCustomConcept(e.target.value)}
                    placeholder="Especificar concepto..."
                    className={styles.modalInput}
                    style={{ marginTop: '0.4rem' }}
                  />
                )}
              </div>
            </div>

            {/* Fila 3: Método de Pago y Fecha en 2 Columnas */}
            <div className={styles.modalGrid2Col}>
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>Origen del Dinero / Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={styles.modalInput}
                >
                  <option value="Efectivo (Caja)">💵 Efectivo de la Caja Registradora</option>
                  <option value="Transferencia Bancaria">🏦 Transferencia Bancaria del Restaurante</option>
                  <option value="Nequi / Daviplata">📱 Nequi / Daviplata</option>
                  <option value="Bolsillo Propio / Externo">👤 Dinero Personal del Dueño (Fuera de Caja)</option>
                </select>
              </div>

              <div className={styles.modalFormGroup} style={{ position: 'relative', zIndex: 10 }}>
                <label className={styles.modalLabel}>Fecha del Pago *</label>
                <Datepicker
                  primaryColor="indigo"
                  useRange={false}
                  asSingle={true}
                  value={{ startDate: paymentDate, endDate: paymentDate }}
                  onChange={(newValue) => {
                    if (newValue?.startDate) setPaymentDate(newValue.startDate);
                  }}
                  displayFormat="DD/MM/YYYY"
                  placeholder="Seleccionar fecha"
                  inputClassName="neo-input"
                />
              </div>
            </div>

            {/* Banner de Alerta si es Efectivo de Caja */}
            {paymentMethod.includes('Caja') && (
              <div className={styles.cashAlertBanner} style={{ marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Salida automática de caja:</strong> Se registrará una salida por este monto en el turno activo de hoy para que el arqueo físico nocturno cuadre a la perfección.
                </div>
              </div>
            )}

            {/* Fila 4: Observaciones */}
            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>Observaciones / Notas (Opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pago correspondiente a las noches del fin de semana"
                className={styles.modalInput}
              />
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="neo-btn neo-btn-secondary"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="neo-spinner neo-spinner-sm" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Confirmar y Registrar Pago</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Modal: Ver Comprobante de Nómina */}
      {selectedVoucher && (
        <Modal
          isOpen={Boolean(selectedVoucher)}
          onClose={() => setSelectedVoucher(null)}
          title="Comprobante de Pago de Nómina"
          subtitle={`Comprobante ID: ${selectedVoucher.id.slice(0, 8).toUpperCase()}`}
          maxWidth="480px"
        >
          <div className={styles.voucherCard}>
            <div className={styles.voucherHeader}>
              <h2 className={styles.voucherTitle}>Comprobante de Nómina</h2>
              <p className={styles.voucherSubtitle}>NeoFood • Control Operativo</p>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                {new Date(selectedVoucher.date).toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <div className={styles.voucherBody}>
              <div className={styles.voucherRow}>
                <span className={styles.voucherRowLabel}>Beneficiario:</span>
                <span className={styles.voucherRowValue}>{selectedVoucher.parsedDetails?.recipientName}</span>
              </div>
              <div className={styles.voucherRow}>
                <span className={styles.voucherRowLabel}>Concepto:</span>
                <span className={styles.voucherRowValue}>{selectedVoucher.parsedDetails?.concept}</span>
              </div>
              <div className={styles.voucherRow}>
                <span className={styles.voucherRowLabel}>Método de Pago:</span>
                <span className={styles.voucherRowValue}>{selectedVoucher.parsedDetails?.paymentMethod}</span>
              </div>
              <div className={styles.voucherRow}>
                <span className={styles.voucherRowLabel}>Registrado Por:</span>
                <span className={styles.voucherRowValue}>{selectedVoucher.user?.name || 'Administrador'}</span>
              </div>
              {selectedVoucher.parsedDetails?.notes && (
                <div className={styles.voucherRow} style={{ borderBottom: 'none' }}>
                  <span className={styles.voucherRowLabel}>Notas:</span>
                  <span className={styles.voucherRowValue}>{selectedVoucher.parsedDetails.notes}</span>
                </div>
              )}
            </div>

            <div className={styles.voucherAmountBox}>
              <div className={styles.voucherAmountLabel}>Total Pagado</div>
              <div className={styles.voucherAmountValue}>
                {formatCurrency(selectedVoucher.amount)}
              </div>
            </div>

            <div className={styles.voucherSignSection}>
              Firma de Recibido a Conformidad<br />
              C.C. __________________________________
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setSelectedVoucher(null)}
              className="neo-btn neo-btn-secondary"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => handlePrintVoucher(selectedVoucher)}
              className={styles.primaryBtn}
            >
              <Printer size={16} />
              <span>Imprimir Recibo</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
