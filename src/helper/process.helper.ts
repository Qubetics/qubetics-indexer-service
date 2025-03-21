import { ethers } from 'ethers';
import { ERC1155ABI, ERC20ABI, ERC721ABI } from '../constant/abi';
import {
	RES_MSG,
	REDIS_KEY,
	QUEUE_NAME,
	CONST_NAME,
	SOCKET_EVENT,
	CONTRACT_TYPE,
	TRANSACTION_TYPE,
	TRANSACTION_STATUS,
} from '../constant/response';
import {
	ITokens,
	ICOINTX,
	IContracts,
	ITransaction,
	IContractLogs,
	ITransactionPayload,
} from '../interface/index';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import { txType, exp, noExponent, hashString } from '../lib/utilities.helper';
import {
	RedisService,
	RabbitMqService,
	SocketEventEmitter,
} from '../service/index';
import rabbitmqService from '../service/rabbitmq.service';
import explorerHelper from './explorer.helper';
import Web3Helper, { Web3SocketHelper } from './web3.helper';

class ProcessHelper {
	/**
	 * Subscribe to new block whenever new block create then we will get an update
	 */
	async subscribeBlocksWs() {
		try {
			const sub = Web3SocketHelper.web3Ws.eth.subscribe(
				'newBlockHeaders',
				async (error: any, blockHeader: any) => {
					if (error) throw new Error(error);

					console.log('New Block:', blockHeader.number);
					const latestBlockNo = Number(blockHeader?.number);
					const blockQueue = `${QUEUE_NAME.BLOCKS}_${latestBlockNo
						.toString()
						.slice(-1)}`;
					this.processblock(
						latestBlockNo,
						QUEUE_NAME.TRANSACTIONS,
						blockQueue,
						true,
						true,
					);

					await RedisService.setString(
						CONST_NAME.LATEST_BLOCK,
						latestBlockNo,
					);
				},
			);

			sub.on('connected', () => {
				logger.info('Latest block indexing started.');
			});

			sub.on('error', (err) => {
				logger.error('Error to latest block subscription', err);
			});
		} catch (err: any) {
			logger.error('Error in subscribe block\n', err);
		}
	}

