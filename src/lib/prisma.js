// Single PrismaClient instance shared by every service.
import { PrismaClient } from '@prisma/client';

const log = process.env.QUERY_LOG === 'true'
  ? ['query', 'warn', 'error']
  : ['warn', 'error'];

export const prisma = new PrismaClient({ log });

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
