import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { bech32 } from 'bech32';
import { RES_MSG, CONST_NAME, REDIS_KEY } from '../constant/response';
import {
	BlockHeader,
	Params,
	ValidatorDelegations,
	ValidatorInfo,
} from '../interface/index';
import logger from '../lib/logger';
import { getDigitsAfterE } from '../lib/utilities.helper';
import { RedisService, SocketEventEmitter } from '../service';
import ExlorerHelper from './explorer.helper';

// Fetch various parameters needed for calculations
async function getParams(apiRes: AxiosInstance): Promise<Params | false> {
	try {
		const [
			validatorResponse,
			circulationSupplyResponse,
			inflationRateResponse,
			poolResponse,
			paramsResponse,
			total_Supply,
			annualProvision,
		] = await Promise.all([
			apiRes.get('/cosmos/staking/v1beta1/validators'),
			apiRes.get(
				`/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.symbol.toLowerCase()}`,
			),
			apiRes.get('/cosmos/mint/v1beta1/inflation'),
			apiRes.get('/cosmos/staking/v1beta1/pool'),
			apiRes.get('/cosmos/distribution/v1beta1/params'),
			apiRes.get('/cosmos/bank/v1beta1/supply'),
			apiRes.get('/cosmos/mint/v1beta1/annual_provisions'),
		]);

		// Filter active validators
		const activeValidator = validatorResponse?.data?.validators.filter(
			(item: any) => item.status === CONST_NAME.BOND_STATUS,
		);
		if (activeValidator?.length === 0) {
			return false;
		}
		const totalValidator: number | undefined =
			validatorResponse?.data?.validators?.length;
		if (totalValidator === undefined) {
			return false;
		}
		const circulation_supply: number =
			Number(circulationSupplyResponse.data.amount.amount) /
			CONST_NAME.ETH_EXP;

		const inflation = Number(inflationRateResponse.data.inflation);

		let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
		blocksPerYear = Number(blocksPerYear / 2);

		// const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);
		const bondedTokens =
			Number(poolResponse.data.pool.bonded_tokens) / 10 ** 18;

		const annualProvisions = annualProvision.data.annual_provisions;

		const totalSupply = total_Supply.data.supply[0].amount;
		// const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);

		// const bondedRate = Number(
		// 	((bondedTokens / totalSupply) * 100).toFixed(3),
		// );
		// const bondedRate = Number(bondedTokens / totalSupply) * 100;
		const bondedRate = Number((bondedTokens / circulation_supply) * 100);

		const communityTax = Number(paramsResponse.data.params.community_tax);

		return {
			annualProvisions,
			blocksPerYear,
			inflation,
			bondedTokens,
			communityTax,
			activeValidator: activeValidator?.length,
			totalValidator,
			circulation_supply,
			bondedRate,
			total_supply: totalSupply,
		};
	} catch (error) {
		console.log(error, 'Print error here');
		logger.log('error occurred while calculating stake APR', error);
		return false;
	}
}

// Calculate Annual Percentage Yield (APY) based on parameters
function calculateAPY(
	inflation: number,
	bondedRate: number,
	communityTax: number,
): number {
	const apy = Number(
		((inflation / bondedRate) * (1 - communityTax) * 100).toFixed(2),
	);
	return apy;
}

const calculateData = async (): Promise<
	| {
			validator: number;
			totalValidator: number;
			bondedRate: number;
			apy: number;
	  }
	| { error: boolean; message: string }
> => {
	try {
		const apiUrl = environment.evmHost;
		const apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			// timeout: CONST_NAME.THOUSAND,
			timeout: 5000,
		});

		const params = await getParams(apiRes);
		if (!params) throw new Error(RES_MSG.APR_VALUE_ERROR);
		const apyValue = calculateAPY(
			Number(params.inflation),
			Number(params.bondedRate / 100),
			params.communityTax,
		);

		// const validatorData = {
		// 	validator: params?.activeValidator,
		// 	totalValidator: params?.totalValidator,
		// 	bondedRate: params?.bondedRate,
		// 	apy: apyValue,
		// };

		const validatorData = {
			validator: params?.activeValidator,
			totalValidator: params?.totalValidator,
			bondedRate: params?.bondedRate,
			apy: apyValue,
			totalSupply: params?.total_supply,
			inflation: Number(params?.inflation),
			circulating_supply: params?.circulation_supply,
		};

		await RedisService.setString(
			REDIS_KEY.VALIDATOR_DATA,
			JSON.stringify(validatorData),
		);
		return validatorData;
	} catch (err) {
		logger.log('error', 'Error occurred while calculating stake APY', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return { error: true, message: RES_MSG.APR_VALUE_ERROR };
	}
};

/**
 *  Fetch delegations for a specific validator address
 * @param apiRes
 * @param address
 * @returns
 */
async function getValidatorStakeDetails(
	apiRes: AxiosInstance,
	address: string,
): Promise<ValidatorDelegations> {
	const response: AxiosResponse = await apiRes.get(
		`/cosmos/staking/v1beta1/validators/${address}/delegations`,
	);
	return response.data;
}

