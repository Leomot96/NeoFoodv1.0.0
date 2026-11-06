const prisma = require('../../../config/prisma');

class ReportService {
  
  // Helper para generar el filtro de fechas
  _getDateFilter(startDate, endDate) {
    if (!startDate || !endDate) return undefined;
    const startRaw = String(startDate).trim();
    const endRaw = String(endDate).trim();
    const start = /^\d{4}-\d{2}-\d{2}$/.test(startRaw)
      ? new Date(`${startRaw}T00:00:00.000`)
      : new Date(startRaw);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
      ? new Date(`${endRaw}T23:59:59.999`)
      : new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw Object.assign(new Error('Rango de fechas inválido'), { statusCode: 400 });
    }
    end.setHours(23, 59, 59, 999); // Incluir todo el último día
    return {
      gte: start,
      lte: end,
    };
  }

  async getSalesAndProfits(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const sales = await prisma.sale.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      include: { 
        customer: true, 
        paymentMethod: true,
        payments: { include: { paymentMethod: true } },
        details: { 
          include: { 
            product: { include: { ingredients: { include: { ingredient: true } } } } 
          } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    return sales.map(s => {
      const totalAmountNum = parseFloat(s.totalAmount || 0);
      const finalAmountNum = parseFloat(s.finalAmount || 0);
      const discountRatio = (totalAmountNum > 0 && finalAmountNum < totalAmountNum)
        ? (finalAmountNum / totalAmountNum)
        : 1;

      let cost = 0;
      s.details.forEach(d => {
        const historicalCost = parseFloat(d.totalCost || 0);
        if (historicalCost > 0) {
          cost += historicalCost;
        } else if (d.product?.ingredients && d.product.ingredients.length > 0) {
          // Sumar el costo exacto de los ingredientes de la receta
          d.product.ingredients.forEach(i => {
            const ingCost = parseFloat(i.ingredient.averageCost || i.ingredient.costPerUnit || i.ingredient.lastCost || 0);
            cost += (parseFloat(i.quantity) * ingCost) * d.quantity;
          });
        } else if (d.product?.trackStock) {
          // Si es producto directo sin costo histórico ni receta, ponderamos por el ratio de descuento aplicado
          cost += (parseFloat(d.subtotal || 0) * discountRatio) * 0.6;
        }
      });

      const amount = Math.round(finalAmountNum * 100) / 100;
      const roundedCost = Math.round(cost * 100) / 100;
      const profit = Math.round((amount - roundedCost) * 100) / 100;

      let methodDisplay = s.paymentMethod?.name || 'Efectivo';
      if (s.payments && s.payments.length > 1) {
        methodDisplay = `Dividido (${s.payments.map(p => `${p.paymentMethod?.name || 'Medio'}: $${Math.round(parseFloat(p.amount)).toLocaleString('es-CO')}`).join(', ')})`;
      }

      return {
        invoice: s.invoiceNumber,
        date: s.createdAt,
        customer: s.customer ? s.customer.name : 'Consumidor Final',
        method: methodDisplay,
        cost: roundedCost,
        amount: amount,
        profit: profit
      };
    });
  }

  async getPurchases(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const purchases = await prisma.purchase.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' }
    });

    return purchases.map(p => ({
      invoice: p.invoiceNumber || 'Sin Factura',
      date: p.createdAt,
      supplier: p.supplier?.name || 'Proveedor Desconocido',
      status: p.status,
      totalCost: parseFloat(p.totalCost)
    }));
  }

  async getInventory() {
    // El inventario no se filtra por fecha, es el stock actual
    const ingredients = await prisma.ingredient.findMany({ 
      where: {
        isActive: true
      }, 
      orderBy: { name: 'asc' } 
    });
    const products = await prisma.product.findMany({ 
      where: {
        trackStock: true
      }, 
      orderBy: { name: 'asc' } 
    });

    const invIngredients = ingredients.map(i => {
      const effectiveCost = parseFloat(i.averageCost || i.costPerUnit || i.lastCost || 0);
      return {
        name: i.name,
        type: 'Ingrediente',
        stock: parseFloat(i.currentStock),
        unit: i.unit,
        unitCost: effectiveCost,
        totalValue: parseFloat(i.currentStock) * effectiveCost
      };
    });

    const invProducts = products.map(p => ({
      name: p.name,
      type: 'Producto Directo',
      stock: parseFloat(p.stock || 0),
      unit: 'UND',
      unitCost: parseFloat(p.price) * 0.6, // Costo estimado
      totalValue: parseFloat(p.stock || 0) * (parseFloat(p.price) * 0.6)
    }));

    return [...invIngredients, ...invProducts];
  }

  async getCashSessions(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const sessions = await prisma.cashSession.findMany({
      where: {
        ...(dateFilter ? { openedAt: dateFilter } : {})
      },
      include: { user: true, cashAudit: true },
      orderBy: { openedAt: 'desc' }
    });

    return sessions.map(s => ({
      date: s.openedAt,
      user: s.user?.name || 'Usuario Desconocido',
      status: s.status,
      opening: parseFloat(s.openingAmount),
      closing: parseFloat(s.closingAmount || 0),
      difference: s.cashAudit ? parseFloat(s.cashAudit.difference) : 0,
      audited: s.cashAudit ? 'Sí' : 'No'
    }));
  }

  async getTopProducts(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const whereClause = {
      ...(dateFilter ? { createdAt: dateFilter } : {})
    };

    const grouped = await prisma.saleDetail.groupBy({
      by: ['productId'],
      where: whereClause,
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } }
    });

    const products = await prisma.product.findMany({ 
      where: {
        id: { in: grouped.map(g => g.productId) }
      } 
    });

    return grouped.map(g => {
      const p = products.find(x => x.id === g.productId);
      return {
        productName: p?.name || 'Producto Eliminado',
        quantitySold: g._sum.quantity,
        revenue: parseFloat(g._sum.subtotal)
      };
    });
  }

  async getExpenses(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const expenses = await prisma.expense.findMany({
      where: {
        ...(dateFilter ? { date: dateFilter } : {})
      },
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' }
    });

    return expenses.map(e => {
      let recipientName = 'N/A';
      let concept = e.category;
      let paymentMethod = 'Efectivo';
      try {
        if (e.description.startsWith('{')) {
          const parsed = JSON.parse(e.description);
          recipientName = parsed.recipientName || recipientName;
          concept = parsed.concept || concept;
          paymentMethod = parsed.paymentMethod || paymentMethod;
        } else {
          recipientName = e.description;
        }
      } catch {}

      return {
        id: e.id,
        date: e.date,
        category: e.category,
        recipient: recipientName,
        concept,
        paymentMethod,
        registeredBy: e.user?.name || 'Administrador',
        amount: parseFloat(e.amount)
      };
    });
  }

  async getTopCustomers(startDate, endDate) {
    const dateFilter = this._getDateFilter(startDate, endDate);
    const grouped = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      _count: { id: true },
      _sum: { finalAmount: true },
      orderBy: { _sum: { finalAmount: 'desc' } }
    });

    const customers = await prisma.customer.findMany({ 
      where: {
        id: { in: grouped.map(g => g.customerId) }
      } 
    });

    return grouped.map(g => {
      const c = customers.find(x => x.id === g.customerId);
      return {
        name: c?.name || 'Cliente Eliminado',
        document: c?.document || 'N/A',
        purchasesCount: g._count.id,
        totalSpent: parseFloat(g._sum.finalAmount)
      };
    });
  }
}

module.exports = new ReportService();
