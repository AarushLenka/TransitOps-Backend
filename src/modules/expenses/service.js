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
  return prisma.expense.findMany({ where, include: INCLUDE, orderBy: { id: 'desc' } });
}

export async function getById(id) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: INCLUDE });
  if (!expense) throw new HttpError(404, 'EXPENSE_NOT_FOUND', `Expense ${id} not found.`);
  return expense;
}

export async function create(data) {
  await ensureRefs(data.vehicleId, data.tripId);
  return prisma.expense.create({
    data: {
      vehicleId: data.vehicleId ?? null,
      tripId: data.tripId ?? null,
      category: data.category,
      amount: data.amount,
      expenseDate: data.expenseDate,
      notes: data.notes ?? null,
    },
    include: INCLUDE,
  });
}

export async function update(id, data) {
  await getById(id);
  await ensureRefs(data.vehicleId, data.tripId);
  return prisma.expense.update({ where: { id }, data, include: INCLUDE });
}

export async function remove(id) {
  await getById(id);
  return prisma.expense.delete({ where: { id } });
}
