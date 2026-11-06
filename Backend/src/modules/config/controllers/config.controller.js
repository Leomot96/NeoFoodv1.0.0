const configService = require('../services/config.service');

class ConfigController {
  async getPrinterConfig(req, res, next) {
    try {
      const config = await configService.getPrinterConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updatePrinterConfig(req, res, next) {
    try {
      const updated = await configService.updatePrinterConfig(req.body);
      res.status(200).json({
        success: true,
        message: 'Configuración de impresora POS guardada correctamente',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConfigController();
