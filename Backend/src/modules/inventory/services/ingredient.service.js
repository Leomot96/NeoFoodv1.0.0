const prisma = require('../../../config/prisma');

class IngredientService {
  _dedupeRecipeIngredients(recipeIngredients) {
    if (!Array.isArray(recipeIngredients) || recipeIngredients.length === 0) return [];
    const byInputId = new Map();
    for (const r of recipeIngredients) {
      if (!r || !r.inputIngredientId) continue;
      const qty = parseFloat(r.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const existing = byInputId.get(r.inputIngredientId);
      if (existing) {
        existing.quantity += qty;
      } else {
        byInputId.set(r.inputIngredientId, {
          inputIngredientId: r.inputIngredientId,
          quantity: qty,
          unit: r.unit
        });
      }
    }
    return Array.from(byInputId.values());
  }

  async _validateRecipeInputs(recipeIngredients, selfId = null) {
    if (!Array.isArray(recipeIngredients) || recipeIngredients.length === 0) return;
    const inputIds = [...new Set(recipeIngredients.map(r => r.inputIngredientId).filter(Boolean))];
    if (inputIds.length === 0) return;
    if (selfId && inputIds.includes(selfId)) {
      const error = new Error('Un insumo elaborado no puede incluirse a sí mismo dentro de su propia receta.');
      error.statusCode = 400;
      throw error;
    }
    const count = await prisma.ingredient.count({
      where: {
        id: { in: inputIds }
      }
    });
    if (count !== inputIds.length) {
      const error = new Error('Uno o más insumos de la sub-receta no existen.');
      error.statusCode = 400;
      throw error;
    }
  }

  async createIngredient(data) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('El nombre del insumo es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const normalizedName = data.name.trim();

    const existing = await prisma.ingredient.findFirst({
      where: {
        name: { equals: normalizedName }
      }
    });
    if (existing) {
      if (!existing.isActive) {
        return await this.updateIngredient(existing.id, {
          ...data,
          name: normalizedName,
          isActive: true
        });
      }
      const error = new Error(`Ya existe un ingrediente activo llamado "${normalizedName}"`);
      error.statusCode = 400;
      throw error;
    }

    const dedupedRecipes = this._dedupeRecipeIngredients(data.recipeIngredients);
    await this._validateRecipeInputs(dedupedRecipes);

    const parsedMinStock = data.minStock !== undefined ? parseFloat(data.minStock) : 0;
    const sanitizedMinStock = Math.max(0, Number.isFinite(parsedMinStock) ? parsedMinStock : 0);

    return await prisma.ingredient.create({
      data: {
        name: normalizedName,
        unit: data.unit || 'Unidad',
        minStock: sanitizedMinStock,
        currentStock: 0,
        costPerUnit: 0,
        isManufactured: Boolean(data.isManufactured),
        recipeIngredients: dedupedRecipes.length > 0 ? {
          create: dedupedRecipes.map(r => ({
            inputIngredientId: r.inputIngredientId,
            quantity: r.quantity,
            unit: r.unit
          }))
        } : undefined
      }
    });
  }

  async getAllIngredients(query = {}) {
    const where = {};
    if (query.includeInactive !== 'true' && query.includeInactive !== true) {
      where.isActive = true;
    }

    const list = await prisma.ingredient.findMany({
      where,
      include: {
        recipeIngredients: {
          include: {
            inputIngredient: true
          }
        },
        usedInRecipes: {
          select: {
            id: true,
            outputIngredientId: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return list.map(item => ({
      ...item,
      isUsedInProduction: Boolean(item.usedInRecipes && item.usedInRecipes.length > 0)
    }));
  }

  async getIngredientById(id) {
    const ingredient = await prisma.ingredient.findUnique({
      where: { id }
    });
    if (!ingredient) {
      const error = new Error('Ingrediente no encontrado');
      error.statusCode = 404;
      throw error;
    }
    return ingredient;
  }

  async updateIngredient(id, data) {
    await this.getIngredientById(id);

    const updateData = {};
    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
        const error = new Error('El nombre del insumo no puede estar vacío');
        error.statusCode = 400;
        throw error;
      }
      const normalizedName = data.name.trim();
      const duplicate = await prisma.ingredient.findFirst({
        where: {
          name: { equals: normalizedName },
          id: { not: id },
          isActive: true
        }
      });
      if (duplicate) {
        const error = new Error(`Ya existe otro ingrediente activo llamado "${normalizedName}"`);
        error.statusCode = 400;
        throw error;
      }
      updateData.name = normalizedName;
    }
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.minStock !== undefined) {
      const parsed = parseFloat(data.minStock);
      updateData.minStock = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    }
    if (data.isManufactured !== undefined) updateData.isManufactured = Boolean(data.isManufactured);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    if (data.recipeIngredients !== undefined) {
      const recipes = this._dedupeRecipeIngredients(data.recipeIngredients);
      await this._validateRecipeInputs(recipes, id);

      updateData.recipeIngredients = {
        deleteMany: {},
        create: recipes.map(r => ({
          inputIngredientId: r.inputIngredientId,
          quantity: r.quantity,
          unit: r.unit
        }))
      };
    }

    return await prisma.ingredient.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteIngredient(id) {
    const ingredient = await this.getIngredientById(id);

    const [
      purchasesCount,
      movesCount,
      productionOrdersCount,
      productionConsumptionsCount,
      productIngredientsCount,
      productAdditionsCount,
      modifierOptionsCount,
      modifierOptionIngredientsCount,
      usedInSubRecipesCount,
    ] = await Promise.all([
      prisma.purchaseDetail.count({ where: { ingredientId: id } }),
      prisma.inventoryMovement.count({ where: { ingredientId: id } }),
      prisma.productionOrder.count({ where: { ingredientId: id } }),
      prisma.productionConsumption.count({ where: { ingredientId: id } }),
      prisma.productIngredient.count({ where: { ingredientId: id } }),
      prisma.productAddition.count({ where: { ingredientId: id } }),
      prisma.productModifierOption.count({ where: { ingredientId: id } }),
      prisma.modifierOptionIngredient.count({ where: { ingredientId: id } }),
      prisma.ingredientRecipe.count({ where: { inputIngredientId: id } }),
    ]);

    const hasHistory = (
      purchasesCount +
      movesCount +
      productionOrdersCount +
      productionConsumptionsCount +
      productIngredientsCount +
      productAdditionsCount +
      modifierOptionsCount +
      modifierOptionIngredientsCount +
      usedInSubRecipesCount
    ) > 0;

    if (hasHistory) {
      await prisma.ingredient.update({
        where: { id },
        data: { isActive: false },
      });

      return {
        action: 'deactivated',
        message: `El insumo "${ingredient.name}" tiene historial o está vinculado en recetas/productos, por lo que fue desactivado del inventario activo para proteger la integridad contable.`
      };
    }

    await prisma.$transaction([
      prisma.ingredientRecipe.deleteMany({ where: { outputIngredientId: id } }),
      prisma.ingredient.delete({ where: { id } })
    ]);
    return {
      action: 'deleted',
      message: `El insumo "${ingredient.name}" fue eliminado permanentemente.`
    };
  }

  async getLowStockAlerts() {
    const activeIngredients = await prisma.ingredient.findMany({
      where: {
        isActive: true
      },
      orderBy: { currentStock: 'asc' }
    });
    return activeIngredients.filter(
      ing => parseFloat(ing.currentStock || 0) <= parseFloat(ing.minStock || 0)
    );
  }

  async getKardex(ingredientId, limit = 200) {
    await this.getIngredientById(ingredientId);
    const takeLimit = Number(limit) > 0 ? Number(limit) : 200;
    return await prisma.inventoryMovement.findMany({
      where: { ingredientId },
      include: {
        user: { select: { name: true, role: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: takeLimit
    });
  }
}

module.exports = new IngredientService();
