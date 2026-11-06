const prisma = require('../../../config/prisma');
const MovementService = require('../../inventory/services/movement.service');
const { deleteUploadedFile } = require('../../../utils/fileCleaner');
const { compareCategories } = require('../../../utils/categoryOrder');

class StoreService {

  async _getBrandThemeConfig() {
    try {
      const rows = await prisma.configuration.findMany({
        where: {
          key: { in: ['brand_primary_color', 'brand_secondary_color', 'brand_theme_preset'] }
        }
      });
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      let primary = map['brand_primary_color'] || process.env.BRAND_PRIMARY_COLOR || '#4f46e5';
      let secondary = map['brand_secondary_color'] || process.env.BRAND_SECONDARY_COLOR || '#10b981';
      let preset = map['brand_theme_preset'] || process.env.BRAND_THEME_PRESET || 'landing';

      // Purga y normalización si había colores antiguos en rojo/fuego
      if (['#ea580c', '#dc2626', '#f97316', '#ef4444'].includes(String(primary).toLowerCase())) {
        primary = '#4f46e5';
        secondary = '#10b981';
        preset = 'landing';
      }

      return {
        primaryColor: primary,
        secondaryColor: secondary,
        themePreset: preset
      };
    } catch {
      return {
        primaryColor: process.env.BRAND_PRIMARY_COLOR || '#4f46e5',
        secondaryColor: process.env.BRAND_SECONDARY_COLOR || '#10b981',
        themePreset: process.env.BRAND_THEME_PRESET || 'landing'
      };
    }
  }

