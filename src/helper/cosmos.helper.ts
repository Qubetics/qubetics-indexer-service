import { AxiosInstance } from 'axios';

export const getValidators = (api: AxiosInstance) =>
	api.get('/cosmos/staking/v1beta1/validators');

export const getInflation = (api: AxiosInstance) =>
	api.get('/cosmos/mint/v1beta1/inflation');

export const getSupply = (api: AxiosInstance, symbol: string) =>
	api.get(
		`/cosmos/bank/v1beta1/supply/by_denom?denom=${symbol.toLowerCase()}`,
	);

export const getStakingPool = (api: AxiosInstance) =>
	api.get('/cosmos/staking/v1beta1/pool');

export const getDistributionParams = (api: AxiosInstance) =>
	api.get('/cosmos/distribution/v1beta1/params');

export const getAnnualProvisions = (api: AxiosInstance) =>
	api.get('/cosmos/mint/v1beta1/annual_provisions');
