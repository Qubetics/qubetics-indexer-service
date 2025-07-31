import moment from 'moment';

export const RES_MSG = {
	BLOCK_ADDED: 'block added successfully!',
	VALIDATOR_ADDED: 'validator added successfully!',
	VALIDATOR_UPDATED: 'validator added successfully!',
	BLOCK_ADDED_ERROR: 'error while adding block!',
	VALIDATOR_ADDED_ERROR: 'error while adding validator!',
	TOKEN_ADDED: 'token added successfully!',
	TOKEN_ADDED_ERROR: 'error while adding token!',
	ERROR: 'Oops! Something went wrong. Please try again.',
	UPDATE_TX_STATUS: 'transaction is updated successfully',
	UPDATE_AMOUNT: 'transfer amount updated successfully',
	SERVER_ERROR: 'server error',
	USER_ADDED: 'user save succeesfully',
	TRANSACTION_ADDED: 'transaction saved successfully',
	COIN_TRANSACTION_ADDED: 'coin transaction saved successfully',
	CONTARCT_TX_ADDED: 'contract transaction saved successfully',
	CONTRACT_ADDED: 'contract saved successfully',
	GET_TX_COUNT: 'transaction count fetched successfully',
	GET_USER_COUNT: 'user count fetched successfully',
	APR_VALUE_ERROR:
		'error occur while fetching APR value and validators count',
	VALIDATOR_ERROR: 'Error occurred while getting validator details',
	BOND_STATUS_BONDED: 'BOND_STATUS_BONDED',
	BOND_STATUS_UNBONDED: 'BOND_STATUS_UNBONDED',
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	DEACTIVATING: 'deactivating',
};

export const ERROR_MSG = {
	GET_BLOCK_INFO_ERROR: 'error occured while fetching block number',
	GET_TX_ERROR: 'error occured while fetching transaction detail',
	GET_CONTRACT_ERROR: 'error occured while fetching contract detail',
	DECODE_PARAM_ERROR: 'error occured while decoding param',
	GET_APR_ERROR: 'error occured while calculating apr value',
	COIN_PRICE_UPDATION: 'Someting went wrong while updation coin price graph',
	GET_BALANCE_ERROR: 'Error while fetching balance from blockchain',
};

export const CONST_NAME = {
	LATEST_BLOCK: 'latestBlock',
	GET_MIN: moment(new Date()).format('mm'),
	GET_HOUR: moment(new Date()).format('hh'),
	GET_SEC: moment().format('ss'),
	FEES: 5,
	THOUSAND: 100000,
	ZERO: 0,
	SLICED_VALUE: 200,
	TX_SLICED_VALUE: 50,
	THIRTY: 30,
	ONE: 1,
	SIX: 6,
	POWER: 10 ** 18,
	SUCCESS_STATUS: 'SUCCESS',
	FAILED_STATUS: 'FAILED',
	PENDING_STATUS: 'PENDING',
	NA: 'N/A',
	BOND_STATUS: 'BOND_STATUS_BONDED',
	YEAR_MILI_SEC: 31536000000,
	BLOCK_PER_YEAR: 365 * 24 * 60 * 60,
	ETH_EXP: 10 ** 18,
	LATEST_OLD_BLOCK: 'latestOldBlock',
};

export const QUEUE_NAME = {
	BLOCKS: 'BLOCKS',
	SAVE_USERS: 'USERS',
	ERROR_BLOCK: 'ERROR_BLOCK',
	TRANSACTIONS: 'TRANSACTIONS',
	MISSING_BLOCK: 'MISSING_BLOCK',
	DOWNTIME_BLOCK: 'DOWNTIME_BLOCK',
	VALIDATOR_DETAIL: 'VALIDATOR_DETAIL',
	CONTRACT_AND_TOKENS: 'CONTRACT_AND_TOKENS',
	STATS_UPDATE: 'STATS_UPDATE',
	OLD_BLOCK: 'OLD_BLOCK',
	BLOCK_TIME_QUE: 'BLOCK_TIME_QUE',
	// TOKEN: 'TOKEN',
	// ADD_TX_HASHES: 'ADD_TX_HASHES',
	// CONTRACT_LOGS: 'CONTRACT_LOGS',
	// COIN_TRANSFER_TX: 'COIN_TRANSFER_TX',
	// DECODED_TRANSACTIONS: 'DECODED_TRANSACTIONS',
};

