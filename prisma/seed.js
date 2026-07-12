// Seeds roles, one user per role, and the §5 workflow dataset:
//   - Van-05 (max 500kg, AVAILABLE, North)
//   - driver Alex (valid licence to 2027, AVAILABLE)
//   - a Draft trip Van-05 + Alex, cargo 450kg  (ready to dispatch in Postman)
// Idempotent-ish: upserts roles/users by natural key.
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { name: 'Fleet Manager', description: 'Oversees fleet assets, maintenance, and operational efficiency.' },
  { name: 'Driver', description: 'Creates trips, assigns vehicles/drivers, monitors active deliveries.' },
  { name: 'Safety Officer', description: 'Ensures driver compliance, licence validity, and safety scores.' },
  { name: 'Financial Analyst', description: 'Reviews costs, fuel consumption, maintenance, and profitability.' },
];

const password = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  // --- Roles -------------------------------------------------------------
  const roleMap = {};
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    roleMap[r.name] = role;
  }
  console.log(`Seeded ${Object.keys(roleMap).length} roles.`);

  // --- Users (one per role) ---------------------------------------------
  const users = [
    { fullName: 'Fleet Manager', email: 'fleet@transitops.test', role: 'Fleet Manager', region: 'North' },
    { fullName: 'Driver Demo', email: 'driver@transitops.test', role: 'Driver', region: 'North' },
    { fullName: 'Safety Officer', email: 'safety@transitops.test', role: 'Safety Officer', region: 'North' },
    { fullName: 'Financial Analyst', email: 'finance@transitops.test', role: 'Financial Analyst', region: 'North' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, passwordHash, roleId: roleMap[u.role].id, region: u.region, isActive: true },
      create: { fullName: u.fullName, email: u.email, passwordHash, roleId: roleMap[u.role].id, region: u.region },
    });
  }
  console.log(`Seeded ${users.length} users (password for all: "${password}").`);

  // --- Vehicle: Van-05 --------------------------------------------------
  const van05 = await prisma.vehicle.upsert({
    where: { registrationNumber: 'Van-05' },
    update: { maxLoadCapacity: 500, type: 'Van', region: 'North', status: 'AVAILABLE' },
    create: {
      registrationNumber: 'Van-05',
      model: 'Ford Transit 350',
      type: 'Van',
      maxLoadCapacity: 500,
      acquisitionCost: 42000,
      region: 'North',
      status: 'AVAILABLE',
    },
  });
  console.log(`Seeded vehicle: ${van05.registrationNumber} (${van05.status}, max ${van05.maxLoadCapacity} kg).`);

  // --- Driver: Alex -----------------------------------------------------
  const alex = await prisma.driver.upsert({
    where: { licenseNumber: 'DL-ALEX-2027' },
    update: { licenseCategory: 'LMV', status: 'AVAILABLE' },
    create: {
      fullName: 'Alex Rivera',
      licenseNumber: 'DL-ALEX-2027',
      licenseCategory: 'LMV',
      licenseExpiryDate: new Date('2027-12-31'),
      contactNumber: '+1-555-0101',
      safetyScore: 88,
      status: 'AVAILABLE',
    },
  });
  console.log(`Seeded driver: ${alex.fullName} (licence valid to ${alex.licenseExpiryDate.toISOString().slice(0, 10)}).`);

  // --- Draft trip: Van-05 + Alex, 450 kg (<= 500 kg) --------------------
  const existingTrip = await prisma.trip.findFirst({
    where: { vehicleId: van05.id, driverId: alex.id, status: 'DRAFT' },
  });
  let trip = existingTrip;
  if (!trip) {
    trip = await prisma.trip.create({
      data: {
        source: 'Warehouse North',
        destination: 'Distribution Center East',
        vehicleId: van05.id,
        driverId: alex.id,
        cargoWeight: 450,
        plannedDistance: 120,
        plannedRevenue: 1500,
        status: 'DRAFT',
      },
    });
  }
  console.log(`Seeded trip #${trip.id}: ${trip.source} -> ${trip.destination}, ${trip.cargoWeight} kg (${trip.status}).`);

  console.log('\nSeed complete. Login as any user with password Password123!:');
  users.forEach((u) => console.log(`  ${u.email} (${u.role})`));
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
