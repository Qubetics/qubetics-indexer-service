import crypto from 'crypto';
import axios, { AxiosResponse, Method } from 'axios';
import { STATIC_BURNED_AMOUNT } from '../constant/constants';
import {
	CONST_NAME,
	REDIS_KEY,
	RES_MSG,
	TRANSACTION_TYPE,
} from '../constant/response';
import { CoinMarketData, ITimeStamp } from '../interface/index';
import { RedisService } from '../service';
import redisHelper from '../service/redis.helper';
import { prisma } from './db';
import logger from './logger';
import { calculateSupplyDetails } from '../helper/common.helper';

export function isEven(n: number) {
	const res = n % 2 === 0;
	return res ?? false;
}

export function exp(val: string): string {
	const data = String(val).split(/[eE]/);
	if (data.length === 1) return data[0];
	let z = '';
	const sign = +val < 0 ? '-' : '';
	const str = data[0].replace('.', '');
	let value = Number(data[1]) + 1;
	if (value < 0) {
		z = `${sign}0.`;
		while (value < 0) {
			z += '0';
			value += 1;
		}

		return z + str.replace('-', '');
	}
	value -= str.length;
	while (value < 0) {
		z += '0';
		value += 1;
	}
	return str + z;
}

// export const defineNoExpo = () => {

export const noExponent = function (num: number | string) {
	try {
		const data = String(num).split(/[eE]/);
		if (data.length === 1) return data[0];
		let z = '';
		const sign = Number(num) < 0 ? '-' : '';
		const str = data[0].replace('.', '');
		let mag = Number(data[1]) + 1;
		if (mag < 0) {
			z = `${sign}0.`;
			while (mag++) z += '0';
			return z + str.replace(/^\-/, '');
		}
		mag -= str.length;
		while (mag--) z += '0';
		// console.log('str + z : ', str + z);

		return str + z;
	} catch (error) {
		// console.log('Exponent error', error);
		return '0';
	}
};

export function txType(toAddress: string, inputLength: string) {
	let type;

	if (inputLength.length > 2 && (toAddress === 'null' || !toAddress)) {
		type = TRANSACTION_TYPE.CONTRACT_CREATION;
	} else if (toAddress && inputLength.length > 2) {
		type = TRANSACTION_TYPE.CONTRACT_TRANSFER;
	} else {
		type = TRANSACTION_TYPE.COIN_TRANSFER;
	}
	return type;
}

export function isExponentialNumber(str: string) {
	return str.includes('e');
}

export function getDigitsAfterE(scientificNotation: string) {
	const parts = scientificNotation.split(/e-|e\+/);
	const exponentPart = parts[1];

	const twoDigitsAfterE = exponentPart.substring(0, 2);
	const numericValue = parseInt(twoDigitsAfterE, 10);
	return numericValue;
}

export async function fillMissingDatesWithZeroByhr(
	graphData: Array<{ hour: Date; count: number }>,
	startDate: Date,
) {
	startDate.setHours(startDate.getHours() + 1);

	const minTimestamp = new Date(startDate).getTime();
	const maxTimestamp = new Date().getTime();

	// Create a range of hours between the earliest and latest timestamps
	const rangeOfHours = [];
	for (
		let timestamp = minTimestamp;
		timestamp <= maxTimestamp;
		timestamp += 3600000
	) {
		rangeOfHours.push(new Date(timestamp).toISOString());
	}

	// Create a map to store the counts by hour for efficient lookup
	const countsMap = new Map(rangeOfHours.map((hour) => [hour, 0]));

	graphData.forEach((item: { hour: Date; count: number }) => {
		const hour = new Date(item.hour).toISOString();
		countsMap.set(hour, item.count);
	});

	// Initialize a new list to store the modified data
	const modifiedData = rangeOfHours.map((hour) => {
		const count = countsMap.get(hour);
		return { createdAt: hour, count };
	});
	return modifiedData;
}

export async function fillMissingDatesWithZeroByDay(
	data: Array<{ day: Date; count: number }>,
	startDate: Date,
	currentDateVal: Date,
) {
	startDate.setDate(startDate.getDate() + 1); // including startDate itself.
	const dateMap = new Map(
		data.map((item) => [item.day.toISOString(), item.count]),
	);
	const result = [];
	const currentDate = new Date(startDate);

	// Calculate the number of days between the startDate and the last date in your data
	const daysDifference = Math.floor(
		(+currentDateVal - +currentDate) / (24 * 60 * 60 * 1000),
	);

	for (let i = 0; i <= daysDifference; i += 1) {
		const currentDateIOS = currentDate.toISOString();
		const count = dateMap.get(currentDateIOS) || 0;
		result.push({ createdAt: currentDateIOS, count });

		currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
	}

	return result;
}

