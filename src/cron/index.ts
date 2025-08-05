import { AnyCnameRecord } from 'dns';
import axios, { AxiosInstance } from 'axios';
import * as cron from 'cron';
import moment, { months } from 'moment';
import {
	CURRENT_DEFAULT_COIN_PRICE,
	DATA_TIME_POINTS,
	DATE_TO_RUN_CRON_SUPPLY,
	DAYS,
	DAYS_TO_RUN_CRON_SUPPLY,
	MILLI_IN_DAY,
	MILLI_IN_MIN,
	MILLI_IN_SEC,
	MILLI_UNITS,
	TIME_UNITS,
} from '../constant/constants';
import {
	CONST_NAME,
	ERROR_MSG,
	QUEUE_NAME,
	REDIS_KEY,
} from '../constant/response';
import cachingHelper from '../helper/caching.helper';
import ExlorerHelper from '../helper/explorer.helper';

import socketHelper from '../helper/socket.helper';
import {
	generateZeroFilledChartPoints,
	getCoinPriceDataFromMarket,
} from '../helper/stats.helper';
import { calculateData, getValidatorsInfo } from '../helper/validator.helper';
import web3Helper from '../helper/web3.helper';
import { ChartPoint } from '../interface/types';
import logger from '../lib/logger';
import { deepCopy } from '../lib/utilities.helper';
import { RabbitMqService, RedisService } from '../service';
import redisHelper from '../service/redis.helper';

const { CronJob } = cron;
const apiUrl = environment.evmHost;
let apiRes: AxiosInstance;

