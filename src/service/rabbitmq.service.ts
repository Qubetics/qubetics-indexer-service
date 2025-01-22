import * as amqp from 'amqplib/callback_api';
import { QUEUE_NAME, REDIS_KEY } from '../constant/response';
import countHelper from '../helper/count.helper';
import explorerHelper from '../helper/explorer.helper';
import processHelper from '../helper/process.helper';
import { IValidator, StatsType } from '../interface';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import { statsUpdater } from './stats.service';
import { RedisService } from '.';

class RabbitMq {
	public channel: amqp.Channel;

	constructor() {
		this.startServer();
	}

	public async startServer() {
		try {
			const res = await this.connect();
			this.channel = res;
			Object.values(QUEUE_NAME).forEach((queue) => {
				this.channel.assertQueue(queue, {
					durable: false,
				});
			});

			for (let i = 0; i < 10; i += 1) {
				this.channel.assertQueue(`${QUEUE_NAME.BLOCKS}_${i}`, {
					durable: false,
				});
			}
			this.channel.prefetch(5);
			this.consumeBlocks();
			this.consumeUsers();
			this.consumeAllTransaction();
			this.consumeMissingBlocks();
			this.consumeDownTimeBlocks();
			this.consumeErrorBlocks();
			this.consumeValidatorDetails();
			this.consumeStats();

			return true;
		} catch (error) {
			console.error('Error while connecting to RabbitMQ: ', error);
			return false;
		}
	}

	public connect(): Promise<amqp.Channel> {
		const RECONNECT_DELAY = 5000;
		return new Promise((resolve, reject) => {
			const attemptConnection = () => {
				amqp.connect(environment.rabbitMq, (err, connection) => {
					if (err) {
						console.error('Error connecting to RabbitMQ:', err);
						reject(err);
						return;
					}

					connection.on('error', (error) => {
						console.error(
							'RabbitMQ connection error:',
							error.message,
						);
						setTimeout(attemptConnection, RECONNECT_DELAY);
					});

					connection.createChannel((error: Error, channel) => {
						if (error) {
							console.error('Error creating channel:', error);
							reject(error);
							return;
						}

						logger.info('RabbitMQ connection created');
						resolve(channel);
					});
				});
			};

			attemptConnection();
		});
	}

	public assertQueue(queue: string) {
		this.channel?.assertQueue(queue, { durable: false });
	}

	/**
	 * Save Data in queue
	 * @param queue
	 * @param data
	 * @returns
	 */
	public enqueueData(queue: string, data: string) {
		try {
			this.channel?.sendToQueue(queue, Buffer.from(data));
			return true;
		} catch (error) {
			logger.error(
				`Error while enqueuing data into queue name: ${queue}`,
				error,
			);
			return false;
		}
	}

