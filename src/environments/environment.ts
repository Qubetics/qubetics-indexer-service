import * as fs from 'fs';
import * as path from 'path';
import { config as configDotenv } from 'dotenv';

import { EnvironmentFile, Environments } from './environment.constant';
import IEnvironment from './environment.interface';

class Environment implements IEnvironment {
	public port: number;

	public secretKey: string;

	public applyEncryption: boolean;

	public env: string;

	public saltValue: number;

	public nodeLink: string;

	public databaseUrl: string;

	public redisHost: string;

	public redisPort: string;

	public rabbitMq: string;

	public cluster: boolean;

	public coinMarketApi: string;

	public coinMarketKey: string;

	public currency: string;

	public symbol: string;

	public evmHost: string;

	public byteDirectory: string;

	public wsUrl: string;

	public address_prefix: string;

	public wsSync: boolean;

	public projectName: string;

	public delegatorPrefix: string;

	public initialSupply: number;

	public nativeAPIUrl: string;
	/**
	 *
	 * @param NODE_ENV
	 */
	constructor(NODE_ENV?: string) {
		this.env = NODE_ENV || process.env.NODE_ENV || Environments.DEV;
		this.setEnvironment(this.env);
		const port: string | undefined | number = process.env.PORT || 3146;
		this.port = Number(port);
		this.secretKey = <string>process.env.SECRET_KEY;
		this.saltValue = (process.env.SALT_VALUE as unknown as number) || 10;
		this.nodeLink = <string>process.env.EVM_TENDERMENT_HTTP_HOST;
		this.databaseUrl = <string>process.env.DATABASE_URL;
		this.redisHost = <string>process.env.REDIS_HOST;
		this.redisPort = <string>process.env.REDIS_PORT;
		this.rabbitMq = <string>process.env.RABITMQ_URL;
		this.coinMarketApi = <string>process.env.COIN_MARKET_API_PATH;
		this.coinMarketKey = <string>process.env.COIN_MARKET_API_KEY;
		this.evmHost = <string>process.env.SWAGGER_HTTP_HOST;
		this.byteDirectory = <string>process.env.BYTE_DIRECTORY;
		this.wsUrl = <string>process.env.EVM_TENDERMINT_NODE_WS_URL;
		this.address_prefix = <string>process.env.ADDRESS_PREFIX;
		this.symbol = <string>process.env.TOKEN_SYMBOL;
		this.currency = <string>process.env.TOKEN_CURRENCY;
		this.wsSync = process.env.WS_SYNC !== 'false';
		this.projectName = <string>process.env.PROJECT_NAME || 'qubetics';
		this.delegatorPrefix =
			<string>process.env.DELEGATOR_PREFIX || 'qubetics';
		this.initialSupply = Number(process.env.INITIAL_SUPPLY) || 1361867964;
				this.nativeAPIUrl = <string>process.env.NATIVE_API_BASE_URL;

	}

	/**
	 *
	 * @returns
	 */
	public getCurrentEnvironment(): string {
		return this.env;
	}

	/**
	 *
	 * @param env
	 */
	public setEnvironment(env: string): void {
		let envPath: string;
		this.env = env || Environments.LOCAL;
		const rootdir: string = path.resolve(__dirname, '../../');
		switch (env) {
			case Environments.PRODUCTION:
				envPath = path.resolve(rootdir, EnvironmentFile.PRODUCTION);
				break;
			case Environments.TEST:
				envPath = path.resolve(rootdir, EnvironmentFile.TEST);
				break;
			case Environments.STAGING:
				envPath = path.resolve(rootdir, EnvironmentFile.QA);
				break;
			case Environments.LOCAL:
				envPath = path.resolve(rootdir, EnvironmentFile.LOCAL);
				break;
			default:
				envPath = path.resolve(rootdir, EnvironmentFile.LOCAL);
		}
		if (this.env !== Environments.PRODUCTION && !fs.existsSync(envPath)) {
			throw new Error('.env file is missing in root directory');
		}
		configDotenv({ path: envPath });
	}

	/**
	 *
	 * @returns
	 */
	public isProductionEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.PRODUCTION;
	}

	/**
	 *
	 * @returns
	 */
	public isDevEnvironment(): boolean {
		return (
			this.getCurrentEnvironment() === Environments.DEV ||
			this.getCurrentEnvironment() === Environments.LOCAL
		);
	}

	/**
	 *
	 * @returns
	 */
	public isTestEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.TEST;
	}

	/**
	 *
	 * @returns
	 */
	public isStagingEnvironment(): boolean {
		return this.getCurrentEnvironment() === Environments.STAGING;
	}
}

export default Environment;