  // ==========================================
  // 1. CONSULTA PÚBLICA DE LA TIENDA
  // ==========================================
  async getPublicStoreBySlug(slug) {
    let restaurant = null;
    if (slug) {
      restaurant = await prisma.restaurant.findUnique({
        where: { slug: slug.toLowerCase() }
      });
    }

    if (!restaurant) {
      restaurant = await prisma.restaurant.findFirst();
    }

    if (!restaurant) {
      throw Object.assign(new Error('Restaurante no encontrado'), { statusCode: 404 });
    }

    if (!restaurant.isStoreActive) {
      throw Object.assign(new Error('La tienda virtual se encuentra temporalmente inactiva'), { statusCode: 403 });
    }

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: {
            isAvailable: true,
            showInStore: true
          }
        }
      },
      include: {
        products: {
          where: {
            isAvailable: true,
            showInStore: true
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            isCombo: true,
            trackStock: true,
            stock: true,
            modifiers: {
              select: {
                id: true,
                name: true,
                isRequired: true,
                options: {
                  select: {
                    id: true,
                    name: true,
                    priceExtra: true
                  }
                }
              }
            },
            additions: {
              select: {
                id: true,
                name: true,
                price: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    categories.sort(compareCategories);

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    // Excluir métodos de crédito/fiado para clientes anónimos de la tienda pública
    const publicPaymentMethods = paymentMethods.filter(pm => {
      const n = (pm.name || '').toLowerCase();
      return !n.includes('crédito') && !n.includes('credito') && !n.includes('fiao');
    });

    const brandTheme = await this._getBrandThemeConfig();

    const storePayload = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      document: restaurant.document,
      phone: restaurant.phone,
      whatsappNumber: restaurant.whatsappNumber || restaurant.phone,
      whatsapp: restaurant.whatsappNumber || restaurant.phone,
      address: restaurant.address,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      bannerPosition: restaurant.bannerPosition || 'center',
      storeSchedule: restaurant.storeSchedule,
      schedule: restaurant.storeSchedule,
      storeDescription: restaurant.storeDescription,
      description: restaurant.storeDescription,
      storeAnnouncement: restaurant.storeAnnouncement,
      announcement: restaurant.storeAnnouncement,
      isStoreActive: restaurant.isStoreActive,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };

    return {
      restaurant: storePayload,
      tenant: storePayload,
      categories,
      paymentMethods: publicPaymentMethods
    };
  }

  // ==========================================
  // 2. CREACIÓN PÚBLICA DE PEDIDO
  // ==========================================
  async createPublicOrder(slug, orderData) {
    let restaurant = null;
    if (slug) {
      restaurant = await prisma.restaurant.findUnique({
        where: { slug: slug.toLowerCase() }
      });
    }
    if (!restaurant) {
      restaurant = await prisma.restaurant.findFirst();
    }
    if (!restaurant) {
      throw Object.assign(new Error('Restaurante no encontrado'), { statusCode: 404 });
    }

    if (!restaurant.isStoreActive) {
      throw Object.assign(new Error('La tienda virtual se encuentra temporalmente cerrada para pedidos'), { statusCode: 403 });
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      deliveryNeighborhood,
      paymentMethodName,
      notes,
      items
    } = orderData;

    const resolvedOrderType = orderData.orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'DELIVERY';
    const resolvedAddress = deliveryAddress && String(deliveryAddress).trim()
      ? String(deliveryAddress).trim()
      : (resolvedOrderType === 'TAKEAWAY' ? 'Recoger en el local' : '');

    if (!customerName || !String(customerName).trim() || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      throw Object.assign(new Error('Nombre, teléfono y al menos un producto son obligatorios'), { statusCode: 400 });
    }

    if (resolvedOrderType === 'DELIVERY' && !resolvedAddress) {
      throw Object.assign(new Error('La dirección de entrega es obligatoria para pedidos a domicilio'), { statusCode: 400 });
    }

    const phoneDigits = String(customerPhone).replace(/\D/g, '');
    if (phoneDigits.length < 7 || String(customerPhone).trim().length > 25) {
      throw Object.assign(new Error('El número de teléfono ingresado no es válido'), { statusCode: 400 });
    }

    if (String(customerName).trim().length > 120 || resolvedAddress.length > 250) {
      throw Object.assign(new Error('Los datos del cliente exceden la longitud máxima permitida'), { statusCode: 400 });
    }

    let totalCalculated = 0;
    const processedDetails = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          modifiers: { include: { options: true } },
          additions: true
        }
      });

      if (!product || !product.isAvailable || !product.showInStore) {
        throw Object.assign(new Error(`El producto "${item.name || item.productId}" no está disponible en este momento`), { statusCode: 400 });
      }

      const qty = parseInt(item.quantity, 10);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 100) {
        throw Object.assign(new Error(`Cantidad inválida para el producto "${product.name}"`), { statusCode: 400 });
      }

      let unitPrice = parseFloat(product.price);

      const selectedModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      const validatedModifiers = [];
      const dbOptionsById = new Map();
      (product.modifiers || []).forEach(m => {
        (m.options || []).forEach(o => {
          dbOptionsById.set(o.id, { ...o, modifierName: m.name });
        });
      });

      for (const mod of selectedModifiers) {
        const optionId = mod.optionId || mod.variationId || mod.id;
        const dbOpt = dbOptionsById.get(optionId);
        if (!dbOpt) {
          throw Object.assign(new Error(`Opción de modificador inválida en "${product.name}"`), { statusCode: 400 });
        }
        const priceExtra = Math.max(0, parseFloat(dbOpt.priceExtra || 0));
        unitPrice += priceExtra;
        validatedModifiers.push({
          id: dbOpt.id,
          optionId: dbOpt.id,
          variationId: dbOpt.id,
          modifierName: dbOpt.modifierName,
          optionName: dbOpt.name,
          priceExtra
        });
      }

      const selectedOptionIds = new Set(validatedModifiers.map(m => m.optionId).filter(Boolean));
      for (const modGroup of (product.modifiers || [])) {
        if (modGroup.isRequired && Array.isArray(modGroup.options) && modGroup.options.length > 0) {
          const hasSelection = modGroup.options.some(opt => selectedOptionIds.has(opt.id));
          if (!hasSelection) {
            throw Object.assign(new Error(`El modificador "${modGroup.name}" es obligatorio para "${product.name}"`), { statusCode: 400 });
          }
        }
      }

      const selectedAdditions = Array.isArray(item.additions) ? item.additions : [];
      const validatedAdditions = [];
      const dbAdditions = product.additions || [];

      for (const add of selectedAdditions) {
        const addQty = parseInt(add.quantity, 10) || 1;
        if (!Number.isInteger(addQty) || addQty <= 0 || addQty > 50) {
          throw Object.assign(new Error(`Cantidad de adición inválida en "${product.name}"`), { statusCode: 400 });
        }
        const addId = add.additionId || add.id;
        const addName = add.name;
        const dbAdd = dbAdditions.find(a =>
          (addId && a.id === addId) ||
          (addName && a.name === addName)
        );
        if (!dbAdd) {
          throw Object.assign(new Error(`Adición inválida en "${product.name}"`), { statusCode: 400 });
        }
        const addPrice = Math.max(0, parseFloat(dbAdd.price || 0));
        unitPrice += addPrice * addQty;
        validatedAdditions.push({
          id: dbAdd.id,
          name: dbAdd.name,
          price: addPrice,
          quantity: addQty
        });
      }

      const subtotal = unitPrice * qty;
      totalCalculated += subtotal;

      processedDetails.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice,
        subtotal,
        notes: item.notes ? String(item.notes).slice(0, 500) : null,
        modifiers: validatedModifiers,
        additions: validatedAdditions
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      let customer = await tx.customer.findFirst({
        where: {
          phone: customerPhone.trim()
        }
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: customerName.trim(),
            phone: customerPhone.trim(),
            email: customerEmail ? customerEmail.trim() : null,
            address: resolvedOrderType === 'DELIVERY' && resolvedAddress ? resolvedAddress : null
          }
        });
      } else if (resolvedOrderType === 'DELIVERY' && resolvedAddress && !customer.address) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { address: resolvedAddress }
        });
      }

      const newOrder = await tx.order.create({
        data: {
          customerId: customer.id,
          isOnlineStore: true,
          orderType: resolvedOrderType,
          status: 'PENDING',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail ? customerEmail.trim() : null,
          deliveryAddress: resolvedAddress || null,
          deliveryNeighborhood: deliveryNeighborhood ? deliveryNeighborhood.trim() : null,
          paymentMethodName: paymentMethodName ? paymentMethodName.trim() : null,
          notes: notes ? String(notes).trim().slice(0, 500) : null,
          totalAmount: totalCalculated,
          details: {
            create: processedDetails.map(d => ({
              productId: d.productId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              subtotal: d.subtotal,
              notes: d.notes,
              modifiers: d.modifiers,
              additions: d.additions
            }))
          }
        },
        include: {
          details: {
            include: {
              product: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      return newOrder;
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: totalCalculated,
      status: order.status,
      orderType: order.orderType,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      whatsappNumber: restaurant.whatsappNumber || restaurant.phone,
      restaurantName: restaurant.name,
      createdAt: order.createdAt,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: totalCalculated,
        status: order.status,
        orderType: order.orderType
      }
    };
  }

  // ==========================================
  // 3. CONFIGURACIÓN DE LA TIENDA
  // ==========================================
  async getStoreConfig() {
    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: process.env.BRAND_NAME || 'NeoFood',
          slug: process.env.BRAND_SLUG || 'neofood'
        }
      });
    }

    const brandTheme = await this._getBrandThemeConfig();

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      document: restaurant.document,
      phone: restaurant.phone,
      whatsappNumber: restaurant.whatsappNumber || restaurant.phone || '',
      whatsapp: restaurant.whatsappNumber || restaurant.phone || '',
      address: restaurant.address || '',
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      bannerPosition: restaurant.bannerPosition || 'center',
      storeSchedule: restaurant.storeSchedule || '',
      schedule: restaurant.storeSchedule || '',
      storeDescription: restaurant.storeDescription || '',
      description: restaurant.storeDescription || '',
      storeAnnouncement: restaurant.storeAnnouncement || '',
      announcement: restaurant.storeAnnouncement || '',
      isStoreActive: restaurant.isStoreActive !== false,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };
  }

  async updateStoreConfig(data) {
    const {
      name,
      document,
      phone,
      whatsappNumber,
      address,
      storeDescription,
      storeAnnouncement,
      isStoreActive,
      storeSchedule,
      bannerPosition,
      primaryColor,
      secondaryColor,
      themePreset
    } = data;

    const cleanStr = (val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      return String(val).trim();
    };

    const cleanHex = (val, fallback) => {
      if (!val || typeof val !== 'string') return fallback;
      const trimmed = val.trim();
      return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
    };

    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: { name: 'NeoFood', slug: 'neofood' }
      });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: cleanStr(name) || undefined,
        document: cleanStr(document),
        phone: cleanStr(phone),
        whatsappNumber: cleanStr(whatsappNumber),
        address: cleanStr(address),
        storeDescription: cleanStr(storeDescription),
        storeAnnouncement: cleanStr(storeAnnouncement),
        isStoreActive: isStoreActive !== undefined ? Boolean(isStoreActive) : undefined,
        storeSchedule: cleanStr(storeSchedule),
        bannerPosition: cleanStr(bannerPosition) || undefined
      }
    });

    const themePairs = [];
    if (primaryColor) {
      themePairs.push({ key: 'brand_primary_color', value: cleanHex(primaryColor, '#4f46e5') });
    }
    if (secondaryColor) {
      themePairs.push({ key: 'brand_secondary_color', value: cleanHex(secondaryColor, '#10b981') });
    }
    if (themePreset) {
      themePairs.push({ key: 'brand_theme_preset', value: String(themePreset).trim().slice(0, 40) });
    }

    if (themePairs.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const item of themePairs) {
          await tx.configuration.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: { key: item.key, value: item.value }
          });
        }
      });
    }

    const brandTheme = await this._getBrandThemeConfig();

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      document: updated.document,
      phone: updated.phone,
      whatsappNumber: updated.whatsappNumber,
      address: updated.address,
      logoUrl: updated.logoUrl,
      bannerUrl: updated.bannerUrl,
      bannerPosition: updated.bannerPosition,
      storeSchedule: updated.storeSchedule,
      storeDescription: updated.storeDescription,
      storeAnnouncement: updated.storeAnnouncement,
      isStoreActive: updated.isStoreActive,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };
  }

  async updateLogo(logoUrl) {
    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({ data: { name: 'NeoFood', slug: 'neofood' } });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { logoUrl }
    });

    if (restaurant.logoUrl && restaurant.logoUrl !== logoUrl) {
      deleteUploadedFile(restaurant.logoUrl);
    }

    return { logoUrl: updated.logoUrl };
  }

  async deleteLogo() {
    const restaurant = await prisma.restaurant.findFirst();
    if (restaurant) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { logoUrl: null }
      });

      if (restaurant.logoUrl) {
        deleteUploadedFile(restaurant.logoUrl);
      }
    }

    return { logoUrl: null };
  }

  async updateBanner(bannerUrl) {
    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({ data: { name: 'NeoFood', slug: 'neofood' } });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { bannerUrl }
    });

    if (restaurant.bannerUrl && restaurant.bannerUrl !== bannerUrl) {
      deleteUploadedFile(restaurant.bannerUrl);
    }

    return { bannerUrl: updated.bannerUrl };
  }

  async deleteBanner() {
    const restaurant = await prisma.restaurant.findFirst();
    if (restaurant) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { bannerUrl: null }
      });

      if (restaurant.bannerUrl) {
        deleteUploadedFile(restaurant.bannerUrl);
      }
    }

    return { bannerUrl: null };
  }

  // ==========================================
  // 4. ADMINISTRACIÓN: GESTIÓN DE PEDIDOS
  // ==========================================
  async getStoreOrders(query = {}) {
    const { filter = 'active', dateFrom, dateTo, search } = query;

    const where = {
      isOnlineStore: true
    };

    if (filter === 'active') {
      where.status = { in: ['PENDING', 'PREPARING', 'READY'] };
    } else if (filter === 'history') {
      where.status = { in: ['DELIVERED', 'CANCELLED'] };
    } else if (filter && filter !== 'all') {
      where.status = filter;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { customerName: { contains: s } },
        { customerPhone: { contains: s } },
        { deliveryAddress: { contains: s } }
      ];
      if (/^\d+$/.test(s)) {
        where.OR.push({ orderNumber: parseInt(s, 10) });
      }
    }

    return await prisma.order.findMany({
      where,
      include: {
        details: {
          include: {
            product: true
          }
        },
        customer: true,
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            finalAmount: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getActiveCount() {
    const [pendingCount, activeCount] = await Promise.all([
      prisma.order.count({
        where: {
          isOnlineStore: true,
          status: 'PENDING'
        }
      }),
      prisma.order.count({
        where: {
          isOnlineStore: true,
          status: { in: ['PENDING', 'PREPARING', 'READY'] }
        }
      })
    ]);

    const latestPending = await prisma.order.findFirst({
      where: {
        isOnlineStore: true,
        status: 'PENDING'
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        totalAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      pendingCount,
      activeCount,
      latestPending
    };
  }

  async updateOrderStatus(orderId, status, userId = null) {
    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw Object.assign(new Error(`Estado no válido: ${status}`), { statusCode: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { sale: true }
    });

    if (!order) {
      throw Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });

    if (status === 'DELIVERED' && !order.sale) {
      try {
        await this.convertOrderToSale(orderId, userId);
      } catch (saleErr) {
        console.warn(`[STORE] Aviso: No se pudo auto-facturar el pedido #${order.orderNumber}: ${saleErr.message}`);
        return {
          ...updated,
          invoicingWarning: `El pedido fue entregado, pero no se pudo facturar automáticamente en caja: ${saleErr.message}. Realiza la facturación manualmente.`
        };
      }
    }

    return updated;
  }

  // ==========================================
  // 5. FACTURAR / CONVERTIR PEDIDO A VENTA
  // ==========================================
  async convertOrderToSale(orderId, userId, data = {}) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        details: {
          include: {
            product: {
              include: {
                ingredients: true,
                modifiers: {
                  include: {
                    options: {
                      include: {
                        linkedProduct: { include: { ingredients: true } }
                      }
                    }
                  }
                },
                additions: true
              }
            }
          }
        },
        sale: true
      }
    });

    if (!order) {
      throw Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 });
    }

    if (order.sale) {
      return order.sale;
    }

    let activeSession = null;
    if (userId) {
      activeSession = await prisma.cashSession.findFirst({
        where: { userId, status: 'OPEN' }
      });
    }

    if (!activeSession) {
      activeSession = await prisma.cashSession.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });
    }

    if (!activeSession) {
      throw Object.assign(new Error('No hay una sesión de caja abierta en este momento para registrar la venta en Caja y Facturas.'), { statusCode: 400 });
    }

    let paymentMethod = null;
    if (data.paymentMethodId) {
      paymentMethod = await prisma.paymentMethod.findUnique({
        where: { id: data.paymentMethodId }
      });
    }

    if (!paymentMethod && order.paymentMethodName) {
      const trimmed = order.paymentMethodName.trim();
      paymentMethod = await prisma.paymentMethod.findFirst({
        where: { name: trimmed }
      });
      if (!paymentMethod) {
        const allMethods = await prisma.paymentMethod.findMany();
        paymentMethod = allMethods.find(m =>
          m.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          trimmed.toLowerCase().includes(m.name.toLowerCase())
        );
      }
    }

    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.findFirst({
        where: { isActive: true, name: 'Efectivo' }
      });
    }
    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
    }

    if (!paymentMethod) {
      throw Object.assign(new Error('No hay métodos de pago activos configurados'), { statusCode: 400 });
    }

    const isCreditSale = paymentMethod.name.toLowerCase().includes('crédito') ||
                         paymentMethod.name.toLowerCase().includes('credito') ||
                         paymentMethod.name.toLowerCase().includes('fiao');

    if (isCreditSale) {
      if (!order.customerId) {
        throw Object.assign(new Error('No se puede facturar a crédito un pedido sin cliente registrado asociado.'), { statusCode: 400 });
      }
      const orderCustomer = await prisma.customer.findUnique({
        where: { id: order.customerId }
      });
      if (
        !orderCustomer ||
        orderCustomer.document === '222222222222' ||
        (orderCustomer.name || '').trim().toLowerCase() === 'consumidor final'
      ) {
        throw Object.assign(new Error('No se puede facturar a crédito al cliente genérico "Consumidor final".'), { statusCode: 400 });
      }
    }

    return await prisma.$transaction(async (tx) => {
      const existingSale = await tx.sale.findUnique({
        where: { orderId: order.id }
      });
      if (existingSale) {
        return existingSale;
      }

      const invoiceNumber = `FE-WEB-${Date.now().toString().slice(-6)}-${order.orderNumber}`;

      const processedDetails = order.details.map(d => {
        const parsedModifiers = typeof d.modifiers === 'string' ? JSON.parse(d.modifiers) : (d.modifiers || []);
        const parsedAdditions = typeof d.additions === 'string' ? JSON.parse(d.additions) : (d.additions || []);
        return {
          ...(d.product || {}),
          ...d,
          id: d.productId,
          productId: d.productId,
          name: d.product?.name || 'Producto',
          trackStock: Boolean(d.product?.trackStock),
          isCombo: Boolean(d.product?.isCombo),
          ingredients: d.product?.ingredients || [],
          modifiers: parsedModifiers,
          additions: parsedAdditions
        };
      });

      const costedDetails = await MovementService.processSaleInventoryAndCost(processedDetails, invoiceNumber, userId, tx);

      const sale = await tx.sale.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          paymentMethodId: paymentMethod.id,
          cashSessionId: activeSession.id,
          invoiceNumber,
          totalAmount: order.totalAmount,
          discount: 0,
          finalAmount: order.totalAmount,
          details: {
            create: costedDetails.map(d => {
              const mods = Array.isArray(d.modifiers) ? d.modifiers : [];
              const adds = Array.isArray(d.additions) ? d.additions : [];
              const descParts = [];
              if (mods.length > 0) descParts.push(mods.map(m => `${m.modifierName || 'Opción'}: ${m.optionName || m.name || ''}`).join(', '));
              if (adds.length > 0) descParts.push(adds.map(a => `+ ${a.name}`).join(', '));
              if (d.notes) descParts.push(`Nota: "${d.notes}"`);
              const finalNotes = descParts.length > 0 ? descParts.join(' | ') : (d.notes || null);

              const validAdditions = adds
                .map(a => ({
                  additionId: a.additionId || a.id,
                  name: a.name || 'Adición',
                  quantity: parseInt(a.quantity || 1, 10),
                  price: parseFloat(a.price || 0)
                }))
                .filter(a => Boolean(a.additionId));

              const validVariations = mods
                .map(m => ({
                  variationId: m.variationId || m.optionId || m.id,
                  name: m.optionName || m.name || 'Variedad',
                  price: parseFloat(m.priceExtra ?? m.price ?? 0)
                }))
                .filter(m => Boolean(m.variationId));

              return {
                productId: d.productId,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                subtotal: d.subtotal,
                unitCost: d.unitCost || 0,
                totalCost: d.totalCost || 0,
                notes: finalNotes,
                ...(validAdditions.length > 0 ? { saleDetailAdditions: { create: validAdditions } } : {}),
                ...(validVariations.length > 0 ? { saleDetailVariations: { create: validVariations } } : {})
              };
            })
          },
          payments: {
            create: [{
              paymentMethodId: paymentMethod.id,
              amount: order.totalAmount
            }]
          }
        }
      });

      if (isCreditSale && order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: { increment: order.totalAmount } }
        });

        await tx.customerCredit.create({
          data: {
            customerId: order.customerId,
            type: 'DEBT',
            amount: order.totalAmount,
            description: `Venta a Crédito Tienda Virtual #${invoiceNumber}`,
            saleId: sale.id,
            paymentMethodId: paymentMethod.id,
            cashSessionId: activeSession.id
          }
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' }
      });

      return sale;
    });
  }
}

module.exports = new StoreService();
