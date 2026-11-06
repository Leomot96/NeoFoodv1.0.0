const prisma = require('../../../config/prisma');

class ExpenseService {
  /**
   * Registra un pago de nómina u honorarios a un colaborador.
   * Si se paga con efectivo de caja y hay un turno abierto, descuenta automáticamente
   * del cajón mediante un movimiento de tipo OUT.
   */
  async createPayrollPayment(data, loggedInUserId) {
    const {
      recipientName,
      amount,
      concept,
      paymentMethod = 'Efectivo',
      paidFromCash = false,
      date,
      notes = ''
    } = data;

    const cleanAmount = parseFloat(amount);
    if (!recipientName || String(recipientName).trim() === '') {
      throw Object.assign(new Error('El nombre del trabajador o beneficiario es obligatorio'), { statusCode: 400 });
    }
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      throw Object.assign(new Error('El monto a pagar debe ser mayor a cero'), { statusCode: 400 });
    }

    const trimmedName = String(recipientName).trim();
    const cleanConcept = String(concept || 'Turno / Salario').trim();
    const cleanMethod = String(paymentMethod || 'Efectivo').trim();
    const paymentDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    return await prisma.$transaction(async (tx) => {
      let cashSessionId = null;
      let cashMovementId = null;

      // Si se especifica que sale del efectivo de la caja registradora, buscar sesión abierta
      if (paidFromCash || cleanMethod.toLowerCase().includes('caja') || cleanMethod.toLowerCase() === 'efectivo') {
        const activeSession = await tx.cashSession.findFirst({
          where: { status: 'OPEN' },
          orderBy: { openedAt: 'desc' }
        });

        if (activeSession && paidFromCash) {
          cashSessionId = activeSession.id;

          // Registrar movimiento de egreso en caja
          const movement = await tx.cashMovement.create({
            data: {
              cashSessionId: activeSession.id,
              userId: loggedInUserId,
              type: 'OUT',
              amount: cleanAmount,
              reason: `Pago de Nómina: ${trimmedName} (${cleanConcept})`
            }
          });
          cashMovementId = movement.id;
        }
      }

      // Estructurar el detalle en la descripción
      const structuredPayload = JSON.stringify({
        recipientName: trimmedName,
        concept: cleanConcept,
        paymentMethod: cleanMethod,
        paidFromCash: Boolean(cashSessionId),
        notes: String(notes || '').trim(),
        cashMovementId
      });

      const expense = await tx.expense.create({
        data: {
          userId: loggedInUserId,
          cashSessionId,
          amount: cleanAmount,
          category: 'Nómina',
          description: structuredPayload,
          date: paymentDate
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          cashSession: { select: { id: true, openedAt: true, status: true } }
        }
      });

      return {
        ...expense,
        parsedDetails: {
          recipientName: trimmedName,
          concept: cleanConcept,
          paymentMethod: cleanMethod,
          paidFromCash: Boolean(cashSessionId),
          notes: String(notes || '').trim()
        }
      };
    });
  }

  /**
   * Consulta historial de gastos de nómina con filtros y KPIs
   */
  async getPayrollPayments({ startDate, endDate, search, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      category: 'Nómina'
    };

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000`);
      const end = new Date(`${endDate}T23:59:59.999`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        where.date = { gte: start, lte: end };
      }
    }

    if (search && String(search).trim()) {
      const cleanTerm = String(search).trim();
      where.description = { contains: cleanTerm };
    }

    const [totalCount, records, allPeriodExpenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          cashSession: { select: { id: true, openedAt: true, status: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.expense.findMany({
        where,
        select: { amount: true, description: true }
      })
    ]);

    let totalPaid = 0;
    let cashPaid = 0;
    let transferPaid = 0;

    allPeriodExpenses.forEach(exp => {
      const amt = parseFloat(exp.amount || 0);
      totalPaid += amt;
      try {
        if (exp.description.startsWith('{')) {
          const parsed = JSON.parse(exp.description);
          if (parsed.paidFromCash) {
            cashPaid += amt;
          } else {
            transferPaid += amt;
          }
        } else {
          transferPaid += amt;
        }
      } catch {
        transferPaid += amt;
      }
    });

    const parsedRecords = records.map(exp => {
      let details = {
        recipientName: 'Colaborador',
        concept: 'Nómina',
        paymentMethod: exp.cashSessionId ? 'Efectivo (Caja)' : 'Transferencia',
        paidFromCash: Boolean(exp.cashSessionId),
        notes: ''
      };
      try {
        if (exp.description.startsWith('{')) {
          details = { ...details, ...JSON.parse(exp.description) };
        } else {
          details.recipientName = exp.description;
        }
      } catch {
        details.recipientName = exp.description;
      }

      return {
        ...exp,
        parsedDetails: details
      };
    });

    return {
      records: parsedRecords,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      kpis: {
        totalPaid,
        cashPaid,
        transferPaid,
        paymentsCount: allPeriodExpenses.length
      }
    };
  }

  /**
   * Eliminar un registro de nómina
   */
  async deletePayrollPayment(id) {
    const expense = await prisma.expense.findUnique({
      where: { id }
    });
    if (!expense) {
      throw Object.assign(new Error('Registro de pago no encontrado'), { statusCode: 404 });
    }

    return await prisma.$transaction(async (tx) => {
      // Revertir movimiento de caja si estaba vinculado
      try {
        if (expense.description && expense.description.startsWith('{')) {
          const parsed = JSON.parse(expense.description);
          if (parsed.cashMovementId) {
            await tx.cashMovement.delete({
              where: { id: parsed.cashMovementId }
            }).catch(() => null);
          }
        }
      } catch (e) {
        console.warn('[deletePayrollPayment] No se pudo revertir movimiento de caja asociado:', e.message);
      }

      return await tx.expense.delete({
        where: { id }
      });
    });
  }

  /**
   * Lista colaboradores disponibles (usuarios activos del restaurante)
   */
  async getStaffList() {
    return await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });
  }
}

module.exports = new ExpenseService();