export const SOCKET_EVENT = {
	LATEST_BLOCK: 'LATEST_BLOCK',
	LATEST_TRANSACTION: 'LATEST_TRANSACTION',
	TX_SUMMARY: 'TX_SUMMARY',
	ANALYTICS: 'ANALYTICS',
	CONTRACT_DEPLOYED_TX: 'CONTRACT_DEPLOYED_GRAPH',
	COIN_TRANSFER_TX: 'COIN_TRANSFER_GRAPH',
	ALL_TRANSACTIONS: 'ALL_TRANSACTIONS_GRAPH',
	ACCOUNT_TX: 'ACCOUNT_TX_GRAPH',
	TOKEN_TX: 'TOKEN_TX_GRAPH',
	VALIDATOR_WIDGET: 'VALIDATOR_WIDGET',
};

export const REDIS_KEY = {
	PENDING_TX: 'PENDING_TRANSACTION',
	CIRCULATING_SUPPLY: 'CIRCULATING_SUPPLY',
	MARKET_CAP: 'MARKET_CAP',
	PRICE: 'PRICE',
	TPS_GRAPH: 'TPS_GRAPH_PAYLOAD',
	TOKEN_GRAPH: 'TOKEN_GRAPH_PAYLOAD',
	ACCOUNT_GRAPH: 'ACCOUNT_GRAPH_PAYLOAD',
	COIN_TRANSFER_GRAPH: 'COIN_TRANSFER_GRAPH_PAYLOAD',
	CONTRACT_DEPLOY_GRAPH: 'CONTRACT_DEPLOY_GRAPH_PAYLOAD',
	MARKET_CAP_PRICE: 'MARKET_CAP_PRICE',
	VALIDATOR_DATA: 'VALIDATOR_DATA',
	COIN_PRICE: 'COIN_PRICE',

	// stats
	TxHistory: 'TxHistory',
	NewAccountHistory: 'NewAccountHistory',
	CoinTransferTxHistory: 'CoinTransferTxHistory',
	ContractDeploymentHistory: 'ContractDeploymentHistory',
	StatsGenerated: 'StatsGenerated',
	TxFeeHistory: 'TxFeeHistory',
	CoinPriceGraph: 'CoinPriceGraph',

	// counts
	BLOCKS_COUNT: 'BLOCKS_COUNT',
	TRANSACTIONS_COUNT: 'TRANSACTIONS_COUNT',
	TOTAL_ADDRESSES: 'TOTAL_ADDRESSES',
	TOTAL_COIN_TRANSFER_TX: 'TOTAL_COIN_TRANSFER_TX',
	TOTAL_CONTRACT_DEPLOYED_TX: 'TOTAL_CONTRACT_DEPLOYED_TX',
	BLOCK_AVG_TIME: 'BLOCK_AVG_TIME',
	DASHBOARD_DATA: 'DASHBOARD_DATA',
};

export enum TRANSACTION_STATUS {
	PENDING = 'PENDING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
}

export enum TRANSACTION_TYPE {
	COIN_TRANSFER = 'COIN_TRANSFER',
	CONTRACT_CREATION = 'CONTRACT_CREATION',
	CONTRACT_TRANSFER = 'CONTRACT_TRANSFER',
}

export enum CONTRACT_TYPE {
	ERC20 = 'ERC-20',
	ERC721 = 'ERC-721',
	ERC777 = 'ERC-777',
	ERC1155 = 'ERC-1155',
	UNKNOWN = 'UNKNOWN',
}
