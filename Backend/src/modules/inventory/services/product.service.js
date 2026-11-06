const prisma = require("../../../config/prisma");
const { deleteUploadedFile } = require("../../../utils/fileCleaner");
const { compareProducts } = require("../../../utils/categoryOrder");

class ProductService {
  // Valida que categoryId y cualquier ingredientId/linkedProductId existan
  async _validateReferences(data) {
    const { categoryId, ingredients, modifiers, additions } = data;

    if (categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: categoryId, isActive: true } });
      if (!cat) {
        throw Object.assign(new Error('La categoría seleccionada no existe o no está activa'), { statusCode: 400 });
      }
    }

    const ingredientIds = new Set();
    const linkedProductIds = new Set();

    for (const ing of ingredients || []) {
      if (ing.ingredientId && ing.ingredientId.trim() !== '') {
        ingredientIds.add(ing.ingredientId);
      }
    }
    for (const mod of modifiers || []) {
      for (const opt of mod.options || []) {
        if (opt.ingredientId) ingredientIds.add(opt.ingredientId);
        if (opt.linkedProductId) linkedProductIds.add(opt.linkedProductId);
        for (const oi of opt.ingredients || []) {
          if (oi.ingredientId) ingredientIds.add(oi.ingredientId);
        }
      }
    }
    for (const add of additions || []) {
      if (add.ingredientId) ingredientIds.add(add.ingredientId);
    }

    if (ingredientIds.size > 0) {
      const count = await prisma.ingredient.count({
        where: { id: { in: [...ingredientIds] } }
      });
      if (count !== ingredientIds.size) {
        throw Object.assign(new Error('Uno o más insumos de la receta no existen'), { statusCode: 400 });
      }
    }

    if (linkedProductIds.size > 0) {
      const count = await prisma.product.count({
        where: { id: { in: [...linkedProductIds] } }
      });
      if (count !== linkedProductIds.size) {
        throw Object.assign(new Error('Uno o más productos vinculados no existen'), { statusCode: 400 });
      }
    }
  }

  // =====================================
  // OBTENER TODOS LOS PRODUCTOS
  // =====================================
  async getAllProducts() {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
        modifiers: {
          include: {
            options: {
              include: {
                ingredient: true,
                ingredients: { include: { ingredient: true } },
                linkedProduct: {
                  include: {
                    ingredients: { include: { ingredient: true } },
                  },
                },
              },
            },
          },
        },
        additions: { include: { ingredient: true } },
      },
      orderBy: { name: "asc" },
    });

    return products.sort(compareProducts);
  }

  // =====================================
  // OBTENER PRODUCTO POR ID
  // =====================================
  async getProductById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
        modifiers: {
          include: {
            options: {
              include: {
                ingredient: true,
                ingredients: { include: { ingredient: true } },
                linkedProduct: true,
              },
            },
          },
        },
        additions: { include: { ingredient: true } },
      },
    });

    if (!product) {
      const error = new Error('Producto no encontrado');
      error.statusCode = 404;
      throw error;
    }
    return product;
  }

  // =====================================
  // CREAR PRODUCTO CON RELACIONES
  // =====================================
  async createProduct(data) {
    await this._validateReferences(data);

    const {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      showInStore = true,
      trackStock,
      isCombo,
      stock,
      ingredients,
      modifiers,
      additions,
    } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw Object.assign(new Error('El nombre del producto es obligatorio'), { statusCode: 400 });
    }
    const normalizedName = name.trim();

    const parsedPrice = parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw Object.assign(new Error('El precio del producto debe ser un número mayor o igual a 0'), { statusCode: 400 });
    }

    const activeDuplicate = await prisma.product.findFirst({
      where: {
        name: { equals: normalizedName },
        categoryId: categoryId || null,
        isAvailable: true
      }
    });
    if (activeDuplicate) {
      throw Object.assign(new Error(`Ya existe un producto activo llamado "${normalizedName}" en esta categoría`), { statusCode: 400 });
    }

    const existingInactive = await prisma.product.findFirst({
      where: {
        name: { equals: normalizedName },
        categoryId: categoryId || null,
        isAvailable: false
      }
    });

    if (existingInactive) {
      return await this.updateProduct(existingInactive.id, {
        ...data,
        name: normalizedName,
        price: parsedPrice,
        isAvailable: true
      });
    }

    return await prisma.product.create({
      data: {
        name: normalizedName,
        description,
        price: parsedPrice,
        imageUrl: imageUrl || null,
        categoryId,
        showInStore: showInStore !== undefined ? Boolean(showInStore) : true,
        trackStock,
        isCombo: Boolean(isCombo),
        stock,

        ingredients:
          ingredients?.length > 0
            ? {
                create: ingredients
                  .filter(
                    (ing) => ing.ingredientId && ing.ingredientId.trim() !== "",
                  )
                  .map((ing) => ({
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity,
                  })),
              }
            : undefined,

        modifiers:
          modifiers?.length > 0
            ? {
                create: modifiers.map((mod) => ({
                  name: mod.name,
                  isRequired: mod.isRequired !== false,
                  options: {
                    create: mod.options.map((opt) => ({
                      name: opt.name,
                      priceExtra: opt.priceExtra || 0,
                      ingredientId: opt.ingredientId || null,
                      quantity: opt.quantity ? opt.quantity : null,
                      linkedProductId: opt.linkedProductId || null,
                      ingredients:
                        opt.ingredients?.length > 0
                          ? {
                              create: opt.ingredients.map((oi) => ({
                                ingredientId: oi.ingredientId,
                                quantity: oi.quantity,
                              })),
                            }
                          : undefined,
                    })),
                  },
                })),
              }
            : undefined,

        additions:
          additions?.length > 0
            ? {
                create: additions.map((add) => ({
                  name: add.name,
                  price: add.price,
                  ingredientId: add.ingredientId || null,
                  quantity: add.quantity || null,
                })),
              }
            : undefined,
      },
      include: {
        category: true,
        ingredients: { include: { ingredient: true } },
        modifiers: {
          include: {
            options: {
              include: {
                ingredient: true,
                ingredients: { include: { ingredient: true } },
                linkedProduct: true,
              },
            },
          },
        },
        additions: { include: { ingredient: true } },
      },
    });
  }

  // =====================================
  // ACTUALIZAR PRODUCTO (REEMPLAZO TOTAL)
  // =====================================
  async updateProduct(id, data) {
    const existing = await this.getProductById(id);
    await this._validateReferences(data);

    const {
      name,
      description,
      price,
      imageUrl,
      categoryId,
      showInStore,
      trackStock,
      isCombo,
      stock,
      isAvailable,
      ingredients,
      modifiers,
      additions,
    } = data;

    let normalizedName = undefined;
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw Object.assign(new Error('El nombre del producto no puede estar vacío'), { statusCode: 400 });
      }
      normalizedName = name.trim();
      const targetCategory = categoryId !== undefined ? categoryId : existing.categoryId;
      const duplicate = await prisma.product.findFirst({
        where: {
          name: { equals: normalizedName },
          categoryId: targetCategory || null,
          id: { not: id },
          isAvailable: true
        }
      });
      if (duplicate) {
        throw Object.assign(new Error(`Ya existe otro producto activo llamado "${normalizedName}" en esta categoría`), { statusCode: 400 });
      }
    }

    let parsedPrice = undefined;
    if (price !== undefined) {
      parsedPrice = parseFloat(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw Object.assign(new Error('El precio del producto debe ser un número mayor o igual a 0'), { statusCode: 400 });
      }
    }

    if (imageUrl !== undefined) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: { imageUrl: true }
      });
      if (current?.imageUrl && current.imageUrl !== imageUrl) {
        deleteUploadedFile(current.imageUrl);
      }
    }

    return await prisma.$transaction(async (tx) => {
      await tx.productIngredient.deleteMany({ where: { productId: id } });
      await tx.productModifier.deleteMany({ where: { productId: id } });
      await tx.productAddition.deleteMany({ where: { productId: id } });

      return await tx.product.update({
        where: { id },
        data: {
          name: normalizedName !== undefined ? normalizedName : undefined,
          description,
          price: parsedPrice !== undefined ? parsedPrice : undefined,
          imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
          categoryId,
          showInStore: showInStore !== undefined ? Boolean(showInStore) : undefined,
          isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
          trackStock,
          isCombo: Boolean(isCombo),
          stock,

          ingredients:
            ingredients?.length > 0
              ? {
                  create: ingredients
                    .filter(
                      (ing) =>
                        ing.ingredientId && ing.ingredientId.trim() !== "",
                    )
                    .map((ing) => ({
                      ingredientId: ing.ingredientId,
                      quantity: ing.quantity,
                    })),
                }
              : undefined,

          modifiers:
            modifiers?.length > 0
              ? {
                  create: modifiers.map((mod) => ({
                    name: mod.name,
                    isRequired: mod.isRequired !== false,
                    options: {
                      create: mod.options.map((opt) => ({
                        name: opt.name,
                        priceExtra: opt.priceExtra || 0,
                        ingredientId: opt.ingredientId || null,
                        quantity: opt.quantity ? opt.quantity : null,
                        linkedProductId: opt.linkedProductId || null,
                        ingredients:
                          opt.ingredients?.length > 0
                            ? {
                                create: opt.ingredients.map((oi) => ({
                                  ingredientId: oi.ingredientId,
                                  quantity: oi.quantity,
                                })),
                              }
                            : undefined,
                      })),
                    },
                  })),
                }
              : undefined,

          additions:
            additions?.length > 0
              ? {
                  create: additions.map((add) => ({
                    name: add.name,
                    price: add.price,
                    ingredientId: add.ingredientId || null,
                    quantity: add.quantity || null,
                  })),
                }
              : undefined,
        },
        include: {
          category: true,
          ingredients: { include: { ingredient: true } },
          modifiers: {
            include: {
              options: {
                include: {
                  ingredient: true,
                  ingredients: { include: { ingredient: true } },
                  linkedProduct: true,
                },
              },
            },
          },
          additions: { include: { ingredient: true } },
        },
      });
    });
  }

  // =====================================
  // ELIMINAR / DESACTIVAR PRODUCTO
  // =====================================
  async deleteProduct(id) {
    const product = await prisma.product.findUnique({
      where: { id }
    });
    if (!product) {
      const error = new Error('Producto no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const [salesCount, ordersCount] = await Promise.all([
      prisma.saleDetail.count({ where: { productId: id } }),
      prisma.orderDetail.count({ where: { productId: id } }),
    ]);

    if (salesCount > 0 || ordersCount > 0) {
      await prisma.product.update({
        where: { id },
        data: { isAvailable: false },
      });

      return {
        action: 'deactivated',
        message: `El producto "${product.name}" tiene historial de ventas/pedidos, por lo que fue desactivado de la carta para proteger tus reportes.`
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.productModifierOption.updateMany({
        where: { linkedProductId: id },
        data: { linkedProductId: null }
      });
      await tx.product.delete({ where: { id } });
    });
    if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.startsWith('/uploads/products/')) {
      deleteUploadedFile(product.imageUrl);
    }
    return {
      action: 'deleted',
      message: `El producto "${product.name}" fue eliminado permanentemente.`
    };
  }
}

module.exports = new ProductService();
