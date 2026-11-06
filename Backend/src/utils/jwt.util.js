const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET y JWT_REFRESH_SECRET son obligatorios en producción.');
  }
  console.warn('[SECURITY WARNING] JWT_SECRET o JWT_REFRESH_SECRET no están definidos en las variables de entorno.');
}

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const verifyToken = (token, isRefreshToken = false) => {
  const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
