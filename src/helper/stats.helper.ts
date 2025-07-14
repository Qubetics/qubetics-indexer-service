import axios from 'axios';
import moment from 'moment';
import { CMC_PATHS, CUSTOM_HEADERS, MILLI_IN_SEC, MILLI_UNITS, MIME_TYPES } from '../constant/constants';
import { TimeInterval } from '../interface/types';
import logger from '../lib/logger';

/**
 * TODO(GB1): Currently every method and function not using the clear returning pattern
 * need to implement a Result<T, E> pattern for return values on success and failure on
 * global level, currently i used a simple pattern on these below functions not ideal but
 * working on current use case
 *
 * TODO(GB2): Also need to implement or use single pattern library for performing and handling
 * http requets wrapper or class that will handle all http requets project wide can usage axios
 * internally but need to add a wrapper around so error can be handled clearly and can also
 * usage the above GB1 todo.
 * */

/**
 * Get the historical price point in usd based on start and end time points
 * @param startTime Start time point of records
 * @param endTime End time point of records
 * @param interval Interval of data (default: daily)
 * @returns
 */
export const getCoinPriceDataFromMarket = async (startTime:string, endTime:string, interval='daily') => {
	try {
	const { symbol, currency, coinMarketApi, coinMarketKey } = environment;
      // TODO(URL1): Need to create a small lib for parsing http urls for safely use.
            const params = {
                symbol,
                interval,
                convert: currency,
                time_start: startTime,
                time_end: endTime
            };            

			const historicalPriceData = await axios.get(
				`${coinMarketApi}${CMC_PATHS.CRYPTOCURRENCY_QUOTES}${CMC_PATHS.HISTORICAL}`,
				{
					params,
					headers: {
					accept: MIME_TYPES.JSON,
					[CUSTOM_HEADERS.CMC_API_KEY]: coinMarketKey,
					}
				});
                
                const dataQuotes = historicalPriceData?.data?.data?.quotes;
                if(!dataQuotes) {
                    // TODO(LOG1): Need to reimplement the logger for showing objects and other logs more accurately and also show a timestamp
                    logger.warn('Quotes Missing from response, due to some issue in request');
                    console.warn('Missing quotes response body: ', historicalPriceData?.data);
                    return [];
                }

                const chartPoints = dataQuotes.map((item:any) => ({ date: item.timestamp, value: item.quote.USD.price }));

                return chartPoints;

	} catch (err:any) {
		logger.error('Error while getting coin price form market\n');
		if(err?.response) logger.error(err.response.data); else logger.error(err);
        return [];
	}
};

/**
 * OPTIMISE(T1): Need to look again and refactor a little bit
 * Generate the zero filled chart points
 * @param startTime Time from points need to be generated
 * @param count Points need to be generated from startTime
 * @param interval Interval of chart points eg: day | month | year
 */
export const generateZeroFilledChartPoints = (startTime:number | Date | string, count:number = 30, interval:TimeInterval = 'day') => {
    const _startDateTime =  moment(startTime).utc().startOf('day').startOf(interval);

    return Array.from({ length: count }, (_, i) => ({ date: _startDateTime.add(i === 0 ? 0 : 1, interval).utc().toISOString(), value: 0 }));
};