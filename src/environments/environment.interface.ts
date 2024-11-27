interface IEnvironment {
	port: number;
	secretKey: string;
	applyEncryption: boolean;
	databaseUrl: string;
	nodeLink: string;
	saltValue: number;
	redisHost: string;
	redisPort: string;
	rabbitMq: string;
	cluster: boolean;
	coinMarketApi: string;
	coinMarketKey: string;
	currency: string;
	symbol: string;
	evmHost: string;
	byteDirectory: string;
	getCurrentEnvironment(): string;
	setEnvironment(env: string): void;
	isProductionEnvironment(): boolean;
	isDevEnvironment(): boolean;
	isTestEnvironment(): boolean;
	isStagingEnvironment(): boolean;
}

export default IEnvironment;
