import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

export async function list(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.region) where.region = query.region;
  return prisma.vehicle.findMany({ where, orderBy: { id: 'asc' } });
}

export async function getById(id) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${id} not found.`);
  return vehicle;
}

export async function create(data) {
  return prisma.vehicle.create({
    data: {
      registrationNumber: data.registrationNumber,
      model: data.model,
      type: data.type,
      maxLoadCapacity: data.maxLoadCapacity,
      odometer: data.odometer ?? 0,
      acquisitionCost: data.acquisitionCost,
      region: data.region ?? null,
      status: 'AVAILABLE',
    },
  });
}

export async function update(id, data) {
  await getById(id);
  // Manual ON_TRIP is reserved for the trip dispatch flow — refuse it here so
  // callers can't fabricate an on-trip state out of band.
  if (data.status === 'ON_TRIP') {
    throw new HttpError(400, 'INVALID_STATUS_TRANSITION', 'Vehicle status cannot be manually set to ON_TRIP; dispatch a trip instead.');
  }
  return prisma.vehicle.update({ where: { id }, data });
}

export async function remove(id) {
  const vehicle = await getById(id);
  if (vehicle.status === 'ON_TRIP') {
    throw new HttpError(409, 'VEHICLE_ON_TRIP', 'Cannot delete a vehicle that is currently on a trip.');
  }
  return prisma.vehicle.delete({ where: { id } });
}
