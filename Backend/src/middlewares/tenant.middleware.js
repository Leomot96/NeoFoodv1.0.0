/**
 * Middleware de establecimiento NeoFood (pass-through)
 */
const tenantMiddleware = (req, res, next) => {
  next();
};

module.exports = tenantMiddleware;
