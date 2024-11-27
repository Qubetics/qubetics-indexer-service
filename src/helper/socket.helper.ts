/* eslint-disable */
import {
	REDIS_KEY,
	SOCKET_EVENT,
	TRANSACTION_TYPE,
} from '../constant/response';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import {
	fillMissingDatesWithZeroByhr,
	fillMissingDatesWithZeroByDay,
	formatDate,
	formatDateForDay,
	formatDateByMin,
	fillMissingMinutes,
	formatDateBySec,
	fillMissingSeconds,
} from '../lib/utilities.helper';
import { SocketEventEmitter } from '../service/index';
import {
	getTxHourlyQuery,
	getTxDailyQuery,
	getTxHourlyMinuteQuery,
	getAccountHourlyQuery,
	getAccountDailyQuery,
	getAccountHourlyMinuteQuery,
	getSecTxQuery,
	getHourlyTxQuery,
	getMinTxQuery,
	getContractTxHourlyQuery,
	getContractTxDailyQuery,
	getContractTxHourlyMinuteQuery,
	getTokenPriceGraph,
} from './query.helper';
class SocketHelper {
	async emitSocket(key: string) {
		if (key === REDIS_KEY.CONTRACT_DEPLOY_GRAPH) {
			// await this.handleContractDeployGraphData(
			// 	SOCKET_EVENT.CONTRACT_DEPLOYED_TX,
			// );
		} else if (key === REDIS_KEY.COIN_TRANSFER_GRAPH) {
			// await this.coinTransferGraphData(
			// 	SOCKET_EVENT.COIN_TRANSFER_TX,
			// 	// TRANSACTION_TYPE.COIN_TRANSFER,
			// );
		} else if (key === REDIS_KEY.ACCOUNT_GRAPH) {
			// await this.handleAccountData(SOCKET_EVENT.ACCOUNT_TX);
		} else if (key === REDIS_KEY.TOKEN_GRAPH) {
			// await this.handleTokenData(SOCKET_EVENT.TOKEN_TX);
		} else if (key === REDIS_KEY.TPS_GRAPH) {
			await this.handleAllTxData(SOCKET_EVENT.ALL_TRANSACTIONS);
		}
	}

	async coinTransferGraphData(socketEvent: string) {
		try {
			let graphData;
			let currentDate;
			let startDate;
			const allGraphData: {
				oneDay: Array<{ createdAt: string; count: number }>;
				sevenDay: Array<{ createdAt: string; count: number }>;
				thirtyDay: Array<{ createdAt: string; count: number }>;
				oneHour: Array<{ createdAt: string; count: number }>;
			} = {
				oneDay: [],
				sevenDay: [],
				thirtyDay: [],
				oneHour: [],
			};
			/** ********************************** */
			currentDate = new Date();
			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			startDate = formatDate(oneDayAgo);
			graphData = (await getTxHourlyQuery(
				startDate,
				currentDate,
			)) as Array<{ hour: Date; count: number }>;

			const finalDataByOneDay = (await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			)) as Array<{ createdAt: string; count: number }>;

			allGraphData.oneDay.push(...finalDataByOneDay);
			/** ********************************** */

			let finalDataBySevenDay: Array<{
				createdAt: string;
				count: number;
			}> = [];
			finalDataBySevenDay = (await this.getDayData(7, 'TPS')) as Array<{
				createdAt: string;
				count: number;
			}>;

			allGraphData.sevenDay.push(...finalDataBySevenDay);

			const finalDataByThirtyDay = (await this.getDayData(
				30,
				'TPS',
			)) as Array<{ createdAt: string; count: number }>;

			allGraphData.thirtyDay.push(...finalDataByThirtyDay);

			/** ********************************** */

			currentDate = new Date();
			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);

