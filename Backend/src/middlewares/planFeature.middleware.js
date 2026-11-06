/**
 * Middleware de características NeoFood: Todas las funciones operativas desbloqueadas
 */
const requirePlanFeature = () => {
  return (req, res, next) => next();
};

module.exports = {
  requirePlanFeature
};
