import { Socket, createConnection, isIP } from 'net';
import * as log from './log';

export class TcpSocket {
	private ipAddress: string;
	private port: number;
	private socket?: Socket;
	private nextMessage?: Buffer;
	connected: boolean;
	private connectionIndex: number = 0;
	private connectionChangedHandler: (connected: boolean) => void;

	constructor(ipAddress: string, port: number, connectionChangedHandler: (connected: boolean) => void) {
		this.ipAddress = ipAddress;
		this.port = port;
		this.connected = false;
		this.connectionChangedHandler = connected => {
			this.connected = connected;

			connectionChangedHandler(connected);
		};
	}

	connect(externalAttempt: boolean=true): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.connected) {
				return resolve();
			}

			this.connectionIndex += 1;

			log.verbose('TcpSocket.connect', `Connecting to ${this.ipAddress}`);

			let connectPromiseResolved = false;

			this.socket = createConnection({
				port: this.port,
				host: this.ipAddress,
				family: isIP(this.ipAddress)
			}, () => {
				this.connectionChangedHandler(true);
				connectPromiseResolved = true;

				resolve();
			});

			this.socket.on('data', data => {
				this.nextMessage = data;
			});

			this.socket.on('error', error => {
				if (connectPromiseResolved) {
					log.error('Socket Error:', error.message || error);
				}
			});

			this.socket.on('close', hadError => {
				let baseMessage = `Socket closed${hadError ? ' (with error)' : ''}`;

				if (connectPromiseResolved) {
					log.warn(`${baseMessage} - attempting restart`);

					this.connectionChangedHandler(false);
					this.connect(false);
				} else if (externalAttempt) {
					log.warn(`${baseMessage} during connection process - not attempting restart`);

					reject(new Error('Unable to connect to device. Are you on the same WiFi network?'));
				} else {
					log.warn(`${baseMessage} during connection process - attempting restart in 10 seconds`);

					this.connectionChangedHandler(false);
					setTimeout(() => this.connect(false), 10000);;
				}
			});

			this.socket.on('timeout', () => {
				log.warn('Socket timeout');
			});
		});
	}

	async disconnect(): Promise<void> {
		await new Promise(resolve => {
			if (this.connected && this.socket) {
				this.socket.end(resolve);
			} else {
				resolve();
			}
		});
	}

	async send(message: Buffer): Promise<void> {
		await new Promise((resolve, reject) => {
			if (this.socket) {
				this.socket.write(message, resolve);
			} else {
				reject(new Error('Socket isn\'t running, please call connect()'));
			}
		});
	}

	async sendWaitForResponse(message: Buffer): Promise<Buffer> {
		this.nextMessage = undefined;

		const preSendConnectionIndex = this.connectionIndex;
		await this.send(message);

		return new Promise((resolve, reject) => {
			const timeout = 10000;
			const intervalTime = 10;

			let attempts = 0;
			const interval = setInterval(() => {
				if (this.nextMessage) {
					clearInterval(interval);

					resolve(this.nextMessage);
				} else if (preSendConnectionIndex < this.connectionIndex) {
					clearInterval(interval);

					reject(new Error('Socket failed while sending (Symptom of invalid message sent to socket)'));
				} else if (attempts++ > timeout / intervalTime) {
					clearInterval(interval);

					reject(new Error('Response timeout exceeded'));
				}
			}, 10);
		});
	}
}
