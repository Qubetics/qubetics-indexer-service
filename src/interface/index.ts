import { TRANSACTION_STATUS, TRANSACTION_TYPE } from '../constant/response';

export interface IBlock {
	blocknumber: number;
	gasLimit: number;
	gasUsed: number;
	nonce: number;
	deposit: string;
	transfer: string;
	blockhash: string;
	parentHash: string;
	stateRoot: string;
	timestamp: Date;
	transactionCount: number;
	miner: string;
	transactionsRoot: string;
	baseFeePerGas: number;
	receiptsRoot: string;
	sha3Uncles: string;
	size: number;
	createdAt: Date;
}

export interface IValidator {
	name: string;
	address: string;
	votingPower: number;
	commission: string;
	delegatorCount: number;
	selfStake: string;
	status: string;
}
export interface ITransaction {
	gas: number;
	// input: string;
	txFee: string;
	value: string;
	token?: string;
	txhash: string;
	gasPrice: number;
	toAddress: string;
	blockhash: string;
	timestamp: Date;
	fromAddress: string;
	blocknumber: number;
	type: TRANSACTION_TYPE;
	contractAddress?: string;
	status: TRANSACTION_STATUS;
}

export interface ICOINTX {
	gas: number;
	txFee: string;
	value: string;
	txhash: string;
	gasPrice: number;
	toAddress: string;
	blockhash: string;
	timestamp: Date;
	fromAddress: string;
	blocknumber: number;
	status: TRANSACTION_STATUS;
}
export interface ITransactionPayload {
	logs?: any;
	txhash: string;
	blocknumber: number;
	blockhash: string;
	gasPrice: number;
	gas: number;
	type: TRANSACTION_TYPE;
	status: TRANSACTION_STATUS;
	fromAddress: string;
	toAddress: string;
	contractAddress: string;
	timestamp: Date;
	value: string;
	txFee: string;
	token?: string;
	createdAt?: Date;
	input?: string;
}

export interface Log {
	address: string;
	blockHash: string;
	blockNumber: number;
	data: string;
	logIndex: number;
	removed: boolean;
	topics: string[] | [];
	transactionHash: string;
	transactionIndex: number;
	id: string;
}

export interface ICopiedTransaction
	extends Omit<ITransaction, 'type' | 'contractAddress'> {}
export interface ICoinTransaction {
	txhash: string;
	blocknumber: string;
	blockhash: string;
	gasPrice: string;
	gas: string;
	fromAddress: string;
	createdAt: Date;
	toAddress: string;
	status: string;
	value: string;
}
export interface IUsers {
	address: string;
	id?: number;
	txn?: number;
}
export interface IESResponse {
	error: boolean;
	data?: object;
	message: string;
}

export interface ERC20ABI {
	constant: boolean;
	inputs: {
		name: string;
		type: string;
	}[];
	name: string;
	outputs: {
		name: string;
		type: string;
	}[];
	payable: boolean;
	stateMutability: string;
	type: string;
}

export interface ERC20ABIEntry {
	payable: boolean;
	stateMutability: string;
	type: string;
}

// export interface ERC20ABIEntry {
// 	jsonInterface: AbiItem[] | AbiItem,
// 	address?: string,
// 	options?: ContractOptions
// }

// export interface AbiItem {
//     anonymous?: boolean;
//     constant?: boolean;
//     inputs?: AbiInput[];
//     name?: string;
//     outputs?: AbiOutput[];
//     payable?: boolean;
//     stateMutability?: StateMutabilityType;
//     type: AbiType;
//     gas?: number;
// }

export interface CoinMarketData {
	price: number;
	marketCap: number;
	circulatingSupply: number;
}

export interface ITimeStamp {
	[key: string]: number;
}

export interface TotalTxResponse {
	error: boolean;
	data: {
		error: boolean;
		count: number;
	};
}
export interface IContracts {
	blockNumber: number;
	blockHash: string;
	txHash: string;
	contractName: string;
	contractType: string;
	creator: string;
	address: string;
	timestamp: Date;
	bytecode: string;
	bytecodeHash: string;
}

export interface ITokens {
	totalSupply: string;
	tokenSymbol: string;
	tokenName: string;
	decimal: string;
	creator: string;
	type: string;
	contractAddress: string;
	blockNumber: number;
	blockHash: string;
}

export interface IContractLogs {
	txHash: string;
	contractAddress: string;
	blockHash: string;
	blockNumber: number;
	topics: string[];
	logs: string;
	methodSignature: string;
	method: string;
	gasFee: number;
	status: string;
	timestamp: Date;
}

export interface IHolders {
	address: string;
	contractAddress: string;
	tokenBalance: string;
}

export interface EventDetail {
	txhash: string;
	contractName: string;
	contractSymbol: string;
	contractType: string;
	gasFee: number;
	nonce: number;
	contractAddress: string;
	blockhash: string;
	blocknumber: number;
	value: string;
	topics: string[]; // Update with the actual type of 'topics'
	txIndex: number;
	logIndex: number;
	removed: boolean;
	textSignature: string;
	method: string;
	isInternal: boolean;
	creator: string;
	status: string;
}
export interface ITextSignature {
	id: number;
	created_at: string;
	text_signature: string;
	hex_signature: string;
	bytes_signature: string;
}

export interface TokenData {
	tokenName: string;
	tokenSymbol: string;
	decimal: number;
	totalSupply: string;
	contractAddress: string;
	blockNumber: number;
	creator: string;
	blockHash: string;
}

export interface ICountResponse {
	error: boolean;
	message: string;
	data: {
		count: number;
	};
}
export interface Params {
	annualProvisions: number;
	blocksPerYear: number;
	inflation: string;
	bondedTokens: number;
	communityTax: number;
	activeValidator: number;
	totalValidator: number;
	circulation_supply: number;
	bondedRate: number;
	total_supply: number;
}

export interface BlockHeader {
	height: number;
	time: Date;
}

export interface DashboardData {
	apy: number;
	validators: number; // Assuming validators is an array of strings; you can adjust the type accordingly
	totalValidators: number;
	bondedRate: number;
}

export interface ValidatorDelegations {
	delegation_responses: Array<{
		delegation: {
			delegator_address: string;
			validator_address: string;
			shares: string;
		};
	}>;
}

export interface ValidatorInfo {
	name: string;
	votingPower: number;
	commission: string;
	delegatorCount: number;
	selfStake: string;
	status: string;
	address: string;
}

export interface ValidatorData {
	validator: number;
	totalValidator: number;
	bondedRate: number;
	apy: number;
}

export interface GraphData {
	createdAt: string;
	count: number;
	total_account?: number;
}
export interface GraphDataTotal {
	finalData: GraphData[];
	count: number;
}
export interface IGraphResponse {
	error?: boolean;
	data?: GraphDataTotal;
	message?: string;
	status?: number;
}

interface ILocation {
	lat: string;
	lon: string;
	country: string;
}
interface ISoftware {
	full: string;
	version: string;
	networkId: string;
}

export interface IPeerData {
	peerId: string;
	roles: string;
	protocolVersion: string;
	bestHash: string;
	bestNumber: string;
	version: string;
	nodeName: string;
	software: ISoftware;
	location: ILocation;
}

export interface StatsType {
	type: string;
	date: number;
	txnCount?: number;
}
