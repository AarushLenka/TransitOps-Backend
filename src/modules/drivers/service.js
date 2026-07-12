import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

export async function list(query) {
  const where = {};
  if (query.status) where.status = query.status;
  return prisma.driver.findMany({ where, orderBy: { id: 'asc' } });
}

export async function getById(id) {
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) throw new HttpError(404, 'DRIVER_NOT_FOUND', `Driver ${id} not found.`);
  return driver;
}

export async function create(data) {
  return prisma.driver.create({
    data: {
      fullName: data.fullName,
      licenseNumber: data.licenseNumber,
      licenseCategory: data.licenseCategory,
      licenseExpiryDate: data.licenseExpiryDate,
      contactNumber: data.contactNumber ?? null,
      safetyScore: data.safetyScore ?? 0,
      status: 'AVAILABLE',
    },
  });
}

export async function update(id, data) {
  await getById(id);
  if (data.status === 'ON_TRIP') {
    throw new HttpError(400, 'INVALID_STATUS_TRANSITION', 'Driver status cannot be manually set to ON_TRIP; dispatch a trip instead.');
  }
  return prisma.driver.update({ where: { id }, data });
}

export async function remove(id) {
  const driver = await getById(id);
  if (driver.status === 'ON_TRIP') {
    throw new HttpError(409, 'DRIVER_ON_TRIP', 'Cannot delete a driver who is currently on a trip.');
  }
  return prisma.driver.delete({ where: { id } });
}
