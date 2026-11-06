const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanUploads() {
  console.log('🧹 Limpiando directorio de archivos subidos (uploads)...');
  const dirs = [
    path.join(__dirname, '..', 'uploads', 'products'),
    path.join(__dirname, '..', 'uploads', 'store')
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(dir, file);
        try {
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            console.log(`   🗑️ Archivo eliminado: ${file}`);
          }
        } catch (err) {
          console.error(`   ⚠️ Error eliminando ${file}:`, err.message);
        }
      }
    }
  }
  console.log('✅ Directorios de uploads limpios y restablecidos.');
}

async function main() {
  console.log('========================================================');
  console.log('🚀 INICIANDO RESTABLECIMIENTO Y LIMPIEZA DE NEOFOOD');
  console.log('========================================================');

  // 1. Desactivar validación de llaves foráneas para truncar tablas de forma segura
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

  const tablesToTruncate = [
    'sale_detail_additions',
    'sale_detail_variations',
    'sale_details',
    'sales',
    'sale_payments',
    'order_details',
    'orders',
    'cash_audits',
    'cash_movements',
    'cash_sessions',
    'customer_credits',
    'customers',
    'expenses',
    'purchase_details',
    'purchases',
    'suppliers',
    'production_consumptions',
    'production_orders',
    'inventory_movements',
    'modifier_option_ingredients',
    'product_modifier_options',
    'product_modifiers',
    'product_additions',
    'product_ingredients',
    'ingredient_recipes',
    'ingredients',
    'products',
    'categories',
    'audit_logs',
    'tables',
    'payment_methods',
    'configurations',
    'users',
    'roles',
    'restaurant'
  ];

  for (const table of tablesToTruncate) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
      console.log(`   ✔️ Tabla vaciada: ${table}`);
    } catch (e) {
      console.warn(`   ⚠️ Advertencia vaciando ${table}: ${e.message}`);
    }
  }

  // Reactivar llaves foráneas
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('✅ Todas las tablas operativas han sido vaciadas.');

  // 2. Crear Establecimiento Único (NeoFood)
  console.log('\n🏢 Sembrando Establecimiento NeoFood...');
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'NeoFood',
      slug: 'neofood',
      document: '900.123.456-7',
      email: 'admin@neofood.com',
      phone: '+57 3154606276',
      address: 'Calle Principal #10-20',
      isStoreActive: true,
      storeSchedule: 'Lunes a Domingo: 11:00 AM - 10:00 PM',
      storeDescription: 'Sede Principal y Matriz Administrativa de NeoFood POS & CRM.',
      storeAnnouncement: '¡Bienvenidos a NeoFood! Plataforma gastronómica activa.'
    }
  });
  console.log(`   ✔️ Restaurante: ${restaurant.name} (${restaurant.slug})`);

  // 3. Crear Roles
  console.log('\n🛡️ Sembrando Roles del Sistema...');
  const baseRoleNames = [
    { name: 'Administrador', desc: 'Control total de la sede, usuarios y configuración' },
    { name: 'Supervisor', desc: 'Supervisión de operaciones, auditorías y turnos de caja' },
    { name: 'Cajero', desc: 'Gestión de cobro, caja y facturación' },
    { name: 'Mesero', desc: 'Toma de comandas y gestión de mesas' }
  ];

  const rolesMap = {};
  for (const r of baseRoleNames) {
    const createdRole = await prisma.role.create({
      data: {
        name: r.name,
        description: r.desc
      }
    });
    rolesMap[r.name] = createdRole;
  }
  console.log(`   ✔️ Roles creados: ${Object.keys(rolesMap).join(', ')}`);

  // 4. Crear Usuario Administrador
  console.log('\n👤 Sembrando Usuario Administrador...');
  const rawSeedPassword = process.env.SEED_DEFAULT_PASSWORD || '123456';
  const passwordHash = await bcrypt.hash(rawSeedPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@neofood.com',
      password: passwordHash,
      name: 'Administrador Principal',
      phone: '+57 3154606276',
      roleId: rolesMap['Administrador'].id,
      isActive: true
    }
  });
  console.log(`   ✔️ Administrador Creado: ${adminUser.email} (Contraseña: ${rawSeedPassword})`);

  // 5. Métodos de Pago Base
  console.log('\n💳 Sembrando Métodos de Pago Base...');
  await prisma.paymentMethod.createMany({
    data: [
      { name: 'Efectivo', isActive: true },
      { name: 'Nequi', isActive: true },
      { name: 'Daviplata', isActive: true },
      { name: 'Tarjeta', isActive: true },
      { name: 'Crédito', isActive: true }
    ]
  });
  console.log('   ✔️ Métodos de pago creados: Efectivo, Nequi, Daviplata, Tarjeta, Crédito');

  // 6. Configuraciones Iniciales del Sistema
  console.log('\n⚙️ Sembrando Configuraciones Iniciales...');
  const initialConfigs = [
    { key: 'business_name', value: 'NeoFood' },
    { key: 'business_document', value: '900.123.456-7' },
    { key: 'business_phone', value: '+57 3154606276' },
    { key: 'business_address', value: 'Calle Principal #10-20' },
    { key: 'currency_symbol', value: '$' },
    { key: 'tax_percentage', value: '0' },
    { key: 'brand_primary_color', value: '#4f46e5' },
    { key: 'brand_secondary_color', value: '#10b981' },
    { key: 'brand_theme_preset', value: 'landing' }
  ];

  for (const ic of initialConfigs) {
    await prisma.configuration.create({
      data: {
        key: ic.key,
        value: ic.value
      }
    });
  }
  console.log('   ✔️ Configuraciones base listas para NeoFood');

  // 7. Mesas Iniciales Limpias
  console.log('\n🪑 Sembrando Mesas Limpias...');
  for (let i = 1; i <= 6; i++) {
    await prisma.table.create({
      data: {
        name: `Mesa ${i}`,
        capacity: 4,
        isActive: true
      }
    });
  }
  console.log('   ✔️ 6 Mesas creadas (Mesa 1 a Mesa 6)');

  // 8. Cliente y Proveedor Base por defecto
  console.log('\n👥 Sembrando Cliente y Proveedor Base...');
  await prisma.customer.create({
    data: {
      name: 'Consumidor final',
      document: '222222222222'
    }
  });

  await prisma.supplier.create({
    data: {
      name: 'Proveedor Genérico',
      nit: '222222222'
    }
  });
  console.log('   ✔️ Cliente "Consumidor final" (222222222222) y Proveedor "Proveedor Genérico" (222222222) creados');

  // 9. Limpieza de Uploads físicos
  await cleanUploads();

  console.log('\n========================================================');
  console.log('🎉 BASE DE DATOS RESTABLECIDA Y LISTA PARA PRODUCCIÓN');
  console.log('========================================================');
  console.log('Credenciales del Sistema:');
  console.log('   - URL: http://localhost:5173/login');
  console.log('   - Email: admin@neofood.com');
  console.log(`   - Password: ${rawSeedPassword}`);
  console.log('   - Tienda Virtual QR: http://localhost:5173/tienda/neofood');
  console.log('========================================================\n');
}

main()
  .catch(e => {
    console.error('❌ Error durante el restablecimiento:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
