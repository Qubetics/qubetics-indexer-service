import axios, { AxiosResponse, Method, AxiosInstance } from 'axios';
import logger from '../lib/logger';

const fetchRequest = async (
	url: string,
	data: { symbol: string; convert: string },
	_method: Method,
	headers: object,
) => {
	try {
		const { symbol } = data;

		const res: AxiosResponse = await axios.get(url, {
			params: data,
			headers,
		});

		const coinData = res.data.data[symbol]?.quote?.USD || {};

		return {
			price: coinData.price,
			volume24h: coinData.volume_24h,
			marketCap: coinData.market_cap,
			circulatingSupply: res.data.data[symbol]?.circulating_supply,
			volumeChange24h: coinData.volume_change_24h,
			percentChange1h: coinData.percent_change_1h,
			percentChange24h: coinData.percent_change_24h,
			percentChange7d: coinData.percent_change_7d,
			percentChange30d: coinData.percent_change_30d,
			self_reported_market_cap:
				res.data.data[symbol]?.self_reported_market_cap,
			self_reported_circulating_supply:
				res.data.data[symbol]?.self_reported_circulating_supply,
		};
	} catch (err: any) {
		logger.error(
			`\x1b[31mError in http request helper: ${err.message}\x1b[31m`,
		);
		throw err;
	}
};

export { fetchRequest };
