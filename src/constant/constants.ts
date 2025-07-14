// TODO(GB3): Need to create a class or wrapper that include all
// constants related to date-time and date-time
export const MILLI_IN_SEC = 1000;
export const MILLI_IN_MIN = MILLI_IN_SEC * 60;
export const MILLI_IN_HOUR = MILLI_IN_MIN * 60;
export const MILLI_IN_DAY = MILLI_IN_HOUR * 24;
export const REDIS_STATS_UPDATION_CRONTIME = '0 */1 * * * *';
export const REDIS_STATS_CRON_KEY = 'REDIS_STATS_UPDATE';
export const CURRENT_DEFAULT_COIN_PRICE = 0.337097;

export const DAYS = Object.freeze({
	SUNDAY: 0,
	MONDAY: 1,
	TUESDAY: 2,
	WEDNESDAY: 3,
	THURSDAY: 4,
	FRIDAY: 5,
	SATURDAY: 6,
});

export const MILLI_UNITS: Record<string, number> = {
	mintue: 60000,
	hourly: 60000 * 60,
	daily: 60000 * 60 * 24,
	monthly: 60000 * 60 * 24 * 31,
};

// cron timers for different time points
export const CRON_TIME: Record<string, string> = {
	mintue: '0 */1 * * * *',
	hourly: '0 0 */1 * * *',
	daily: '0 0 0 */1 * *',
	monthly: '0 0 0 1 */1 *',
};

export const DATA_TIME_POINTS = {
	MIN: 'mintue',
	HOUR: 'hourly',
	DAY: 'daily',
	MONTH: 'monthly',
};

export const TIME_UNITS = {
	SEC: 'second',
	MIN: 'mintue',
	HOUR: 'hour',
	DAY: 'day',
	MONTH: 'month',
	YEAR: 'year'
};

export const VERIFICATION_TYPE = {
	INITIAL: -2,
	REJECTED: -1,
	PENDING: 0,
	PARTIAL_VERIFIED: 1,
	FULLY_VERIFIED: 2,
};

// MIME types
export const MIME_TYPES = {
	JSON: 'application/json',
	URL_ENCODED: 'application/x-www-form-urlencoded'
};

// Frequently used headers keys
export const CUSTOM_HEADERS = {
	'CMC_API_KEY': 'X-CMC_PRO_API_KEY'
};

// Coin Market Cap paths (OPTIMISE(C1): We can also usage a json config file or environment variables)
// TODO(CMC1): We can also create a helper class or small lib to make request to specfic paths of coin market cap
export const CMC_PATHS = {
	CRYPTOCURRENCY_QUOTES: '/v1/cryptocurrency/quotes',
	LATEST: '/latest',
	HISTORICAL: '/historical'
};