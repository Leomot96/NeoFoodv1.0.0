const prisma = require('../../../config/prisma');
const { compareCategories } = require('../../../utils/categoryOrder');

class CategoryService {

  async createCategory(data) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('El nombre de la categoría es obligatorio');
      error.statusCode = 400;
      throw error;
    }
    const normalizedName = data.name.trim();

    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: normalizedName }
      }
    });

    if (existing) {
      if (!existing.isActive) {
        return await prisma.category.update({
          where: { id: existing.id },
          data: {
            name: normalizedName,
            isActive: true,
            description: data.description || existing.description
          }
        });
      } else {
        const error = new Error('Ya existe una categoría activa con este nombre');
        error.statusCode = 400;
        throw error;
      }
    }

    return await prisma.category.create({
      data: {
        name: normalizedName,
        description: data.description ? String(data.description).trim() : null
      }
    });
  }

  async getAllCategories() {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return categories.sort(compareCategories);
  }

  async getCategoryById(id) {
    const category = await prisma.category.findUnique({
      where: { id }
    });
    if (!category) {
      const error = new Error('Categoría no encontrada');
      error.statusCode = 404;
      throw error;
    }
    return category;
  }

  async updateCategory(id, data) {
    await this.getCategoryById(id);

    const allowedFields = ['name', 'description', 'isActive'];
    const safeData = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        safeData[key] = data[key];
      }
    }

    if (safeData.name !== undefined) {
      if (!safeData.name || typeof safeData.name !== 'string' || !safeData.name.trim()) {
        const error = new Error('El nombre de la categoría no puede estar vacío');
        error.statusCode = 400;
        throw error;
      }
      safeData.name = safeData.name.trim();
      const duplicate = await prisma.category.findFirst({
        where: {
          name: { equals: safeData.name },
          id: { not: id },
          isActive: true
        }
      });
      if (duplicate) {
        const error = new Error('Ya existe otra categoría activa con este nombre');
        error.statusCode = 400;
        throw error;
      }
    }

    if (safeData.description !== undefined && typeof safeData.description === 'string') {
      safeData.description = safeData.description.trim();
    }

    return await prisma.category.update({
      where: { id },
      data: safeData,
    });
  }

  async deleteCategory(id) {
    const category = await this.getCategoryById(id);

    const activeProductsCount = await prisma.product.count({
      where: {
        categoryId: id,
        isAvailable: true
      }
    });

    if (activeProductsCount > 0) {
      throw Object.assign(
        new Error(`No se puede eliminar la categoría "${category.name}" porque contiene ${activeProductsCount} producto(s) activo(s). Reasigna o desactiva los productos antes de eliminarla.`),
        { statusCode: 400 }
      );
    }

    // Soft delete
    return await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

module.exports = new CategoryService();
