import axios, { AxiosInstance } from 'axios';
import * as cron from 'cron';
import { CONST_NAME, REDIS_KEY } from '../constant/response';
import ExlorerHelper from '../helper/explorer.helper';

import socketHelper from '../helper/socket.helper';
import { calculateData, getValidatorsInfo } from '../helper/validator.helper';

const { CronJob } = cron;
const apiUrl = environment.evmHost;
let apiRes: AxiosInstance;

class CronService {
	constructor() {
		apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			timeout: CONST_NAME.THOUSAND,
		});
	}

	public checkPendingTransaction() {
		new CronJob(
			'*/30 * * * *', // will run every 30 min.
			async () => {
				await ExlorerHelper.checkTransactionStatus();
			},
			null,
			true,
			'America/Los_Angeles',
		);
	}

	public async saveTokenPrice() {
		async function fetchData() {
			await ExlorerHelper.saveTokenPriceByDate();
			setTimeout(fetchData, 60 * 60 * 1000); // Schedule the function to run again in 1 hour (60 minutes * 60 seconds * 1000 milliseconds)
		}

		// Call the function initially to start the scheduling
		await fetchData();
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
}

export default new CronService();
