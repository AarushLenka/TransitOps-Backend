// Dashboard KPIs (§3.2). Type + region scope the fleet; the counts then break
// the scoped fleet down by status.
import { prisma } from '../../lib/prisma.js';

export async function getKpis(query) {
  const scope = {};
  if (query.type) scope.type = query.type;
  if (query.region) scope.region = query.region;

  const [
    onTrip, available, inShop, retired, total,
    activeTrips, pendingTrips, driversOnDuty,
  ] = await Promise.all([
    prisma.vehicle.count({ where: { ...scope, status: 'ON_TRIP' } }),
    prisma.vehicle.count({ where: { ...scope, status: 'AVAILABLE' } }),
    prisma.vehicle.count({ where: { ...scope, status: 'IN_SHOP' } }),
    prisma.vehicle.count({ where: { ...scope, status: 'RETIRED' } }),
    prisma.vehicle.count({ where: scope }),
    prisma.trip.count({ where: { status: 'DISPATCHED' } }),
    prisma.trip.count({ where: { status: 'DRAFT' } }),
    prisma.driver.count({ where: { status: 'ON_TRIP' } }),
  ]);

  const activeFleet = total - retired;
  const fleetUtilizationPercent = activeFleet > 0
    ? Math.round(((onTrip / activeFleet) * 100) * 10) / 10
    : 0;

  return {
    activeVehicles: onTrip,
    availableVehicles: available,
    vehiclesInMaintenance: inShop,
    activeTrips,
    pendingTrips,
    driversOnDuty,
    fleetUtilizationPercent,
    meta: {
      totalVehicles: total,
      retiredVehicles: retired,
      activeFleet,
      filters: { type: query.type ?? null, region: query.region ?? null },
    },
  };
}
