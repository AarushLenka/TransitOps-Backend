// Reports & Analytics (§3.8). Every report is a per-vehicle aggregate built from
// groupBy queries, then merged by vehicleId.
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/httpError.js';

const byVehicleId = (rows, field) => Object.fromEntries(rows.map((r) => [r.vehicleId, r._sum[field] ?? 0]));

// Operational Cost per vehicle = maintenance + fuel + other expenses.
export async function operationalCost() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, registrationNumber: true, model: true, type: true, region: true },
    orderBy: { id: 'asc' },
  });
  const [mSum, fSum, eSum] = await Promise.all([
    prisma.maintenanceLog.groupBy({ by: ['vehicleId'], _sum: { cost: true } }),
    prisma.fuelLog.groupBy({ by: ['vehicleId'], _sum: { cost: true } }),
    prisma.expense.groupBy({ by: ['vehicleId'], _sum: { amount: true } }),
  ]);
  const m = byVehicleId(mSum, 'cost');
  const f = byVehicleId(fSum, 'cost');
  const e = byVehicleId(eSum, 'amount');

  return vehicles.map((v) => {
    const maintenance = m[v.id] ?? 0;
    const fuel = f[v.id] ?? 0;
    const expenses = e[v.id] ?? 0;
    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      model: v.model,
      type: v.type,
      region: v.region,
      maintenanceCost: maintenance,
      fuelCost: fuel,
      expensesCost: expenses,
      totalOperationalCost: maintenance + fuel + expenses,
    };
  });
}

// Fuel Efficiency per vehicle = total distance / total fuel (km per litre).
export async function fuelEfficiency() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, registrationNumber: true, model: true },
    orderBy: { id: 'asc' },
  });
  const [distSum, fuelSum] = await Promise.all([
    prisma.trip.groupBy({ by: ['vehicleId'], where: { status: 'COMPLETED' }, _sum: { actualDistance: true } }),
    prisma.fuelLog.groupBy({ by: ['vehicleId'], _sum: { liters: true } }),
  ]);
  const d = byVehicleId(distSum, 'actualDistance');
  const f = byVehicleId(fuelSum, 'liters');

  return vehicles.map((v) => {
    const distance = d[v.id] ?? 0;
    const liters = f[v.id] ?? 0;
    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      model: v.model,
      totalDistance: distance,
      totalFuel: liters,
      fuelEfficiency: liters > 0 ? Math.round((distance / liters) * 100) / 100 : null, // km/l
    };
  });
}

// Fleet Utilization = vehicles on trip / non-retired fleet, expressed as a %.
export async function fleetUtilization() {
  const [onTrip, retired, total] = await Promise.all([
    prisma.vehicle.count({ where: { status: 'ON_TRIP' } }),
    prisma.vehicle.count({ where: { status: 'RETIRED' } }),
    prisma.vehicle.count(),
  ]);
  const activeFleet = total - retired;
  return {
    onTripVehicles: onTrip,
    activeFleet,
    totalVehicles: total,
    retiredVehicles: retired,
    fleetUtilizationPercent: activeFleet > 0 ? Math.round(((onTrip / activeFleet) * 100) * 10) / 10 : 0,
  };
}

// Vehicle ROI = (revenue - (maintenance + fuel)) / acquisition cost, as a %.
export async function vehicleRoi() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, registrationNumber: true, acquisitionCost: true },
    orderBy: { id: 'asc' },
  });
  const [revSum, mSum, fSum] = await Promise.all([
    prisma.trip.groupBy({ by: ['vehicleId'], where: { status: 'COMPLETED' }, _sum: { actualRevenue: true } }),
    prisma.maintenanceLog.groupBy({ by: ['vehicleId'], _sum: { cost: true } }),
    prisma.fuelLog.groupBy({ by: ['vehicleId'], _sum: { cost: true } }),
  ]);
  const r = byVehicleId(revSum, 'actualRevenue');
  const m = byVehicleId(mSum, 'cost');
  const f = byVehicleId(fSum, 'cost');

  return vehicles.map((v) => {
    const revenue = r[v.id] ?? 0;
    const maintenance = m[v.id] ?? 0;
    const fuel = f[v.id] ?? 0;
    const operationalCost = maintenance + fuel;
    const roiPercent = v.acquisitionCost > 0
      ? Math.round((((revenue - operationalCost) / v.acquisitionCost) * 100) * 100) / 100
      : null;
    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      acquisitionCost: v.acquisitionCost,
      revenue,
      maintenanceCost: maintenance,
      fuelCost: fuel,
      operationalCost,
      roiPercent,
    };
  });
}

// CSV export of the operational-cost report.
export async function operationalCostCsv() {
  const rows = await operationalCost();
  const header = 'vehicleId,registrationNumber,model,maintenanceCost,fuelCost,expensesCost,totalOperationalCost';
  const lines = rows.map((r) =>
    [r.vehicleId, escapeCsv(r.registrationNumber), escapeCsv(r.model), r.maintenanceCost, r.fuelCost, r.expensesCost, r.totalOperationalCost].join(','),
  );
  return [header, ...lines].join('\n');
}

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
