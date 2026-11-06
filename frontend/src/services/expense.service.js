import api from '../api/axios';

class ExpenseService {
  /**
   * Obtiene el listado de colaboradores / personal activo del sistema
   */
  async getStaffList() {
    const response = await api.get('/expenses/staff');
    return response.data?.data || [];
  }

  /**
   * Obtiene el historial de pagos de nómina con filtros y KPIs
   */
  async getPayrollPayments({ startDate, endDate, search = '', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (search) params.append('search', search);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    const response = await api.get(`/expenses/payroll?${params.toString()}`);
    return response.data?.data || { records: [], totalCount: 0, kpis: {} };
  }

  /**
   * Registra un pago de nómina u honorarios a un colaborador
   */
  async createPayrollPayment(payload) {
    const response = await api.post('/expenses/payroll', payload);
    return response.data;
  }

  /**
   * Elimina un registro de nómina
   */
  async deletePayrollPayment(id) {
    const response = await api.delete(`/expenses/payroll/${id}`);
    return response.data;
  }
}

export default new ExpenseService();