	/**
	 * For consuming all type of transactions
	 */
	public consumeAllTransaction() {
		this.channel?.consume(
			QUEUE_NAME.TRANSACTIONS,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						const txData = JSON.parse(message.content.toString());
						const txRes =
							await processHelper.processTransactions(txData);

						if (txRes.error) {
							this.enqueueData(
								QUEUE_NAME.ERROR_BLOCK,
								txData.blocknumber.toString(),
							);
						}
						console.log('acknowledging the queue for tx ..');
						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeAllTransaction Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * Save the Users
	 */
	public consumeUsers(): void {
		this.channel?.consume(
			QUEUE_NAME.SAVE_USERS,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						await explorerHelper.userSave(
							JSON.parse(message.content.toString()),
						);
						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeUsers Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * For consuming the Missed blocks
	 */
	public consumeMissingBlocks(): void {
		this.channel?.consume(
			QUEUE_NAME.MISSING_BLOCK,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						const blockNumber = Number(message.content.toString());
						const isSuccess =
							await processHelper.saveDowntimeAndErrBlock(
								blockNumber,
							);
						if (!isSuccess && blockNumber) {
							this.enqueueData(
								QUEUE_NAME.ERROR_BLOCK,
								blockNumber.toString(),
							);
						}
						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeMissingBlocks Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * This will handle validator details of api service
	 */
	public consumeValidatorDetails(): void {
		this.channel?.consume(
			QUEUE_NAME.VALIDATOR_DETAIL,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						const validatorString = message.content.toString();
						const validator: IValidator =
							JSON.parse(validatorString);
						await explorerHelper.saveValidatorData(validator);

						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeValidatorDetails Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * consume error block queue
	 */
	consumeErrorBlocks(): void {
		this.channel?.consume(
			QUEUE_NAME.ERROR_BLOCK,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						const blockNumber = Number(message.content.toString());
						await processHelper.saveDowntimeAndErrBlock(
							blockNumber,
						);
						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeErrorBlocks Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * Handle blocks one by one when server is down
	 */
	consumeDownTimeBlocks(): void {
		this.channel?.consume(
			QUEUE_NAME.DOWNTIME_BLOCK,
			async (message: amqp.Message | null) => {
				if (message) {
					try {
						const blockNumber = Number(message.content.toString());
						const isSuccess =
							await processHelper.saveDowntimeAndErrBlock(
								blockNumber,
							);
						if (isSuccess) {
							// Retrieve the block count from Redis or the database
							let blockCount = await RedisService.getString(
								REDIS_KEY.BLOCKS_COUNT,
							);

							if (!blockCount) {
								// First time, get the count from the database
								blockCount = await prisma.blocks.count();
								await RedisService.setString(
									REDIS_KEY.BLOCKS_COUNT,
									blockCount,
								);
							} else {
								// Increment the block count
								blockCount = Number(blockCount) + 1;
								await RedisService.setString(
									REDIS_KEY.BLOCKS_COUNT,
									blockCount,
								);
							}
						}
						console.log('Downtime Block (Saved): ', blockNumber);
						if (!isSuccess) {
							this.enqueueData(
								QUEUE_NAME.ERROR_BLOCK,
								blockNumber.toString(),
							);
						}
						this.channel?.ack(message);
					} catch (error) {
						console.log('consumeDownTimeBlocks Error', error);
						this.channel?.ack(message);
					}
				}
			},
			{ noAck: false },
		);
	}

	public consumeBlocks(): void {
		for (let i = 0; i < 10; i += 1) {
			this.channel?.consume(
				`${QUEUE_NAME.BLOCKS}_${i}`,
				async (message: amqp.Message | null) => {
					if (message) {
						try {
							const blockData = JSON.parse(
								message.content.toString(),
							);
							const isSuccess =
								await explorerHelper.saveBlockData(blockData);

							if (isSuccess) {
								// Retrieve the block count from Redis or the database
								let blockCount = await RedisService.getString(
									REDIS_KEY.BLOCKS_COUNT,
								);

								if (!blockCount) {
									// First time, get the count from the database
									blockCount = await prisma.blocks.count();
									await RedisService.setString(
										REDIS_KEY.BLOCKS_COUNT,
										blockCount,
									);
								} else {
									// Increment the block count
									blockCount = Number(blockCount) + 1;
									await RedisService.setString(
										REDIS_KEY.BLOCKS_COUNT,
										blockCount,
									);
								}
							}
							if (isSuccess?.error && blockData?.blocknumber) {
								this.enqueueData(
									QUEUE_NAME.ERROR_BLOCK,
									blockData.blocknumber.toString(),
								);
							}
							this.channel?.ack(message);
						} catch (error) {
							console.log('consumeBlocks Error', error);
							this.channel?.ack(message);
						}
					}
				},
				{ noAck: false },
			);
		}
	}

	consumeStats = () => {
		this.channel.consume(
			QUEUE_NAME.STATS_UPDATE,
			(msg: amqp.Message | null) => {
				if (!msg) return;
				try {
					const message: StatsType = JSON.parse(
						msg.content.toString('utf-8'),
					);
					// update the latest count for data tables
					countHelper.updateLatestCount(message);

					// update the stats
					if (!statsUpdater.updateInMemoryStats(message))
						this.channel.ack(msg);
				} catch (error) {
					console.log('consumeStats Error', error);
					this.channel.ack(msg);
				}
			},
		);
	};
}

export default new RabbitMq();
