import * as bufferpack from 'bufferpack';
import { TcpSocket } from './tcp-socket';
import { decryptResponse, encryptPacket } from './encryption';
import * as log from './log';
import { RgbColors, HslColors } from './colors';
const lakeside = require('./lakeside_pb.js');

export enum Model {
	// plug
	T1201 = 'T1201',
	T1202 = 'T1202',
	T1203 = 'T1203',
	// light switch
	T1211 = 'T1211',
	// white bulb
	T1011 = 'T1011',
	T1012 = 'T1012',
	// color bulb
	T1013 = 'T1013'
}

export enum DeviceType {
	LIGHT_BULB = 'LIGHT_BULB',
	POWER_PLUG = 'POWER_PLUG',
	SWITCH = 'SWITCH'
}

export const getTypeForModel = (model: Model | string): DeviceType => {
	switch (model) {
		case Model.T1201:
		case Model.T1202:
		case Model.T1203:
			return DeviceType.POWER_PLUG;

		case Model.T1211:
			return DeviceType.SWITCH;

		case Model.T1011:
		case Model.T1012:
		case Model.T1013:
			return DeviceType.LIGHT_BULB;

		default:
			throw new Error('Unknown device model');
	}
}

export const isWhiteLightBulb = (model: Model): boolean => {
	return [Model.T1011, Model.T1012].indexOf(model) > -1;
};

const isPlugOrSwitch = (model: Model): boolean => {
	return [Model.T1201, Model.T1202, Model.T1203, Model.T1211].indexOf(model) > -1;
};

// this is a protobuf packet
export type Packet = any & {
	serializeBinary: () => Uint8Array;
	deserializeBinary: (bytes: Uint8Array) => Packet;
};

export enum DeviceEvent {
	CONNECTION_STATE_CHANGED = 'CONNECTION_STATE_CHANGED'
}

export interface Device {
	readonly model: Model;
	readonly code: string;
	readonly ipAddress: string;
	readonly name: string;
	readonly deviceType: DeviceType;

	toString(): string;

	on(event: DeviceEvent.CONNECTION_STATE_CHANGED, handler: (connected: boolean) => void): void;

	isConnected(): boolean;
	connect(): Promise<void>;
	disconnect(): Promise<void>;

	loadCurrentState(): Promise<void>;

	isPowerOn(): boolean;
	setPowerOn(on: boolean): Promise<boolean>;

	supportsBrightness(): boolean;
	getBrightness(): number;
	setBrightness(brightness: number): Promise<number>;

	supportsTemperature(): boolean;
	getTemperature(): number;
	setTemperature(temperature: number): Promise<number>;

	supportsColors(): boolean;
	getRgbColors(): RgbColors;
	setRgbColors(red: number, green: number, blue: number): Promise<RgbColors>;
	getHslColors(): HslColors;
	setHslColors(hue: number, saturation: number, lightness: number): Promise<HslColors>;
}

export abstract class AbstractDevice implements Device {
	readonly model: Model;
	readonly code: string;
	readonly ipAddress: string;
	readonly name: string;
	readonly deviceType: DeviceType;

	private readonly socket: TcpSocket;
	private onConnectionEventHandler: Array<(connected: boolean) => void>;

	protected power?: boolean;

	constructor(model: Model, code: string, ipAddress: string, name?: string) {
		log.verbose('AbstractDevice.new', `Create device (model: ${model}, code: ${code})`);

		this.model = model;
		this.code = code;
		this.ipAddress = ipAddress;
		if (name) {
			this.name = name;
		} else {
			switch (this.deviceType) {
				case DeviceType.LIGHT_BULB:
					this.name = 'Unnamed Light Bulb';
					break;

				case DeviceType.SWITCH:
					this.name = 'Unnamed Switch';
					break;

				case DeviceType.POWER_PLUG:
					this.name = 'Unnamed Power Plug';
					break;
				default:
					this.name = 'Unknown Device';
			}
		}
		this.deviceType = getTypeForModel(model);

		this.onConnectionEventHandler = [];
		this.socket = new TcpSocket(this.ipAddress, 55556, connected => {
			log.verbose('AbstractDevice.new', 'TCP Socket connected');

			this.onConnectionEventHandler.forEach(handler => handler(connected));
		});
	}

	toString(): string {
		return `${this.name} (Model: ${this.model}, Code: ${this.code}, IP Address: ${this.ipAddress})`;
	}

	on(event: DeviceEvent, handler: (connected: boolean) => void) {
		log.verbose('AbstractDevice.on', `Attaching event handler "${event}"`);

		if (event === DeviceEvent.CONNECTION_STATE_CHANGED) {
			this.onConnectionEventHandler.push(handler);
		} else {
			log.error(`Unknown event ${event}`);
		}
	}

	isConnected(): boolean {
		return this.socket.connected;
	}

	private isConnecting: boolean = false;

	async connect(): Promise<void> {
		log.verbose('AbstractDevice.connect', 'Connecting');

		if (this.isConnecting) {
			log.verbose('AbstractDevice.connect', 'Stopping - currently trying to connect');

			return;
		}

		this.isConnecting = true;

		await this.socket.connect();

		log.verbose('AbstractDevice.connect', `Connected to device ${this.toString()}`);

		log.verbose('AbstractDevice.connect', 'Loading current device state');

		await this.loadCurrentState();

		this.isConnecting = false;
	}

	async disconnect(): Promise<void> {
		log.verbose('AbstractDevice.disconnect', 'Disconnecting');

		await this.socket.disconnect();

		this.onConnectionEventHandler = [];
	}

