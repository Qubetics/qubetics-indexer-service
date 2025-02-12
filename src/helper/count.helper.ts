import { REDIS_KEY, TRANSACTION_TYPE } from '../constant/response';
import { StatsType } from '../interface';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import { RedisService } from '../service';
import redisHelper from '../service/redis.helper';

class CountHelper {
	static instance: CountHelper;

	counts: any;

	constructor() {
		if (!CountHelper.instance) CountHelper.instance = this;
		return CountHelper.instance;
	}

	/**
	 * Initialize the count from database
	 * (must be executed when service is started)
	 */
	initializeCount = async () => {
		const [
			blockCount,
			txCount,
			addressCount,
			deployedContractCount,
			coinTranferTxnCount,
		] = await Promise.all([
			prisma.blocks.count(),
			prisma.transactions.count(),
			prisma.users.count(),
			prisma.contracts.count(),
			prisma.transactions.count({
				where: {
					type: TRANSACTION_TYPE.COIN_TRANSFER,
				},
			}),
		]);

		// set the counts in memory for quick read
		this.counts = {
			blockCount,
			txCount,
			addressCount,
			deployedContractCount,
			coinTranferTxnCount,
		};

		// add the count in redis (for quick read if service is crashed or restarted)
		await Promise.all([
			RedisService.setString(REDIS_KEY.BLOCKS_COUNT, blockCount),
			RedisService.setString(REDIS_KEY.TRANSACTIONS_COUNT, txCount),
			RedisService.setString(REDIS_KEY.TOTAL_ADDRESSES, addressCount),
			RedisService.setString(
				REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX,
				deployedContractCount,
			),
			RedisService.setString(
				REDIS_KEY.TOTAL_COIN_TRANSFER_TX,
				coinTranferTxnCount,
			),
		]);
	};

	/**
	 * Update the latest count for different data tables
	 */
	updateLatestCount = async (countPayload: StatsType) => {
		try {
			let _redisPayload;
			const _count = countPayload?.txnCount ? countPayload.txnCount : 1;

			switch (countPayload.type) {
				// Coin transactions count updation
				case REDIS_KEY.CoinTransferTxHistory:
					_redisPayload = this._updateInMemory(
						'coinTranferTxnCount',
						REDIS_KEY.TOTAL_COIN_TRANSFER_TX,
						_count,
					);
					break;
				// Deployed contract count updation
				case REDIS_KEY.ContractDeploymentHistory:
					_redisPayload = this._updateInMemory(
						'deployedContractCount',
						REDIS_KEY.TOTAL_CONTRACT_DEPLOYED_TX,
						_count,
					);
					break;
				// Public addresses count updation
				case REDIS_KEY.NewAccountHistory:
					_redisPayload = this._updateInMemory(
						'addressCount',
						REDIS_KEY.TOTAL_ADDRESSES,
						_count,
					);
					break;

				default:
					logger.info(
						`No count updation implemented for ${countPayload.type}`,
					);
					return false;
			}

			if (_redisPayload?.key && _redisPayload.count)
				await redisHelper.setString(
					_redisPayload.key,
					_redisPayload.count,
				);
			else
				logger.info(
					`Inmemory count not found for related key \'${countPayload.type}\'`,
				);

			return false;
		} catch (err) {
			console.error(
				'Error while updating the latest total data count\n',
				err,
			);
			return true;
		}
	};

	// *************************** Internals **************************
	_updateInMemory = (countKey: string, key: string, count: number) => {
		if (!this.counts[countKey]) return null;
		const redisPayload = { key: '', count: 0 };
		this.counts[countKey] += count;

		redisPayload.count += this.counts[countKey];
		redisPayload.key = key;
		console.log('Redis Payload: ', redisPayload);

		return redisPayload;
	};
}
export default new CountHelper();
