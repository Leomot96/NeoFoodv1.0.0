const authService = require('./auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.loginUser(req.body);
      res.status(200).json({
        success: true,
        message: 'Autenticación exitosa',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logoutUser(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      
      res.status(200).json({
        success: true,
        message: 'Token actualizado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await authService.getCurrentUser(req.user.id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBranding(req, res, next) {
    try {
      const branding = await authService.getPublicBranding();
      res.status(200).json({
        success: true,
        data: branding,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
