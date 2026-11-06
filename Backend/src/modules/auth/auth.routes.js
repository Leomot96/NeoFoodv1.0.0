const express = require('express');
const authController = require('./auth.controller');
const { protectRoute, restrictTo } = require('../../middlewares/auth.middleware');
const {
  sendCodeLimiter,
  verifyCodeLimiter,
  loginLimiter,
  honeypotMiddleware
} = require('../../middlewares/security.middleware');
const ROLES = require('../../constants/roles');

const router = express.Router();

// Rutas públicas protegidas con Rate Limiting y Honeypot Anti-Bot
router.get('/plans', (req, res) => res.status(200).json({ success: true, data: [] }));
router.get('/branding', authController.getBranding);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh-token', loginLimiter, authController.refreshToken);

// Rutas protegidas (Requieren estar logueado)
router.use(protectRoute);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

// Rutas protegidas y restringidas por roles (Administrador)
router.post('/register', restrictTo(ROLES.ADMINISTRADOR), authController.register);

module.exports = router;