/**
 *  Process and update information for each validator
 * @param apiRes
 * @returns
 */
async function getValidatorsInfo(
	apiRes: AxiosInstance,
): Promise<ValidatorInfo[] | { error: boolean; message: string }> {
	try {
		const response: AxiosResponse = await apiRes.get(
			'/cosmos/staking/v1beta1/validators',
		);
		const validators: ValidatorInfo[] = [];
		const validatorAddresses: string[] = [];
		let selfStakeValue = 0;
		console.log('LWNGHT', response?.data?.validators?.length);
		for (let i = 0; i < response?.data?.validators?.length; i++) {
			console.log('i ki value:', i);
			const validator = response.data.validators[i];

			const validatorOperaterAddress = validator.operator_address;

			const decodeAddress = bech32.decode(validatorOperaterAddress);
			const address = bech32.encode(
				environment.delegatorPrefix,
				decodeAddress.words,
			);

			// console.log('address', address);
			// const data = bech32.fromWords(decodeAddress.words); // Convert 5-bit words to binary
			// console.log(data, 'data');
			// console.log(
			// 	'decodeVALIDE',
			// 	`0x${Buffer.from(data).toString('hex')}`,
			// ); // Convert binary to hex

			validatorAddresses.push(address);
			let stakeDetails: any = await getValidatorStakeDetails(
				apiRes,
				validator.operator_address,
			);

			console.log('STAKE_DETAILS', stakeDetails);
			const valIndex: number =
				stakeDetails?.delegation_responses.findIndex(
					(e: any) =>
						e.delegation.delegator_address === address &&
						e.delegation.validator_address ===
							validatorOperaterAddress,
				);

			if (valIndex < 0) {
				console.log('Not found In the Previous API');
				const getDelegationDetail: any = await getDelegationDetails(
					apiRes,
					address,
				);
				console.log('stakeDetails2', getDelegationDetail);

				selfStakeValue =
					getDelegationDetail?.delegation_responses[0]?.balance
						.amount;
				// if (getDelegationDetail?.delegation_responses.length > 0) {
				// 	// stakeDetails.push([getDelegationDetail]);
				// 	{stakeDetails,...getDelegationDetail}
				// }
				if (getDelegationDetail?.delegation_responses?.length > 0) {
					stakeDetails = {
						...stakeDetails,
						delegation_responses: [
							...stakeDetails.delegation_responses,
							...getDelegationDetail.delegation_responses,
						],
						pagination: {
							...stakeDetails.pagination,
							// total update if needed:
							total: (
								Number(stakeDetails.pagination.total || 0) +
								Number(
									getDelegationDetail.pagination.total || 0,
								)
							).toString(),
						},
					};
				}
			}

			let deleShares = 0;

			if (stakeDetails?.delegation_responses[valIndex]?.balance?.amount) {
				deleShares =
					stakeDetails.delegation_responses[valIndex].balance?.amount;
			} else if (selfStakeValue) {
				deleShares = selfStakeValue;
			}

			const selfStake = deleShares || 0;
			const delegatorCount = parseInt(stakeDetails.pagination.total, 10);

			let status = RES_MSG.DEACTIVATING;

			switch (validator?.status) {
				case RES_MSG.BOND_STATUS_BONDED:
					status = RES_MSG.ACTIVE;
					break;
				case RES_MSG.BOND_STATUS_UNBONDED:
					status = RES_MSG.INACTIVE;
					break;
				default:
					break;
			}

			const validatorData: ValidatorInfo = {
				name: validator?.description?.moniker,
				votingPower: Number(validator.tokens / 10 ** 18),
				commission: validator?.commission?.commission_rates.rate,
				status,
				selfStake: selfStake.toString(),
				delegatorCount,
				address,
			};

			validators.push(validatorData);
			console.log(validatorData, 'validatorDatato save');
			await ExlorerHelper.saveValidatorData(validatorData);
		}

		ExlorerHelper.deleteValidatorData(validatorAddresses);

		return validators;
	} catch (err) {
		console.log('Error occurred while getting validator details', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return {
			error: true,
			message: RES_MSG.VALIDATOR_ERROR,
		};
	}
}

const getDashboardData = async (): Promise<
	| {
			validator: number;
			totalValidator: number;
			bondedRate: number;
			apy: number;
	  }
	| { error: boolean; message: string }
> => {
	try {
		const apiUrl = environment.evmHost;
		const apiRes = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Accept: 'application/json',
			},
			timeout: 9000,
		});

		const tenderMintParams = await getParams(apiRes);
		if (!tenderMintParams) throw new Error(RES_MSG.APR_VALUE_ERROR);

		const apyValue = calculateAPY(
			Number(tenderMintParams.inflation),
			Number(tenderMintParams.bondedRate / 100),
			tenderMintParams.communityTax,
		);

		const blocksYearReal = await getBlocksPerYearReal(apiRes);
		const nominalAPR: number = calculateNominalAPR(tenderMintParams);
		const actualAPR: any = calculateRealAPR(
			tenderMintParams,
			nominalAPR,
			blocksYearReal,
		);

		const expoValue: number = getDigitsAfterE(actualAPR.toString());
		const actualapr = actualAPR.toFixed(expoValue);

		const validatorData = {
			validator: tenderMintParams?.activeValidator,
			totalValidator: tenderMintParams?.totalValidator,
			bondedRate: tenderMintParams?.bondedRate,
			apy: apyValue,
			totalSupply: tenderMintParams?.total_supply,
			inflation: Number(tenderMintParams?.inflation),
			circulating_supply: tenderMintParams?.circulation_supply,
			activeValidator: tenderMintParams?.activeValidator,
			bondedTokens: tenderMintParams?.bondedTokens,
			communityTax: tenderMintParams?.communityTax,
			apr: actualapr,
		};

		const existingDataStr: any = await RedisService.getString(
			REDIS_KEY.DASHBOARD_DATA,
		);
		let existingData: any = {};
		if (existingDataStr) {
			existingData = JSON.parse(existingDataStr);
		}

		// Step 2: Add or update fields
		existingData.validator = validatorData.validator;
		existingData.totalValidator = validatorData.totalValidator;
		existingData.bondedRate = validatorData.bondedRate;

		existingData.apy = validatorData.apy;
		existingData.totalSupply = validatorData.totalSupply;
		existingData.inflation = validatorData.inflation;
		existingData.circulating_supply = validatorData.circulating_supply;
		existingData.circulationSupply = validatorData.circulating_supply;
		existingData.activeValidator = validatorData.activeValidator;
		existingData.apr = validatorData.apr;

		// const [latest_block, transactionCount, userCount] = await Promise.all([
		// 	web3Helper.getBlockNumber().then(Number),
		// 	prisma.transactions.count(),
		// 	prisma.users.count(),
		// ]);

		const latest_block: string = await RedisService.getString(
			CONST_NAME.LATEST_BLOCK,
		);
		const total_transactions: string = await RedisService.getString(
			REDIS_KEY.TRANSACTIONS_COUNT,
		);
		const total_accounts: string = await RedisService.getString(
			REDIS_KEY.TOTAL_ADDRESSES,
		);
		existingData.latest_block = JSON.parse(latest_block);
		existingData.total_transactions = JSON.parse(total_transactions);
		existingData.total_accounts = JSON.parse(total_accounts);

		await RedisService.setStringWithExpiry(
			REDIS_KEY.DASHBOARD_DATA,
			JSON.stringify(existingData),
			600,
		);
		return validatorData;
	} catch (err) {
		logger.log('error', 'Error occurred while calculating stake APY', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return { error: true, message: RES_MSG.APR_VALUE_ERROR };
	}
};

