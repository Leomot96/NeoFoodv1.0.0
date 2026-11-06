const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('Variables críticas faltantes en entorno: DATABASE_URL, JWT_SECRET y JWT_REFRESH_SECRET son obligatorias.');
    }

    // Verificar conexión a la base de datos
    await prisma.$connect();
    console.log('✅ Conexión exitosa a la base de datos mediante Prisma');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor NeoFood ejecutándose en el puerto ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'production'}`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor y conexiones Prisma...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
