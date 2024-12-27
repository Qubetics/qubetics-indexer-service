import Web3 from 'web3';
import { ERROR_MSG } from '../constant/response';
import logger from '../lib/logger';

class Web3Helper {
	public web3: Web3;

	public endPoint: string;

	constructor() {
		this.init();
	}

	async init() {
		this.web3 = new Web3(
			new Web3.providers.HttpProvider(environment.nodeLink),
		);
	}

	async getBlockNumber() {
		try {
			return await this.web3.eth.getBlockNumber();
		} catch (err) {
			// console.log('error : ', err);
			throw new Error(ERROR_MSG.GET_BLOCK_INFO_ERROR);
		}
	}

	async getDetailByBlockNumber(latestBlock: number) {
		try {
			const res = await this.web3.eth.getBlock(latestBlock);
			return res;
		} catch (err) {
			throw new Error(ERROR_MSG.GET_BLOCK_INFO_ERROR);
		}
	}

	async getTxByHash(txHash: string) {
		try {
			return await this.web3.eth.getTransaction(txHash);
		} catch (err) {
			throw new Error(ERROR_MSG.GET_TX_ERROR);
		}
	}

	async getTransactionCount(address: string) {
		try {
			return await this.web3.eth.getTransactionCount(address);
		} catch (err) {
			throw new Error(ERROR_MSG.GET_TX_ERROR);
		}
	}

	async getTransactionReceipt(hash: string) {
		try {
			const res = await this.web3.eth.getTransactionReceipt(hash);
			return res;
		} catch (err) {
			throw new Error(ERROR_MSG.GET_TX_ERROR);
		}
	}

	async tokenContract(ERC20Abi: any, toAddress: string) {
		try {
			const res = new this.web3.eth.Contract(ERC20Abi, toAddress);
			return res;
		} catch (err) {
			throw new Error(ERROR_MSG.GET_CONTRACT_ERROR);
		}
	}

	async decodeParam(erc20TransferABI: string[], input: string) {
		try {
			const res = await this.web3.eth.abi.decodeParameters(
				erc20TransferABI,
				input,
			);
			return res;
		} catch (err) {
			throw new Error(ERROR_MSG.DECODE_PARAM_ERROR);
		}
	}

	async getCheckSumAddress(address: string) {
		try {
			return this.web3.utils.toChecksumAddress(address);
		} catch (err) {
			throw new Error(ERROR_MSG.DECODE_PARAM_ERROR);
		}
	}

	async getContract(address: string, abi: any) {
		return new this.web3.eth.Contract(abi, address);
	}
}
export default new Web3Helper();

export class Web3SocketHelper {
	static web3Ws: Web3;

	public endPoint: string;

	private static instance: Web3SocketHelper | null = null;
	// private static connectionAttempt = 0;

	static getInstance(): Web3SocketHelper {
		if (!Web3SocketHelper.instance) {
			Web3SocketHelper.instance = new Web3SocketHelper();
			// delete Web3SocketHelper.constructor;
		}
		return Web3SocketHelper.instance;
	}

	public async initializeWsConnection() {
		const options: any = {
			reconnect: {
				auto: true,
				delay: 5000,
				maxAttempts: 15,
				onTimeout: false,
			},
			keepAlive: true,
		};

		// WebSocket connection Web3 (evm)
		const web3wsProvider = new Web3.providers.WebsocketProvider(
			environment.wsUrl,
			options,
		);

		// bind event for failure for reconnect
		web3wsProvider.on('end', () => {
			web3wsProvider.connect();
		});

		web3wsProvider.on('disconnect', () => {
			web3wsProvider.connect();
		});

		web3wsProvider.on('error', () => {
			// console.log('error while making connection with evm... ');
			web3wsProvider.connect();
		});

		Web3SocketHelper.web3Ws = new Web3(web3wsProvider);
		const chainId = await Web3SocketHelper.web3Ws.eth.getChainId();
		logger.info('Rpc node reach checking...');
		logger.info(`Rpc node reach success! (Chain Id ${chainId})`);
		return true;
	}
}
