import { RedisClientType, createClient } from 'redis';
import logger from '../lib/logger';

class RedisService {
	client: RedisClientType;

	constructor() {
		this.createConnection();
	}

	/**
	 * create redis client
	 */
	public async createConnection() {
		try {
			this.client = createClient({
				url: `redis://${environment.redisHost}:${environment.redisPort}`,
			});

			await this.client.connect();
			logger.info('Redis connection created.');

			// bind the common redis events
			this.client.on('connect', () => {
				logger.info('Connect to redis successfully. ');
			});
			this.client.on('ready', () => {
				logger.info('Ready');
			});
			this.client.on('reconnecting', () => {
				logger.info('Reconnecting');
			});

			this.client.on('end', () => {
				logger.info('End');
			});
			this.client.on('error', (err: Error) =>
				logger.error(
					'\x1b[31m%s\x1b[0m',
					'error while connecting redis server: ',
					err.message,
				),
			);
		} catch (err) {
			logger.error('Error while redis client creation');
			logger.error(err);
		}
	}

	/**
	 * release redis connection
	 */
	// public disconnect = () => {
	// 	try {

	// 	} catch (err) {
	// 		logger.error('Error while releasing redis connection');
	// 		logger.error(err);
	// 	}
	// };

	// set the string data to redis
	public async setString<T>(key: string, data: T) {
		try {
			await this.client.set(key, JSON.stringify(data));
			return false;
		} catch (err) {
			logger.error('error while setting the data into redis: ', err);
			return true;
		}
	}

	// get the string data from redis
	public async getString<T>(key: string): Promise<T> {
		try {
			const res = (await this.client.get(key)) as string;
			return JSON.parse(res);
		} catch (err) {
			logger.error('Error while getting the data from redis: ', err);
			return null as T;
		}
	}

	public async setStringWithExpiry<T>(
		key: string,
		data: T,
		expiration: number,
	) {
		try {
			const res = await this.client.setEx(
				key,
				expiration,
				JSON.stringify(data),
			);
			logger.info(
				'Redis Data Saving Response setStringWithExpiry: ',
				res,
			);
		} catch (err) {
			console.error(
				'Error while setting the data into redis setStringWithExpiry: ',
				err,
			);
			console.log('Key : ', key, 'value : ', data);
		}
	}
}
export default new RedisService();
