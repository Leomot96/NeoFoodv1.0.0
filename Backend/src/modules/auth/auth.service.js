const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../../utils/jwt.util');
const ROLES = require('../../constants/roles');
const { validatePassword } = require('../../utils/passwordValidator');

// Hash bcrypt señuelo para mitigar ataques de enumeración por tiempo en login
const DUMMY_BCRYPT_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V5G7Y9xL0K2p1m3N5v7B9c1eG';

const hashTokenOrCode = (val) =>
  crypto.createHash('sha256').update(String(val)).digest('hex');

const safeCompareHex = (hexA, hexB) => {
  if (typeof hexA !== 'string' || typeof hexB !== 'string' || hexA.length !== hexB.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(hexA, 'utf8'), Buffer.from(hexB, 'utf8'));
  } catch {
    return false;
  }
};

class AuthService {
  async _getBrandThemeConfig() {
    try {
      const rows = await prisma.configuration.findMany({
        where: {
          key: { in: ['brand_primary_color', 'brand_secondary_color', 'brand_theme_preset'] }
        }
      });
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      let primary = map['brand_primary_color'] || process.env.BRAND_PRIMARY_COLOR || '#4f46e5';
      let secondary = map['brand_secondary_color'] || process.env.BRAND_SECONDARY_COLOR || '#10b981';
      let preset = map['brand_theme_preset'] || process.env.BRAND_THEME_PRESET || 'landing';

      // Purga y normalización si había colores antiguos en rojo/fuego
      if (['#ea580c', '#dc2626', '#f97316', '#ef4444'].includes(String(primary).toLowerCase())) {
        primary = '#4f46e5';
        secondary = '#10b981';
        preset = 'landing';
      }

      return {
        primaryColor: primary,
        secondaryColor: secondary,
        themePreset: preset
      };
    } catch {
      return {
        primaryColor: process.env.BRAND_PRIMARY_COLOR || '#4f46e5',
        secondaryColor: process.env.BRAND_SECONDARY_COLOR || '#10b981',
        themePreset: process.env.BRAND_THEME_PRESET || 'landing'
      };
    }
  }

  async getPublicBranding() {
    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: process.env.BRAND_NAME || 'NeoFood',
          slug: process.env.BRAND_SLUG || 'neofood'
        }
      });
    }

    const brandTheme = await this._getBrandThemeConfig();

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      whatsappNumber: restaurant.whatsappNumber,
      logoUrl: restaurant.logoUrl,
      address: restaurant.address,
      document: restaurant.document,
      description: restaurant.storeDescription || restaurant.description || null,
      storeDescription: restaurant.storeDescription || null,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };
  }

  async loginUser(credentials) {
    const { email, password } = credentials;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true
      }
    });

    // Ejecutar siempre bcrypt.compare para evitar enumeración de usuarios
    const targetHash = user?.password || DUMMY_BCRYPT_HASH;
    const isPasswordValid = await bcrypt.compare(String(password || ''), targetHash);

    if (!user || !user.isActive || !isPasswordValid) {
      const error = new Error('Credenciales inválidas o usuario inactivo');
      error.statusCode = 401;
      throw error;
    }

    // Obtener información del restaurante único
    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: 'NeoFood',
          slug: 'neofood'
        }
      });
    }

    const payload = {
      id: user.id,
      role: user.role.name
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const refreshTokenHash = hashTokenOrCode(refreshToken);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash }
    });

    const brandTheme = await this._getBrandThemeConfig();

    const restaurantPayload = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      logoUrl: restaurant.logoUrl,
      address: restaurant.address,
      document: restaurant.document,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role.name,
        restaurant: restaurantPayload,
        tenant: restaurantPayload
      },
      accessToken,
      refreshToken,
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      include: { role: true }
    });

    if (!user || !user.isActive) {
      const error = new Error('Usuario no encontrado o inactivo');
      error.statusCode = 401;
      throw error;
    }

    let restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: 'NeoFood',
          slug: 'neofood'
        }
      });
    }

    const brandTheme = await this._getBrandThemeConfig();

    const restaurantPayload = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      logoUrl: restaurant.logoUrl,
      address: restaurant.address,
      document: restaurant.document,
      primaryColor: brandTheme.primaryColor,
      secondaryColor: brandTheme.secondaryColor,
      themePreset: brandTheme.themePreset
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role.name,
        restaurant: restaurantPayload,
        tenant: restaurantPayload
      }
    };
  }

  async logoutUser(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });
    return true;
  }

  async refreshAccessToken(token) {
    if (!token) {
      const error = new Error('Refresh token requerido');
      error.statusCode = 401;
      throw error;
    }

    try {
      const decoded = verifyToken(token, true);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          role: true
        }
      });

      const incomingHash = hashTokenOrCode(token);
      const storedToken = user?.refreshToken || '';
      const tokenMatches = safeCompareHex(storedToken, incomingHash);

      if (!user || !user.isActive || !storedToken || !tokenMatches) {
        const error = new Error('Refresh token inválido o revocado');
        error.statusCode = 401;
        throw error;
      }

      const payload = {
        id: user.id,
        role: user.role.name
      };
      const newAccessToken = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken(payload);
      const newRefreshTokenHash = hashTokenOrCode(newRefreshToken);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshTokenHash }
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (err) {
      const error = new Error('Refresh token inválido o expirado');
      error.statusCode = 401;
      throw error;
    }
  }

  async registerUser(userData) {
    const { email, password, name, phone, roleName } = userData;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      const error = new Error('El correo electrónico es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      const error = new Error(passwordValidation.message);
      error.statusCode = 400;
      throw error;
    }

    const userExists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (userExists) {
      const error = new Error('El correo ya está registrado');
      error.statusCode = 400;
      throw error;
    }

    const requestedRoleName = String(roleName || ROLES.CAJERO).trim();
    const role = await prisma.role.findFirst({
      where: {
        name: requestedRoleName
      }
    });

    if (!role) {
      const error = new Error('El rol especificado no existe');
      error.statusCode = 400;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: typeof name === 'string' ? name.trim() : name,
        phone: phone ? phone.trim() : null,
        roleId: role.id
      },
      include: { role: true }
    });

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      phone: newUser.phone,
      role: newUser.role.name,
    };
  }
}

module.exports = new AuthService();
