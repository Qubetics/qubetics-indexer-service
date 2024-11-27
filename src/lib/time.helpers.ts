import { MILLI_UNITS } from '../constant/constants';
import { StatsTimeType } from '../interface/types';

export const getMillisecondByStatsTime = (type: StatsTimeType) => {
	if (MILLI_UNITS[type]) return MILLI_UNITS[type];
	return 0;
};

export const getStatsTimeoutDiff = (
	dateTime: string,
	type: StatsTimeType,
	currentTimestamp = Date.now(),
): number => {
	const timeStamp = new Date(dateTime).getTime();
	const additionalTime = getMillisecondByStatsTime(type);
	const timeDiffInMilliWithDelay =
		timeStamp + additionalTime - currentTimestamp;
	return timeDiffInMilliWithDelay;
};

export const getStartTimePointByType = (
	type: string,
	timeStamp: number,
): number => {
	const _tempDate = new Date(timeStamp);
	switch (type) {
		case 'mintue':
			return _tempDate.setUTCMinutes(_tempDate.getUTCMinutes(), 0, 0);
		case 'hourly':
			return _tempDate.setUTCHours(_tempDate.getUTCHours(), 0, 0, 0);
		case 'daily':
			return _tempDate.setUTCHours(0, 0, 0, 0);
		default:
			return 0;
	}
};

export const generateTimeRangesFromObj = (
	currentStatsPoints: Record<string, any>,
) => {
	const _tempTimePoints: Record<string, any> = {};

	Object.keys(currentStatsPoints).forEach((key) => {
		const tempRange = generateTimeRange(
			key,
			currentStatsPoints[key].createdAt,
		);
		_tempTimePoints[key] = {
			data: currentStatsPoints[key],
			timeStampRange: tempRange,
		};
	});
	return _tempTimePoints;
};

export const generateTimeRange = (
	type: StatsTimeType,
	dateTime: string | number,
) => {
	const tempDate =
		typeof dateTime === 'number' ? dateTime : new Date(dateTime).getTime();
	return { start: tempDate, end: tempDate + getMillisecondByStatsTime(type) };
};
