const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando sembrado completo de datos demo (Extrema Burger)...');

  // =========================================================================
  // 1. RESTAURANTE ÚNICO
  // =========================================================================
  const weeklySchedule = [
    { dayIndex: 1, dayName: 'Lunes', isOpen: true, openTime: '12:00', closeTime: '22:00', hasSecondShift: false },
    { dayIndex: 2, dayName: 'Martes', isOpen: true, openTime: '12:00', closeTime: '22:00', hasSecondShift: false },
    { dayIndex: 3, dayName: 'Miércoles', isOpen: true, openTime: '12:00', closeTime: '22:00', hasSecondShift: false },
    { dayIndex: 4, dayName: 'Jueves', isOpen: true, openTime: '12:00', closeTime: '23:00', hasSecondShift: false },
    { dayIndex: 5, dayName: 'Viernes', isOpen: true, openTime: '12:00', closeTime: '00:00', hasSecondShift: false },
    { dayIndex: 6, dayName: 'Sábado', isOpen: true, openTime: '12:00', closeTime: '01:00', hasSecondShift: false },
    { dayIndex: 0, dayName: 'Domingo', isOpen: true, openTime: '12:00', closeTime: '21:00', hasSecondShift: false }
  ];

  let restaurant = await prisma.restaurant.findFirst();
  if (restaurant) {
    restaurant = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: 'Extrema Burger',
        slug: 'extrema-burger',
        document: '900.876.543-1',
        email: 'admin@neofood.com',
        phone: '+57 312 987 6543',
        whatsappNumber: '573129876543',
        address: 'Cra 15 # 85-30, Zona Rosa, Bogotá',
        storeAnnouncement: '🔥 ¡2x1 en Hamburguesas Doble Fuego los Jueves! Envíos rápidos por WhatsApp.',
        storeDescription: 'Hamburguesas artesanales a la parrilla de carbón, carnes maduradas 100% res, queso cheddar fundido y pan brioche horneado a diario.',
        isStoreActive: true,
        storeSchedule: JSON.stringify(weeklySchedule)
      }
    });
    console.log('✅ Restaurante actualizado a Extrema Burger.');
  } else {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Extrema Burger',
        slug: 'extrema-burger',
        document: '900.876.543-1',
        email: 'admin@neofood.com',
        phone: '+57 312 987 6543',
        whatsappNumber: '573129876543',
        address: 'Cra 15 # 85-30, Zona Rosa, Bogotá',
        storeAnnouncement: '🔥 ¡2x1 en Hamburguesas Doble Fuego los Jueves! Envíos rápidos por WhatsApp.',
        storeDescription: 'Hamburguesas artesanales a la parrilla de carbón, carnes maduradas 100% res, queso cheddar fundido y pan brioche horneado a diario.',
        isStoreActive: true,
        storeSchedule: JSON.stringify(weeklySchedule)
      }
    });
    console.log('✅ Restaurante Extrema Burger creado.');
  }

  // =========================================================================
  // 2. ROLES Y USUARIOS
  // =========================================================================
  const roleNames = ['Administrador', 'Supervisor', 'Cajero', 'Mesero'];
  const roleMap = {};
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    roleMap[name] = role.id;
  }
  console.log('✅ Roles asegurados.');

  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@neofood.com' },
    update: { password: passwordHash, isActive: true, roleId: roleMap['Administrador'] },
    create: {
      email: 'admin@neofood.com',
      password: passwordHash,
      name: 'Chef Ejecutivo (Admin)',
      phone: '3129876543',
      roleId: roleMap['Administrador'],
      isActive: true
    }
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cajero@neofood.com' },
    update: { password: passwordHash, isActive: true, roleId: roleMap['Cajero'] },
    create: {
      email: 'cajero@neofood.com',
      password: passwordHash,
      name: 'Carlos Mendoza (Caja)',
      phone: '3118765432',
      roleId: roleMap['Cajero'],
      isActive: true
    }
  });

  const waiter = await prisma.user.upsert({
    where: { email: 'mesero@neofood.com' },
    update: { password: passwordHash, isActive: true, roleId: roleMap['Mesero'] },
    create: {
      email: 'mesero@neofood.com',
      password: passwordHash,
      name: 'Valentina Gómez (Salón)',
      phone: '3107654321',
      roleId: roleMap['Mesero'],
      isActive: true
    }
  });
  console.log('✅ Usuarios asegurados: admin@neofood.com, cajero@neofood.com, mesero@neofood.com (clave: 123456).');

  // =========================================================================
  // 3. MÉTODOS DE PAGO
  // =========================================================================
  const paymentMethodsList = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta Débito', 'Tarjeta Crédito', 'Bancolombia QR'];
  const paymentMap = {};
  for (const name of paymentMethodsList) {
    const pm = await prisma.paymentMethod.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true }
    });
    paymentMap[name] = pm.id;
  }
  console.log('✅ Métodos de pago creados/actualizados.');

  // =========================================================================
  // 4. MESAS DEL SALÓN
  // =========================================================================
  const tablesList = [
    { name: 'Mesa 1', capacity: 4 },
    { name: 'Mesa 2', capacity: 2 },
    { name: 'Mesa 3', capacity: 4 },
    { name: 'Mesa 4', capacity: 6 },
    { name: 'Mesa 5', capacity: 4 },
    { name: 'Terraza 1', capacity: 4 },
    { name: 'Terraza 2', capacity: 2 },
    { name: 'Terraza 3', capacity: 6 },
    { name: 'Barra 1', capacity: 1 },
    { name: 'Barra 2', capacity: 1 },
    { name: 'VIP 1', capacity: 8 }
  ];
  const tableMap = {};
  for (const t of tablesList) {
    const table = await prisma.table.upsert({
      where: { name: t.name },
      update: { capacity: t.capacity, isActive: true },
      create: { name: t.name, capacity: t.capacity, isActive: true }
    });
    tableMap[t.name] = table.id;
  }
  console.log('✅ Mesas aseguradas (11 mesas).');

  // =========================================================================
  // 5. CLIENTES
  // =========================================================================
  const customersList = [
    { document: '1020304050', name: 'Juan Pablo Morales', email: 'juan.morales@gmail.com', phone: '3101234567', address: 'Calle 100 # 15-20', balance: 0 },
    { document: '1030405060', name: 'Carolina Restrepo', email: 'carolina.r@hotmail.com', phone: '3112345678', address: 'Carrera 7 # 72-10', balance: 55000 },
    { document: '1040506070', name: 'Andrés Felipe Vargas', email: 'andres.vargas@empresa.co', phone: '3123456789', address: 'Calle 127 # 53-10', balance: 0 },
    { document: '1050607080', name: 'María Paula Echeverri', email: 'mp.echeverri@yahoo.com', phone: '3134567890', address: 'Transversal 23 # 95-40', balance: 0 },
    { document: '222222222222', name: 'Consumidor Final', email: 'cliente@mostrador.com', phone: '3000000000', address: 'Mostrador POS', balance: 0 }
  ];

  const customerMap = {};
  for (const c of customersList) {
    const customer = await prisma.customer.upsert({
      where: { document: c.document },
      update: { name: c.name, email: c.email, phone: c.phone, address: c.address, balance: c.balance },
      create: c
    });
    customerMap[c.document] = customer.id;
  }
  console.log('✅ Clientes asegurados.');

  // =========================================================================
  // 6. PROVEEDORES
  // =========================================================================
  const suppliersList = [
    { nit: '900.123.888-1', name: 'Frigorífico San Martín S.A.S.', phone: '3105551234', email: 'ventas@frigorificosanmartin.com', address: 'Autopista Sur km 8' },
    { nit: '900.456.999-2', name: 'Panificadora Gourmet Andina', phone: '3114445678', email: 'pedidos@panaderiagourmet.com', address: 'Av. Las Américas # 45-20' },
    { nit: '900.789.111-3', name: 'Lácteos & Quesos El Trébol', phone: '3123337890', email: 'distribucion@quesoseltrebol.com', address: 'Calle 68 # 22-14' },
    { nit: '900.999.000-4', name: 'Bebidas y Licores del Norte', phone: '3157778899', email: 'pedidos@bebidasnorte.co', address: 'Calle 13 # 68-90' }
  ];

  const supplierMap = {};
  for (const s of suppliersList) {
    const sup = await prisma.supplier.upsert({
      where: { nit: s.nit },
      update: { name: s.name, phone: s.phone, email: s.email, address: s.address },
      create: s
    });
    supplierMap[s.nit] = sup.id;
  }
  console.log('✅ Proveedores asegurados.');

  // =========================================================================
  // 7. INGREDIENTES / INVENTARIO
  // =========================================================================
  const ingredientsList = [
    { name: 'Pan Brioche Artesanal', unit: 'UND', currentStock: 140, minStock: 30, costPerUnit: 1400 },
    { name: 'Carne de Res Madurada 150g', unit: 'UND', currentStock: 110, minStock: 25, costPerUnit: 5800 },
    { name: 'Tocineta Ahumada Crujiente', unit: 'KG', currentStock: 22.5, minStock: 5, costPerUnit: 29000 },
    { name: 'Queso Cheddar Americano', unit: 'KG', currentStock: 16.0, minStock: 4, costPerUnit: 34000 },
    { name: 'Queso Mozzarella', unit: 'KG', currentStock: 14.5, minStock: 4, costPerUnit: 28000 },
    { name: 'Cebolla Caramelizada', unit: 'KG', currentStock: 8.0, minStock: 2, costPerUnit: 15000 },
    { name: 'Papas a la Francesa Rizadas', unit: 'KG', currentStock: 45.0, minStock: 10, costPerUnit: 9000 },
    { name: 'Costilla de Cerdo BBQ', unit: 'KG', currentStock: 28.0, minStock: 6, costPerUnit: 36000 },
    { name: 'Salsa Ahumada BBQ', unit: 'L', currentStock: 18.0, minStock: 3, costPerUnit: 14000 },
    { name: 'Cerveza Artesanal IPA', unit: 'UND', currentStock: 60, minStock: 12, costPerUnit: 7200 },
    { name: 'Coca Cola 400ml', unit: 'UND', currentStock: 85, minStock: 20, costPerUnit: 3200 },
    { name: 'Helado de Vainilla y Caramelo', unit: 'L', currentStock: 12.0, minStock: 3, costPerUnit: 22000 }
  ];

  const ingredientMap = {};
  for (const ing of ingredientsList) {
    let item = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    if (!item) {
      item = await prisma.ingredient.create({ data: ing });
    } else {
      item = await prisma.ingredient.update({
        where: { id: item.id },
        data: { currentStock: ing.currentStock, minStock: ing.minStock, costPerUnit: ing.costPerUnit }
      });
    }
    ingredientMap[ing.name] = item.id;
  }
  console.log('✅ Ingredientes asegurados (12 insumos).');

  // =========================================================================
  // 8. CATEGORÍAS Y PRODUCTOS
  // =========================================================================
  const categoriesData = [
    {
      name: 'Hamburguesas Artesanales',
      description: 'Carnes 100% de res maduradas a la brasa con queso cheddar y pan brioche',
      products: [
        {
          name: 'Hamburguesa Fuego Master',
          price: 32900,
          description: 'Carne madurada 150g a la parrilla, tocineta crujiente, doble queso cheddar fundido, cebolla caramelizada y salsa ahumada.',
          imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Término de la Carne',
              isRequired: true,
              options: [
                { name: 'Término Medio (Jugosa)', priceExtra: 0 },
                { name: 'Tres Cuartos (Recomendado)', priceExtra: 0 },
                { name: 'Bien Asada', priceExtra: 0 }
              ]
            },
            {
              name: 'Tipo de Pan',
              isRequired: true,
              options: [
                { name: 'Pan Brioche Mantequilla', priceExtra: 0 },
                { name: 'Pan Rústico con Ajonjolí Negro', priceExtra: 500 },
                { name: 'En Cama de Lechuga (Sin Pan)', priceExtra: 0 }
              ]
            }
          ],
          additions: [
            { name: 'Tocineta Extra Crujiente', price: 4500 },
            { name: 'Doble Queso Cheddar', price: 3800 },
            { name: 'Carne Extra 150g', price: 9500 },
            { name: 'Huevo Frito de Campo', price: 2500 }
          ]
        },
        {
          name: 'Hamburguesa Doble Extrema',
          price: 39900,
          description: '300g de carne madurada en dos medallones, cuádruple cheddar, tocineta glaseada en maple y salsa secreta de la casa.',
          imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Término de la Carne',
              isRequired: true,
              options: [
                { name: 'Término Medio', priceExtra: 0 },
                { name: 'Tres Cuartos (Recomendado)', priceExtra: 0 },
                { name: 'Bien Asada', priceExtra: 0 }
              ]
            }
          ],
          additions: [
            { name: 'Papas Francesas Rizadas', price: 6500 },
            { name: 'Aros de Cebolla', price: 7000 },
            { name: 'Tocineta Extra', price: 4500 }
          ]
        },
        {
          name: 'Hamburguesa Trufa & Champiñones',
          price: 36500,
          description: 'Carne artesanal 150g, salteado de champiñones portobello al vino tinto, mayonesa de trufa negra y queso gouda derretido.',
          imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Término de la Carne',
              isRequired: true,
              options: [
                { name: 'Término Medio', priceExtra: 0 },
                { name: 'Tres Cuartos', priceExtra: 0 },
                { name: 'Bien Asada', priceExtra: 0 }
              ]
            }
          ],
          additions: [
            { name: 'Champiñones Extra', price: 4000 },
            { name: 'Tocineta Ahumada', price: 4500 }
          ]
        }
      ]
    },
    {
      name: 'Parrilla & Carnes',
      description: 'Cortes seleccionados asados al carbón de leña con guarnición',
      products: [
        {
          name: 'Costillas San Luis Ahumadas 500g',
          price: 46900,
          description: 'Costillas de cerdo tiernas cocinadas 8 horas a fuego lento, bañadas en salsa BBQ de frutos rojos y papas fritas.',
          imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Salsa de Acompañamiento',
              isRequired: true,
              options: [
                { name: 'BBQ Frutos Rojos', priceExtra: 0 },
                { name: 'BBQ Ahumada Tradicional', priceExtra: 0 },
                { name: 'Miel Mostaza Picante', priceExtra: 0 }
              ]
            }
          ],
          additions: [
            { name: 'Porción de Mazorca Dulce Asada', price: 5000 },
            { name: 'Papas en Cascos Extra', price: 6000 }
          ]
        },
        {
          name: 'Punta de Anca a la Brasa 350g',
          price: 49000,
          description: 'Corte madurado con borde de grasa crujiente, chimichurri artesanal, papas criollas y ensalada fresca.',
          imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Término del Corte',
              isRequired: true,
              options: [
                { name: 'Término Medio (Recomendado)', priceExtra: 0 },
                { name: 'Tres Cuartos', priceExtra: 0 },
                { name: 'Bien Asado', priceExtra: 0 }
              ]
            }
          ],
          additions: [
            { name: 'Chimichurri Extra', price: 2000 }
          ]
        }
      ]
    },
    {
      name: 'Entradas & Snacks',
      description: 'Platos para compartir y acompañamientos crocantes',
      products: [
        {
          name: 'Papas Loaded con Cheddar y Tocineta',
          price: 19500,
          description: 'Generosa porción de papas fritas bañadas en salsa de queso cheddar fundido, cebollín fresco y lluvia de tocineta.',
          imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80',
          additions: [
            { name: 'Jalapeños encurtidos', price: 3000 },
            { name: 'Carne desmechada encima', price: 6500 }
          ]
        },
        {
          name: 'Alitas Crispy BBQ x12',
          price: 29900,
          description: 'Alitas crocantes marinadas en especias, bañadas en salsa BBQ o búfalo, servidas con bastones de apio y aderezo ranch.',
          imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80',
          modifiers: [
            {
              name: 'Nivel de Picante',
              isRequired: true,
              options: [
                { name: 'Suave / Dulce BBQ', priceExtra: 0 },
                { name: 'Picante Medio (Búfalo)', priceExtra: 0 },
                { name: 'Fuego Habanero (Ultra Picante)', priceExtra: 1000 }
              ]
            }
          ]
        },
        {
          name: 'Aros de Cebolla Rebozados en Cerveza',
          price: 15500,
          description: 'Aros dorados y crujientes servidos con salsa tártara de la casa.',
          imageUrl: 'https://images.unsplash.com/photo-1639024471287-0351860db52e?auto=format&fit=crop&w=600&q=80'
        }
      ]
    },
    {
      name: 'Bebidas & Cervezas',
      description: 'Bebidas refrescantes, sodas saborizadas y cervezas artesanales',
      products: [
        {
          name: 'Cerveza Artesanal IPA 330ml',
          price: 14500,
          description: 'Cerveza amarga con notas cítricas y aroma floral.',
          imageUrl: 'https://images.unsplash.com/photo-1608270199042-320c02506e30?auto=format&fit=crop&w=600&q=80'
        },
        {
          name: 'Limonada Natural Cerezada',
          price: 9500,
          description: 'Zumo de limón fresco con toques de cereza dulce y hielo frapé.',
          imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80'
        },
        {
          name: 'Coca Cola Zero 400ml',
          price: 6500,
          description: 'Gaseosa fría en botella.',
          imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80'
        }
      ]
    },
    {
      name: 'Postres & Malteadas',
      description: 'El toque dulce perfecto para cerrar la experiencia',
      products: [
        {
          name: 'Malteada Caramelo Salado & Brownie',
          price: 17900,
          description: 'Helado cremoso de vainilla, sirope de caramelo con sal marina, trozos de brownie y crema chantilly.',
          imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80'
        }
      ]
    }
  ];

  const productMap = {};

  for (const catData of categoriesData) {
    const category = await prisma.category.upsert({
      where: { name: catData.name },
      update: { description: catData.description, isActive: true },
      create: { name: catData.name, description: catData.description, isActive: true }
    });

    for (const prodData of catData.products) {
      let product = await prisma.product.findFirst({
        where: { name: prodData.name, categoryId: category.id }
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: prodData.name,
            description: prodData.description,
            price: prodData.price,
            imageUrl: prodData.imageUrl,
            categoryId: category.id,
            isAvailable: true,
            showInStore: true,
            trackStock: false
          }
        });
      } else {
        product = await prisma.product.update({
          where: { id: product.id },
          data: {
            description: prodData.description,
            price: prodData.price,
            imageUrl: prodData.imageUrl,
            isAvailable: true,
            showInStore: true
          }
        });
      }

      productMap[prodData.name] = product;

      // Crear Modificadores si los tiene
      if (prodData.modifiers) {
        for (const mod of prodData.modifiers) {
          let existingMod = await prisma.productModifier.findFirst({
            where: { productId: product.id, name: mod.name }
          });
          if (!existingMod) {
            existingMod = await prisma.productModifier.create({
              data: {
                productId: product.id,
                name: mod.name,
                isRequired: mod.isRequired
              }
            });
            for (const opt of mod.options) {
              await prisma.productModifierOption.create({
                data: {
                  modifierId: existingMod.id,
                  name: opt.name,
                  priceExtra: opt.priceExtra
                }
              });
            }
          }
        }
      }

      // Crear Adiciones si las tiene
      if (prodData.additions) {
        for (const add of prodData.additions) {
          const existingAdd = await prisma.productAddition.findFirst({
            where: { productId: product.id, name: add.name }
          });
          if (!existingAdd) {
            await prisma.productAddition.create({
              data: {
                productId: product.id,
                name: add.name,
                price: add.price
              }
            });
          }
        }
      }
    }
  }
  console.log('✅ Catálogo completo creado con modificadores y adiciones.');

  // =========================================================================
  // 9. SESIÓN DE CAJA ACTIVA Y SESIÓN DE AYER
  // =========================================================================
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(11, 30, 0, 0);

  const yesterdayClose = new Date(yesterday);
  yesterdayClose.setHours(23, 15, 0, 0);

  let pastSession = await prisma.cashSession.findFirst({
    where: { status: 'CLOSED' }
  });
  if (!pastSession) {
    pastSession = await prisma.cashSession.create({
      data: {
        userId: cashier.id,
        openingAmount: 150000,
        closingAmount: 1240000,
        status: 'CLOSED',
        openedAt: yesterday,
        closedAt: yesterdayClose
      }
    });
  }

  let activeSession = await prisma.cashSession.findFirst({
    where: { status: 'OPEN' }
  });
  if (!activeSession) {
    const todayMorning = new Date();
    todayMorning.setHours(11, 0, 0, 0);
    activeSession = await prisma.cashSession.create({
      data: {
        userId: cashier.id,
        openingAmount: 200000,
        status: 'OPEN',
        openedAt: todayMorning
      }
    });
  }
  console.log('✅ Sesión de caja abierta y activa (ID: ' + activeSession.id + ').');

  // =========================================================================
  // 10. ÓRDENES EN COCINA ACTIVAS (KDS)
  // =========================================================================
  const burgerFuego = productMap['Hamburguesa Fuego Master'];
  const burgerDoble = productMap['Hamburguesa Doble Extrema'];
  const costillas = productMap['Costillas San Luis Ahumadas 500g'];
  const papasLoaded = productMap['Papas Loaded con Cheddar y Tocineta'];
  const alitas = productMap['Alitas Crispy BBQ x12'];
  const ipa = productMap['Cerveza Artesanal IPA 330ml'];
  const limonada = productMap['Limonada Natural Cerezada'];

  // Orden 1: Mesa 2 - Preparando
  const kitchenOrder1 = await prisma.order.create({
    data: {
      userId: waiter.id,
      tableId: tableMap['Mesa 2'],
      customerId: customerMap['1020304050'],
      status: 'PREPARING',
      orderType: 'DINE_IN',
      notes: '¡Cliente fiel! Servir papas bien calientes.',
      totalAmount: 52400,
      details: {
        create: [
          {
            productId: burgerFuego.id,
            quantity: 1,
            unitPrice: burgerFuego.price,
            subtotal: burgerFuego.price,
            notes: 'Término 3/4, Pan Brioche',
            modifiers: { 'Término de la Carne': 'Tres Cuartos', 'Tipo de Pan': 'Pan Brioche Mantequilla' },
            additions: [{ name: 'Tocineta Extra Crujiente', price: 4500 }]
          },
          {
            productId: papasLoaded.id,
            quantity: 1,
            unitPrice: papasLoaded.price,
            subtotal: papasLoaded.price,
            notes: 'Sin cebollín'
          }
        ]
      }
    }
  });

  // Orden 2: Mesa 4 - Pendiente
  const kitchenOrder2 = await prisma.order.create({
    data: {
      userId: waiter.id,
      tableId: tableMap['Mesa 4'],
      customerId: customerMap['1040506070'],
      status: 'PENDING',
      orderType: 'DINE_IN',
      notes: 'Mesa corporativa - Facturar con NIT',
      totalAmount: 76800,
      details: {
        create: [
          {
            productId: burgerDoble.id,
            quantity: 1,
            unitPrice: burgerDoble.price,
            subtotal: burgerDoble.price,
            notes: 'Término Medio, salsa aparte'
          },
          {
            productId: costillas.id,
            quantity: 1,
            unitPrice: costillas.price,
            subtotal: costillas.price,
            notes: 'Salsa BBQ Frutos Rojos'
          }
        ]
      }
    }
  });

  // Orden 3: Terraza 1 - Lista para entregar
  const kitchenOrder3 = await prisma.order.create({
    data: {
      userId: waiter.id,
      tableId: tableMap['Terraza 1'],
      customerId: customerMap['1050607080'],
      status: 'READY',
      orderType: 'DINE_IN',
      notes: 'Terraza exterior',
      totalAmount: 44400,
      details: {
        create: [
          {
            productId: alitas.id,
            quantity: 1,
            unitPrice: alitas.price,
            subtotal: alitas.price,
            notes: 'Búfalo picante medio'
          },
          {
            productId: ipa.id,
            quantity: 1,
            unitPrice: ipa.price,
            subtotal: ipa.price
          }
        ]
      }
    }
  });
  console.log('✅ 3 Comandas activas creadas en Cocina KDS (Preparando, Pendiente, Lista).');

  // =========================================================================
  // 11. HISTORIAL DE FACTURAS Y VENTAS (ÚLTIMOS 7 DÍAS + HOY)
  // =========================================================================
  console.log('⏳ Generando histórico de ventas y facturación para métricas y reportes...');

  const sampleProducts = [burgerFuego, burgerDoble, costillas, papasLoaded, alitas, ipa, limonada];
  const paymentMethodsArray = [
    paymentMap['Efectivo'],
    paymentMap['Nequi'],
    paymentMap['Tarjeta Débito'],
    paymentMap['Tarjeta Crédito'],
    paymentMap['Daviplata']
  ];
  const customersArray = [
    customerMap['1020304050'],
    customerMap['1030405060'],
    customerMap['1040506070'],
    customerMap['1050607080'],
    customerMap['222222222222']
  ];

  let invoiceSequence = 1001;

  // Generar 16 ventas completadas distribuidas en los últimos 5 días
  for (let dayOffset = 5; dayOffset >= 0; dayOffset--) {
    const salesInDay = dayOffset === 0 ? 5 : 3; // 5 ventas hoy, 3 por cada día previo

    for (let s = 0; s < salesInDay; s++) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - dayOffset);
      saleDate.setHours(12 + (s * 2), Math.floor(Math.random() * 50), 0, 0);

      const prod1 = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
      const prod2 = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
      const qty1 = Math.floor(Math.random() * 2) + 1;
      const qty2 = 1;

      const sub1 = Number(prod1.price) * qty1;
      const sub2 = Number(prod2.price) * qty2;
      const total = sub1 + sub2;

      const pmId = paymentMethodsArray[Math.floor(Math.random() * paymentMethodsArray.length)];
      const custId = customersArray[Math.floor(Math.random() * customersArray.length)];
      const sessionToUse = dayOffset === 0 ? activeSession.id : pastSession.id;

      // 1. Crear Orden entregada
      const completedOrder = await prisma.order.create({
        data: {
          userId: waiter.id,
          customerId: custId,
          tableId: tableMap['Mesa 1'],
          status: 'DELIVERED',
          orderType: 'DINE_IN',
          totalAmount: total,
          createdAt: saleDate,
          updatedAt: saleDate,
          details: {
            create: [
              {
                productId: prod1.id,
                quantity: qty1,
                unitPrice: prod1.price,
                subtotal: sub1,
                notes: 'Término 3/4'
              },
              {
                productId: prod2.id,
                quantity: qty2,
                unitPrice: prod2.price,
                subtotal: sub2
              }
            ]
          }
        }
      });

      // 2. Crear Venta / Factura
      const invoiceNum = `FAC-${2000 + invoiceSequence++}`;
      const sale = await prisma.sale.create({
        data: {
          invoiceNumber: invoiceNum,
          orderId: completedOrder.id,
          customerId: custId,
          paymentMethodId: pmId,
          cashSessionId: sessionToUse,
          totalAmount: total,
          discount: 0,
          finalAmount: total,
          createdAt: saleDate,
          updatedAt: saleDate,
          details: {
            create: [
              {
                productId: prod1.id,
                quantity: qty1,
                unitPrice: prod1.price,
                subtotal: sub1,
                unitCost: Number(prod1.price) * 0.4,
                totalCost: sub1 * 0.4
              },
              {
                productId: prod2.id,
                quantity: qty2,
                unitPrice: prod2.price,
                subtotal: sub2,
                unitCost: Number(prod2.price) * 0.4,
                totalCost: sub2 * 0.4
              }
            ]
          },
          payments: {
            create: [
              {
                paymentMethodId: pmId,
                amount: total,
                createdAt: saleDate
              }
            ]
          }
        }
      });
    }
  }

  // =========================================================================
  // 12. HISTORIAL DE CRÉDITO PARA CLIENTE CON DEUDA (Carolina Restrepo)
  // =========================================================================
  const carolinaId = customerMap['1030405060'];
  await prisma.customerCredit.create({
    data: {
      customerId: carolinaId,
      type: 'DEBT',
      amount: 95000,
      description: 'Consumo a crédito almuerzo oficina',
      createdAt: yesterday
    }
  });

  await prisma.customerCredit.create({
    data: {
      customerId: carolinaId,
      type: 'PAYMENT',
      amount: 40000,
      description: 'Abono parcial en Efectivo',
      paymentMethodId: paymentMap['Efectivo'],
      cashSessionId: activeSession.id,
      createdAt: new Date()
    }
  });

  console.log('✅ Historial de crédito y abono de cartera registrado.');

  console.log('\n🎉 ¡SEMILLERO DEMO COMPLETADO CON ÉXITO!');
  console.log('----------------------------------------------------');
  console.log('Restaurante: Extrema Burger');
  console.log('Admin:       admin@neofood.com / 123456');
  console.log('Cajero:      cajero@neofood.com / 123456');
  console.log('Mesero:      mesero@neofood.com / 123456');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Error en el sembrado de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