const withCache = async (key: string, fn: () => Promise<any>, ttl = 3600) => {
	const cached: string = await RedisService.getString(key);
	if (cached) return JSON.parse(cached);

	const data = await fn();
	await RedisService.setStringWithExpiry(key, JSON.stringify(data), ttl);
	return data;
};

function calculateNominalAPR(params: Params): number {
	return (
		(params.annualProvisions * (CONST_NAME.ONE - params.communityTax)) /
		params.bondedTokens
	);
}

async function getBlocksPerYearReal(lcdApi: AxiosInstance): Promise<number> {
	try {
		const response: AxiosResponse = await lcdApi.get(
			'/cosmos/base/tendermint/v1beta1/blocks/latest',
		);

		const block1: BlockHeader = response.data.block.header;
		const blockRange =
			Number(block1.height) > CONST_NAME.THOUSAND
				? CONST_NAME.THOUSAND
				: CONST_NAME.ONE;
		const response2: AxiosResponse = await lcdApi.get(
			`/cosmos/base/tendermint/v1beta1/blocks/${
				Number(block1.height) - blockRange
			}`,
		);

		const block2: BlockHeader = response2.data.block.header;

		const yearMilisec = CONST_NAME.YEAR_MILI_SEC;
		const blockMilisec =
			(new Date(block1.time).valueOf() -
				new Date(block2.time).valueOf()) /
			blockRange;

		return Math.ceil(yearMilisec / blockMilisec);
	} catch (error) {
		logger.log('error', 'Error occurred while getting blocks per year.');
		return -CONST_NAME.ONE;
	}
}

function calculateRealAPR(
	params: Params,
	nominalAPR: number,
	blocksYearReal: number,
): number {
	const blockProvision = params.annualProvisions / params.blocksPerYear;
	const realProvision = blockProvision * blocksYearReal;
	return nominalAPR * (realProvision / params.annualProvisions);
}

async function getDelegationDetails(
	apiRes: AxiosInstance,
	address: string,
): Promise<ValidatorDelegations> {
	const response: AxiosResponse = await apiRes.get(
		`/cosmos/staking/v1beta1/delegations/${address}`,
	);
	console.log(
		`getDelegationDetails for ${address}`,
		response.data.delegation_responses[0],
	);

	return response.data;
}

export { calculateData, getValidatorsInfo };