export async function fillMissingMinutes(
	inputData: Array<{ hour: Date; count: number }> | [],
	startMinute: Date,
	endMinute: Date,
) {
	startMinute.setMinutes(startMinute.getMinutes() + 1);
	const fromTime = startMinute;
	const toTime = endMinute;

	// Generate an array of timestamps with minute intervals
	const timestamps = [];
	const currentTime = new Date(fromTime);
	while (currentTime <= toTime) {
		timestamps.push(new Date(currentTime));
		currentTime.setMinutes(currentTime.getMinutes() + 1);
	}

	// Create an object to store the result
	const result: ITimeStamp = {};

	// Initialize the result object with zeros
	timestamps.forEach((timestamp: Date) => {
		result[timestamp.toISOString()] = 0;
	});
	// Update the result object with counts from the input data
	inputData.forEach((data) => {
		const dataTime = new Date(data.hour).toISOString();
		if (result[dataTime] === 0) {
			result[dataTime] = data.count;
		}
	});

	// Convert the result object back to an array of objects
	const resultArray = Object.keys(result).map((timestamp) => ({
		createdAt: timestamp,
		count: result[timestamp],
	}));
	return resultArray;
}

export async function fillMissingSeconds(
	data: Array<{ second: Date; count: number }>,
	startTime: Date,
	endTime: Date,
) {
	const newData = [];
	const currentTime = new Date(startTime);

	while (currentTime <= endTime) {
		const matchingData = data.find(
			(item) => item.second.getTime() === currentTime.getTime(),
		);
		if (matchingData) {
			const secondVal = {
				createdAt: matchingData.second,
				count: matchingData.count,
			};
			newData.push(secondVal);
		} else {
			newData.push({
				createdAt: new Date(currentTime).toString(),
				count: 0,
			});
		}

		currentTime.setSeconds(currentTime.getSeconds() + 1);
	}

	return newData;
}

export function formatDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:00:00.000Z`;
}

export function formatDateForDay(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	// const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T00:00:00.000Z`;
}

export function formatDateByMin(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
}

export function formatDateBySec(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}

export async function fetchRequest(
	url: string,
	data: { symbol: string; convert: string },
	method: Method,
	headers: object,
): Promise<CoinMarketData> {
	return new Promise((resolve, reject) => {
		const { symbol } = data;

		axios
			.get(url, {
				params: data,
				headers,
			})
			.then((res: AxiosResponse) => {
				const coinMarketPrice = {
					price: res.data.data[symbol].quote.USD.price,
					volume24h: res.data.data[symbol].quote.USD.volume_24h,
					marketCap: res.data.data[symbol].quote.USD.market_cap,
					circulatingSupply: res.data.data[symbol].circulating_supply,
				};

				resolve(coinMarketPrice);
			})
			.catch((err) => {
				logger.error(err.response.data.status.error_message);
				reject(new Error(err.response.data.status.error_message));
			});
	});
}

export async function fillMissingDatesWithZeroByMonthV1(
	data: Array<{ month: Date; count: number }>,
	startDate: Date,
	currentDateVal: Date,
) {
	startDate.setMonth(startDate.getMonth() + 1);
	const dateMap = new Map(
		data.map((item) => [item.month.toISOString(), item.count]),
	);
	const result = [];
	const currentDate = new Date(startDate);

	// Calculate the number of months between the startDate and the last date in your data
	const monthsDifference =
		(currentDateVal.getFullYear() - currentDate.getFullYear()) * 12 +
		currentDateVal.getMonth() -
		currentDate.getMonth();

	for (let i = 0; i <= monthsDifference; i += 1) {
		const currentDateISO = currentDate.toISOString();
		const count = dateMap.get(currentDateISO) || 0;
		result.push({ createdAt: currentDateISO, count });

		currentDate.setMonth(currentDate.getMonth() + 1); // Move to the next month
	}

	return result;
}

export function formatDateForYear(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	// const day = String(date.getUTCDate()).padStart(2, '0');
	// const hours = String(date.getUTCHours()).padStart(2, '0');
	// const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	// const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-01T00:00:00.000Z`;
}

