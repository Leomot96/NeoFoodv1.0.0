const { verifyToken } = require('../utils/jwt.util');
const prisma = require('../config/prisma');

// Middleware para verificar que el usuario está logueado y el token es válido
const protectRoute = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No autorizado, token faltante' });
    }

    // Verifica el token usando la firma del Access Token
    const decoded = verifyToken(token, false);

    // Buscamos al usuario incluyendo su rol
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'El usuario del token ya no existe' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'El usuario está desactivado' });
    }

    // Limpiamos datos sensibles antes de inyectarlo en la request
    delete user.password;
    delete user.refreshToken;

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'No autorizado, token inválido o expirado' });
  }
};

// Middleware de permisos (Autorización)
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    const roleName = req.user?.role?.name || req.user?.role;
    // Administrador siempre tiene acceso total
    if (roleName === 'Administrador') {
      return next();
    }

    if (!req.user || !req.user.role || !allowedRoles.includes(roleName)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado: No tienes los permisos necesarios para realizar esta acción' 
      });
    }
    next();
  };
};

module.exports = {
  protectRoute,
  restrictTo
};
