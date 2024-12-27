import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { bech32 } from 'bech32';
import { RES_MSG, CONST_NAME, REDIS_KEY } from '../constant/response';
import {
	Params,
	ValidatorDelegations,
	ValidatorInfo,
} from '../interface/index';
import logger from '../lib/logger';
import { RedisService, SocketEventEmitter } from '../service';
import ExlorerHelper from './explorer.helper';
import explorerHelper from './explorer.helper';

// Fetch various parameters needed for calculations
async function getParams(apiRes: AxiosInstance): Promise<Params | false> {
	try {
		const [
			validatorResponse,
			circulationSupplyResponse,
			inflationRateResponse,
			poolResponse,
			paramsResponse,
			totalSupplyResponse,
		] = await Promise.all([
			apiRes.get('/cosmos/staking/v1beta1/validators'),
			apiRes.get(
				`/cosmos/bank/v1beta1/supply/by_denom?denom=${environment.projectName}`,
			),
			apiRes.get('/cosmos/mint/v1beta1/inflation'),
			apiRes.get('/cosmos/staking/v1beta1/pool'),
			apiRes.get('/cosmos/distribution/v1beta1/params'),
			apiRes.get('/cosmos/bank/v1beta1/supply'),
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

		const inflation_rate = Number(inflationRateResponse.data.inflation);

		const formattedInflationRate = `${inflation_rate}`;

		const annualProvisions = Number(
			circulation_supply * parseFloat(formattedInflationRate),
		);

		let blocksPerYear = Number(CONST_NAME.BLOCK_PER_YEAR);
		blocksPerYear = Number(blocksPerYear / 2);
		const inflation = formattedInflationRate;

		const bondedTokens = Number(poolResponse.data.pool.bonded_tokens);

		// Find the entry with denom "qubetics"
		const qubeticsAmount = totalSupplyResponse.data.supply.find(
			(item: any) => item.denom === 'qubetics',
		);

		const totalSupply = qubeticsAmount.amount;

		const bondedRate = Number(
			((bondedTokens / totalSupply) * 100).toFixed(3),
		);

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
		};
	} catch (error) {
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

		const validatorData = {
			validator: params?.activeValidator,
			totalValidator: params?.totalValidator,
			bondedRate: params?.bondedRate,
			apy: apyValue,
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
		// console.log(response?.data?.validators);
		for (let i = 0; i < response?.data?.validators?.length; i += 1) {
			const validator = response.data.validators[i];
			const validatorOperaterAddress = validator.operator_address;

			const decodeAddress = bech32.decode(validatorOperaterAddress);

			const address = bech32.encode(
				decodeAddress.prefix,
				decodeAddress.words,
			);

			// console.log('address', address);
			const data = bech32.fromWords(decodeAddress.words); // Convert 5-bit words to binary
			// console.log(
			// 	'decodeVALIDE',
			// 	`0x${Buffer.from(data).toString('hex')}`,
			// ); // Convert binary to hex

			validatorAddresses.push(address);
			const stakeDetails: any = await getValidatorStakeDetails(
				apiRes,
				validator.operator_address,
			);

			const valIndex: number =
				stakeDetails?.delegation_responses.findIndex(
					(e: any) =>
						e.delegation.delegator_address === address &&
						e.delegation.validator_address ===
							validatorOperaterAddress,
				);
			// console.log('valIndex', valIndex);

			const deleShares =
				stakeDetails?.delegation_responses[valIndex]?.delegation
					.shares || 0;
			const selfStake = deleShares || 0;
			const delegatorCount = parseInt(stakeDetails.pagination.total, 10);
			// console.log('deleShares', deleShares, delegatorCount);

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
			await ExlorerHelper.saveValidatorData(validatorData);
		}

		explorerHelper.deleteValidatorData(validatorAddresses);

		return validators;
	} catch (err) {
		// console.log('Error occurred while getting validator details', err);
		if (err instanceof Error) {
			return { error: true, message: err.message };
		}
		return {
			error: true,
			message: RES_MSG.VALIDATOR_ERROR,
		};
	}
}

export { calculateData, getValidatorsInfo };