// Function to hash a string
export function hashString(str: string, algorithm: string = 'sha256') {
	return crypto.createHash(algorithm).update(str).digest('hex');
}

export async function fillMissingDatesWithZeroByMonth(
	records: Array<{ month: Date; count: number }>,
	startDate: Date,
	endDate: Date,
) {
	const filledRecords = [];
	startDate.setMonth(startDate.getMonth() + 1);
	const currentDate = new Date(startDate);

	// Set time to start of the day to avoid time component discrepancies
	currentDate.setHours(0, 0, 0, 0);

	// Convert endDate to the end of the month
	const endOfMonth = new Date(endDate);
	endOfMonth.setDate(1);
	endOfMonth.setMonth(endOfMonth.getMonth() + 1);
	endOfMonth.setDate(0);

	let currentIndex = 0;
	let currentRecord = records[currentIndex];

	while (currentDate <= endOfMonth) {
		if (
			currentRecord &&
			currentRecord.month.getFullYear() === currentDate.getFullYear() &&
			currentRecord.month.getMonth() === currentDate.getMonth()
		) {
			const resExist = {
				createdAt: currentRecord.month,
				count: currentRecord.count,
			};
			filledRecords.push(resExist);
			currentIndex++;
			currentRecord = records[currentIndex];
		} else {
			const cDate = new Date(currentDate);
			filledRecords.push({ createdAt: cDate, count: 0 });
		}

		// Move to the next month
		currentDate.setMonth(currentDate.getMonth() + 1);
	}

	return filledRecords;
}

