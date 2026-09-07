import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: 'customers.read', description: 'Consultar clientes' },
  { code: 'customers.write', description: 'Crear/modificar clientes' },
  { code: 'suppliers.read', description: 'Consultar proveedores' },
  { code: 'suppliers.write', description: 'Crear/modificar proveedores' },
  { code: 'products.read', description: 'Consultar catálogo de productos' },
  { code: 'products.write', description: 'Crear/modificar productos' },
  { code: 'price-lists.import', description: 'Importar listas de precios' },
  { code: 'pricing-rules.write', description: 'Configurar reglas de margen/IVA' },
  { code: 'delivery-notes.read', description: 'Consultar remitos' },
  { code: 'delivery-notes.write', description: 'Emitir/anular remitos' },
  { code: 'settlements.read', description: 'Consultar liquidaciones' },
  { code: 'settlements.write', description: 'Generar/confirmar/anular liquidaciones' },
  { code: 'payments.read', description: 'Consultar pagos' },
  { code: 'payments.write', description: 'Registrar/anular pagos' },
  { code: 'audit.read', description: 'Consultar auditoría del sistema' },
  { code: 'users.manage', description: 'Administrar usuarios y roles' },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrador: PERMISSIONS.map((p) => p.code),
  Vendedor: ['customers.read', 'products.read', 'delivery-notes.read', 'delivery-notes.write'],
  'Administración': [
    'customers.read',
    'customers.write',
    'suppliers.read',
    'suppliers.write',
    'products.read',
    'price-lists.import',
    'delivery-notes.read',
    'settlements.read',
    'settlements.write',
    'payments.read',
    'payments.write',
  ],
};

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, fullName: 'Administrador del sistema' },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Administrador' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const paymentMethods = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta'];
  for (const name of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(`Seed completo. Usuario admin: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
