const prisma = require('../../../config/prisma');

class SupplierService {
  async createSupplier(data) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('El nombre del proveedor es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const normalizedNit = typeof data.nit === 'string' && data.nit.trim() !== '' ? data.nit.trim() : null;

    if (normalizedNit) {
      const existing = await prisma.supplier.findFirst({ where: { nit: normalizedNit } });
      if (existing) {
        const error = new Error('Ya existe un proveedor con este NIT');
        error.statusCode = 400;
        throw error;
      }
    }

    const allowedFields = ['name', 'nit', 'phone', 'email', 'address'];
    const supplierData = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        supplierData[key] = data[key];
      }
    }
    supplierData.name = data.name.trim();
    supplierData.nit = normalizedNit;
    if (supplierData.phone && typeof supplierData.phone === 'string') supplierData.phone = supplierData.phone.trim();
    if (supplierData.email && typeof supplierData.email === 'string') supplierData.email = supplierData.email.trim();
    if (supplierData.address && typeof supplierData.address === 'string') supplierData.address = supplierData.address.trim();

    return await prisma.supplier.create({ data: supplierData });
  }

  async getAllSuppliers() {
    return await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getSupplierById(id) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      const error = new Error('Proveedor no encontrado');
      error.statusCode = 404;
      throw error;
    }
    return supplier;
  }

  async updateSupplier(id, data) {
    await this.getSupplierById(id);

    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
        const error = new Error('El nombre del proveedor es obligatorio');
        error.statusCode = 400;
        throw error;
      }
    }

    const allowedFields = ['name', 'nit', 'phone', 'email', 'address'];
    const safeData = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        safeData[key] = data[key];
      }
    }

    if (safeData.name && typeof safeData.name === 'string') {
      safeData.name = safeData.name.trim();
    }

    if (safeData.nit !== undefined) {
      safeData.nit = typeof safeData.nit === 'string' && safeData.nit.trim() !== '' ? safeData.nit.trim() : null;
      if (safeData.nit) {
        const duplicate = await prisma.supplier.findFirst({
          where: {
            nit: safeData.nit,
            id: { not: id }
          }
        });
        if (duplicate) {
          const error = new Error('Ya existe otro proveedor con este NIT');
          error.statusCode = 400;
          throw error;
        }
      }
    }

    if (safeData.phone && typeof safeData.phone === 'string') safeData.phone = safeData.phone.trim();
    if (safeData.email && typeof safeData.email === 'string') safeData.email = safeData.email.trim();
    if (safeData.address && typeof safeData.address === 'string') safeData.address = safeData.address.trim();

    return await prisma.supplier.update({
      where: { id },
      data: safeData,
    });
  }

  async deleteSupplier(id) {
    await this.getSupplierById(id);
    
    const purchasesCount = await prisma.purchase.count({ where: { supplierId: id } });
    if (purchasesCount > 0) {
      const error = new Error('No se puede eliminar el proveedor porque tiene compras asociadas');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.supplier.delete({ where: { id } });
  }
}

module.exports = new SupplierService();