	/**
	 * Process Block data and transactions inside a block
	 * @param blockno
	 * @param txQueue
	 * @param blockQueue
	 * @param emitTx
	 * @param emitBlock
	 * @returns
	 */
	async processblock(
		blockno: number,
		txQueue: string | null,
		blockQueue: string | null,
		emitTx: boolean = false,
		emitBlock: boolean = false,
	) {
		try {
			const block = await Web3SocketHelper.web3Ws.eth.getBlock(
				blockno,
				true,
			);
			const transactions = block?.transactions || [];
			const transactionsArr = [];

			const blockExtractedData = {
				miner: block?.miner,
				blockhash: block?.hash,
				createdAt: new Date(),
				size: Number(block?.size),
				nonce: Number(block?.nonce),
				stateRoot: block?.stateRoot,
				parentHash: block?.parentHash,
				sha3Uncles: block?.sha3Uncles,
				gasUsed: Number(block?.gasUsed),
				gasLimit: Number(block?.gasLimit),
				receiptsRoot: block?.receiptsRoot,
				deposit: block?.gasUsed.toString(),
				blocknumber: Number(block?.number),
				transfer: CONST_NAME.ZERO.toString(), // need to update
				transactionCount: transactions?.length,
				transactionsRoot: block?.transactionsRoot,
				baseFeePerGas: Number(block?.baseFeePerGas),
				// timestamp: Number(block?.timestamp) * CONST_NAME.THOUSAND,
				timestamp: new Date(Number(block?.timestamp) * 1000),
			};
			console.log(blockExtractedData, 'blockExtractedData');
			if (transactions.length) {
				console.log('We are enqueing TrX....');
				rabbitmqService.enqueueData(
					QUEUE_NAME.STATS_UPDATE,
					JSON.stringify({
						type: REDIS_KEY.TxHistory,
						date: blockExtractedData.timestamp
							? new Date(blockExtractedData.timestamp).getTime()
							: Date.now(),
						txnCount: transactions.length,
					}),
				);
			}

			if (blockQueue)
				RabbitMqService.enqueueData(
					blockQueue,
					JSON.stringify(blockExtractedData),
				);

			/* emit the latest block data */
			if (emitBlock)
				SocketEventEmitter.emitMessage(
					SOCKET_EVENT.LATEST_BLOCK,
					blockExtractedData,
				);

			const analytics = await explorerHelper.getAnalytics();

			/* emit the transactions per block count */
			SocketEventEmitter.emitMessage(SOCKET_EVENT.TX_SUMMARY, {
				tpb: blockExtractedData?.transactionCount,
				totalTx: await prisma.transactions.count(),
			});

			/* emit  analytics */
			SocketEventEmitter.emitMessage(SOCKET_EVENT.ANALYTICS, analytics);

			// contract and coin transafer transactions
			const _txns = { contractDeployment: 0, coin: 0 };

			/* eslint-disable no-await-in-loop */
			// Disable the rule for the next line
			// eslint-disable-next-line no-restricted-syntax
			for (const element of transactions) {
				const gasPrice = Number(element?.gasPrice || CONST_NAME.ZERO);
				const gas = element?.gas || CONST_NAME.ZERO;
				const txFee = (gas * gasPrice) / CONST_NAME.POWER;
				const txnType = txType(`${element.to}`, element.input);

				if (txnType === TRANSACTION_TYPE.COIN_TRANSFER) _txns.coin++;
				else if (txnType === TRANSACTION_TYPE.CONTRACT_CREATION)
					_txns.contractDeployment++;

				const txExtractedData: ITransactionPayload = {
					gas,
					gasPrice,
					logs: [],
					createdAt: new Date(),
					txFee: exp(`${txFee}`),
					blockhash: block?.hash,
					input: element.input,
					txhash: element?.hash,
					contractAddress: CONST_NAME.NA,
					timestamp: new Date(Number(block?.timestamp) * 1000),
					blocknumber: Number(block.number),
					token: CONST_NAME.ZERO.toString(),
					fromAddress: element?.from,
					status: TRANSACTION_STATUS.PENDING,
					toAddress: element?.to || CONST_NAME.NA,
					type: txnType,
					value: exp(`${Number(element?.value) / CONST_NAME.POWER}`),
				};

				const txReceipt =
					await Web3SocketHelper.web3Ws.eth.getTransactionReceipt(
						element.hash,
					);

				if (txReceipt) {
					txExtractedData.status = txReceipt?.status
						? TRANSACTION_STATUS.SUCCESS
						: TRANSACTION_STATUS.FAILED;
					txExtractedData.contractAddress =
						txReceipt?.contractAddress ||
						txExtractedData.contractAddress;
					txExtractedData.gas = txReceipt.gasUsed;
					txExtractedData.logs = txReceipt.logs || [];
				} else {
					const savedPendingTransaction =
						await RedisService.getString<any>(REDIS_KEY.PENDING_TX);
					savedPendingTransaction.push(txExtractedData);
					await RedisService.setString(
						REDIS_KEY.PENDING_TX,
						savedPendingTransaction,
					);
				}
				transactionsArr.push(txExtractedData);
				if (txQueue)
					RabbitMqService.enqueueData(
						txQueue,
						JSON.stringify(txExtractedData),
					);
			}

			// send stats update (coin transfer)
			if (_txns.coin)
				rabbitmqService.enqueueData(
					QUEUE_NAME.STATS_UPDATE,
					JSON.stringify({
						type: REDIS_KEY.CoinTransferTxHistory,
						date: blockExtractedData.timestamp
							? new Date(blockExtractedData.timestamp).getTime()
							: Date.now(),
						txnCount: _txns.coin,
					}),
				);
			// send stats update (contract deployment transfer)
			else if (_txns.contractDeployment)
				rabbitmqService.enqueueData(
					QUEUE_NAME.STATS_UPDATE,
					JSON.stringify({
						type: REDIS_KEY.ContractDeploymentHistory,
						date: blockExtractedData.timestamp
							? blockExtractedData.timestamp
							: Date.now(),
						txnCount: _txns.contractDeployment,
					}),
				);

			/* emit the latest transactions data */
			if (emitTx)
				SocketEventEmitter.emitMessage(
					SOCKET_EVENT.LATEST_TRANSACTION,
					transactionsArr,
				);

			return {
				block: blockExtractedData,
				transactions: transactionsArr,
			};
		} catch (error) {
			console.log(
				'error while fetching and emiting block and transaction data ',
				error,
			);
			return null;
		}
	}

