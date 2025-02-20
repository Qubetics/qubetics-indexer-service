import { CronCommand, CronJob } from 'cron';
import {
	CRON_TIME,
	DATA_TIME_POINTS,
	REDIS_STATS_CRON_KEY,
	REDIS_STATS_UPDATION_CRONTIME,
} from '../constant/constants';
import { REDIS_KEY } from '../constant/response';
import { StatsType } from '../interface/index';
import { StatsTimeType } from '../interface/types';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import {
	generateTimeRange,
	generateTimeRangesFromObj,
	getMillisecondByStatsTime,
	getStartTimePointByType,
} from '../lib/time.helpers';
import {
	fillMissingDatesWithZeroByhr,
	fillMissingDatesWithZeroByDay,
	formatDate,
	formatDateForDay,
	formatDateByMin,
	fillMissingMinutes,
	formatDateForYear,
	fillMissingDatesWithZeroByMonth,
	formatTheDate,
} from '../lib/utilities.helper';
import redisHelper from './redis.helper';

/**
 * Stats calculation related helper class
 */
class Stats {
	/**
	 * compute the tx history
	 * @returns
	 */
	computeTxHistory = async () => {
		try {
			let graphData;
			let startDate = '';

			const currentDate = new Date();
			const getCurrentDate = await formatTheDate(currentDate);

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1);
			startDate = formatDate(oneDayAgo);
			graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('hour', "timestamp") AS "hour", COUNT(*)::int AS "count"
				FROM "Transactions"
				WHERE "timestamp" >= ${new Date(startDate)}
				AND "timestamp" <= ${currentDate}
		
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

			const hourly = await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			);

