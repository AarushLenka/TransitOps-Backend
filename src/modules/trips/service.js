// Trips service — enforces the §4 business rules and the Draft -> Dispatched ->
// Completed -> Cancelled state machine. State-changing operations run inside
// Prisma $transaction so vehicle/driver statuses flip atomically with the trip.
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

const TRIP_INCLUDE = { vehicle: true, driver: true };

function isLicenseValid(driver, now = new Date()) {
  return new Date(driver.licenseExpiryDate) >= now;
}

export async function list(query) {
  const where = {};
  if (query.status) where.status = query.status;
  return prisma.trip.findMany({ where, include: TRIP_INCLUDE, orderBy: { id: 'desc' } });
}

export async function getById(id) {
  const trip = await prisma.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
  if (!trip) throw new HttpError(404, 'TRIP_NOT_FOUND', `Trip ${id} not found.`);
  return trip;
}

// ---- CREATE (Draft) -------------------------------------------------------
// Rule: pick an available vehicle + available driver; cargo <= max capacity;
// driver licence valid + not suspended (available implies not suspended).
export async function create(data, creatorId = null) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) throw new HttpError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${data.vehicleId} not found.`);
  if (vehicle.status !== 'AVAILABLE') {
    throw new HttpError(409, 'VEHICLE_NOT_AVAILABLE', `Vehicle ${vehicle.registrationNumber} is ${vehicle.status} and cannot be assigned to a trip.`);
  }

  const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
  if (!driver) throw new HttpError(404, 'DRIVER_NOT_FOUND', `Driver ${data.driverId} not found.`);
  if (driver.status !== 'AVAILABLE') {
    throw new HttpError(409, 'DRIVER_NOT_AVAILABLE', `Driver ${driver.fullName} is ${driver.status} and cannot be assigned to a trip.`);
  }
  if (!isLicenseValid(driver)) {
    throw new HttpError(409, 'DRIVER_LICENSE_EXPIRED', `Driver ${driver.fullName}'s licence has expired.`);
  }

  if (data.cargoWeight > vehicle.maxLoadCapacity) {
    throw new HttpError(
      400,
      'CARGO_EXCEEDS_CAPACITY',
      `Cargo weight ${data.cargoWeight} kg exceeds ${vehicle.registrationNumber}'s maximum capacity of ${vehicle.maxLoadCapacity} kg.`,
    );
  }

  return prisma.trip.create({
    data: {
      source: data.source,
      destination: data.destination,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      cargoWeight: data.cargoWeight,
      plannedDistance: data.plannedDistance,
      plannedRevenue: data.plannedRevenue ?? null,
      status: 'DRAFT',
      creatorId,
    },
    include: TRIP_INCLUDE,
  });
}

// ---- DISPATCH  (Draft -> Dispatched) -------------------------------------
// Re-checks availability under a transaction lock and flips vehicle/driver to
// ON_TRIP. Also guards against a concurrent dispatched trip on the same asset.
export function dispatch(id) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
    if (!trip) throw new HttpError(404, 'TRIP_NOT_FOUND', `Trip ${id} not found.`);
    if (trip.status !== 'DRAFT') {
      throw new HttpError(409, 'INVALID_TRIP_STATUS', `Trip ${id} is ${trip.status}; only DRAFT trips can be dispatched.`);
    }

    const vehicle = await tx.vehicle.findUnique({ where: { id: trip.vehicleId } });
    if (vehicle.status !== 'AVAILABLE') {
      throw new HttpError(409, 'VEHICLE_NOT_AVAILABLE', `Vehicle ${vehicle.registrationNumber} is ${vehicle.status} and cannot be dispatched.`);
    }
    const driver = await tx.driver.findUnique({ where: { id: trip.driverId } });
    if (driver.status !== 'AVAILABLE') {
      throw new HttpError(409, 'DRIVER_NOT_AVAILABLE', `Driver ${driver.fullName} is ${driver.status} and cannot be dispatched.`);
    }
    if (!isLicenseValid(driver)) {
      throw new HttpError(409, 'DRIVER_LICENSE_EXPIRED', `Driver ${driver.fullName}'s licence has expired.`);
    }

    // Safety net: no other DISPATCHED trip should already hold this vehicle/driver.
    const conflict = await tx.trip.findFirst({
      where: { status: 'DISPATCHED', OR: [{ vehicleId: trip.vehicleId }, { driverId: trip.driverId }] },
    });
    if (conflict) {
      throw new HttpError(409, 'ALREADY_ON_TRIP', `Vehicle or driver is already on an active trip (trip #${conflict.id}).`);
    }

    await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'ON_TRIP' } });
    await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'ON_TRIP' } });

    return tx.trip.update({
      where: { id },
      data: { status: 'DISPATCHED', startedAt: new Date() },
      include: TRIP_INCLUDE,
    });
  });
}

// ---- COMPLETE (Dispatched -> Completed) ---------------------------------
// Records actuals, advances the vehicle odometer, and returns vehicle/driver to
// AVAILABLE (a retired vehicle stays retired).
export function complete(id, data) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
    if (!trip) throw new HttpError(404, 'TRIP_NOT_FOUND', `Trip ${id} not found.`);
    if (trip.status !== 'DISPATCHED') {
      throw new HttpError(409, 'INVALID_TRIP_STATUS', `Trip ${id} is ${trip.status}; only DISPATCHED trips can be completed.`);
    }

    const vehicleUpdate = {};
    if (trip.vehicle.status !== 'RETIRED') vehicleUpdate.status = 'AVAILABLE';
    if (data.finalOdometer != null && data.finalOdometer > trip.vehicle.odometer) {
      vehicleUpdate.odometer = data.finalOdometer;
    }
    if (Object.keys(vehicleUpdate).length) {
      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: vehicleUpdate });
    }
    await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } });

    return tx.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualDistance: data.actualDistance ?? null,
        actualRevenue: data.actualRevenue ?? null,
        finalOdometer: data.finalOdometer ?? null,
        fuelConsumed: data.fuelConsumed ?? null,
      },
      include: TRIP_INCLUDE,
    });
  });
}

// ---- CANCEL -------------------------------------------------------------
// Dispatched -> CANCELLED restores the vehicle/driver to AVAILABLE.
// Draft -> CANCELLED changes nothing else (nothing was ever reserved).
export function cancel(id) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
    if (!trip) throw new HttpError(404, 'TRIP_NOT_FOUND', `Trip ${id} not found.`);
    if (trip.status === 'COMPLETED') {
      throw new HttpError(409, 'INVALID_TRIP_STATUS', 'Cannot cancel a completed trip.');
    }
    if (trip.status === 'CANCELLED') {
      throw new HttpError(409, 'INVALID_TRIP_STATUS', `Trip ${id} is already cancelled.`);
    }

    if (trip.status === 'DISPATCHED') {
      if (trip.vehicle.status !== 'RETIRED') {
        await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'AVAILABLE' } });
      }
      await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } });
    }

    return tx.trip.update({ where: { id }, data: { status: 'CANCELLED' }, include: TRIP_INCLUDE });
  });
}

// ---- DELETE -------------------------------------------------------------
// Only DRAFT or CANCELLED trips may be removed (history is preserved).
export async function remove(id) {
  const trip = await getById(id);
  if (!['DRAFT', 'CANCELLED'].includes(trip.status)) {
    throw new HttpError(409, 'INVALID_TRIP_STATUS', `Cannot delete a ${trip.status} trip.`);
  }
  return prisma.trip.delete({ where: { id } });
}
