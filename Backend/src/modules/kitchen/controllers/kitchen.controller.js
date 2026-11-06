const kitchenService = require('../services/kitchen.service');

class KitchenController {
  async getOrders(req, res, next) {
    try {
      const orders = await kitchenService.getKitchenOrders(req.query);
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: 'El estado es requerido' });
      }

      const updated = await kitchenService.updateOrderStatus(id, status, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Estado del pedido actualizado',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req, res, next) {
    try {
      const order = await kitchenService.createKitchenOrder(req.user?.id, req.body);
      res.status(201).json({
        success: true,
        message: 'Comanda creada con éxito',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KitchenController();