			graphData = (await getTxHourlyMinuteQuery(
				new Date(startDate),
				currentDate,
			)) as Array<{ hour: Date; count: number }>;
			const finalDataOneHour = (await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.oneHour.push(...finalDataOneHour);

			/** ********************************** */

			// const txCount = await RedisService.getString(
			// 	type === TRANSACTION_TYPE.COIN_TRANSFER
			// 		? REDIS_KEY.TOTAL_COIN_TRANSFER_TX
			// 		: REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX,
			// );
			//const counter = await ExlorerHelper.getCoinTransferTxCount();
			const count = await prisma.transactions.count({
				where: {
					type: TRANSACTION_TYPE.COIN_TRANSFER,
				},
			});
			const obj = {
				finalData: allGraphData,
				count: count,
			};

			SocketEventEmitter.emitMessage(socketEvent, obj);
			return true;
		} catch (err) {
			logger.error(err);
			logger.error(
				'error occured while handle Graph Data, coin and contract deployed tx',
			);
			return false;
		}
	}

	async handleContractDeployGraphData(socketEvent: string) {
		try {
			/** **************************************** */

			let graphData;
			let currentDate;
			let startDate;
			const allGraphData: {
				oneDay: Array<{ createdAt: string; count: number }>;
				sevenDay: Array<{ createdAt: string; count: number }>;
				thirtyDay: Array<{ createdAt: string; count: number }>;
				oneHour: Array<{ createdAt: string; count: number }>;
			} = {
				oneDay: [],
				sevenDay: [],
				thirtyDay: [],
				oneHour: [],
			};

			currentDate = new Date();
			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			startDate = formatDate(oneDayAgo);
			graphData = (await getContractTxHourlyQuery(
				new Date(startDate),
				currentDate,
			)) as Array<{ hour: Date; count: number }>;

			const finalDataByOneDay = (await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			)) as Array<{ createdAt: string; count: number }>;

			allGraphData.oneDay.push(...finalDataByOneDay);

			/** **************************************** */

			const finalDataBySevenDay = await this.getDayData(7, 'contract');

			allGraphData.sevenDay.push(...finalDataBySevenDay);

			/** **************************************** */

			const finalDataByThirtyDay = await this.getDayData(30, 'contract');

			allGraphData.thirtyDay.push(...finalDataByThirtyDay);

			/** **************************************** */

			currentDate = new Date();
			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);

			graphData = (await getContractTxHourlyMinuteQuery(
				new Date(startDate),
				currentDate,
			)) as Array<{ hour: Date; count: number }>;
			const finalDataOneHour = (await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.oneHour.push(...finalDataOneHour);
			// const txCount = await RedisService.getString(
			// 	type === TRANSACTION_TYPE.COIN_TRANSFER
			// 		? REDIS_KEY.TOTAL_COIN_TRANSFER_TX
			// 		: REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX,
			// );
			//const counter = await ExlorerHelper.getContractDeloyedTxCount();

			const obj = {
				finalData: allGraphData,
				count: await prisma.contracts.count(),
			};

			SocketEventEmitter.emitMessage(socketEvent, obj);
			return true;
		} catch (err) {
			logger.error(
				'Error occured while handle Graph Data, coin and contract deployed tx',
			);
			return false;
		}
	}

	async handleAccountData(socketEvent: string) {
		try {
			let graphData;
			let currentDate;

			let startDate;
			const allGraphData: {
				oneDay: Array<{ createdAt: string; count: number }>;
				sevenDay: Array<{ createdAt: string; count: number }>;
				thirtyDay: Array<{ createdAt: string; count: number }>;
				oneHour: Array<{ createdAt: string; count: number }>;
			} = {
				oneDay: [],
				sevenDay: [],
				thirtyDay: [],
				oneHour: [],
			};

			/** ************************************ */
			currentDate = new Date();
			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			startDate = formatDate(oneDayAgo);
			graphData = (await getAccountHourlyQuery(
				startDate,
				currentDate,
			)) as Array<{ hour: Date; count: number }>;

			const finalDataByOneDay = (await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDate),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.oneDay.push(...finalDataByOneDay);

			/** ************************************ */

			const finalDataBySevenDay = await this.getDayData(7, 'account');
			allGraphData.sevenDay.push(...finalDataBySevenDay);

			/** **************************************** */

			const finalDataByThirtyDay = await this.getDayData(30, 'account');

			allGraphData.thirtyDay.push(...finalDataByThirtyDay);

			/** ************************************ */

			currentDate = new Date();
			const currentDateModi = formatDateByMin(new Date());
			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 1);
			startDate = formatDateByMin(oneHourAgo);
			graphData = (await getAccountHourlyMinuteQuery(
				new Date(startDate),
				currentDate,
			)) as Array<{ hour: Date; count: number }>;

			const finalDataOneHour = (await fillMissingMinutes(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.oneHour.push(...finalDataOneHour);

			/** ************************************ */

			// const accountCount = await RedisService.getString(
			// 	REDIS_KEY.TOTAL_ACCOUNT,
			// );

			//const counter = await ExlorerHelper.getUserCount();

			const obj = {
				finalData: allGraphData,
				//count: counter.data.count,
				count: await prisma.users.count(),
			};

			SocketEventEmitter.emitMessage(socketEvent, obj);
			return true;
		} catch (err) {
			logger.error(
				'error occured while handle Account Data , coin and contract deployed tx',
			);
			return false;
		}
	}

	async handleTokenData(socketEvent: string) {
		try {
			type Entry = object; // Define a type for the objects within the arrays

			type GroupData = {
				[key: string]: Array<Entry>;
			};

			interface PriceData {
				createdAt: Date;
				price: string;
			}

			const currentDate = new Date();

			const allGraphData: {
				oneDay: Array<{ createdAt: Date; price: string }>;
				sevenDay: Array<GroupData>;

				thirtyDay: Array<GroupData>;
				oneHour: Array<{ createdAt: Date; price: string }>;
			} = {
				oneDay: [],
				sevenDay: [],
				thirtyDay: [],
				oneHour: [],
			};

			const oneDayAgo = new Date();
			oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Subtract 1 day
			const startDateOneDay = formatDate(oneDayAgo);
			const hourlyPricesOneDay = await getTokenPriceGraph(
				new Date(startDateOneDay),
				currentDate,
			);

			const resultOneDay: PriceData[] = [];
			let lastHour: Date | null = null;

			for (const record of hourlyPricesOneDay) {
				if (!lastHour || (+record.createdAt - +lastHour) / 36e5 >= 1) {
					resultOneDay.push(record);
					lastHour = record.createdAt;
				}

				if (resultOneDay.length >= 24) {
					break;
				}
			}

			allGraphData.oneDay = resultOneDay;

			/** ************************************** */

			const sevenDaydaysAgo = 7;
			const fromDateSevenDay = new Date();
			fromDateSevenDay.setDate(
				fromDateSevenDay.getDate() - sevenDaydaysAgo,
			);
			const startDate = formatDate(fromDateSevenDay);
			const hourlyPrices = await getTokenPriceGraph(
				new Date(startDate),
				new Date(),
			);

			const groupedData: Record<
				string,
				Array<{ createdAt: Date; price: string }>
			> = {};

			hourlyPrices.forEach((entry) => {
				const date = entry.createdAt.toLocaleDateString();
				if (!groupedData[date]) {
					groupedData[date] = [];
				}
				groupedData[date].push(entry);
			});

			const result = Object.entries(groupedData).map(
				([date, entries]) => ({
					[date]: entries,
				}),
			);
			// const latestEntry = await prisma.coinmarketInfo.findFirst({
			// 	orderBy: {
			// 		createdAt: 'desc',
			// 	},
			// 	select: {
			// 		price: true,
			// 	},
			// });

			allGraphData.sevenDay = result;

			/** ************************************** */
			const thirtyDaysAgo = 30;
			const fromDateThirty = new Date(currentDate);
			fromDateThirty.setDate(fromDateThirty.getDate() - thirtyDaysAgo);
			const startDateThirty = formatDate(fromDateThirty);
			const hourlyPricesThirty = await getTokenPriceGraph(
				new Date(startDateThirty),
				currentDate, // new Date(endDate),
			);

			const groupedDataThirty: Record<
				string,
				Array<{ createdAt: Date; price: string }>
			> = {};

			hourlyPricesThirty.forEach(
				(entry: { createdAt: Date; price: string }) => {
					const date = entry.createdAt.toLocaleDateString();
					if (!groupedDataThirty[date]) {
						groupedDataThirty[date] = [];
					}
					groupedDataThirty[date].push(entry);
				},
			);

			const resultThirtyDay = Object.entries(groupedDataThirty).map(
				([date, entries]) => ({
					[date]: entries,
				}),
			);
			allGraphData.thirtyDay = resultThirtyDay;

			const latestEntryThirty = await prisma.coinmarketInfo.findFirst({
				orderBy: {
					createdAt: 'desc',
				},
				select: {
					price: true,
				},
			});

			//const counter = await ExlorerHelper.getTokensCount();

			const obj = {
				finalData: allGraphData,
				currentPrice: latestEntryThirty?.price ?? 0,
				count: await prisma.coinmarketInfo.count(),
			};
			SocketEventEmitter.emitMessage(socketEvent, obj);

			return true;
		} catch (err) {
			logger.error('error occurred while processing token price tx');
			return false;
		}
	}

	async handleAllTxData(socketEvent: string) {
		try {
			let graphData;
			let finalData;
			const allGraphData: {
				tenSecond: Array<{ createdAt: string; count: number }>;
				thirtyMinute: Array<{ createdAt: string; count: number }>;
				sixHour: Array<{ createdAt: string; count: number }>;
			} = {
				tenSecond: [],
				thirtyMinute: [],
				sixHour: [],
			};
			/** *******************minute******************************** */
			const currentDateByMinute = new Date();
			const currentDateModiOfMinute = formatDateByMin(new Date());
			const oneMinuteAgo = new Date();
			oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 30);
			const startDateByMinute = formatDateByMin(oneMinuteAgo);

			graphData = (await getMinTxQuery(
				new Date(startDateByMinute),
				currentDateByMinute,
			)) as Array<{
				hour: Date;
				count: number;
			}>;
			finalData = (await fillMissingMinutes(
				graphData,
				new Date(startDateByMinute),
				new Date(currentDateModiOfMinute),
			)) as Array<{ createdAt: string; count: number }>;

			allGraphData.thirtyMinute.push(...finalData);

			const currentDateByHour = new Date();

			const oneHourAgo = new Date();
			oneHourAgo.setHours(oneHourAgo.getHours() - 7);
			const startDateByHour = formatDate(oneHourAgo);

			graphData = (await getHourlyTxQuery(
				startDateByHour,
				currentDateByHour,
			)) as Array<{ hour: Date; count: number }>;
			finalData = (await fillMissingDatesWithZeroByhr(
				graphData,
				new Date(startDateByHour),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.sixHour.push(...finalData);

			const currentDateBySecond = new Date();
			const currentDateModi = formatDateBySec(new Date());
			const oneSecondAgo = new Date();
			oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 9);
			const startDate = formatDateBySec(oneSecondAgo);

			graphData = (await getSecTxQuery(
				new Date(startDate),
				currentDateBySecond,
			)) as Array<{
				second: Date;
				count: number;
			}>;
			finalData = (await fillMissingSeconds(
				graphData,
				new Date(startDate),
				new Date(currentDateModi),
			)) as Array<{ createdAt: string; count: number }>;
			allGraphData.tenSecond.push(...finalData);

			// const txCount = await RedisService.getString(REDIS_KEY.TOTAL_TX);
			//const counter = await ExlorerHelper.getTxCount();
			const obj = {
				finalData: allGraphData,
				count: await prisma.transactions.count(),
			};

			SocketEventEmitter.emitMessage(socketEvent, obj);
			return true;
		} catch (err) {
			logger.error('error occured while processing all tx');
			return false;
		}
	}

	async getDayData(period: number, type: string) {
		let graphData: Array<{ day: Date; count: number }> = [];
		const currentDate = new Date();
		const fromDateSeven = new Date(currentDate);
		fromDateSeven.setDate(fromDateSeven.getDate() - period);
		const startDate = formatDateForDay(fromDateSeven);
		if (type === 'account') {
			graphData = (await getAccountDailyQuery(
				startDate,
				currentDate,
			)) as Array<{ day: Date; count: number }>;
		} else if (type === 'contract') {
			graphData = (await getContractTxDailyQuery(
				startDate,
				currentDate,
			)) as Array<{ day: Date; count: number }>;
		} else if (type === 'TPS') {
			graphData = (await getTxDailyQuery(
				startDate,
				currentDate,
			)) as Array<{ day: Date; count: number }>;
		}
		const finalDataBySevenDay = await fillMissingDatesWithZeroByDay(
			graphData,
			new Date(startDate),
			currentDate,
		);

		return finalDataBySevenDay;
	}
}

export default new SocketHelper();
