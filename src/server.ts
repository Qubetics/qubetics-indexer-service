import * as http from 'http';
import { AddressInfo } from 'net';
import Environment from './environments/environment';
import { setGlobalEnvironment } from './global';
const env: Environment = new Environment();
setGlobalEnvironment(env);
import App from './App';
import CronService from './cron/index';
import SocketHelper from './service/socket.heper';
import logger from './lib/logger';
import { connectToDatabase } from './lib/db';
import { Web3SocketHelper } from './helper/web3.helper';
import processHelper from './helper/process.helper';
import { StatsUpdater } from './service/stats.service';
import countHelper from './helper/count.helper';

declare global {
	namespace NodeJS {
		interface Global {
			socket?: Socket;
		}
	}
}

const app: App = new App();
let server: http.Server;

function serverError(error: NodeJS.ErrnoException): void {
	if (error.syscall !== 'listen') {
		throw error;
	}

	throw error;
}

function serverListening(): void {
	const addressInfo: AddressInfo = <AddressInfo>server.address();
	logger.info(`Listening on ${addressInfo.address}:${env.port}`);
	connectToDatabase();
}

app.init()
	.then(async () => {
		const instance = Web3SocketHelper.getInstance();
		await instance.initializeWsConnection();
		await countHelper.initializeCount();
		await new StatsUpdater().start();
		processHelper.ProcessDowntimeBlock();
		processHelper.subscribeBlocksWs();
		CronService.saveTokenPrice();
		CronService.checkValidators();
		CronService.updateGraph();
		CronService.checkPendingTransaction();
		// processHelper.ProcessMissedBlockAndTxn();

		app.express.set('port', env.port);
		server = app.httpServer;
		server.on('error', serverError);
		server.on('listening', serverListening);

		server.listen(env.port);
		connectSocket(server);
	})
	.catch((err: Error) => {
		logger.info('Error while app initlization\n');
		logger.error(err.message);
	});

function connectSocket(serverInstance: http.Server): void {
	const io: NodeJS.Socket = require('socket.io')(serverInstance, {
		cors: {
			origin: ['https://socket.io', 'http://localhost:3000', '*'],

			credentials: true,
		},

		allowEIO3: true,
	});
	const globalData = global as unknown as NodeJS.Global;
	globalData.socket = io;
	new SocketHelper(io);
}

// handle the service level unhandled rejection
process.on('unhandledRejection', (reason: Error) => {
	logger.error('\x1b[31mUnhandled Rejection (reason)\x1b[0m: ');
	console.error(reason);
});
