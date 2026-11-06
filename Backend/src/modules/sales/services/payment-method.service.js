const prisma = require('../../../config/prisma');

class PaymentMethodService {
  async createPaymentMethod(data) {
    const trimmedName = String(data?.name || '').trim();
    if (!trimmedName) {
      throw Object.assign(new Error('El nombre del método de pago es requerido'), { statusCode: 400 });
    }
    const existing = await prisma.paymentMethod.findFirst({
      where: {
        name: { equals: trimmedName }
      }
    });
    if (existing) {
      throw Object.assign(new Error(`Ya existe un método de pago con el nombre "${trimmedName}"`), { statusCode: 400 });
    }
    return await prisma.paymentMethod.create({
      data: {
        name: trimmedName,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });
  }

  async getAllPaymentMethods() {
    return await prisma.paymentMethod.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async updatePaymentMethod(id, data) {
    const parsedId = String(id);
    const existing = await prisma.paymentMethod.findUnique({
      where: { id: parsedId }
    });
    if (!existing) {
      throw Object.assign(new Error('Método de pago no encontrado'), { statusCode: 404 });
    }

    const allowedFields = ['name', 'isActive'];
    const safeData = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        safeData[key] = data[key];
      }
    }
    return await prisma.paymentMethod.update({
      where: { id: parsedId },
      data: safeData,
    });
  }

  async toggleStatus(id) {
    const parsedId = String(id);
    const method = await prisma.paymentMethod.findUnique({ 
      where: { id: parsedId } 
    });
    
    if (!method) {
      throw Object.assign(new Error('Método de pago no encontrado'), { statusCode: 404 });
    }

    return await prisma.paymentMethod.update({
      where: { id: parsedId },
      data: { isActive: !method.isActive }
    });
  }

  async deletePaymentMethod(id) {
    const parsedId = String(id);

    const method = await prisma.paymentMethod.findUnique({
      where: { id: parsedId },
      include: {
        _count: {
          select: { sales: true, customerCredits: true, payments: true }
        }
      }
    });

    if (!method) {
      throw Object.assign(new Error('Método de pago no encontrado'), { statusCode: 404 });
    }

    const totalUsage = (method._count?.sales || 0) + (method._count?.customerCredits || 0) + (method._count?.payments || 0);
    if (totalUsage > 0) {
      throw Object.assign(new Error(`No se puede eliminar el método de pago "${method.name}" porque tiene historial asociado en el sistema. Desactívalo en su lugar.`), { statusCode: 400 });
    }

    return await prisma.paymentMethod.delete({
      where: { id: parsedId }
    });
  }
}

module.exports = new PaymentMethodService();
