import { Socket, Server } from 'socket.io';

type GlobalWithSocket = {
	socket: Socket;
};

declare const global: GlobalWithSocket;
class SocketEventEmitter {
	emitMessage<T>(eventName: string, data: T) {
		const globalVar: GlobalWithSocket = global;
		console.log('globalVar', globalVar);
		if (!globalVar.socket) {
			console.error('Socket is not initialized!');
			return;
		}
		globalVar.socket.emit(eventName, data);
	}
}

export default new SocketEventEmitter();
