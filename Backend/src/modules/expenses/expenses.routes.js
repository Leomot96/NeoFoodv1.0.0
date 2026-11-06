const express = require('express');
const { protectRoute, restrictTo } = require('../../middlewares/auth.middleware');
const ROLES = require('../../constants/roles');
const expenseController = require('./controllers/expense.controller');

const router = express.Router();

router.use(protectRoute);

// Rutas de nómina y gastos
router.get(
  '/payroll',
  restrictTo(ROLES.ADMINISTRADOR, ROLES.SUPERVISOR),
  expenseController.getPayrollPayments
);

router.post(
  '/payroll',
  restrictTo(ROLES.ADMINISTRADOR, ROLES.SUPERVISOR),
  expenseController.createPayrollPayment
);

router.delete(
  '/payroll/:id',
  restrictTo(ROLES.ADMINISTRADOR),
  expenseController.deletePayrollPayment
);

router.get(
  '/staff',
  restrictTo(ROLES.ADMINISTRADOR, ROLES.SUPERVISOR),
  expenseController.getStaffList
);

module.exports = router;