			const daysAgo = 60;
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - daysAgo);
			startDate = formatDateForDay(fromDate);
			const fromMonth = await formatTheDate(fromDate);

			graphData = (await prisma.$queryRaw`
			  SELECT DATE_TRUNC('day', "timestamp") AS "day", COUNT(*)::int AS "count"
			  FROM "Transactions"
			  WHERE "timestamp" >= ${fromMonth}::timestamp
				AND "timestamp" <= ${getCurrentDate}::timestamp
				
			  GROUP BY "day"
			  ORDER BY "day";
			`) as Array<{ day: Date; count: number }>;

			const daily = await fillMissingDatesWithZeroByDay(
				graphData,
				new Date(startDate),
				currentDate,
			);

			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
			startDate = formatDateForYear(oneYearAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('month', "timestamp") AS "month", COUNT(*)::int AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					GROUP BY "month"
					ORDER BY "month";
				`) as Array<{ month: Date; count: number }>;

			const monthly = await fillMissingDatesWithZeroByMonth(
				graphData,
				new Date(startDate),
				currentDate,
			);

			return {
				key: REDIS_KEY.TxHistory,
				data: { hourly, daily, monthly },
				statsCurrents: {
					hourly: hourly[hourly.length - 1],
					daily: daily[daily.length - 1],
					monthly: monthly[monthly.length - 1],
				},
			};
			// return {
			// 	error: false,
			// 	message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
			// 	data: {
			// 		finalData: finalData as Array<GraphData>,
			// 		count: await prisma.transactions.count(),
			// 	},
			// };
		} catch (err) {
			console.error('Error while computing the tx history:\n', err);
			return { key: null };
		}
	};

	/**
	 * compute the new account history
	 * @returns
	 */
	computeNewAccountHistory = async (onlyMinInterval: boolean = false) => {
		try {
			let graphData;
			let startDate = '';

			const currentDate = new Date();
			const getCurrentDate = await formatTheDate(currentDate);

			const currentDateFormated = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);
			graphData = (await prisma.$queryRaw`
				SELECT DATE_TRUNC('minute', "createdAt") AS "hour", COUNT(*)::int AS "count"
				FROM "Users"
				WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${new Date(currentDateFormated)}
				
				GROUP BY "hour"
				ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

			const mintue = await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDate),
			);

			if (onlyMinInterval) return { mintue };

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1);
			startDate = formatDate(oneDayAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('hour', "createdAt") AS "hour", COUNT(*)::int AS "count"
					FROM "Users"
					WHERE "createdAt" >= ${new Date(startDate)}
					AND "createdAt" <= ${currentDate}
			
					GROUP BY "hour"
					ORDER BY "hour";
					`) as Array<{ hour: Date; count: number }>;

			const hourly = await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			);

			const daysAgo = 60;
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - daysAgo);
			startDate = formatDateForDay(fromDate);
			console.log('startDateMONTH', startDate);
			const fromMonth = await formatTheDate(fromDate);

			graphData = (await prisma.$queryRaw`
				  SELECT DATE_TRUNC('day', "createdAt") AS "day", COUNT(*)::int AS "count"
				  FROM "Users"
				  WHERE "createdAt" >= ${fromMonth}::timestamp
					AND "createdAt" <= ${getCurrentDate}::timestamp
					
				  GROUP BY "day"
				  ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

			const daily = await fillMissingDatesWithZeroByDay(
				graphData,
				new Date(startDate),
				currentDate,
			);

			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
			startDate = formatDateForYear(oneYearAgo);
			const fromYear = await formatTheDate(oneYearAgo);

			console.log('getCurrentDate', getCurrentDate);
			console.log(fromYear, 'fromYear');

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('month', "createdAt") AS "month", COUNT(*)::int AS "count"
					FROM "Users"
					WHERE "createdAt" >= ${fromYear}::timestamp
					AND "createdAt" <= ${getCurrentDate}::timestamp
					GROUP BY "month"
					ORDER BY "month";
				`) as Array<{ month: Date; count: number }>;

			const monthly = await fillMissingDatesWithZeroByMonth(
				graphData,
				new Date(startDate),
				currentDate,
			);

			return {
				key: REDIS_KEY.NewAccountHistory,
				data: { hourly, mintue, daily, monthly },
				statsCurrents: {
					hourly: hourly[hourly.length - 1],
					daily: daily[daily.length - 1],
					monthly: monthly[monthly.length - 1],
				},
			};
		} catch (err) {
			return { key: null };
		}
	};

	/**
	 * compute the coin transfer history
	 * @returns
	 */
	computeCoinTransferHistory = async (onlyMinInterval: boolean = false) => {
		try {
			let graphData;
			let startDate = '';

			const currentDate = new Date();

			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);
			graphData = (await prisma.$queryRaw`
			   SELECT DATE_TRUNC('minute', "timestamp") AS "hour", COUNT(*)::int AS "count"
			   FROM "Transactions"
			   WHERE "timestamp" >= ${new Date(startDate)}
				AND "timestamp" <= ${currentDate}
				AND "type" = 'COIN_TRANSFER'
			   GROUP BY "hour"
			   ORDER BY "hour";
			`) as Array<{ hour: Date; count: number }>;

			const mintue = await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			);

			if (onlyMinInterval) return { mintue };

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1);
			startDate = formatDate(oneDayAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('hour', "timestamp") AS "hour", COUNT(*)::int AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'COIN_TRANSFER'
					GROUP BY "hour"
					ORDER BY "hour";
					`) as Array<{ hour: Date; count: number }>;
			const hourly = await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			);

			const daysAgo = 60;
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - daysAgo);
			startDate = formatDateForDay(fromDate);

			graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "timestamp") AS "day", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'COIN_TRANSFER'
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

			const daily = await fillMissingDatesWithZeroByDay(
				graphData,
				new Date(startDate),
				currentDate,
			);

			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
			startDate = formatDateForYear(oneYearAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('month', "timestamp") AS "month", COUNT(*)::int AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'COIN_TRANSFER'
					GROUP BY "month"
					ORDER BY "month";
				`) as Array<{ month: Date; count: number }>;

			const monthly = await fillMissingDatesWithZeroByMonth(
				graphData,
				new Date(startDate),
				currentDate,
			);

			return {
				key: REDIS_KEY.CoinTransferTxHistory,
				data: { mintue, daily, hourly, monthly },
				statsCurrents: {
					mintue: mintue[mintue.length - 1],
					hourly: hourly[hourly.length - 1],
					daily: daily[daily.length - 1],
					monthly: monthly[monthly.length - 1],
				},
			};

			// return {
			// 	error: false,
			// 	message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
			// 	data: {
			// 		finalData: finalData as Array<GraphData>,
			// 		count: count,
			// 	},
			// };
		} catch (err) {
			return { key: null };
		}
	};

	/**
	 * compute the contract deployment history
	 * @returns
	 */
	computeContractDeployHistory = async (onlyMinInterval: boolean = false) => {
		try {
			let graphData;
			let startDate = '';

			const currentDate = new Date();

			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);
			graphData = (await prisma.$queryRaw`
               SELECT DATE_TRUNC('minute', "timestamp") AS "hour", COUNT(*)::int AS "count"
               FROM "Transactions"
               WHERE "timestamp" >= ${new Date(startDate)}
                   AND "timestamp" <= ${currentDate}
                   AND "type" = 'CONTRACT_CREATION'
               GROUP BY "hour"
               ORDER BY "hour";
               `) as Array<{ hour: Date; count: number }>;
			const mintue = await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			);

			if (onlyMinInterval) return { mintue };

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			startDate = formatDate(oneDayAgo);

			graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('hour', "timestamp") AS "hour", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "hour"
				   ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;
			const hourly = await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			);

			const daysAgo = 60;
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - daysAgo);
			startDate = formatDateForDay(fromDate);

			graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "timestamp") AS "day", COUNT(*)::int AS "count"
				   FROM "Transactions"
				   WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

			const daily = await fillMissingDatesWithZeroByDay(
				graphData,
				new Date(startDate),
				currentDate,
			);

			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); // Subtract 1 year
			startDate = formatDateForYear(oneYearAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('month', "timestamp") AS "month", COUNT(*)::int AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					AND "type" = 'CONTRACT_CREATION'
					GROUP BY "month"
					ORDER BY "month";
				`) as Array<{ month: Date; count: number }>;

			const monthly = await fillMissingDatesWithZeroByMonth(
				graphData,
				new Date(startDate),
				currentDate,
			);

			return {
				key: REDIS_KEY.ContractDeploymentHistory,
				data: { hourly, mintue, daily, monthly },
				statsCurrents: {
					mintue: mintue[mintue.length - 1],
					hourly: hourly[hourly.length - 1],
					daily: daily[daily.length - 1],
					monthly: monthly[monthly.length - 1],
				},
			};
			// return {
			// 	error: false,
			// 	message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
			// 	data: {
			// 		finalData: finalData as Array<GraphData>,
			// 		count: await prisma.contracts.count(),
			// 	},
			// };
		} catch (err) {
			return { key: null };
		}
	};

	computeTxFeeSum = async (onlyMinInterval: boolean = false) => {
		try {
			let graphData;
			let startDate = '';
			const currentDate = new Date();

			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);

			graphData = (await prisma.$queryRaw`
				 SELECT DATE_TRUNC('minute', "timestamp") AS "hour", SUM((CAST("gasPrice" AS numeric) * CAST("gas" AS numeric))/1e18) AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					GROUP BY "hour"
					ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

			const mintue = await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			);

			if (onlyMinInterval) return { mintue };

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			startDate = formatDate(oneDayAgo);

			graphData = (await prisma.$queryRaw`
				 SELECT DATE_TRUNC('hour', "timestamp") AS "hour", ROUND(SUM((CAST("gasPrice" AS numeric) * CAST("gas" AS numeric))/1e18), 2) AS "count"
					FROM "Transactions"
					WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
					
					GROUP BY "hour"
					ORDER BY "hour";
				`) as Array<{ hour: Date; count: number }>;

			const hourly = await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			);

			const daysAgo = 31;
			const fromDate = new Date(currentDate);
			fromDate.setDate(fromDate.getDate() - daysAgo);
			startDate = formatDateForDay(fromDate);

			graphData = (await prisma.$queryRaw`
				   SELECT DATE_TRUNC('day', "timestamp") AS "day", ROUND(SUM((CAST("gasPrice" AS numeric) * CAST("gas" AS numeric))/1e18), 2) AS "count"
				   FROM "Transactions"
				   WHERE "timestamp" >= ${new Date(startDate)}
					AND "timestamp" <= ${currentDate}
				
				   GROUP BY "day"
				   ORDER BY "day";
				`) as Array<{ day: Date; count: number }>;

			const daily = await fillMissingDatesWithZeroByDay(
				graphData,
				new Date(startDate),
				currentDate,
			);

			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 5); // Subtract 1 year
			startDate = formatDateForYear(oneYearAgo);

			graphData = (await prisma.$queryRaw`
					SELECT DATE_TRUNC('month', "timestamp") AS  "month", ROUND(SUM((CAST("gasPrice" AS numeric) * CAST("gas" AS numeric))/1e18), 2) AS "count"
						FROM "Transactions"
						WHERE "timestamp" >= ${oneYearAgo}
						AND "timestamp" <= ${currentDate}
						GROUP BY "month"
						ORDER BY "month";
				`) as Array<{ month: Date; count: number }>;

			const monthly = await fillMissingDatesWithZeroByMonth(
				graphData,
				new Date(startDate),
				currentDate,
			);

			// return {
			// 	key: REDIS_KEY.TxFeeHistory,
			// 	data: { hourly, daily, monthly },
			// 	statsCurrents: {
			// 		hourly: hourly[hourly.length - 1],
			// 		daily: daily[daily.length - 1],
			// 		monthly: monthly[monthly.length - 1],
			// 	},
			// };
			return {
				key: REDIS_KEY.TxFeeHistory,
				data: { mintue, daily, hourly, monthly },
				statsCurrents: {
					mintue: mintue[mintue.length - 1],
					hourly: hourly[hourly.length - 1],
					daily: daily[daily.length - 1],
					monthly: monthly[monthly.length - 1],
				},
			};
			// return {
			// 	error: false,
			// 	message: RES_MSG.TRANSACTION_HISTORY_SUCCESS,
			// 	data: {
			// 		finalData: finalData as Array<GraphData>,
			// 		count: await prisma.contracts.count(),
			// 	},
			// };
		} catch (err) {
			console.log('Error while calculating the tx fee: ', err);
			return { key: null };
		}
	};
}

/**
 * Stats calculation and updation scheduler class
 */
export class StatsUpdater {
	crons: Record<string, CronJob> = {};

	statsState: any = {};

	statsCurrents: any = {};

	stats = new Stats();

	static instance: StatsUpdater;

	constructor() {
		if (!StatsUpdater.instance) StatsUpdater.instance = this;
		return StatsUpdater.instance;
	}

	/**
	 * Externals
	 * */

	// start the stats calculation and updation service
	start = async () => {
		this.computeStats();
	};

	// stop cron schedule by cron id or key
	stopCronSchedule = (key: string) => {
		if (this.crons[key]) {
			this.crons[key].stop();
			return true;
		}
		logger.error('Cron is undefined (stop)');
		return false;
	};

	// cron factory
	createCron = (
		cronTime: string | Date = '*/15 * * * * *',
		cb: CronCommand | null = null,
	) =>
		new CronJob(
			cronTime,
			cb ||
				(() => {
					console.log(
						`Cron schedule running (${cronTime} - no callback provided)`,
					);
				}),
			null,
			false,
			'UTC',
		);

	// update the next
	addNextDatePoint = (
		type: StatsTimeType,
		statsKey: string,
		timestamp: string,
	) => {
		const _tempDate =
			new Date(timestamp).getTime() + getMillisecondByStatsTime(type);

		// set next data point in stats
		const _tempDataPoint = {
			createdAt: new Date(_tempDate),
			count: 0,
		};

		const range = generateTimeRange(type, _tempDate);
		this.statsCurrents[statsKey].current[type] = {
			data: _tempDataPoint,
			timeStampRange: range,
		};
		// appendFile(path.join(__dirname, 'date.txt'), `TimePoint: ${type} Start: ${new Date(range.start).toLocaleString()} End: ${new Date(range.end).toLocaleString()}\n`);
		const tempStatsArr: any[] = this.statsState[statsKey][type];
		tempStatsArr.shift();
		tempStatsArr.push(_tempDataPoint);
	};

	// compute the stats data within a spefic interval
	computeStats = async () => {
		const isStatsGenerated = await redisHelper.getString(
			REDIS_KEY.StatsGenerated,
		);

		if (Number(isStatsGenerated)) {
			this.statsState = {
				[REDIS_KEY.TxHistory]: await redisHelper.getString(
					REDIS_KEY.TxHistory,
				),
				[REDIS_KEY.CoinTransferTxHistory]: await redisHelper.getString(
					REDIS_KEY.CoinTransferTxHistory,
				),
				[REDIS_KEY.NewAccountHistory]: await redisHelper.getString(
					REDIS_KEY.NewAccountHistory,
				),
				[REDIS_KEY.ContractDeploymentHistory]:
					await redisHelper.getString(
						REDIS_KEY.ContractDeploymentHistory,
					),
				[REDIS_KEY.TxFeeHistory]: await redisHelper.getString(
					REDIS_KEY.TxFeeHistory,
				),
			};

			// assign the current time stats records
			const tempCurrent: { [key: string]: any } = {};
			const currentTimeStamp = Date.now();
			Object.keys(this.statsState).forEach((key) => {
				const tempStats = this.statsState[key];
				tempCurrent[key] = { current: {} };
				Object.keys(tempStats).forEach((innerKey) => {
					const shortInnerKey = innerKey;
					const tempArr: any[] = tempStats[innerKey];
					// check if its stats array
					if (tempArr?.length) {
						const tempDataPoint = tempArr[tempArr.length - 1];
						const timeStampRange = generateTimeRange(
							shortInnerKey,
							tempDataPoint.createdAt,
						);

						/**
						 * if time range is expired in redis saved stats
						 * structure add the current time point
						 * */
						if (
							currentTimeStamp > timeStampRange.end &&
							shortInnerKey !== DATA_TIME_POINTS.MONTH
						) {
							const newTimePoint = getStartTimePointByType(
								shortInnerKey,
								currentTimeStamp,
							);

							//    this.addNextDatePoint(shortInnerKey, key, newTimePoint.toString())
							/**
							 * new stats record for current timepoint
							 * (this is generated due to there is a difference between
							 *  last time point saved and current time point)
							 * */
							const newStatsRecord = {
								createdAt: new Date(newTimePoint),
								count: 0,
							};
							// #DUPLICATE need to remove this in future
							tempCurrent[key].current[shortInnerKey] = {
								data: newStatsRecord,
								timeStampRange: generateTimeRange(
									shortInnerKey,
									newTimePoint,
								),
							};

							tempArr.push(newStatsRecord);
							tempArr.shift();
							return;
						}

						tempCurrent[key].current[shortInnerKey] = {
							data: tempDataPoint,
							timeStampRange: generateTimeRange(
								shortInnerKey,
								tempDataPoint.createdAt,
							),
						};
					}
				});
			});
			this.statsCurrents = tempCurrent;
			await this._updateInRedis();
			this._scheduleCrons();
			return;
		}

		logger.info('Generating stats...');

		// compute all stats data
		const statsDataList = await Promise.all([
			this.stats.computeTxHistory(),
			this.stats.computeNewAccountHistory(),
			this.stats.computeCoinTransferHistory(),
			this.stats.computeContractDeployHistory(),
			this.stats.computeTxFeeSum(),
		]);
		// if key is not null save the computed stats data
		statsDataList.forEach((statsData: any) => {
			this.statsState[statsData.key] = statsData.data;
			// console.log('statsData.key', statsData.key);
			// console.log(statsData.statsCurrents, 'statsData.statsCurrents');
			if (statsData.key) {
				this.statsCurrents[statsData.key] = {
					current: generateTimeRangesFromObj(statsData.statsCurrents),
				};
			}
		});

		await this._updateInRedis();
		await redisHelper.setString(REDIS_KEY.StatsGenerated, 1);
		this._scheduleCrons();
	};

	// Queue helper for processing latest stats updation
	updateInMemoryStats = (txDetails: StatsType) => {
		try {
			if (Object.keys(this.statsCurrents).length === 0) {
				return false;
			}

			const _currentRecords = this.statsCurrents[txDetails.type].current;

			Object.keys(_currentRecords).forEach((recordKey) => {
				// get the record for current time point
				const {
					data,
					timeStampRange: { start, end },
				} = _currentRecords[recordKey];
				if (txDetails.date >= start && txDetails.date <= end)
					data.count =
						Number(data.count) +
						(txDetails?.txnCount ? txDetails.txnCount : 1);
			});
			return true;
		} catch (err) {
			logger.error('Error while updating the stats: ', err);
			return false;
		}
	};

	/**
	 * Internals
	 */

	// cron helpers for date point creation
	_setTimePoint = async (key: string, innerKey: string) => {
		try {
			const state = this.statsCurrents[key].current[innerKey];
			logger.info(
				`Stats update schedule running for ${key} of ${innerKey}`,
			);
			this.addNextDatePoint(innerKey, key, state.data.createdAt);
		} catch (err) {
			logger.error(
				'Error while setting date point\n',
				`stats-${key}-${innerKey}\n`,
				err,
			);
		}
	};

	// setup the stats timepoint cron
	_scheduleInMemoryUpdationCron = () => {
		try {
			Object.keys(this.statsCurrents).forEach((key) => {
				Object.keys(this.statsCurrents[key]?.current).forEach(
					(innerKey) => {
						/**
						 * create, set and start cron for setting up stats time intervals
						 * */
						const _cron = this.createCron(
							CRON_TIME[innerKey],
							this._setTimePoint.bind(this, key, innerKey),
						);
						this.crons[`${key}-${innerKey}`] = _cron;
						_cron.start();
					},
				);
			});
			logger.info('InMemory stats updation cron scheduled');
		} catch (err) {
			logger.error('Error while setting up crons: ', err);
		}
	};

	// update stats in redis
	_updateInRedis = async () => {
		try {
			logger.info('Redis stats updation schedule running');
			/**
			 * Update the stats inside redis asynchronously (It maybe take more then 2 mintues
			 * because we didn't awaited task and timer do not guarantee the exact time execution)
			 * */

			for (const statsKey of Object.keys(this.statsState)) // eslint-disable-line no-restricted-syntax
				await redisHelper.setString(
					statsKey,
					this.statsState[statsKey],
				);
		} catch (err) {
			logger.error('Error while updating stats in redis\n', err);
		}
	};

	// schedule redis updation cron
	_scheduleRedisUpdationCron = () => {
		const _tempCron = this.createCron(
			REDIS_STATS_UPDATION_CRONTIME,
			this._updateInRedis,
		);
		this.crons[REDIS_STATS_CRON_KEY] = _tempCron;
		_tempCron.start();
		logger.info('Redis stats updation cron scheduled');
	};

	// setup stats related crons
	_scheduleCrons = () => {
		// schedule the crons for stats updation work
		// (one update the stats into inmemory of service and other update it into redis)
		this._scheduleInMemoryUpdationCron();
		this._scheduleRedisUpdationCron();
	};
}

export const statsUpdater = new StatsUpdater();
