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
			const res = await this.connect(); // Ensure `connect` is awaited if it's a Promise
			this.channel = res;
			Object.values(QUEUE_NAME).forEach((queue) => {
				this.channel.assertQueue(queue, {
					durable: false,
				});
			});

			// Assert additional BLOCKS_* queues
			for (let i = 0; i < 10; i += 1) {
				this.channel.assertQueue(`${QUEUE_NAME.BLOCKS}_${i}`, {
					durable: false, // Set to true for persistent queues
				});
			}
			this.channel.prefetch(1);
			this.startConsumers();

			console.log('RabbitMQ server started successfully!');
			return true;
		} catch (error) {
			console.error('Error while connecting to RabbitMQ:', error);
			return false;
		}
	}

	public startConsumers() {
		this.consumeBlocks();
		this.consumeUsers();
		this.consumeAllTransaction();
		this.consumeMissingBlocks();
		this.consumeDownTimeBlocks();
		this.consumeErrorBlocks();
		this.consumeValidatorDetails();
		this.consumeStats();
		// this.consumeMissingMissingMethods();
	}

	public connect(): Promise<amqp.Channel> {
		const RECONNECT_DELAY = 5000;
		const connectionOptions = { heartbeat: 60 }; // Heartbeat interval in seconds

		return new Promise((resolve, reject) => {
			const attemptConnection = (reConsume: boolean = false) => {
				amqp.connect(
					environment.rabbitMq,
					connectionOptions,
					(err, connection) => {
						if (err) {
							logger.error('Error connecting to RabbitMQ:', err);
							reject(err);
							return;
						}

						// Handle connection errors
						connection.on('error', (error) => {
							logger.error('RabbitMQ connection error:', error);
							setTimeout(
								() => attemptConnection(true),
								RECONNECT_DELAY,
							);
						});

						// Handle connection closure
						connection.on('close', (error) => {
							logger.warn('RabbitMQ connection closed:', error);
							setTimeout(
								() => attemptConnection(true),
								RECONNECT_DELAY,
							);
						});

						// Function to create and handle channel
						const createChannel = () => {
							connection.createChannel(
								(error: Error, channel) => {
									if (error) {
										logger.error(
											'Error creating channel:',
											error,
										);
										reject(error);
										return;
									}

									this.channel = channel;

									// Handle channel errors
									channel.on('error', (chanError) => {
										logger.error(
											'RabbitMQ channel error:',
											chanError,
										);
									});

									// Handle channel closure and recreate it
									channel.on('close', (channelError) => {
										logger.warn(
											'RabbitMQ channel closed, recreating...',
											channelError,
										);
										setTimeout(
											createChannel,
											RECONNECT_DELAY,
										);
									});

									// Re-consume messages if necessary
									if (reConsume) {
										this.startConsumers();
									}

									logger.info(
										'RabbitMQ channel created successfully',
									);
									resolve(channel);
								},
							);
						};

						// Create the initial channel
						createChannel();
					},
				);
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
		try {
			this.channel?.consume(
				QUEUE_NAME.TRANSACTIONS,
				async (message: amqp.Message | null) => {
					if (message) {
						try {
							const txData = JSON.parse(
								message.content.toString(),
							);
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
		} catch (error) {
			console.log('consumeAllTransaction Error In last', error);
		}
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
		try {
			this.channel?.consume(
				QUEUE_NAME.MISSING_BLOCK,
				async (message: amqp.Message | null) => {
					console.log(
						'consumeErrorBlocks_message',
						message?.content.toString(),
					);

					if (message) {
						try {
							const blockNumber = Number(
								message.content.toString(),
							);
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
					} else {
						console.log('consumeErrorBlocks_message EKSE');
					}
				},
				{ noAck: false },
			);
		} catch (error) {
			console.log('consumeMissingBlocks Error Last', error);
		}
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
				console.log(
					'consumeErrorBlocks_message',
					message?.content.toString(),
				);

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
				} else {
					console.log('consumeErrorBlocks_message ELSE');
				}
			},
			{ noAck: false },
		);
	}

	/**
	 * Handle blocks one by one when server is down
	 */
	consumeDownTimeBlocks(): void {
		try {
			this.channel?.consume(
				QUEUE_NAME.DOWNTIME_BLOCK,
				async (message: amqp.Message | null) => {
					console.log(
						'consumeDownTimeBlocks_message',
						message?.content.toString(),
					);
					if (message) {
						try {
							const blockNumber = Number(
								message.content.toString(),
							);
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
										blockCount.toString(),
									);
								} else {
									// Increment the block count
									blockCount = Number(blockCount) + 1;
									await RedisService.setString(
										REDIS_KEY.BLOCKS_COUNT,
										blockCount.toString(),
									);
								}
							}
							console.log(
								'Downtime Block (Saved): ',
								blockNumber,
							);
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
					} else {
						console.log('consumeDownTimeBlocks_message ELSE');
					}
				},
				{ noAck: false },
			);
		} catch (error) {
			console.log('consumeDownTimeBlocks Error In last', error);
		}
	}

	public consumeBlocks(): void {
		try {
			for (let i = 0; i < 10; i += 1) {
				this.channel?.consume(
					`${QUEUE_NAME.BLOCKS}_${i}`,
					async (message: amqp.Message | null) => {
						console.log(
							'consumeBlocks_message',
							message?.content.toString(),
						);
						if (message) {
							try {
								const blockData = JSON.parse(
									message.content.toString(),
								);
								const isSuccess =
									await explorerHelper.saveBlockData(
										blockData,
									);

								if (isSuccess) {
									// Retrieve the block count from Redis or the database
									let blockCount =
										await RedisService.getString(
											REDIS_KEY.BLOCKS_COUNT,
										);

									if (!blockCount) {
										// First time, get the count from the database
										blockCount =
											await prisma.blocks.count();
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
								console.log('isSuccess', isSuccess);
								if (
									isSuccess?.error &&
									blockData?.blocknumber
								) {
									console.log('isSuccess-isSuccess');
									this.enqueueData(
										QUEUE_NAME.ERROR_BLOCK,
										blockData.blocknumber.toString(),
									);
								}
								console.log('2-isSuccess');

								this.channel?.ack(message);
								
							} catch (error) {
								console.log('consumeBlocks Error', error);
								this.channel?.ack(message);
							}
						} else {
							console.log('ELSE consumeBlocks_message');
						}
					},
					{ noAck: false },
				);
			}
		} catch (error) {
			console.log('consumeBlocks Error In last', error);
		}
	}

	consumeStats = () => {
		try {
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
				{ noAck: false },
			);
		} catch (error) {
			console.log('consumeStats Error In last', error);
		}
	};
}

export default new RabbitMq();
