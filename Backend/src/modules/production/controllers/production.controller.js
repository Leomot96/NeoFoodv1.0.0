const productionService = require('../services/production.service');

class ProductionController {
  
  // POST /api/production
  async createProductionOrder(req, res, next) {
    try {
      const { ingredientId, quantityProduced, notes } = req.body;
      
      if (!ingredientId || !quantityProduced) {
        const error = new Error('Faltan datos obligatorios (ingredientId, quantityProduced)');
        error.statusCode = 400;
        throw error;
      }

      const data = {
        ingredientId,
        quantityProduced,
        notes
      };

      const order = await productionService.createProductionOrder(data, req.user.id);

      res.status(201).json({
        success: true,
        status: 'success',
        data: {
          order
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/production
  async getProductionOrders(req, res, next) {
    try {
      const orders = await productionService.getProductionOrders(req.query);

      res.status(200).json({
        success: true,
        status: 'success',
        results: orders.length,
        data: {
          orders
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/production/:id/cancel
  async cancelProductionOrder(req, res, next) {
    try {
      const { id } = req.params;
      const result = await productionService.cancelProductionOrder(id, req.user.id);

      res.status(200).json({
        success: true,
        status: 'success',
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductionController();
