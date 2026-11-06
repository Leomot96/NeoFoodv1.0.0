const prisma = require('../../../config/prisma');
const bcrypt = require('bcrypt');
const { validatePassword } = require('../../../utils/passwordValidator');

class UserService {
  // 1. Obtener todos los roles para el formulario del Frontend
  async getRoles() {
    return await prisma.role.findMany({
      where: {
        name: { notIn: ['SuperAdmin', 'SUPERADMIN', 'superadmin'] }
      },
      orderBy: { name: 'asc' }
    });
  }

  // Obtener información del restaurante único
  async getRestaurants() {
    const restaurant = await prisma.restaurant.findFirst({
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
    return restaurant ? [restaurant] : [];
  }

  // 2. Obtener usuarios (excluyendo password e incluyendo los datos del Rol y Teléfono)
  async getAllUsers() {
    return await prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        isActive: true, 
        createdAt: true,
        roleId: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });
  }

  // 3. Crear Usuario
  async createUser(data) {
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      const error = new Error('El correo electrónico es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      const error = new Error('El correo o usuario ya está registrado');
      error.statusCode = 400;
      throw error;
    }

    const targetRole = await prisma.role.findFirst({
      where: { id: data.roleId }
    });
    if (!targetRole) {
      const error = new Error('El rol seleccionado no existe');
      error.statusCode = 400;
      throw error;
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      const error = new Error(passwordValidation.message);
      error.statusCode = 400;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: data.phone ? data.phone.trim() : null,
        password: hashedPassword,
        roleId: targetRole.id
      }
    });

    delete user.password;
    return user;
  }

  // 4. Actualizar Usuario
  async updateUser(id, data, requestingUserId = null) {
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });
    if (!existingUser) {
      const error = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    // Impedir que el usuario autenticado desactive su propia cuenta o cambie su propio rol en sesión
    if (requestingUserId && existingUser.id === requestingUserId) {
      if (data.isActive === false) {
        const error = new Error('No puedes desactivar tu propia cuenta mientras estás en sesión');
        error.statusCode = 400;
        throw error;
      }
      if (data.roleId && data.roleId !== existingUser.roleId) {
        const error = new Error('No puedes cambiar el rol de tu propia cuenta en uso');
        error.statusCode = 400;
        throw error;
      }
    }

    let validatedRoleId = undefined;
    if (data.roleId) {
      const targetRole = await prisma.role.findFirst({
        where: { id: data.roleId }
      });
      if (!targetRole) {
        const error = new Error('El rol seleccionado no existe');
        error.statusCode = 400;
        throw error;
      }
      validatedRoleId = targetRole.id;
    }

    // Impedir dejar al restaurante sin al menos un Administrador activo
    const existingRoleName = String(existingUser.role?.name || '').trim().toLowerCase();
    const isCurrentlyAdmin = existingRoleName === 'administrador';
    const isDeactivatingAdmin = isCurrentlyAdmin && existingUser.isActive && data.isActive === false;
    const isDemotingAdmin = isCurrentlyAdmin && existingUser.isActive && validatedRoleId && validatedRoleId !== existingUser.roleId;

    if (isDeactivatingAdmin || isDemotingAdmin) {
      const remainingAdmins = await prisma.user.count({
        where: {
          id: { not: existingUser.id },
          isActive: true,
          role: { name: 'Administrador' }
        }
      });
      if (remainingAdmins === 0) {
        const error = new Error('El establecimiento debe conservar al menos un usuario Administrador activo');
        error.statusCode = 400;
        throw error;
      }
    }

    let normalizedEmail = undefined;
    if (data.email !== undefined && data.email !== null) {
      normalizedEmail = String(data.email).trim().toLowerCase();
      if (!normalizedEmail) {
        const error = new Error('El correo electrónico no puede estar vacío');
        error.statusCode = 400;
        throw error;
      }
      if (normalizedEmail !== existingUser.email.toLowerCase()) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            id: { not: id }
          }
        });
        if (emailExists) {
          const error = new Error('El correo electrónico ya está registrado por otro usuario');
          error.statusCode = 400;
          throw error;
        }
      }
    }

    const updateData = {
      name: data.name !== undefined ? (typeof data.name === 'string' ? data.name.trim() : data.name) : undefined,
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
      phone: data.phone !== undefined ? (data.phone ? data.phone.trim() : null) : undefined,
      ...(validatedRoleId ? { roleId: validatedRoleId } : {}),
      isActive: data.isActive
    };

    // Si se desactiva al usuario, revocar su refreshToken inmediatamente
    if (data.isActive === false) {
      updateData.refreshToken = null;
    }

    if (data.password && data.password.trim() !== '') {
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.isValid) {
        const error = new Error(passwordValidation.message);
        error.statusCode = 400;
        throw error;
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });

    delete user.password;
    return user;
  }

  // 5. Eliminar Usuario Definitivamente y sus Registros
  async deleteUser(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) {
      const error = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    // Impedir eliminar al único Administrador activo del restaurante
    const roleName = String(user.role?.name || '').trim().toLowerCase();
    if (roleName === 'administrador' && user.isActive) {
      const remainingAdmins = await prisma.user.count({
        where: {
          id: { not: user.id },
          isActive: true,
          role: { name: 'Administrador' }
        }
      });
      if (remainingAdmins === 0) {
        const error = new Error('No se puede eliminar al único Administrador activo del establecimiento.');
        error.statusCode = 400;
        throw error;
      }
    }

    // Verificar si el usuario posee actividad histórica comercial, contable o fiscal para PROHIBIR su eliminación física
    const [cashSessionsCount, ordersCount, expensesCount, auditsCount] = await Promise.all([
      prisma.cashSession.count({ where: { userId: id } }),
      prisma.order.count({ where: { userId: id } }),
      prisma.expense.count({ where: { userId: id } }),
      prisma.cashAudit.count({ where: { OR: [{ auditorId: id }, { cashierId: id }] } })
    ]);

    if (cashSessionsCount > 0 || ordersCount > 0 || expensesCount > 0 || auditsCount > 0) {
      const error = new Error('No es posible eliminar el usuario porque tiene turnos de caja, ventas, pedidos o registros contables asociados. Por integridad tributaria y fiscal, desactive la cuenta en su lugar.');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Logs de auditoría
      await tx.auditLog.deleteMany({ where: { userId: id } });

      // 2. Movimientos de inventario registrados por el usuario
      await tx.inventoryMovement.deleteMany({ where: { userId: id } });

      // 3. Borrar usuario
      const deletedUser = await tx.user.delete({
        where: { id }
      });

      delete deletedUser.password;
      return deletedUser;
    });
  }
}

module.exports = new UserService();
