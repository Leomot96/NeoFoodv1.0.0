const expenseService = require('../services/expense.service');

class ExpenseController {
  async createPayrollPayment(req, res, next) {
    try {
      const loggedInUserId = req.user.id;
      const result = await expenseService.createPayrollPayment(req.body, loggedInUserId);
      return res.status(201).json({
        success: true,
        message: 'Pago de nómina registrado con éxito en gastos',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getPayrollPayments(req, res, next) {
    try {
      const { startDate, endDate, search, page, limit } = req.query;
      const result = await expenseService.getPayrollPayments({
        startDate,
        endDate,
        search,
        page,
        limit
      });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async deletePayrollPayment(req, res, next) {
    try {
      const { id } = req.params;
      await expenseService.deletePayrollPayment(id);
      return res.status(200).json({
        success: true,
        message: 'Registro de nómina eliminado correctamente'
      });
    } catch (err) {
      next(err);
    }
  }

  async getStaffList(req, res, next) {
    try {
      const staff = await expenseService.getStaffList();
      return res.status(200).json({
        success: true,
        data: staff
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExpenseController();
