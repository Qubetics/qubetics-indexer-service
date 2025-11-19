import axios from 'axios';
import { ethers } from 'ethers';
import {
	CMC_PATHS,
	CURRENT_DEFAULT_CIRCULATING_SUPPLY,
	CURRENT_DEFAULT_COIN_PRICE,
	VERIFICATION_TYPE,
} from '../constant/constants';
import {
	RES_MSG,
	REDIS_KEY,
	CONST_NAME,
	TRANSACTION_STATUS,
	QUEUE_NAME,
} from '../constant/response';
import {
	IBlock,
	ITokens,
	ICOINTX,
	IHolders,
	IValidator,
	IContracts,
	IESResponse,
	ITransaction,
	IContractLogs,
	ValidatorData,
	ITextSignature,
} from '../interface/index';
import { prisma } from '../lib/db';
import logger from '../lib/logger';
import { RedisService } from '../service/index';
import rabbitmqService from '../service/rabbitmq.service';
import { fetchRequest } from './common.helper';
import SocketHelper from './socket.helper';
import Web3Helper from './web3.helper';

class ExlorerHelper {
	/**
	 * save blocks data into db
	 * @param blockData
	 * @returns
	 */
	saveBlockData = async (blockData: IBlock): Promise<IESResponse> => {
		try {
			await prisma.blocks.create({
				data: blockData,
			});
			return {
				error: false,
				message: RES_MSG.BLOCK_ADDED,
				data: { isAdded: true },
			};
		} catch (err: any) {
			console.log(err.message, 'saveBlockData Error');
			const error = JSON.parse(JSON.stringify(err));
			console.log('errorCode', error.code);
			if (error.code === 'P2002') {
				console.log('----ooo---');
				return {
					error: true,
					message: RES_MSG.BLOCK_ADDED,
					data: { isAdded: true },
				};
			}
			return {
				error: true,
				message: RES_MSG.BLOCK_ADDED_ERROR,
				data: { isAdded: false },
			};
		}
	};

