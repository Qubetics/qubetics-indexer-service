import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient();

async function connectToDatabase() {
	try {
		await prisma.$connect();
		logger.info('Database connection created.');
	} catch (error) {
		logger.error('Database connection failed:', error);
	}
}

export { prisma, connectToDatabase };
