// Maintenance service — opening a log sends the vehicle to IN_SHOP; closing it
// restores AVAILABLE unless the vehicle is retired or still has other open logs.
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

const INCLUDE = { vehicle: true };

export async function list() {
  return prisma.maintenanceLog.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
}

export async function getById(id) {
  const log = await prisma.maintenanceLog.findUnique({ where: { id }, include: INCLUDE });
  if (!log) throw new HttpError(404, 'MAINTENANCE_NOT_FOUND', `Maintenance log ${id} not found.`);
  return log;
}

// CREATE (Open) -> vehicle becomes IN_SHOP (unless retired; never while ON_TRIP).
export function create(data) {
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${data.vehicleId} not found.`);
    if (vehicle.status === 'ON_TRIP') {
      throw new HttpError(409, 'VEHICLE_ON_TRIP', 'Cannot start maintenance on a vehicle currently on a trip.');
    }
    const log = await tx.maintenanceLog.create({
      data: {
        vehicleId: data.vehicleId,
        serviceType: data.serviceType,
        description: data.description ?? null,
        cost: data.cost ?? 0,
        startDate: data.startDate ?? new Date(),
        notes: data.notes ?? null,
        status: 'OPEN',
      },
      include: INCLUDE,
    });
    if (vehicle.status !== 'RETIRED') {
      await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'IN_SHOP' } });
    }
    return log;
  });
}

// UPDATE -> closing (status -> CLOSED, set endDate) restores the vehicle to
// AVAILABLE only if it's IN_SHOP and has no other OPEN/IN_PROGRESS logs.
export function update(id, data) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.maintenanceLog.findUnique({ where: { id }, include: INCLUDE });
    if (!log) throw new HttpError(404, 'MAINTENANCE_NOT_FOUND', `Maintenance log ${id} not found.`);

    const closingNow = data.status === 'CLOSED' && log.status !== 'CLOSED';

    const updated = await tx.maintenanceLog.update({
      where: { id },
      data: {
        serviceType: data.serviceType,
        description: data.description,
        cost: data.cost,
        status: data.status,
        notes: data.notes,
        endDate: data.endDate ?? (closingNow ? new Date() : undefined),
      },
      include: INCLUDE,
    });

    if (closingNow && log.vehicle.status === 'IN_SHOP') {
      const otherOpen = await tx.maintenanceLog.findFirst({
        where: {
          vehicleId: log.vehicleId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          NOT: { id },
        },
      });
      if (!otherOpen) {
        await tx.vehicle.update({ where: { id: log.vehicleId }, data: { status: 'AVAILABLE' } });
      }
    }
    return updated;
  });
}

export async function remove(id) {
  await getById(id);
  return prisma.maintenanceLog.delete({ where: { id } });
}