	/**
	 * Process transaction data save transactions according to their type
	 * @param tx
	 */
	async processTransactions(tx: ITransactionPayload) {
		try {
			const transactions = { ...tx };
			rabbitmqService.enqueueData(
				QUEUE_NAME.STATS_UPDATE,
				JSON.stringify({
					type: REDIS_KEY.TxFeeHistory,
					date: new Date(transactions.timestamp).getTime()
						? new Date(transactions.timestamp).getTime()
						: Date.now(),
					txnCount: Number(
						(Number(transactions.gas) *
							Number(transactions.gasPrice)) /
							1e18,
					),
				}),
			);

			delete transactions.logs;
			const txData = await explorerHelper.saveTransactions(
				transactions as ITransaction,
			);
			if (txData) {
				let txCount = await RedisService.getString(
					REDIS_KEY.TRANSACTIONS_COUNT,
				);

				if (!txCount) {
					// First time, get the count from the database
					txCount = await prisma.blocks.count();
					await RedisService.setString(
						REDIS_KEY.TRANSACTIONS_COUNT,
						txCount,
					);
				} else {
					// Increment the block count
					txCount = Number(txCount) + 1;
					await RedisService.setString(
						REDIS_KEY.TRANSACTIONS_COUNT,
						txCount,
					);
				}
			}
			switch (tx.type) {
				case TRANSACTION_TYPE.CONTRACT_CREATION:
					console.log('CONTRACT_CREATION CASE: ', `${tx.txhash}`);
					/* Contract Craetion Transaction Saving Code space */
					await this.handleContractCreation(tx);
					break;

				case TRANSACTION_TYPE.CONTRACT_TRANSFER:
					/* Contract Transfer or execution Transaction Saving Code space */
					console.log('CONTRACT_TRANSFER CASE: ', `${tx.txhash}`);
					await this.handleContractExecution(tx);
					RabbitMqService.enqueueData(
						'DECODE_NEW_TRANSACTION',
						JSON.stringify({ txHash: tx.txhash }),
					);
					break;

				case TRANSACTION_TYPE.COIN_TRANSFER:
					/* Coin Transfer Transaction Count Saving Code space */
					await this.handleCoinTransfer(tx);
					break;

				default:
					throw new Error('unknown transaction type.');
					break;
			}
			return {
				error: false,
				message: RES_MSG.TRANSACTION_ADDED,
				data: { isAdded: true },
			};
		} catch (error) {
			console.log('Error in processContractTx : ', error);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	}

	/**
	 * handle contract creation part and save it to db
	 * @param tx
	 */
	private async handleContractCreation(tx: ITransactionPayload) {
		try {
			const contractType =
				(await this.getContractTypes(tx?.contractAddress)) ||
				CONTRACT_TYPE.UNKNOWN;

			let decimal: number;
			let tokenName: string;
			let totalSupply: number;
			let tokenSymbol: string;
			let tokenbalance: string;

			try {
				decimal = Number(
					await contractType?.contract?.methods?.decimals().call(),
				);
			} catch (error) {
				decimal = 0;
			}

			try {
				totalSupply = Number(
					await contractType?.contract?.methods?.totalSupply().call(),
				);
			} catch (error) {
				totalSupply = 0;
			}

			try {
				tokenName = await contractType?.contract?.methods
					?.name()
					.call();
			} catch (error) {
				tokenName = '';
			}

			try {
				tokenSymbol = await contractType?.contract?.methods
					?.symbol()
					.call();
			} catch (error) {
				tokenSymbol = '';
			}
			try {
				tokenbalance = await contractType.contract.methods
					.balanceOf(tx.fromAddress)
					.call();
			} catch (error) {
				tokenbalance = '';
			}

			const bytecode = await Web3SocketHelper.web3Ws.eth.getCode(
				tx?.contractAddress,
			);

			const contractDetails: IContracts = {
				txHash: tx?.txhash,
				timestamp: tx.timestamp,
				contractName: tokenName,
				creator: tx.fromAddress,
				blockHash: tx?.blockhash,
				address: tx?.contractAddress,
				contractType: contractType.type,
				bytecode,
				blockNumber: Number(tx?.blocknumber),
				bytecodeHash: hashString(bytecode),
			};

			const contractSaveRes = await explorerHelper.saveContractDeployTx(
				contractDetails,
				noExponent(tokenbalance ?? ''),
			);

			if (contractSaveRes.error) throw new Error(contractSaveRes.message);

			if (
				contractType.type === CONTRACT_TYPE.ERC20 ||
				contractType.type === CONTRACT_TYPE.ERC721
			) {
				const tokens: ITokens = {
					tokenName,
					tokenSymbol,
					creator: tx.fromAddress,
					blockHash: tx.blockhash,
					type: contractType.type,
					decimal: noExponent(decimal),
					blockNumber: tx.blocknumber,
					totalSupply: noExponent(totalSupply),
					contractAddress: tx?.contractAddress,
				};

				explorerHelper.saveToken(tokens);
			}

			return contractSaveRes;
		} catch (error) {
			console.log('error while processing contract creation ', error);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	}

	/**
	 * handle contract transaction or execution part and save it to db
	 * @param tx
	 */
	private async handleContractExecution(tx: ITransactionPayload) {
		try {
			const contractType =
				(await this.getContractTypes(tx?.toAddress)) ||
				CONTRACT_TYPE.UNKNOWN;

			// Check if contractType is "UNKNOWN"
			if (contractType.type === CONTRACT_TYPE.UNKNOWN) {
				const data = await prisma.contracts.update({
					where: {
						address: tx.toAddress,
					},
					data: {
						updatedAt: new Date(tx.timestamp).toISOString(),
					},
				});
			}

			// const methodSignature = topics[0].substring(0, 10);
			const methodSignature = tx.input ? tx.input.slice(0, 10) : '';

			let method = methodSignature;
			if (contractType.type !== CONTRACT_TYPE.UNKNOWN) {
				method = Web3Helper.getEventValue(
					methodSignature,
					contractType.type,
				);
			}

			if (tx?.logs?.length) {
				for (let i = 0; i < tx?.logs?.length; i += 1) {
					const topics = tx?.logs[i].topics;
					const fromAddress =
						Web3SocketHelper.web3Ws.utils.toChecksumAddress(
							`0x${topics[1].substring(26, topics[1].length)}`,
						);

					const toAddress =
						Web3SocketHelper.web3Ws.utils.toChecksumAddress(
							`0x${topics[2].substring(26, topics[2].length)}`,
						);

					// let method: string = (await explorerHelper.getEventValue(
					// 	methodSignature,
					// )) as string;

					// if (method.includes('watch')) {
					// 	method = method.replace(
					// 		'watch_tg_invmru_f6545ba',
					// 		'approval',
					// 	);
					// }

					// Check if contractType is "UNKNOWN"
					if (contractType.type === 'UNKNOWN') {
						await prisma.contracts.update({
							where: {
								address: tx.toAddress,
							},
							data: {
								updatedAt: new Date(tx.timestamp).toISOString(),
							},
						});
					}

					// if (
					// 	tx.toAddress !== toAddress &&
					// 	method === 'transfer' &&
					// 	contractType.type === CONTRACT_TYPE.ERC20
					// ) {
					// 	await explorerHelper.updateTransactionTable(
					// 		tx.txhash,
					// 		tx.toAddress,
					// 		toAddress,
					// 	);
					// }

					const contractLogData: IContractLogs = {
						logs: JSON.stringify(tx.logs),
						topics,
						method,
						gasFee: tx.gas,
						methodSignature,
						txHash: tx.txhash,
						status: tx.status,
						blockHash: tx.blockhash,
						timestamp: tx.timestamp,
						contractAddress: tx.toAddress,
						blockNumber: Number(tx.blocknumber),
					};

					const logsRes =
						await explorerHelper.saveContractLogs(contractLogData);

					if (await explorerHelper.ifContractExist(tx.toAddress)) {
						await explorerHelper.updateContractExec(tx.toAddress);
					}
					let fromRes: any;
					let toRes: any;

					if (
						fromAddress !==
						'0x0000000000000000000000000000000000000000'
					) {
						const tokenbalancefrom =
							await contractType.contract.methods
								.balanceOf(fromAddress)
								.call();

						fromRes = await explorerHelper.upsertHolder({
							address: fromAddress,
							contractAddress: tx.toAddress,
							tokenBalance: exp(`${tokenbalancefrom}`),
						});
					}
					if (fromAddress !== toAddress) {
						const tokenbalanceTo =
							await contractType.contract.methods
								.balanceOf(toAddress)
								.call();
						toRes = await explorerHelper.upsertHolder({
							address: toAddress,
							contractAddress: tx.toAddress,
							tokenBalance: exp(`${tokenbalanceTo}`),
						});
					}

					let totalSupply: number;
					try {
						totalSupply = Number(
							await contractType?.contract?.methods
								?.totalSupply()
								.call(),
						);
					} catch (error) {
						totalSupply = 0;
					}

					await explorerHelper.updateToken({
						contractAddress: tx?.toAddress,
						totalSupply: noExponent(totalSupply),
					});

					if (logsRes?.error || fromRes?.error || toRes?.error)
						throw new Error(
							'Error while saving contract execution details',
						);
				}
			}
			return {
				error: false,
				message: RES_MSG.ERROR,
				data: { isAdded: true },
			};
		} catch (error) {
			console.log('Error while handleContractTransfer : ', error);
			return {
				error: true,
				message: RES_MSG.ERROR,
				data: { isAdded: false },
			};
		}
	}

	/**
	 * handle noraml transactions part and save it to db
	 * @param tx
	 */
	private async handleCoinTransfer(tx: ITransactionPayload) {
		const copiedObject: ICOINTX = {
			txhash: tx.txhash,
			blocknumber: tx.blocknumber,
			blockhash: tx.blockhash,
			status: tx.status,
			fromAddress: tx.fromAddress,
			toAddress: tx.toAddress,
			timestamp: tx.timestamp,
			gas: Number(exp(`${tx.gas}`)),
			value: exp(`${tx.value}`),
			txFee: exp(`${tx.txFee}`),
			gasPrice: Number(exp(`${tx.gasPrice}`)),
		};

		const coinTxRes = await explorerHelper.coinTransferTxSave(copiedObject);
		return coinTxRes;
	}

	/**
	 * Process missed blocks
	 */
	async ProcessDowntimeBlock() {
		try {
			const lastBlockSaved = await RedisService.getString(
				CONST_NAME.LATEST_BLOCK,
			);
			const newBlock = await Web3SocketHelper.web3Ws.eth.getBlockNumber();

			if (newBlock && lastBlockSaved) {
				const diff = Number(newBlock) - Number(lastBlockSaved);
				console.log(
					'Block Difference Between Latest and Last Saved: ',
					diff,
				);
				if (diff > 1) {
					for (
						let i = Number(lastBlockSaved) + 1;
						i <= Number(newBlock) + 1;
						i += 1
					) {
						// saving missed block to downtime block Queue
						RabbitMqService.enqueueData(
							QUEUE_NAME.DOWNTIME_BLOCK,
							i.toString(),
						);
					}
				} else logger.info('Socket service is uptodate.');
			}
		} catch (error) {
			console.log('Error while getting downtimeblocks : ', error);
		}
	}

	/**
	 * Get details of block and transactions inside this block and save it
	 * @param blockNo
	 */
	async saveDowntimeAndErrBlock(blockNo: number) {
		try {
			const res = await this.processblock(
				blockNo,
				QUEUE_NAME.TRANSACTIONS,
				null,
				false,
				false,
			);
			if (res?.block?.blocknumber) {
				await explorerHelper.saveBlockData(res.block);
				return true;
			}
			return false;
		} catch (error) {
			console.log('saveDowntimeAndErrBlock Error', error);
			return false;
		}
	}

	/**
	 * Acept contract address and return type of it
	 * @param contractAddress
	 * @returns
	 */
	async getContractTypes(contractAddress: string) {
		try {
			let contract = new Web3SocketHelper.web3Ws.eth.Contract(
				ERC20ABI,
				contractAddress,
			);
			const isERC20 = await this.checkERC20(contractAddress, contract);
			if (isERC20)
				return {
					contract,
					type: CONTRACT_TYPE.ERC20,
				};

			contract = new Web3SocketHelper.web3Ws.eth.Contract(
				ERC721ABI,
				contractAddress,
			);
			// const isERC721 = await this.checkERC721(contractAddress, contract);
			// if (isERC721)
			// 	return {
			// 		contract,
			// 		type: CONTRACT_TYPE.ERC721,
			// 	};

			// contract = new Web3SocketHelper.web3Ws.eth.Contract(
			// 	ERC1155ABI,
			// 	contractAddress,
			// );
			// const isERC1155 = await this.checkERC1155(
			// 	contractAddress,
			// 	contract,
			// );

			// if (isERC1155)
			// 	return {
			// 		contract,
			// 		type: CONTRACT_TYPE.ERC1155,
			// 	};

			const checkContractType =
				await this.checkContractType(contractAddress);
			if (checkContractType) {
				if (checkContractType.type === 'ERC-721') {
					contract = new Web3SocketHelper.web3Ws.eth.Contract(
						ERC721ABI,
						contractAddress,
					);
				} else if (checkContractType.type === 'ERC-1155') {
					contract = new Web3SocketHelper.web3Ws.eth.Contract(
						ERC1155ABI,
						contractAddress,
					);
				}

				return {
					contract,
					type: checkContractType.type,
				};
			}

			return {
				contract,
				type: CONTRACT_TYPE.UNKNOWN,
			};
		} catch (err) {
			console.error('Error detecting contract type:', err);
			return {
				contract: new Web3SocketHelper.web3Ws.eth.Contract(
					ERC20ABI,
					contractAddress,
				),
				type: CONTRACT_TYPE.UNKNOWN,
			};
		}
	}

	/**
	 * check if a contract is erc20 or not
	 * @param contractAddress
	 * @param contract
	 * @returns
	 */
	async checkERC20(_contractAddress: string, contract: any) {
		try {
			// const bytecode = await Web3SocketHelper.web3Ws.eth.getCode(contractAddress);
			// const contract = new Web3SocketHelper.web3Ws.eth.Contract(ERC20ABI, contractAddress)
			const methods = ['totalSupply', 'decimals', 'name'];

			for (let i = 0; i < methods.length; i += 1) {
				const method = methods[i];
				await contract.methods[method]().call();
			}
			return true;
		} catch (err) {
			// console.error('Error checking ERC-20 functions:', err);
			return false;
		}
	}

	/**
	 * check if a contract is erc721 or not
	 * @param contractAddress
	 * @param contract
	 * @returns
	 */
	async checkERC721(_contractAddress: any, contract: any) {
		try {
			// const contract = new Web3SocketHelper.web3Ws.eth.Contract(ERC721ABI, contractAddress)
			return {
				contract,
				state: await contract.methods
					.supportsInterface('0x80AC58CD')
					.call(),
			};
		} catch (err) {
			// console.error('Error checking ERC-721 functions:', err);
			return false;
		}
	}

	async calculateAndUpdateFee(gasfee: string) {
		try {
			let txfee;

			const data = await prisma.txFee.findMany({
				select: {
					fee: true,
					id: true,
				},
			});

			if (data.length === 0) {
				await prisma.txFee.create({
					data: { fee: gasfee },
				});
			} else {
				txfee = data.length === 0 ? 0 : Number(data[0].fee);

				const updatedFee = txfee + Number(gasfee);

				await prisma.txFee.update({
					where: {
						id: data[0].id,
					},
					data: {
						fee: exp(`${updatedFee}`),
					},
				});
			}
			return true;
		} catch (error) {
			logger.error('error while calculating and updating fee:', error);
			return false;
		}
	}

	async checkERC1155(_contractAddress: any, contract: any) {
		try {
			console.log('ERC1155Checking', _contractAddress);
			return {
				contract,
				state: await contract.methods
					.supportsInterface('0xd9b67a26')
					.call(),
			};
		} catch (err) {
			return false;
		}
	}

	async checkContractType(contractAddress: string) {
		const provider = new ethers.JsonRpcProvider(environment.nodeLink);

		const abi = [
			'function supportsInterface(bytes4 interfaceId) external view returns (bool)',
		];
		const ERC721_INTERFACE_ID = '0x80ac58cd'; // IERC721
		const ERC1155_INTERFACE_ID = '0xd9b67a26'; // IERC1155
		const contract = new ethers.Contract(contractAddress, abi, provider);

		try {
			const isERC721 =
				await contract.supportsInterface(ERC721_INTERFACE_ID);
			const isERC1155 =
				await contract.supportsInterface(ERC1155_INTERFACE_ID);

			console.log('supportsInterface(ERC-721):', isERC721);
			console.log('supportsInterface(ERC-1155):', isERC1155);

			if (isERC1155) {
				console.log('The contract is ERC-1155.');
				return {
					contract,
					type: CONTRACT_TYPE.ERC1155,
				};
			}
			if (isERC721) {
				console.log('The contract is ERC-721.');
				return {
					contract,
					type: CONTRACT_TYPE.ERC721,
				};
			}
			console.log('The contract is neither ERC-721 nor ERC-1155.');
			return {
				contract,
				type: CONTRACT_TYPE.UNKNOWN,
			};
		} catch (error) {
			console.error('Error checking contract type:', error);
			return false;
		}
	}
}
export default new ProcessHelper();
