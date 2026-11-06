const prisma = require('../../../config/prisma');
const MovementService = require('../../inventory/services/movement.service');

class SaleService {
  
  // ==========================================
  // CREACIÓN DE VENTA Y DESCUENTO DE INVENTARIO
  // ==========================================
  async createSale(data, userId) {
    const { customerId, paymentMethodId, discount = 0, orderType = 'DINE_IN', notes, details, tableId, orderId } = data;

    if (!details || details.length === 0) {
      throw Object.assign(new Error('La venta debe incluir al menos un producto'), { statusCode: 400 });
    }

    let activeSession = await prisma.cashSession.findFirst({
      where: { userId, status: 'OPEN' }
    });

    if (!activeSession) {
      activeSession = await prisma.cashSession.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });
    }

    if (!activeSession) {
      throw Object.assign(new Error('La caja se encuentra cerrada. Debes abrir la caja en el módulo de Caja antes de registrar ventas.'), { statusCode: 403 });
    }

    const parsedDiscount = Math.max(0, parseFloat(discount) || 0);

    return await prisma.$transaction(async (tx) => {
      let subtotalTotal = 0;
      const processedDetails = [];

      const candidateVarIds = [];
      const candidateAddIds = [];
      details.forEach(item => {
        (item.variations || item.modifiers || []).forEach(v => {
          const vid = typeof v === 'string' ? v : (v.variationId || v.modifierId || v.optionId || v.id);
          if (vid) candidateVarIds.push(vid);
        });
        (item.additions || []).forEach(a => {
          const aid = a.additionId || a.id;
          if (aid) candidateAddIds.push(aid);
        });
      });

      const [dbVariations, dbAdditions] = await Promise.all([
        candidateVarIds.length > 0
          ? tx.productModifierOption.findMany({
              where: {
                id: { in: candidateVarIds }
              },
              include: { modifier: { select: { name: true } } }
            })
          : [],
        candidateAddIds.length > 0
          ? tx.productAddition.findMany({
              where: {
                id: { in: candidateAddIds }
              }
            })
          : []
      ]);

      const variationsMap = new Map(dbVariations.map(v => [v.id, v]));
      const additionsMap = new Map(dbAdditions.map(a => [a.id, a]));

      for (const item of details) {
        const prodId = item.productId || item.product?.id || item.id;
        const dbProduct = await tx.product.findUnique({
          where: { id: prodId },
          include: {
            ingredients: true,
            modifiers: { include: { options: true } },
            additions: true
          }
        });

        if (!dbProduct) {
          throw Object.assign(new Error(`Producto no encontrado o no disponible: ${item.name || prodId}`), { statusCode: 400 });
        }

        const qty = parseInt(item.quantity, 10);
        if (!Number.isInteger(qty) || qty <= 0 || qty > 1000) {
          throw Object.assign(new Error(`Cantidad inválida para el producto "${dbProduct.name}"`), { statusCode: 400 });
        }

        const baseUnitPrice = parseFloat(dbProduct.price);
        let calculatedUnitPrice = baseUnitPrice;

        const processedVariations = [];
        const incomingVariations = item.variations || item.modifiers || [];
        for (const v of incomingVariations) {
          const vid = typeof v === 'string' ? v : (v.variationId || v.modifierId || v.optionId || v.id);
          if (vid && variationsMap.has(vid)) {
            const opt = variationsMap.get(vid);
            const extra = parseFloat(opt.priceExtra || 0);
            calculatedUnitPrice += extra;
            processedVariations.push({
              variationId: opt.id,
              name: opt.name,
              price: extra
            });
          }
        }

        const processedAdditions = [];
        const incomingAdditions = item.additions || [];
        for (const a of incomingAdditions) {
          const aid = a.additionId || a.id;
          if (aid && additionsMap.has(aid)) {
            const add = additionsMap.get(aid);
            const addQty = Math.max(1, parseInt(a.quantity || 1, 10));
            const addPrice = parseFloat(add.price || 0);
            calculatedUnitPrice += addPrice * addQty;
            processedAdditions.push({
              additionId: add.id,
              name: add.name,
              quantity: addQty,
              price: addPrice
            });
          }
        }

        const itemSubtotal = calculatedUnitPrice * qty;
        subtotalTotal += itemSubtotal;

        processedDetails.push({
          ...item,
          productId: dbProduct.id,
          id: dbProduct.id,
          name: dbProduct.name,
          quantity: qty,
          unitPrice: calculatedUnitPrice,
          subtotal: itemSubtotal,
          trackStock: dbProduct.trackStock,
          isCombo: dbProduct.isCombo,
          ingredients: dbProduct.ingredients || [],
          modifiers: processedVariations,
          variations: processedVariations,
          additions: processedAdditions
        });
      }

      if (parsedDiscount > subtotalTotal) {
        throw Object.assign(new Error(`El descuento ($${parsedDiscount.toLocaleString('es-CO')}) no puede ser mayor al subtotal de la venta ($${subtotalTotal.toLocaleString('es-CO')})`), { statusCode: 400 });
      }

      const finalAmount = Math.max(0, subtotalTotal - parsedDiscount);

      let effectiveCustomerId = customerId;
      let selectedCustomerDoc = null;
      let selectedCustomerName = '';
      if (effectiveCustomerId) {
        const customer = await tx.customer.findUnique({
          where: { id: effectiveCustomerId }
        });
        if (customer) {
          selectedCustomerDoc = customer.document;
          selectedCustomerName = customer.name;
        } else {
          effectiveCustomerId = null;
        }
      }
      if (!effectiveCustomerId) {
        const defaultCustomer = await tx.customer.findFirst({
          where: {
            OR: [
              { document: '222222222222' },
              { name: { contains: 'Consumidor' } }
            ]
          }
        });
        if (defaultCustomer) {
          effectiveCustomerId = defaultCustomer.id;
        }
      }

      let effectiveTableId = tableId || null;
      let effectiveOrderId = orderId || null;

      if (effectiveTableId) {
        const checkTable = await tx.table.findUnique({
          where: { id: effectiveTableId }
        });
        if (!checkTable) {
          // Si no existe como mesa, verificar si es un orderId que se envió por error como tableId (ej. pedidos sin mesa en cocina)
          const checkOrder = await tx.order.findUnique({
            where: { id: effectiveTableId }
          });
          if (checkOrder) {
            effectiveOrderId = effectiveOrderId || checkOrder.id;
            effectiveTableId = checkOrder.tableId || null;
          } else {
            throw Object.assign(new Error('La mesa seleccionada no existe'), { statusCode: 400 });
          }
        } else if (!effectiveOrderId) {
          // Si es una mesa válida y no se envió orderId explícito, vincular la comanda activa sin facturar
          const activeTableOrder = await tx.order.findFirst({
            where: { tableId: effectiveTableId, sale: null, status: { not: 'CANCELLED' } },
            orderBy: { createdAt: 'desc' }
          });
          if (activeTableOrder) {
            effectiveOrderId = activeTableOrder.id;
          }
        }
      }

      let order;
      if (effectiveOrderId) {
        order = await tx.order.findUnique({
          where: { id: effectiveOrderId },
          include: { sale: { select: { id: true, invoiceNumber: true } } }
        });
        if (order?.sale) {
          throw Object.assign(new Error(`Esta comanda ya ha sido facturada previamente (Factura #${order.sale.invoiceNumber || order.sale.id})`), { statusCode: 400 });
        }
        if (order) {
          await tx.orderDetail.deleteMany({ where: { orderId: order.id } });
          order = await tx.order.update({
            where: { id: order.id },
            data: {
              customerId: effectiveCustomerId || order.customerId,
              tableId: effectiveTableId || order.tableId,
              status: 'DELIVERED',
              notes: notes || order.notes,
              totalAmount: finalAmount,
              details: {
                create: processedDetails.map(pd => ({
                  productId: pd.id,
                  quantity: pd.quantity,
                  unitPrice: pd.unitPrice,
                  subtotal: pd.subtotal,
                  notes: pd.notes,
                  modifiers: pd.modifiers || [],
                  additions: pd.additions || []
                }))
              }
            }
          });
        }
      }

      if (!order) {
        order = await tx.order.create({
          data: {
            userId,
            customerId: effectiveCustomerId || null,
            tableId: effectiveTableId || null,
            status: (orderType === 'TAKEAWAY' || orderType === 'DELIVERY') ? 'PENDING' : 'DELIVERED',
            orderType,
            notes,
            totalAmount: finalAmount,
            details: {
              create: processedDetails.map(pd => ({
                productId: pd.id,
                quantity: pd.quantity,
                unitPrice: pd.unitPrice,
                subtotal: pd.subtotal,
                notes: pd.notes,
                modifiers: pd.modifiers || [],
                additions: pd.additions || []
              }))
            }
          }
        });
      }

      let paymentsToRecord = [];
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        paymentsToRecord = data.payments
          .filter(p => p.paymentMethodId && parseFloat(p.amount) > 0)
          .map(p => ({
            paymentMethodId: String(p.paymentMethodId),
            amount: parseFloat(p.amount),
            notes: p.notes || null
          }));
      }

      if (paymentsToRecord.length === 0) {
        if (!paymentMethodId) {
          throw Object.assign(new Error('Método de pago no válido o no encontrado'), { statusCode: 400 });
        }
        paymentsToRecord = [{
          paymentMethodId: String(paymentMethodId),
          amount: finalAmount,
          notes: null
        }];
      }

      const totalPaid = paymentsToRecord.reduce((acc, p) => acc + p.amount, 0);
      if (Math.abs(totalPaid - finalAmount) > 1) {
        throw Object.assign(new Error(`La suma de los pagos ($${Math.round(totalPaid).toLocaleString('es-CO')}) no coincide con el total de la venta ($${Math.round(finalAmount).toLocaleString('es-CO')})`), { statusCode: 400 });
      }

      const requestedMethodIds = [...new Set(paymentsToRecord.map(p => p.paymentMethodId))];
      const dbPaymentMethods = await tx.paymentMethod.findMany({
        where: {
          id: { in: requestedMethodIds }
        }
      });
      const paymentMethodsMap = new Map(dbPaymentMethods.map(m => [m.id, m]));

      for (const p of paymentsToRecord) {
        if (!paymentMethodsMap.has(p.paymentMethodId)) {
          throw Object.assign(new Error('Uno o más métodos de pago no son válidos'), { statusCode: 400 });
        }
      }

      const primaryPayment = [...paymentsToRecord].sort((a, b) => b.amount - a.amount)[0];
      const primaryPaymentMethod = paymentMethodsMap.get(primaryPayment.paymentMethodId);

      const invoiceNumber = `FE-${Date.now().toString().slice(-6)}-${order.orderNumber}`;

      const costedDetails = await MovementService.processSaleInventoryAndCost(processedDetails, invoiceNumber, userId, tx);

      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount: subtotalTotal,
          finalAmount: finalAmount,
          discount: parsedDiscount,
          orderId: order.id,
          paymentMethodId: primaryPaymentMethod.id,
          cashSessionId: activeSession.id,
          customerId: effectiveCustomerId || null,
          details: {
            create: costedDetails.map(item => {
              const detailData = {
                productId: item.productId || item.product?.id,
                quantity: parseInt(item.quantity, 10),
                unitPrice: parseFloat(item.unitPrice || item.finalPrice),
                subtotal: parseInt(item.quantity, 10) * parseFloat(item.unitPrice || item.finalPrice),
                unitCost: item.unitCost || 0,
                totalCost: item.totalCost || 0,
                notes: item.notes
              };

              if (item.additions && item.additions.length > 0) {
                detailData.saleDetailAdditions = {
                  create: item.additions.map(add => ({
                    additionId: add.additionId || null,
                    name: add.name || 'Adición Extra',
                    quantity: add.quantity || 1,
                    price: parseFloat(add.price) || 0
                  }))
                };
              }

              const variationsList = item.variations || item.modifiers || [];
              if (variationsList.length > 0) {
                detailData.saleDetailVariations = {
                  create: variationsList.map(v => ({
                    variationId: v.variationId || null,
                    name: v.name || 'Variedad',
                    price: parseFloat(v.price || v.priceExtra) || 0 
                  }))
                };
              }

              return detailData;
            })
          },
          payments: {
            create: paymentsToRecord.map(p => ({
              paymentMethodId: p.paymentMethodId,
              amount: p.amount,
              notes: p.notes
            }))
          }
        }
      });

      const creditPayments = paymentsToRecord.filter(p => {
        const m = paymentMethodsMap.get(p.paymentMethodId);
        const mName = m?.name?.toLowerCase() || '';
        return mName.includes('crédito') || mName.includes('credito') || mName.includes('fiao');
      });

      const totalCredit = creditPayments.reduce((acc, p) => acc + p.amount, 0);
      if (totalCredit > 0) {
        const isGenericFinalConsumer = !customerId ||
          selectedCustomerDoc === '222222222222' ||
          selectedCustomerName.trim().toLowerCase() === 'consumidor final';
        if (!effectiveCustomerId || isGenericFinalConsumer) {
          throw Object.assign(
            new Error('Debes seleccionar un cliente real (distinto a Consumidor Final) para registrar ventas a crédito'),
            { statusCode: 400 }
          );
        }

        await tx.customer.update({
          where: { id: effectiveCustomerId },
          data: { balance: { increment: totalCredit } }
        });

        await tx.customerCredit.create({
          data: {
            customerId: effectiveCustomerId,
            type: 'DEBT',
            amount: totalCredit,
            description: `Venta a crédito (${creditPayments.length > 1 || paymentsToRecord.length > 1 ? 'Parcial/Dividido' : 'Total'}) - Factura ${invoiceNumber}`,
            saleId: newSale.id,
            paymentMethodId: creditPayments[0]?.paymentMethodId || primaryPaymentMethod.id,
            cashSessionId: activeSession.id
          }
        });
      }

      const fullSale = await tx.sale.findUnique({
        where: { id: newSale.id },
        include: {
          customer: { select: { name: true, document: true, phone: true } },
          paymentMethod: { select: { id: true, name: true } },
          payments: {
            include: {
              paymentMethod: { select: { id: true, name: true } }
            }
          },
          order: {
            select: {
              orderNumber: true,
              table: { select: { name: true } },
              user: { select: { name: true } }
            }
          },
          details: {
            include: {
              product: { select: { name: true } },
              saleDetailAdditions: true,
              saleDetailVariations: true
            }
          }
        }
      });

      return fullSale;
    });
  }

  _parseDateRange(startDate, endDate) {
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endRaw) && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
      end.setHours(23, 59, 59, 999);
    }
    return { gte: start, lte: end };
  }

  // ==========================================
  // HISTORIAL DE VENTAS
  // ==========================================
  async getSalesHistory(filters = {}, page = 1, limit = 50) {
    const { startDate, endDate, paymentMethodId, customerId, invoiceNumber } = filters;
    const whereClause = {};

    if (paymentMethodId) whereClause.paymentMethodId = paymentMethodId;
    if (customerId) whereClause.customerId = customerId;
    if (invoiceNumber) whereClause.invoiceNumber = { contains: invoiceNumber };

    if (startDate && endDate) {
      whereClause.createdAt = this._parseDateRange(startDate, endDate);
    }

    const skip = (page - 1) * limit;

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where: whereClause }),
      prisma.sale.findMany({
        where: whereClause,
        include: {
          customer: { select: { name: true, document: true } },
          paymentMethod: { select: { name: true } },
          payments: {
            include: {
              paymentMethod: { select: { name: true } }
            }
          },
          order: {
            select: {
              orderNumber: true,
              table: { select: { name: true } },
              user: { select: { name: true } }
            }
          },
          details: {
            include: {
              product: { select: { name: true } },
              saleDetailAdditions: true,
              saleDetailVariations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      })
    ]);

    return {
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) },
      sales
    };
  }

  async getInvoiceData(saleId) {
    const sale = await prisma.sale.findUnique({
      where: {
        id: saleId
      },
      include: {
        details: { 
          include: { 
            product: true,
            saleDetailAdditions: { include: { addition: true } },
            saleDetailVariations: { include: { variation: true } }
          } 
        },
        paymentMethod: true,
        payments: {
          include: {
            paymentMethod: true
          }
        },
        order: { include: { user: { select: { name: true } }, table: true } },
        customer: true
      }
    });

    if (!sale) throw Object.assign(new Error('Venta no encontrada'), { statusCode: 404 });

    const restaurant = await prisma.restaurant.findFirst();

    const TAX_RATE = 0.08;
    const taxAmount = parseFloat(sale.finalAmount) * TAX_RATE;
    const baseAmount = parseFloat(sale.finalAmount) - taxAmount;

    return {
      storeConfig: {
        name: restaurant?.name || "NeoFood",
        address: restaurant?.address || "Colombia",
        nit: restaurant?.document || "900.000.000-1",
        phone: restaurant?.phone || ""
      },
      invoice: {
        number: sale.invoiceNumber,
        date: sale.createdAt,
        cashier: sale.order?.user?.name || "Cajero",
        customer: sale.customer ? sale.customer.name : 'Consumidor Final',
        orderType: sale.order?.orderType || 'DINE_IN',
      },
      items: sale.details.map(d => ({
        product: d.product.name,
        qty: d.quantity,
        price: parseFloat(d.unitPrice),
        unitPrice: parseFloat(d.unitPrice),
        total: parseFloat(d.subtotal),
        subtotal: parseFloat(d.subtotal),
        notes: d.notes,
        additions: (d.saleDetailAdditions || []).map(a => ({
          name: a.name || a.addition?.name || 'Adición',
          price: parseFloat(a.price || 0),
          quantity: a.quantity || 1
        })),
        variations: (d.saleDetailVariations || []).map(v => ({
          name: v.name || v.variation?.name || 'Variedad',
          price: parseFloat(v.price || 0)
        }))
      })),
      totals: {
        baseAmount,
        taxAmount,
        discount: parseFloat(sale.discount),
        finalAmount: parseFloat(sale.finalAmount),
        subtotal: parseFloat(sale.totalAmount),
        total: parseFloat(sale.finalAmount),
        paymentMethod: sale.paymentMethod?.name || (sale.payments?.[0]?.paymentMethod?.name) || 'Efectivo'
      },
      payments: (sale.payments && sale.payments.length > 0)
        ? sale.payments.map(p => ({
            method: p.paymentMethod?.name || 'Otro',
            amount: parseFloat(p.amount)
          }))
        : [{
            method: sale.paymentMethod?.name || 'Efectivo',
            amount: parseFloat(sale.finalAmount)
          }]
    };
  }

  // ==========================================
  // REPORTE DE UTILIDAD (VENTAS VS COSTOS)
  // ==========================================
  async getUtilityReport(startDate, endDate) {
    const dateRange = this._parseDateRange(startDate, endDate);
    const sales = await prisma.saleDetail.findMany({
      where: {
        sale: {
          createdAt: dateRange
        }
      },
      include: {
        product: {
          include: { ingredients: { include: { ingredient: true } } }
        },
        sale: true
      }
    });

    let totalRevenue = 0;
    let totalCost = 0;

    sales.forEach(sd => {
      const saleRevenue = parseFloat(sd.subtotal);
      const historicalTotalCost = parseFloat(sd.totalCost || 0);
      let productCost = 0;

      if (historicalTotalCost > 0) {
        productCost = historicalTotalCost;
      } else if (sd.product.ingredients && sd.product.ingredients.length > 0) {
        sd.product.ingredients.forEach(prodIng => {
          const qtyRequired = parseFloat(prodIng.quantity);
          const ingCost = parseFloat(prodIng.ingredient.averageCost || prodIng.ingredient.costPerUnit || prodIng.ingredient.lastCost || 0);
          productCost += (qtyRequired * ingCost) * sd.quantity;
        });
      } else if (sd.product.trackStock) {
        productCost = saleRevenue * 0.60; 
      }

      totalRevenue += saleRevenue;
      totalCost += productCost;
    });

    const uniqueSales = [...new Map(sales.map(item => [item.saleId, item.sale])).values()];
    const totalDiscounts = uniqueSales.reduce((sum, sale) => sum + parseFloat(sale.discount), 0);
    
    const netRevenue = totalRevenue - totalDiscounts;
    const grossProfit = netRevenue - totalCost;
    const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    return {
      period: { startDate, endDate },
      financials: {
        grossRevenue: totalRevenue,
        discounts: totalDiscounts,
        netRevenue: netRevenue,
        cogs: totalCost,
        grossProfit: grossProfit,
        marginPercent: profitMargin.toFixed(2) + '%'
      }
    };
  }

  // ==========================================
  // RESUMEN UNIFICADO PARA EL DASHBOARD
  // ==========================================
  async getDashboardSummary(userId = null) {
    const now = new Date();
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Ventas de Hoy
    const todaySales = await prisma.sale.aggregate({
      where: {
        createdAt: { gte: startOfToday, lte: endOfToday }
      },
      _sum: { finalAmount: true },
      _count: true
    });
    const dailySales = parseFloat(todaySales._sum.finalAmount || 0);

    // 2. Ventas del Mes
    const monthSales = await prisma.sale.aggregate({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth }
      },
      _sum: { finalAmount: true },
      _count: true
    });
    const monthlySales = parseFloat(monthSales._sum.finalAmount || 0);

    // 3. Compras del Mes
    const monthPurchases = await prisma.purchase.aggregate({
      where: {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        status: 'COMPLETED'
      },
      _sum: { totalCost: true }
    });
    const totalPurchases = parseFloat(monthPurchases._sum.totalCost || 0);

    // 4. Ganancia Estimada
    const monthlyProfit = Math.max(0, monthlySales - totalPurchases);

    // 5. Estado de Caja
    const openSession = await prisma.cashSession.findFirst({
      where: {
        status: 'OPEN'
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        cashMovements: true,
        sales: {
          select: {
            finalAmount: true,
            paymentMethod: { select: { name: true } },
            payments: { include: { paymentMethod: { select: { name: true } } } },
            customerCredits: { select: { type: true } }
          }
        },
        customerCredits: {
          include: { paymentMethod: { select: { name: true } } }
        },
        expenses: true
      },
      orderBy: { openedAt: 'desc' }
    });

    const isAbonoMovement = (description) => {
      if (!description || typeof description !== 'string') return false;
      return /^(abono\s*(a\s*)?factura|pago\s*factura|abono\s*de\s*cliente)/i.test(description.trim());
    };

    let activeCashSession = null;
    if (openSession) {
      let cashTotal = 0;
      let electronicTotal = 0;
      let totalCollected = 0;

      openSession.sales.forEach(sale => {
        const finalAmt = parseFloat(sale.finalAmount || 0);

        if (sale.payments && sale.payments.length > 0) {
          sale.payments.forEach(p => {
            const pMethodName = (p.paymentMethod?.name || '').toLowerCase();
            const pAmt = parseFloat(p.amount || 0);
            const isCredit = pMethodName.includes('crédito') || pMethodName.includes('credito') || pMethodName.includes('fiao');
            if (!isCredit) {
              totalCollected += pAmt;
              if (pMethodName.includes('efectivo')) {
                cashTotal += pAmt;
              } else {
                electronicTotal += pAmt;
              }
            }
          });
        } else {
          const hadInitialDebt = Array.isArray(sale.customerCredits) && sale.customerCredits.some(c => c.type === 'DEBT');
          if (hadInitialDebt) return;
          const methodName = (sale.paymentMethod?.name || '').toLowerCase();
          const isCredit = methodName.includes('crédito') || methodName.includes('credito') || methodName.includes('fiao');
          if (!isCredit) {
            totalCollected += finalAmt;
            if (methodName.includes('efectivo')) {
              cashTotal += finalAmt;
            } else {
              electronicTotal += finalAmt;
            }
          }
        }
      });

      let cashAbonos = 0;
      (openSession.customerCredits || []).forEach(credit => {
        if (credit.type === 'PAYMENT') {
          const amt = parseFloat(credit.amount || 0);
          const methodName = (credit.paymentMethod?.name || '').toLowerCase();
          totalCollected += amt;
          if (methodName.includes('efectivo')) {
            cashAbonos += amt;
          } else {
            electronicTotal += amt;
          }
        }
      });

      const manualIn = openSession.cashMovements
        .filter(m => m.type === 'IN' && !isAbonoMovement(m.description))
        .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
      const manualOut = openSession.cashMovements
        .filter(m => m.type === 'OUT')
        .reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
      const expensesTotal = openSession.expenses
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      const opening = parseFloat(openSession.openingAmount || 0);
      const expectedCash = opening + cashTotal + cashAbonos + manualIn - manualOut;

      activeCashSession = {
        id: openSession.id,
        cashier: openSession.user.name,
        openingAmount: opening,
        expectedCash,
        cashTotal: cashTotal + cashAbonos,
        electronicTotal,
        totalCollected,
        expensesTotal,
        openedAt: openSession.openedAt,
        status: openSession.status
      };
    }

    // 6. Gráfica semanal (últimos 7 días en una sola consulta)
    const chartData = [];
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const recentSales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo, lte: endOfToday }
      },
      select: {
        createdAt: true,
        finalAmount: true
      }
    });

    const dailyTotalsMap = new Map();
    recentSales.forEach(s => {
      const dt = new Date(s.createdAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      dailyTotalsMap.set(key, (dailyTotalsMap.get(key) || 0) + parseFloat(s.finalAmount || 0));
    });

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

      chartData.push({
        name: daysOfWeek[d.getDay()],
        ventas: dailyTotalsMap.get(key) || 0,
        fullDate: d.toLocaleDateString('es-CO')
      });
    }

    // 7. Top 5 Productos más vendidos
    const topSaleDetails = await prisma.saleDetail.groupBy({
      by: ['productId'],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    const topProductIds = topSaleDetails.map(t => t.productId);
    const productsData = await prisma.product.findMany({
      where: {
        id: { in: topProductIds }
      },
      select: { id: true, name: true }
    });
    const productNameMap = {};
    productsData.forEach(p => { productNameMap[p.id] = p.name; });

    const topProducts = topSaleDetails.map(t => ({
      name: productNameMap[t.productId] || 'Producto',
      quantity: parseInt(t._sum.quantity || 0, 10),
      revenue: parseFloat(t._sum.subtotal || 0)
    }));

    // 8. Insumos con bajo stock
    const allIngredients = await prisma.ingredient.findMany({
      where: {
        isActive: true
      },
      orderBy: { currentStock: 'asc' }
    });
    const lowStockItems = allIngredients
      .filter(i => parseFloat(i.currentStock) <= parseFloat(i.minStock))
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        name: i.name,
        currentStock: parseFloat(i.currentStock),
        minStock: parseFloat(i.minStock),
        unit: i.unit
      }));

    return {
      kpis: {
        dailySales,
        monthlySales,
        monthlyProfit,
        totalPurchases,
        cashSession: activeCashSession,
        lowStockItems
      },
      chartData,
      topProducts
    };
  }
}

module.exports = new SaleService();
