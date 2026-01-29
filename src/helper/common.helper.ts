import axios, { AxiosResponse, Method, AxiosInstance } from 'axios';
import { ALLOCATIONS, TOTAL_SUPPLY } from '../constant/response';
import type { SupplyResult, Breakdown } from '../interface/index';
import logger from '../lib/logger';

import { getCurrentDateTime, roundToDecimals } from '../lib/utilities.helper';
import explorerHelper from './explorer.helper';

export const fetchRequest = async (
	url: string,
	data: { symbol: string; convert: string },
	_method: Method,
	headers: object,
) =>
	new Promise((resolve, reject) => {
		try {
			const { symbol } = data;
			axios
				.get(url, {
					params: data,
					headers,
				})
				.then((res: AxiosResponse) => {
					const coinMarketPrice = {
						price: res.data.data[symbol]?.quote?.USD.price,
						volume24h: res.data.data[symbol]?.quote.USD.volume_24h,
						marketCap: res.data.data[symbol]?.quote.USD.market_cap,
						circulatingSupply:
							res.data.data[symbol]?.circulating_supply,
						volumeChange24h:
							res.data.data[symbol]?.quote?.USD.volume_change_24h,
						percentChange1h:
							res.data.data[symbol]?.quote?.USD.percent_change_1h,
						percentChange24h:
							res.data.data[symbol]?.quote?.USD
								.percent_change_24h,
						percentChange7d:
							res.data.data[symbol]?.quote?.USD.percent_change_7d,
						percentChange30d:
							res.data.data[symbol]?.quote?.USD
								.percent_change_30d,
						self_reported_market_cap:
							res.data.data[symbol]?.self_reported_market_cap,
						self_reported_circulating_supply:
							res.data.data[symbol]
								?.self_reported_circulating_supply ?? 0,
					};

					resolve(coinMarketPrice);
				})
				.catch((err) => {
					console.log('err fetchRequest', err.message);
				});
		} catch (err) {
			logger.error(
				`\x1b[31mError in http request helper: ${err}\x1b[31m`,
			);
			reject(err);
		}
	});

export function calculateSupplyDetails(): SupplyResult {
	const currentDate = getCurrentDateTime();
	// const currentDate = new Date('2026-02-03T13:00:00.000Z');

	const breakdown: Breakdown = {};
	let totalUnlocked = 0;

	// Calculate unlocked amount for each allocation
	for (const [name, alloc] of Object.entries(ALLOCATIONS)) {
		const unlocked = explorerHelper.getUnlocked(name, alloc, currentDate);

		breakdown[name] = {
			unlocked: roundToDecimals(unlocked, 2),
			total: alloc.total,
			percentage:
				alloc.total > 0
					? roundToDecimals((unlocked / alloc.total) * 100, 4)
					: 0,
		};

		totalUnlocked += unlocked;
	}

	return {
		timestamp: currentDate.toISOString(),
		circulating_supply: roundToDecimals(totalUnlocked, 2),
		total_supply: TOTAL_SUPPLY,
		max_supply: TOTAL_SUPPLY,
		circulating_percentage: roundToDecimals(
			(totalUnlocked / TOTAL_SUPPLY) * 100,
			4,
		),
		locked_supply: roundToDecimals(TOTAL_SUPPLY - totalUnlocked, 2),
		breakdown,
	};
}

export function getCirculatingSupply(): number {
	const result = calculateSupplyDetails();
	return result.circulating_supply;
}
