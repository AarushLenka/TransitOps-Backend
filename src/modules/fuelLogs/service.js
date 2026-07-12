import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

const INCLUDE = { vehicle: true, trip: true };

async function ensureRefs(vehicleId, tripId) {
  if (vehicleId != null) {
    const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${vehicleId} not found.`);
  }
  if (tripId != null) {
    const t = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!t) throw new HttpError(404, 'TRIP_NOT_FOUND', `Trip ${tripId} not found.`);
  }
}

export async function list(query) {
  const where = query.vehicleId ? { vehicleId: query.vehicleId } : {};
  return prisma.fuelLog.findMany({ where, include: INCLUDE, orderBy: { id: 'desc' } });
}

export async function getById(id) {
  const log = await prisma.fuelLog.findUnique({ where: { id }, include: INCLUDE });
  if (!log) throw new HttpError(404, 'FUEL_LOG_NOT_FOUND', `Fuel log ${id} not found.`);
  return log;
}

export async function create(data) {
  await ensureRefs(data.vehicleId, data.tripId);
  return prisma.fuelLog.create({
    data: {
      vehicleId: data.vehicleId,
      tripId: data.tripId ?? null,
      liters: data.liters,
      cost: data.cost,
      logDate: data.logDate,
      odometerAtFill: data.odometerAtFill ?? null,
    },
    include: INCLUDE,
  });
}

export async function update(id, data) {
  await getById(id);
  await ensureRefs(data.vehicleId, data.tripId);
  return prisma.fuelLog.update({ where: { id }, data, include: INCLUDE });
}

export async function remove(id) {
  await getById(id);
  return prisma.fuelLog.delete({ where: { id } });
}
