const express = require('express');
const { protectRoute, restrictTo } = require('../../middlewares/auth.middleware');
const ROLES = require('../../constants/roles');

const userController = require('./controllers/user.controller');

const router = express.Router();

// Protegemos todas las rutas de usuarios (Solo el Administrador puede gestionar personal)
router.use(protectRoute);
router.use(restrictTo(ROLES.ADMINISTRADOR));

router.get('/roles', userController.getRoles);
router.get('/restaurants', userController.getRestaurants);
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