	/**
	 * save transactions into db
	 * @param txData
	 * @returns
	 */
	saveTransactions = async (txData: ITransaction): Promise<IESResponse> => {
		try {
			const txRes = await prisma.transactions.create({
				data: txData,
			});

			// Call userSave method with relevant data
			const userData = [
				{
					address:
						!txData.toAddress || txData.toAddress === 'N/A'
							? ''
							: txData.toAddress,
				},
				{ address: txData.fromAddress ?? '' },
			];

			await this.userSave(userData);
			// SocketHelper.emitSocket(REDIS_KEY.TPS_GRAPH);

			if (!txRes) {
				throw new Error('error while saving tx and user data');
			}
			return {
				error: false,
				message: RES_MSG.TRANSACTION_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			console.log('error while saving tx detail', err);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	coinTransferTxSave = async (data: ICOINTX): Promise<IESResponse> => {
		try {
			const saveRes = await prisma.coinTransaferTx.create({
				data,
			});

			// await SocketHelper.emitSocket(REDIS_KEY.COIN_TRANSFER_GRAPH);

			if (saveRes)
				return {
					error: false,
					message: RES_MSG.COIN_TRANSACTION_ADDED,
					data: { isAdded: true },
				};
			throw new Error('error while saving coin tx');
		} catch (err) {
			logger.error(`error while saving coin tx detail - ${err}`);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	processUserData = async (data: { address: string }) => {
		try {
			if (data.address) {
				const existingUser = await prisma.users.findUnique({
					where: { address: data.address },
				});

				if (existingUser) {
					await prisma.users.update({
						where: { id: existingUser.id },
						data: {
							txn: Number(existingUser.txn) + CONST_NAME.ONE,
						},
					});
				} else {
					rabbitmqService.enqueueData(
						QUEUE_NAME.STATS_UPDATE,
						JSON.stringify({
							type: REDIS_KEY.NewAccountHistory,
							date: Date.now(),
							txnCount: 1,
						}),
					);
					await prisma.users.create({
						data: {
							address: data.address,
							txn: CONST_NAME.ONE,
						},
					});
				}
			}

			return true;
		} catch (err) {
			logger.error('error while saving user data:', err);
			return false;
		}
	};

	userSave = async (
		userData: Array<{ address: string }>,
	): Promise<IESResponse> => {
		try {
			await Promise.all(userData.map(this.processUserData));

			// await SocketHelper.emitSocket(REDIS_KEY.ACCOUNT_GRAPH);
			return {
				error: false,
				message: RES_MSG.USER_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			logger.error(`error while saving users -${err}`);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	saveContractDeployTx = async (
		contactData: IContracts,
		holderBalance: string,
	): Promise<IESResponse> => {
		try {
			const saved = await prisma.contracts.createMany({
				data: contactData,
				skipDuplicates: true,
			});

			// SocketHelper.emitSocket(REDIS_KEY.CONTRACT_DEPLOY_GRAPH);

			if (saved.count) {
				await this.upsertHolder({
					address: contactData.creator,
					contractAddress: contactData.address,
					tokenBalance: holderBalance,
				});
			}

			const result: any = await prisma.contracts.findMany({
				where: {
					bytecodeHash: contactData.bytecodeHash, // Filter contracts by bytecode (assuming it's a string)
					ContractVerification: {
						verificationType: {
							in: [
								VERIFICATION_TYPE.FULLY_VERIFIED,
								VERIFICATION_TYPE.PARTIAL_VERIFIED,
							],
						},
					},
				},
				include: {
					ContractVerification: true, // Include related contractverification data
				},
			});

			if (result.length) {
				const contractDetails = result[0].ContractVerification;
				delete contractDetails.iconUrl;
				delete contractDetails.implementation;
				delete contractDetails.updatedAt;
				delete contractDetails.id;
				delete contractDetails.contractAddress;

				contractDetails.contractAddress = contactData.address;

				await prisma.contractVerification.upsert({
					where: { contractAddress: contactData.address }, // Check if the product with id: 1 exists
					update: contractDetails,
					create: contractDetails,
				});
			}

			return {
				error: false,
				message: RES_MSG.CONTRACT_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			console.log('error while saving contract deploy details  :  ', err);

			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
				data: { isAdded: false },
			};
		}
	};

	saveContractLogs = async (contractData: IContractLogs) => {
		try {
			console.log('contractData : ', contractData);

			await prisma.contractLogs.create({
				data: contractData,
			});
			return {
				error: false,
				message: RES_MSG.CONTRACT_ADDED,
				data: { isAdded: true },
			};
		} catch (error) {
			console.error('error while save contract events', error);
			return {
				error: true,
				message: RES_MSG.ERROR,
				data: { isAdded: false },
			};
		}
	};

	async updateContractExec(address: string) {
		try {
			await prisma.contracts.update({
				where: {
					address,
				},
				data: {
					updatedAt: new Date(),
				},
			});

			return {
				error: false,
				message: RES_MSG.CONTRACT_ADDED,
				data: { isAdded: true },
			};
		} catch (error) {
			console.log(
				'error while updating contract execution feild : ',
				error,
			);
			return {
				error: true,
				message: RES_MSG.ERROR,
				data: { isAdded: false },
			};
		}
	}

	async upsertHolder(holderData: IHolders) {
		try {
			const existingHolder = await prisma.holders.findMany({
				where: {
					address: holderData.address,
					contractAddress: holderData.contractAddress,
				},
			});
			if (existingHolder.length > 0) {
				// Use Promise.all to perform updates concurrently
				await Promise.all(
					existingHolder.map(async (e) => {
						const updatedHolder = await prisma.holders.update({
							where: {
								id: e.id,
							},
							data: {
								tokenBalance: holderData.tokenBalance,
							},
						});
						console.log('Updated holder:', updatedHolder);
					}),
				);
			} else {
				await prisma.holders.create({
					data: holderData,
				});
			}

			return {
				error: false,
				message: RES_MSG.CONTRACT_ADDED,
				data: { isAdded: true },
			};
		} catch (error) {
			console.error('Error upserting holder:', error);
			return {
				error: true,
				message: RES_MSG.ERROR,
				data: { isAdded: false },
			};
		}
	}

	getEventValue = async (topicDigit: string) => {
		let minLength = Infinity;
		let minIdObject: ITextSignature;

		return new Promise((resolve, reject) => {
			axios
				.get(`${environment.byteDirectory}${topicDigit}`)
				.then((res) => {
					res.data.results.forEach((item: ITextSignature) => {
						const idLength = item.id.toString().length;
						if (idLength < minLength) {
							minLength = idLength;
							minIdObject = item;
						}
					});

					if (minIdObject) resolve(minIdObject.text_signature);
				})
				.catch((error: Error) => {
					reject(error);
				});
		});
	};

	saveToken = async (tokenData: ITokens): Promise<IESResponse> => {
		try {
			await prisma.tokens.create({
				data: tokenData,
			});
			return {
				error: false,
				message: RES_MSG.TOKEN_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			console.error('error while saving token detail', err);
			return {
				error: true,
				message: RES_MSG.BLOCK_ADDED_ERROR,
				data: { isAdded: false },
			};
		}
	};

	updateToken = async (tokenData: any): Promise<IESResponse> => {
		try {
			await prisma.tokens.update({
				where: { contractAddress: tokenData.contractAddress },
				data: tokenData,
			});
			return {
				error: false,
				message: RES_MSG.TOKEN_ADDED,
				data: { isAdded: true },
			};
		} catch (err) {
			console.error('error while saving token detail', err);
			return {
				error: true,
				message: RES_MSG.BLOCK_ADDED_ERROR,
				data: { isAdded: false },
			};
		}
	};

	// OPTIMISE | CLEANUP(CP1): Need to refactor the logic and api calls of below latest coin price updation routine, separate the saving logic to cache storage (redis) and null safty
	saveLatestCoinPriceFromMarket = async () => {
		try {
			const { symbol, currency, coinMarketApi, coinMarketKey } =
				environment;
			const params = {
				symbol: symbol.toUpperCase(),
				convert: currency.toLowerCase(),
			};

			const coinResult = (await fetchRequest(
				`${coinMarketApi}${CMC_PATHS.CRYPTOCURRENCY_QUOTES}${CMC_PATHS.LATEST}`,
				params,
				'get',
				{
					accept: 'application/json',
					'X-CMC_PRO_API_KEY': coinMarketKey,
				},
			)) as {
				price: number;
				volume24h: number;
				marketCap: number;
				circulatingSupply: number;
				volumeChange24h: number;
				percentChange1h: number;
				percentChange24h: number;
				percentChange7d: number;
				percentChange30d: number;
				self_reported_circulating_supply: number;
				self_reported_market_cap: number;
			};

			// For this example, let (C) = 10,000 USD / 1 BTC and let (S) = 17,000,000 BTC.

			// D = C * S
			// D = 10,000 USD / 1 BTC * 17,000,000 BTC = 170,000,000,000 USD

			/**
			 * checks to get the market cap values
			 * if value is 0 for market cap from CMC : display self-reported market cap
			 * if self-reported market cap is 0 : D = C * S where C is the last known price in USD and the S is the current supply
			 */
			if (coinResult) {
				const coinMarketResult = {
					price: coinResult.price.toString(),
					volume24h: coinResult.volume24h.toString(),
					volumeChange24h: coinResult.volumeChange24h.toString(),
					percentChange1h: coinResult.percentChange1h.toString(),
					percentChange24h: coinResult.percentChange24h.toString(),
					percentChange7d: coinResult.percentChange7d.toString(),
					percentChange30d: coinResult.percentChange30d.toString(),
					symbol,
					currency,
				};

				await RedisService.setString(
					REDIS_KEY.MARKET_CAP_PRICE,
					coinMarketResult,
				);

				await prisma.coinmarketInfo.create({
					data: coinMarketResult,
				});
			}

			logger.info('Price updation schedule running, Data below');

			const coinPrice = coinResult?.price ?? CURRENT_DEFAULT_COIN_PRICE;
			const circulating_supply = CURRENT_DEFAULT_CIRCULATING_SUPPLY;
			const marketCapital = coinPrice * circulating_supply;
			console.log({ coinPrice, circulating_supply, marketCapital });
			/**
			 * Uncomment from here
			 */
			// const circulating_supply =
			// 	coinResult?.circulatingSupply !== 0
			// 		? coinResult?.circulatingSupply
			// 		: coinResult?.self_reported_circulating_supply;
			// const marketCapital: number =
			// 	coinResult?.marketCap !== 0
			// 		? coinResult?.marketCap
			// 		: coinResult?.self_reported_market_cap ??
			// 			coinPrice * circulating_supply;
			/**
			 * Uncomment till here
			 */

			await RedisService.setString(REDIS_KEY.MARKET_CAP, marketCapital);
			await RedisService.setString(
				REDIS_KEY.CIRCULATING_SUPPLY,
				circulating_supply,
			);

			await RedisService.setString(REDIS_KEY.COIN_PRICE, coinPrice);
			await SocketHelper.emitSocket(REDIS_KEY.TOKEN_GRAPH);

			return { error: false, data: coinResult };
		} catch (err) {
			logger.error('Unable to save token price.');
			console.error(err);
			return { error: true, data: null };
		}
	};

	checkTransactionStatus = async () => {
		try {
			let pendingTransaction: ITransaction[] =
				await RedisService.getString(REDIS_KEY.PENDING_TX);

			if (!pendingTransaction || !pendingTransaction?.length) {
				logger.info('no pending transaction to check');
				return;
			}

			// Use Promise.all to concurrently check transaction status
			await Promise.all(
				pendingTransaction.map(async (tx) => {
					const txRec = await Web3Helper.getTransactionReceipt(
						tx.txhash,
					);

					if (txRec) {
						// Update the transaction status
						await this.updateTransactionStatus({
							contractAddress:
								txRec.contractAddress ?? CONST_NAME.NA,
							gas: txRec.gasUsed.toString(),
							status: txRec.status
								? TRANSACTION_STATUS.SUCCESS
								: TRANSACTION_STATUS.FAILED,
							txhash: txRec.transactionHash.toString(),
						});
					}
				}),
			);

			// Filter out completed transactions
			pendingTransaction = pendingTransaction.filter((tx) => {
				const txRec = Web3Helper.getTransactionReceipt(tx.txhash);
				return !txRec;
			});

			// Update the pending transaction into Redis
			await RedisService.setString(
				REDIS_KEY.PENDING_TX,
				pendingTransaction,
			);
		} catch (err) {
			logger.error('error while checking the pending transaction: ', err);
			// Handle the error or add retry logic if needed
		}
	};

	updateTransactionStatus = async (txStatus: {
		contractAddress: string;
		gas: string;
		status: TRANSACTION_STATUS;
		txhash: string;
	}): Promise<IESResponse> => {
		try {
			await prisma.transactions.update({
				where: {
					txhash: txStatus.txhash,
				},
				data: {
					contractAddress: txStatus.contractAddress,
					gas: Number(txStatus.gas),
					status: txStatus.status,
				},
			});

			return {
				error: false,
				message: RES_MSG.UPDATE_TX_STATUS,
			};
		} catch (err) {
			logger.error(`error while update tx  status -${err}`);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
			};
		}
	};

	getRedisValue = async (): Promise<
		| {
				supply: number;
				marketCap: number;
				validatorData: ValidatorData;
		  }
		| false
	> => {
		try {
			const supply =
				(await RedisService.getString<number>(
					REDIS_KEY.CIRCULATING_SUPPLY,
				)) || 0;
			const marketCap =
				(await RedisService.getString<number>(REDIS_KEY.MARKET_CAP)) ||
				0;
			const validatorData =
				(await RedisService.getString<any>(REDIS_KEY.VALIDATOR_DATA)) ||
				'';

			return {
				supply,
				marketCap,
				validatorData,
			};
		} catch (err) {
			logger.error('error while getting value from redis ', err);
			return false;
		}
	};

	async getAnalytics() {
		try {
			const obj: {
				supply: number;
				marketCap: number;
				count: number;
				validatorData: ValidatorData;
			} = {
				supply: 0,
				marketCap: 0,
				count: 0,
				validatorData: {
					validator: 0,
					totalValidator: 0,
					bondedRate: 0,
					apy: 0,
				},
			};

			const data = await this.getRedisValue();
			if (data) {
				obj.supply = data?.supply;
				obj.marketCap = data?.marketCap;
				obj.validatorData = data?.validatorData;
			}

			obj.count = await prisma.users.count();
			return obj;
		} catch (error) {
			logger.error('error occureusers.d in getAnalytics: ', error);
			return {};
		}
	}

	async saveCountToRedis(redisKey: string, currentCount: number) {
		try {
			const totalAccounts = await RedisService.getString(redisKey);
			const count = Number(totalAccounts) ?? 0;
			await RedisService.setString(redisKey, count + currentCount);
			return true;
		} catch (err) {
			logger.error('error occured while saving count to redis', err);
			return false;
		}
	}

	async updateAmount(blockNumber: number, transferAmount: string) {
		try {
			await prisma.blocks.update({
				where: {
					blocknumber: blockNumber,
				},
				data: {
					transfer: transferAmount,
				},
			});

			return {
				error: false,
				message: RES_MSG.UPDATE_AMOUNT,
			};
		} catch (err) {
			logger.error('error occured while updating transfer amount', err);
			return {
				error: true,
				message: RES_MSG.SERVER_ERROR,
			};
		}
	}

	saveValidatorData = async (
		validatorData: IValidator,
	): Promise<IESResponse> => {
		try {
			const existingValidator = await prisma.validator.findUnique({
				where: { address: validatorData.address },
			});

			if (existingValidator) {
				// Update the existing validator
				await prisma.validator.update({
					where: { address: validatorData.address },
					data: validatorData,
				});
			} else {
				// Create a new validator
				await prisma.validator.create({
					data: validatorData,
				});
			}

			return {
				error: false,
				message: existingValidator
					? RES_MSG.VALIDATOR_UPDATED
					: RES_MSG.VALIDATOR_ADDED,
			};
		} catch (err: any) {
			console.log(
				`Error while saving validator data for address: ${validatorData.address}`,
				err,
			);
			return {
				error: true,
				message: RES_MSG.VALIDATOR_ADDED_ERROR,
				data: { isAdded: false },
			};
		}
	};

	/**
	 * delete validators
	 * @param address
	 * @returns
	 */
	deleteValidatorData = async (addresses: string[]) => {
		try {
			const deleteCount = await prisma.validator.deleteMany({
				where: {
					NOT: {
						address: {
							in: addresses,
						},
					},
				},
			});

			return {
				error: false,
			};
		} catch (error) {
			console.log('error while deleteValidatorData : ', error);
			return {
				error: true,
			};
		}
	};

	ifContractExist = async (contractAddress: string) => {
		try {
			// abi source code and methods

			const res = await prisma.contracts.findFirst({
				where: {
					address: contractAddress,
				},
			});
			if (res) {
				return true;
			}
			return false;
		} catch {
			return false;
		}
	};

	updateTransactionTable = async (
		txHash: string,
		contractAddress: string,
		toAddress: string,
	) => {
		try {
			await prisma.transactions.update({
				data: {
					contractAddress,
					toAddress,
				},
				where: {
					txhash: txHash,
				},
			});
			return true;
		} catch (error) {
			console.log('Error while update trxn table', error);
			return false;
		}
	};

	async getAndStoreInternalTxs(
		txHash: string,
		blockNumber: number,
		timestamp: Date,
		contractAddress: string,
	) {
		try {
			const provider = new ethers.JsonRpcProvider(environment.nodeLink);
			console.log('calls-provider', provider);
			// const tx = await provider.getTransaction(txHash);

			// const receipt = await provider.getTransactionReceipt(txHash);

			// Send raw RPC call
			const trace = await provider.send('debug_traceTransaction', [
				txHash,
				{ tracer: 'callTracer' },
			]);
			console.log('calls-trace', trace);
			let callTraces: any = trace;

			if (callTraces?.calls) {
				callTraces = callTraces?.calls;
			} else {
				callTraces = [trace];
			}
			console.log('callTraces', callTraces, Array.isArray(callTraces));

			if (callTraces) {
				for (const t of callTraces) {
					if (t.type === 'CALL') {
						console.log('Checking txn', t);
						await prisma.internalTransaction.create({
							data: {
								txnHash: txHash,
								fromAddress: t.from,
								toAddress: t.to,
								value: Number(t.value).toString(),
								input: t?.input || '',
								callType: t.type,
								blockNumber,
								timestamp,
								gas: Number(t.gas),
								gasUsed: Number(t.gasUsed),
								output: t.output,
								contractAddress,
								method: 'Transfer',
							},
						});

						await this.updateBalance(t.from);
						await this.updateBalance(t.to);
						await this.updateBalance(contractAddress);
					}
				}
			}

			return true;
		} catch (error) {
			console.log('error', error);
			return false;
		}
	}

	updateBalance = async (wallet_address: string): Promise<any> => {
		try {
			if (wallet_address) {
				const balance = await Web3Helper.getBalance(wallet_address);
				const updateData: any = {
					address: wallet_address,
					balance: balance.toString(),
					txn: {
						increment: 1,
					},
				};
				console.log('updateBalance', updateData);
				const isExist = await prisma.users.findFirst({
					where: { address: wallet_address },
				});

				if (isExist) {
					await prisma.users.update({
						where: { address: wallet_address },
						data: updateData,
					});
				} else {
					await prisma.users.create({
						data: {
							address: wallet_address,
							balance: balance.toString(),
							txn: 1,
						},
					});
				}
			}

			return true;
		} catch (err) {
			console.error('Error creating new user:', err);
			return false;
		}
	};
}

export default new ExlorerHelper();