// types for stats
type DatePoint = { date: string; value: number };
type GraphPayload = { monthly: DatePoint[]; daily: DatePoint[] };

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

	/**
	 * Check the days of the week (eg. Monday, Tuesday...)
	 * @returns boolean
	 */
	private checkDayOfWeek(date: string | number, day: number) {
		return new Date(date).getDay() === day;
	}

	/**
	 * Generate months and days date points for restoring graphs
	 * @returns GraphPayload
	 */
	private generateDatePoints(month = 11, day = 29): GraphPayload {
		const today = new Date();
		const monthly: { date: string; value: number }[] = [];
		const daily: { date: string; value: number }[] = [];

		// Generate past 11 months and current month first date points
		for (let i = month; i >= 0; i--) {
			const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
			monthly.push({
				date: date.toISOString(),
				value: 0,
			});
		}

		// Generate current and previous 29 days point
		for (let i = day; i >= 0; i--) {
			const date = new Date();
			date.setDate(today.getDate() - i);
			daily.push({
				date: date.toISOString(),
				value: 0,
			});
		}

		return { monthly, daily };
	}

	/**
	 * restore previous coin price points
	 * @param daysData
	 * @returns DatePoint[]
	 */
	private restorePriceDaysGraph(daysData: DatePoint[], price: number) {
		let coinPrice = price;
		// not side-effects
		return deepCopy(daysData)
			.reverse()
			.map((point: DatePoint): DatePoint => {
				point.value = coinPrice;
				if (this.checkDayOfWeek(point.date, DAYS.MONDAY))
					coinPrice -= (coinPrice * 10) / 100;
				return point;
			});
	}

	/**
	 * restore previous coin price points
	 * @param monthsData
	 * @returns DatePoint[]
	 */
	private restorePriceMonthsGraph(monthsData: DatePoint[], price: number) {
		let coinPrice = price;
		// not side-effects
		return deepCopy(monthsData)
			.reverse()
			.map((point: DatePoint): DatePoint => {
				point.value =
					coinPrice > CURRENT_DEFAULT_COIN_PRICE
						? coinPrice
						: CURRENT_DEFAULT_COIN_PRICE;
				coinPrice -= ((coinPrice * 10) / 100) * 4;
				return point;
			});
	}

	/**
	 * restore the graph history points
	 * @returns boolean
	 */
	private async restoreGraphs() {
		try {
			let priceGraph = await redisHelper.getString<GraphPayload>(
				REDIS_KEY.CoinPriceGraph,
			);
			// if stats is already generated then don't restore again
			if (priceGraph) return false;
			const tokenPrice =
				(await redisHelper.getString<number>(REDIS_KEY.COIN_PRICE)) ||
				CURRENT_DEFAULT_COIN_PRICE;

			priceGraph = this.generateDatePoints();
			const daysData = this.restorePriceDaysGraph(
				priceGraph.daily,
				tokenPrice,
			);
			const monthsData = this.restorePriceMonthsGraph(
				priceGraph.monthly,
				tokenPrice,
			);

			await redisHelper.setString(REDIS_KEY.CoinPriceGraph, {
				daily: daysData,
				monthly: monthsData,
			});
			return true;
		} catch (err) {
			console.log('Error while restoring graph: ', err);
			return false;
		}
	}

	public async coinPriceGraphUpdationSchedule() {
		try {
			// TODO(REF CP1): Needed need to remove in future
			// await this.restoreGraphs();

			/**
			 * schedule the cron to handle graph price update
			 * NOTE: need to further work on it for implementing
			 * more optimized method
			 * currently zero filled is generated if date is missing from the data
			 * fetched from coin market cap api zero filled values will be generated
			 * for that date
			 */

			/**
			 * TODO(CP2): Need to removed hardcoded values like month and days count in below logic
			 * in future and need to implement types for below implementation
			 */

			/**
			 * TODO(CP3): Also need to create a cron time file or make the cron time dynamic
			 * so we can change it easily without any changes in code and 1 default value will be
			 * available in the code
			 *
			 * TODO(GE1): Need to optimise the try catch exception handling uses
			 */

			/**
			 * CLEANUP(CP2): Need to refactor the below job routine (assignment, breaking into smaller reusable methods and condtionals)
			 * */

			/**
			 * Job callback (also can be used without any job schedule)
			 * */
			const jobCallback = async () => {
				try {
					const { error, data } =
						await ExlorerHelper.saveLatestCoinPriceFromMarket();

					logger.info('Price updation schedule running.');
					const currentTimePoint = new Date();
					const priceChartData: {
						daily: ChartPoint[];
						monthly: ChartPoint[];
					} = { daily: [], monthly: [] };

					// Current day is not included
					const pastTimePoint = moment().utc().subtract(29, 'day');
					// Get day wise price data points from third party provider
					const pastDaysPriceChartPoint =
						await getCoinPriceDataFromMarket(
							pastTimePoint.toISOString(),
							currentTimePoint.toISOString(),
						);

					// Day wise price data points
					const daysZeroFilledPoints = generateZeroFilledChartPoints(
						pastTimePoint.toISOString(),
						30 - pastDaysPriceChartPoint.length,
					);
					priceChartData.daily = daysZeroFilledPoints
						.concat(pastDaysPriceChartPoint)
						.reverse();

					// Current month is not included
					const pastMonthTimePoint = moment()
						.utc()
						.subtract(11, 'month');

					// Get month wise price data points from third party provider
					const pastMonthsPriceChartPoint =
						await getCoinPriceDataFromMarket(
							pastMonthTimePoint.toISOString(),
							currentTimePoint.toISOString(),
							DATA_TIME_POINTS.MONTH,
						);

					const monthlyZeroFilledPoints =
						generateZeroFilledChartPoints(
							pastMonthTimePoint.toISOString(),
							12 - pastMonthsPriceChartPoint.length,
							'month',
						);

					// Only work if third party provider not giving monthly data points (due to plan or other issues)
					if (pastMonthsPriceChartPoint.length === 0) {
						monthlyZeroFilledPoints[
							monthlyZeroFilledPoints.length - 1
						].value = error
							? pastDaysPriceChartPoint[
									pastDaysPriceChartPoint.length - 1
								].value
							: data?.price;
						priceChartData.monthly =
							monthlyZeroFilledPoints.reverse();
					} else
						priceChartData.monthly = monthlyZeroFilledPoints
							.concat(pastMonthsPriceChartPoint)
							.reverse();

					// update the latest price for today
					if (data?.price) priceChartData.daily[0].value = data.price;

					// TODO(KEY1): Need to change all redis keys and queue names and other services related
					// keys need to capital for better code formatting.
					await redisHelper.setString(
						REDIS_KEY.CoinPriceGraph,
						priceChartData,
					);
					// console.log('Chart points saved: ', priceChartData);
					logger.info('Cron Schedule price chart updation completed');
				} catch (err) {
					console.error('Price chart job routine exception:\n', err);
				}

				// TODO(REF CP1) Need to removed in future if not used (keeping it just in case)
				// const priceGraph =
				// 	await redisHelper.getString<GraphPayload>(
				// 		REDIS_KEY.CoinPriceGraph,
				// 	);
				// const currentCoinPrice =
				// 	(await redisHelper.getString<number>(
				// 		REDIS_KEY.COIN_PRICE,
				// 	)) || CURRENT_DEFAULT_COIN_PRICE;

				// const date = new Date();
				// const today = date.toISOString();

				// priceGraph.daily.unshift({
				// 	date: today,
				// 	value: currentCoinPrice,
				// });

				// if (date.getDate() === 1) {
				// 	priceGraph.monthly.unshift({
				// 		date: today,
				// 		value: currentCoinPrice,
				// 	});

				// 	priceGraph.monthly.pop();

				// 	// only update the monthly price on monday
				// } else if (this.checkDayOfWeek(today, DAYS.MONDAY))
				// 	priceGraph.monthly[0].value = currentCoinPrice;

				// // Save updated history back to Redis
				// const updatedGraph = await redisHelper.setString(
				// 	REDIS_KEY.CoinPriceGraph,
				// 	priceGraph,
				// );
				// if (updatedGraph)
				// 	logger.error(ERROR_MSG.COIN_PRICE_UPDATION);

				// logger.info(
				// 	`Coin price record saved for ${today}: ${currentCoinPrice}`,
				// );
			};

			// If price chart data not generated, save it initially on service startup
			const chartData = await redisHelper.getString(
				REDIS_KEY.CoinPriceGraph,
			);
			if (!chartData) await jobCallback();

			// Create and schedule the price chart updation job
			new CronJob('*/2 * * * *', jobCallback, null, true, 'UTC');

			logger.info('Coin price history scheduler started.');
		} catch (err) {
			console.error(
				'Error while updating the coin price graph cron\n',
				err,
			);
		}
	}

	public checkPendingTransaction() {
		new CronJob(
			'*/30 * * * *', // will run after every 30 min.
			async () => {
				await ExlorerHelper.checkTransactionStatus();
			},
			null,
			true,
			'America/Los_Angeles',
		);
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

			const updateBlock = await RedisService.getString<number>(
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

	public syncOldBlocks() {
		console.log('Syncing Old Blocks');
		let processing = false;
		new CronJob(
			'*/5 * * * * *', // will run every 1  seconds.
			async () => {
				if (!processing) {
					processing = true;
					await this.processOldBlock();
					processing = false;
				}
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	async processOldBlock() {
		try {
			// const latestBlock = await web3Helper.getBlockNumber();
			const lastBlock = BigInt(1).toString();
			console.log('processOldBlock', lastBlock);
			const updateBlock = await RedisService.getString<number>(
				CONST_NAME.LATEST_OLD_BLOCK,
			);
			console.log('updateBlock', updateBlock);

			if (!updateBlock) {
				await RedisService.setString(
					CONST_NAME.LATEST_OLD_BLOCK,
					+lastBlock,
				);
			}
			console.log('updateBlock', updateBlock);

			const latestBlockNo = Number(updateBlock);

			const nextBlock = +updateBlock + 1;

			const blockQueue = `${QUEUE_NAME.DOWNTIME_BLOCK}`;
			RabbitMqService.enqueueData(blockQueue, latestBlockNo.toString());

			await RedisService.setString(
				CONST_NAME.LATEST_OLD_BLOCK,
				nextBlock,
			);

			return true;
		} catch (err) {
			console.log('Error while saving blocks processBlock In CRON', err);
			return false;
		}
	}

	public syncInternalTransactions() {
		console.log(' syncInternalTransactions Blocks');
		let processing = false;
		new CronJob(
			'*/2 * * * * *', // will run every 2  seconds.
			async () => {
				if (!processing) {
					processing = true;
					await this.processInternalTransactions();
					processing = false;
				}
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	async processInternalTransactions() {
		try {
			const lastBlock: any = await RedisService.getString(
				CONST_NAME.INTERNAL_TRNXN_BLOCK,
			);

			const latestBlock: any = await RedisService.getString(
				CONST_NAME.LATEST_BLOCK,
			);

			console.log('processInternal-lastBlock', lastBlock);
			let latestBlockNo = 697616;
			const revisedBlock = 697616;
			if (lastBlock) {
				console.log('lastBlock-lastBlock', lastBlock);
				latestBlockNo = Number(lastBlock);
			}
			await RedisService.setString(
				CONST_NAME.INTERNAL_TRNXN_BLOCK,
				revisedBlock,
			);
			// if (latestBlockNo > latestBlock) {
			// 	await RedisService.setString(
			// 		CONST_NAME.INTERNAL_TRNXN_BLOCK,
			// 		revisedBlock,
			// 	);
			// 	return false;
			// }
			console.log('processInternal-latestBlockNo', latestBlockNo);

			const nextBlock = +latestBlockNo + 1;
			console.log('processInternal-nextBlock', nextBlock);

			const internalTxnQueue = `${QUEUE_NAME.MISSING_INTERNAL_TRXNS}`;
			RabbitMqService.enqueueData(
				internalTxnQueue,
				latestBlockNo.toString(),
			);

			await RedisService.setString(
				CONST_NAME.INTERNAL_TRNXN_BLOCK,
				nextBlock,
			);

			return true;
		} catch (err) {
			console.log('Error while processInternalTransactions CRON', err);
			return false;
		}
	}

	async circulateSupplyCron() {
		let getSupplyStartDate: any = await redisHelper.getString(
			REDIS_KEY.START_CIRCULATING_SUPPLY_DATE,
		);

		if (!getSupplyStartDate) {
			console.log('DATE_TO_RUN_CRON_SUPPLY');
			getSupplyStartDate = DATE_TO_RUN_CRON_SUPPLY;
			await redisHelper.setString(
				REDIS_KEY.START_CIRCULATING_SUPPLY_DATE,
				getSupplyStartDate,
			);
		}
		const startDate = new Date(getSupplyStartDate);
		const today = new Date();

		const diffInMs = today.getTime() - startDate.getTime();
		const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

		if (diffInDays > DAYS_TO_RUN_CRON_SUPPLY) {
			return false;
		}

		new CronJob(
			'00 00 14 * * *', // will run every 07.30pm(IST).
			async () => {
				await cachingHelper.circulateSupplyCron();
			},
			null,
			true,
			'America/Los_Angeles',
		);
		return true;
	}
}

export default new CronService();
