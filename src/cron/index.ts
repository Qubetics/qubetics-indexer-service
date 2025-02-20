import axios, { AxiosInstance } from 'axios';
import * as cron from 'cron';
import { CURRENT_DEFAULT_COIN_PRICE } from '../constant/constants';
import { CONST_NAME, QUEUE_NAME, REDIS_KEY } from '../constant/response';
import ExlorerHelper from '../helper/explorer.helper';

import socketHelper from '../helper/socket.helper';
import { calculateData, getValidatorsInfo } from '../helper/validator.helper';
import web3Helper from '../helper/web3.helper';
import logger from '../lib/logger';
import { RabbitMqService, RedisService } from '../service';
import redisHelper from '../service/redis.helper';

const { CronJob } = cron;
const apiUrl = environment.evmHost;
let apiRes: AxiosInstance;

class CronService {
	constructor() {
		apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			// timeout: CONST_NAME.THOUSAND,
			timeout: 5000,
		});
	}

	public async scheduleCoinPriceUpdation() {
		try {
			// save the default price initially in cache(redis)
			const coinPrice = await redisHelper.getString(REDIS_KEY.COIN_PRICE);
			if (!coinPrice) {
				logger.info('Initial coin price saved');
				await redisHelper.setString(
					REDIS_KEY.COIN_PRICE,
					CURRENT_DEFAULT_COIN_PRICE,
				);
			}

			logger.info('Price updation scheduled');
			new CronJob(
				'0 0 * * 1',
				async () => {
					logger.info('Price updation schedule running');
					/**
					 * get the price from cache if saved or otherwise
					 * default hard coded price is used
					 */
					const savedPrice = await redisHelper.getString(
						REDIS_KEY.COIN_PRICE,
					);
					let currentPrice = savedPrice
						? Number(savedPrice)
						: CURRENT_DEFAULT_COIN_PRICE;
					currentPrice += (currentPrice * 10) / 100;

					// save the updated price
					redisHelper.setString(REDIS_KEY.COIN_PRICE, currentPrice);
				},
				null,
				true,
				'UTC',
			);
		} catch (err) {
			console.error(
				'Error while scheduling the coin price updation cron\n',
				err,
			);
		}
	}

	public checkPendingTransaction() {
		new CronJob(
			'*/30 * * * *', // will run every 30 min.
			async () => {
				await ExlorerHelper.checkTransactionStatus();
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	public async saveTokenPrice() {
		async function fetchData() {
			await ExlorerHelper.saveTokenPriceByDate();
			setTimeout(fetchData, 60 * 60 * 1000); // Schedule the function to run again in 1 hour (60 minutes * 60 seconds * 1000 milliseconds)
		}

		// Call the function initially to start the scheduling
		await fetchData();
	}

	public async checkValidators() {
		async function fetchData() {
			await getValidatorsInfo(apiRes);
			await calculateData();
			setTimeout(fetchData, 1 * 60 * 1000);
		}

		// Call the function initially to start the scheduling
		await fetchData();
	}

	// public checkValidators() {
	// 	new CronJob(
	// 		'*/3 * * * * *', // will run every 1 sec.
	// 		async () => {
	// 			await getValidatorsInfo(apiRes);
	// 		},
	// 		null,
	// 		true,
	// 		'America/Los_Angeles',
	// 	);
	// }

	public updateGraph() {
		new CronJob(
			'*/10 * * * * *', // will run every 10  seconds.
			async () => {
				socketHelper.emitSocket(REDIS_KEY.TPS_GRAPH);
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	public syncBlocks() {
		let processing = false;
		new CronJob(
			'*/1 * * * * *', // will run every 1  seconds.
			async () => {
				if (!processing) {
					processing = true;
					await this.processBlock();
					processing = false;
				}
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	async processBlock() {
		try {
			const latestBlock = await web3Helper.getBlockNumber();
			const lastBlock = BigInt(latestBlock).toString();

			const updateBlock = await RedisService.getString(
				CONST_NAME.LATEST_BLOCK,
			);

			if (!updateBlock) {
				await RedisService.setString(
					CONST_NAME.LATEST_BLOCK,
					+lastBlock,
				);
			}

			if (updateBlock !== null) {
				if (+updateBlock < +lastBlock) {
					const latestBlockNo = Number(updateBlock);

					RabbitMqService.enqueueData(
						QUEUE_NAME.BLOCKS,
						latestBlockNo.toString(),
					);

					const diff = +lastBlock - +updateBlock;

					let nextBlock = +updateBlock + 1;
					if (diff > 4) {
						nextBlock = +lastBlock - 1;

						for (
							let i = Number(updateBlock);
							i <= Number(lastBlock);
							i += 1
						) {
							const blockQueue = `${QUEUE_NAME.DOWNTIME_BLOCK}_${i
								.toString()
								.slice(-1)}`;
							// saving missed block to downtime block Queue
							RabbitMqService.enqueueData(
								blockQueue,
								i.toString(),
							);
						}
					}
					await RedisService.setString(
						CONST_NAME.LATEST_BLOCK,
						nextBlock,
					);
				}
			}

			return true;
		} catch (err) {
			console.log('Error while saving blocks processBlock In CRON', err);
			return false;
		}
	}
}

export default new CronService();
