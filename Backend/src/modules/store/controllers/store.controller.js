const storeService = require('../services/store.service');

class StoreController {
  // ==========================================
  // PÚBLICOS
  // ==========================================
  async getPublicStore(req, res, next) {
    try {
      const { slug } = req.params;
      const data = await storeService.getPublicStoreBySlug(slug);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async createPublicOrder(req, res, next) {
    try {
      const { slug } = req.params;
      const result = await storeService.createPublicOrder(slug, req.body);
      res.status(201).json({
        success: true,
        message: '¡Pedido registrado con éxito!',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADMINISTRACIÓN (PROTEGIDOS)
  // ==========================================
  async getConfig(req, res, next) {
    try {
      const config = await storeService.getStoreConfig();
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req, res, next) {
    try {
      const updated = await storeService.updateStoreConfig(req.body);
      res.status(200).json({
        success: true,
        message: 'Configuración de la tienda actualizada correctamente',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadLogo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se envió ningún archivo de imagen para el logo' });
      }

      const { verifyUploadedImageSignature } = require('../../../middlewares/upload.middleware');
      verifyUploadedImageSignature(req.file.path);

      const logoUrl = `/uploads/store/${req.file.filename}`;
      const result = await storeService.updateLogo(logoUrl);

      res.status(200).json({
        success: true,
        message: 'Logotipo actualizado exitosamente',
        data: result
      });
    } catch (error) {
      if (req.file?.path) {
        try {
          const { deleteUploadedFile } = require('../../../utils/fileCleaner');
          deleteUploadedFile(req.file.path);
        } catch (_) {}
      }
      next(error);
    }
  }

  async deleteLogo(req, res, next) {
    try {
      const result = await storeService.deleteLogo();
      res.status(200).json({
        success: true,
        message: 'Logotipo eliminado exitosamente',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadBanner(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se envió ningún archivo de imagen para el banner' });
      }

      const { verifyUploadedImageSignature } = require('../../../middlewares/upload.middleware');
      verifyUploadedImageSignature(req.file.path);

      const bannerUrl = `/uploads/store/${req.file.filename}`;
      const result = await storeService.updateBanner(bannerUrl);

      res.status(200).json({
        success: true,
        message: 'Banner de portada actualizado exitosamente',
        data: result
      });
    } catch (error) {
      if (req.file?.path) {
        try {
          const { deleteUploadedFile } = require('../../../utils/fileCleaner');
          deleteUploadedFile(req.file.path);
        } catch (_) {}
      }
      next(error);
    }
  }

  async deleteBanner(req, res, next) {
    try {
      const result = await storeService.deleteBanner();
      res.status(200).json({
        success: true,
        message: 'Banner eliminado exitosamente',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req, res, next) {
    try {
      const orders = await storeService.getStoreOrders(req.query);
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveCount(req, res, next) {
    try {
      const stats = await storeService.getActiveCount();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await storeService.updateOrderStatus(id, status, req.user?.id);
      res.status(200).json({
        success: true,
        message: `Estado de la orden actualizado a ${status}`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async convertToSale(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const sale = await storeService.convertOrderToSale(id, userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Pedido facturado correctamente en caja',
        data: sale
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StoreController();