export async function formatTheDate(getDateTime: any) {
	const year = getDateTime.getUTCFullYear();
	const month = String(getDateTime.getUTCMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
	const day = String(getDateTime.getUTCDate()).padStart(2, '0');
	const hours = String(getDateTime.getUTCHours()).padStart(2, '0');
	const minutes = String(getDateTime.getUTCMinutes()).padStart(2, '0');
	const seconds = String(getDateTime.getUTCSeconds()).padStart(2, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function deepCopy<T>(obj: T): T {
	// for faster clone (*note: only work on nodejs 17+)
	// @ts-expect-error structuredClone is not supported in below nodejs v17
	if (global.structuredClone) return structuredClone(obj);

	if (obj === null || typeof obj !== 'object') return obj;
	if (Array.isArray(obj)) return obj.map(deepCopy) as T;

	const copy = {} as T;
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			copy[key] = deepCopy(obj[key]);
		}
	}
	return copy;
}

export const getGroupedTransactions = async (
	from: Date,
	to: Date,
	interval: 'hour' | 'day' | 'month',
): Promise<{ time: Date; count: number }[]> => {
	const groupBy = interval;
	const result = await prisma.$queryRaw<{ time: Date; count: number }[]>`
    SELECT DATE_TRUNC(${groupBy}, "timestamp") AS time, COUNT(*)::int AS count
    FROM "Transactions"
    WHERE "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY time
    ORDER BY time;
  `;
	return result;
};

export function convertBigIntToNumber(dataVal: any): any {
	if (typeof dataVal === 'bigint') {
		return Number(dataVal);
	}

	if (Array.isArray(dataVal)) {
		return dataVal.map(convertBigIntToNumber);
	}

	// if (dataVal !== null && typeof dataVal === 'object') {
	// 	const result: any = {};
	// 	for (const key in dataVal) {
	// 		if (Object.prototype.hasOwnProperty.call(dataVal, key)) {
	// 			const value = dataVal[key];
	// 			result[key] = convertBigIntToNumber(value);
	// 		}
	// 	}
	// 	return result;
	// }

	if (dataVal !== null && typeof dataVal === 'object') {
		return Object.fromEntries(
			Object.entries(dataVal).map(([key, value]) => {
				if (
					(key === 'block_timestamp' ||
						key === 'timestamp' ||
						key === 'created_at' ||
						key === 'updated_at' ||
						key === 'createdAt' ||
						key === 'updatedAt') &&
					value instanceof Date
				) {
					return [key, value.toISOString()]; // Convert block_timestamp to string
				}
				return [key, convertBigIntToNumber(value)];
			}),
		);
	}

	return dataVal;
}

export function serializeBigInt(dataVal: any): any {
	if (typeof dataVal === 'bigint') {
		return dataVal.toString();
	}
	if (Array.isArray(dataVal)) {
		return dataVal.map(convertBigIntToNumber);
	}
	if (dataVal !== null && typeof dataVal === 'object') {
		return Object.fromEntries(
			Object.entries(dataVal).map(([key, value]) => {
				if (
					(key === 'block_timestamp' ||
						key === 'timestamp' ||
						key === 'created_at' ||
						key === 'updated_at' ||
						key === 'createdAt' ||
						key === 'updatedAt') &&
					value instanceof Date
				) {
					return [key, value.toISOString()]; // Convert block_timestamp to string
				}
				return [key, convertBigIntToNumber(value)];
			}),
		);
	}
	return dataVal;
}

export async function calculateBurnedAmount() {
	// initialSupply: number = environment.initialSupply,
	// CurrentSupply: number,

	try {
		const apiUrl = environment.evmHost;

		const getSupply: any = await axios.get(
			`${apiUrl}/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.symbol.toLowerCase()}`,
		);

		const { initialSupply } = environment;
		const circulation_supply: number =
			Number(getSupply.data.amount.amount) / CONST_NAME.ETH_EXP;

		const returnValue = initialSupply - circulation_supply;
		return returnValue;
	} catch (error) {
		console.log(error, 'error in calculateBurnedAmount');
		return false;
	}
}

export async function getTotalSupply() {
	try {
		let burnedAmount: number = await redisHelper.getString(
			REDIS_KEY.TOTAL_BURNED_AMOUNT,
		);

		if (!burnedAmount) {
			/** save burned fees */
			burnedAmount = await getBurnedAmount();
			await redisHelper.setString(
				REDIS_KEY.TOTAL_BURNED_AMOUNT,
				burnedAmount,
			);
		}

		const { initialSupply } = environment;

		const totalSupply = initialSupply - burnedAmount;

		return totalSupply;
	} catch (err) {
		logger.error('dashboard-Error', err);
		return false;
	}
}

export async function calculateCirculatingSupply() {
	try {
		let circulatingSupply = await RedisService.getString(
			REDIS_KEY.CIRCULATING_SUPPLY,
		);
		if (!circulatingSupply) {

			const supplyDetails = await calculateSupplyDetails();
				circulatingSupply = supplyDetails.circulating_supply;

			// const circulationSupplyUrl = environment.nativeAPIUrl;
			// const result = await axios.get(
			// 	`${circulationSupplyUrl}/explorer/circulation-supply`,
			// );

			// console.log(result.data.data.circulationSupply, 'CRCLFRMNATIVE');
			// circulationSupply = result?.data?.data?.circulationSupply;
			await RedisService.setStringWithExpiry(
				REDIS_KEY.CIRCULATING_SUPPLY,
				circulatingSupply,
				600,
			);
		}

		return circulatingSupply;
	} catch (err) {
		logger.error('dashboard-Error', err);
		return 0;
	}
}

export async function getBurnedAmount() {
	try {
		const burnedAmount: any = await prisma.transactions.aggregate({
			_sum: {
				burnedFee: true,
			},
		});

		if (burnedAmount) {
			return (
				Number(burnedAmount?._sum.burnedFee) +
				Number(STATIC_BURNED_AMOUNT)
			);
		}
		return Number(STATIC_BURNED_AMOUNT);
	} catch (error) {
		console.log(error, 'error in getBurnedAmount');
		return STATIC_BURNED_AMOUNT;
	}
}


/**
 * Utility Helper Functions
 */

/**
 * Add calendar months to a date, handling month-end edge cases.
 *
 * @param date - The starting date
 * @param months - Number of months to add
 * @returns New date with months added
 *
 * @example
 * addMonths(new Date('2025-01-31'), 1) // Returns 2025-02-28
 * addMonths(new Date('2025-01-15'), 3) // Returns 2025-04-15
 */
export function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const currentMonth = result.getMonth();
	const currentDay = result.getDate();

	result.setMonth(currentMonth + months);

	// Handle edge case where day doesn't exist in target month (e.g., Jan 31 + 1 month)
	if (result.getDate() !== currentDay) {
		result.setDate(0); // Set to last day of previous month
	}

	return result;
}

/**
 * Get current date normalized to 13:00 UTC.
 * All token unlocks happen at 13:00 UTC daily.
 *
 * @returns Current date at 13:00:00.000 UTC
 */
export function getCurrentDateTime(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			13,
			0,
			0,
			0,
		),
	);
}

/**
 * Round a number to specified decimal places.
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
	const multiplier = 10 ** decimals;
	return Math.round(value * multiplier) / multiplier;
}