	abstract loadCurrentState(): Promise<void>;
	abstract setPowerOn(on: boolean): Promise<boolean>;

	isPowerOn(): boolean {
		log.verbose('AbstractDevice.isPowerOn', 'Checking power state');

		if (this.power === undefined) {
			throw new Error(`Unknown device state - call loadCurrentState()`);
		}

		return this.power;
	}

	abstract supportsBrightness(): boolean;
	abstract getBrightness(): number;
	abstract setBrightness(brightness: number): Promise<number>;

	abstract supportsTemperature(): boolean;
	abstract getTemperature(): number;
	abstract setTemperature(temperature: number): Promise<number>;

	abstract supportsColors(): boolean;
	abstract getRgbColors(): RgbColors;
	abstract setRgbColors(red: number, green: number, blue: number): Promise<RgbColors>;
	abstract getHslColors(): HslColors;
	abstract setHslColors(hue: number, saturation: number, lightness: number): Promise<HslColors>;

	private encryptPacket(packet: Packet): Buffer {
		log.verbose('AbstractDevice.encryptPacket', packet);

		let serializedPacket: Uint8Array;
		try {
			serializedPacket = packet.serializeBinary();
		} catch (e) {
			throw new Error('Error serializing packet: ' + (e.message || 'Unknown'));
		}

		log.verbose('AbstractDevice.encryptPacket', 'Serialized:', Buffer.from(serializedPacket).toString('hex'));

		try {
			return encryptPacket(serializedPacket);
		} catch (e) {
			throw new Error('Error encrypting packet: ' + (e.message || 'Unknown'));
		}
	}

	protected async sendPacket(packet: Packet): Promise<void> {
		log.verbose('AbstractDevice.sendPacket', packet);

		if (!this.isConnected()) {
			log.verbose('AbstractDevice.sendPacket', 'Not connected - connecting first');

			await this.connect();
		}

		const encryptedPacket = this.encryptPacket(packet);

		log.verbose('AbstractDevice.sendPacket', 'Sending encrypted packet');

		try {
			await this.socket.send(encryptedPacket);
		} catch (error) {
			log.error('Retrying sending sending packet to device after error:', error.message || error);

			await this.connect();

			log.verbose('AbstractDevice.sendPacket', 'Re-connected - trying to re-send packet');

			await this.socket.send(encryptedPacket);
		}
	}

	protected async sendPacketWithResponse(packet: Packet): Promise<Packet> {
		log.verbose('AbstractDevice.sendPacketWithResponse', packet);

		if (!this.isConnected()) {
			log.verbose('AbstractDevice.sendPacketWithResponse', 'Not connected - connecting first');

			await this.connect();
		}

		const encryptedPacket = this.encryptPacket(packet);

		log.verbose('AbstractDevice.sendPacket', 'Sending encrypted packet');

		let response;
		try {
			response = await this.socket.sendWaitForResponse(encryptedPacket);
		} catch (error) {
			log.error('Retrying sending sending packet to device after error:', error.message || error);

			await this.connect()

			log.verbose('AbstractDevice.sendPacketWithResponse', 'Re-connected - trying to re-send packet');

			response = await this.socket.sendWaitForResponse(encryptedPacket);
		}

		log.verbose('AbstractDevice.sendPacketWithResponse', 'Response received:', response.toString('hex'));

		const decrypted = decryptResponse(response);

		log.verbose('AbstractDevice.sendPacketWithResponse', 'Response decrypted:', decrypted.toString('hex'));

		const packetLength = bufferpack.unpack('<H', decrypted.slice(0, 2))[0];

		log.verbose('AbstractDevice.sendPacketWithResponse', 'Expected packet length:', packetLength);

		const serializedPacket = decrypted.slice(2, packetLength + 2);

		log.verbose('AbstractDevice.sendPacketWithResponse', 'Serialized packet:', serializedPacket.toString('hex'));
		log.verbose('AbstractDevice.sendPacketWithResponse', 'Serialized packet length:', serializedPacket.length);

		if (isWhiteLightBulb(this.model)) {
			log.verbose('AbstractDevice.sendPacketWithResponse', 'Deserializing response as T1012Packet');

			return lakeside.T1012Packet.deserializeBinary(serializedPacket);
		} else if (this.model === Model.T1013) {
			log.verbose('AbstractDevice.sendPacketWithResponse', 'Deserializing response as T1013Packet');

			return lakeside.T1013Packet.deserializeBinary(serializedPacket);
		} else if (isPlugOrSwitch(this.model)) {
			log.verbose('AbstractDevice.sendPacketWithResponse', 'Deserializing response as T1201Packet');

			return lakeside.T1201Packet.deserializeBinary(serializedPacket);
		} else {
			throw new Error(`Unable to deserialize response for model "${this.model}"`);
		}
	}

	protected async getSequence(): Promise<number> {
		log.verbose('AbstractDevice.getSequence', 'Loading current sequence number');

		const packet = new lakeside.T1012Packet();
		packet.setSequence(Math.round(Math.random() * 3000000));
		packet.setCode(this.code);

		packet.setPing(new lakeside.Ping());
		packet.getPing().setType(0);

		const response = await this.sendPacketWithResponse(packet);
		const currentSequence = response.getSequence();

		log.verbose('AbstractDevice.getSequence', 'Current sequence number:', currentSequence);

		if (currentSequence > 0x80000000) {
			log.warn('WARNING: There is a bug with Eufy devices that might mean that your device will disconnect! For further information, go: https://github.com/sebmos/node-eufy-api/issues');
		}

		return currentSequence + 1;
	}
}
