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
	private keepAliveInterval?: NodeJS.Timeout;
	private onConnectionEventHandler: Array<(connected: boolean) => void>;

	protected power?: boolean;

	constructor(model: Model, code: string, ipAddress: string, name?: string) {
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
			this.onConnectionEventHandler.forEach(handler => handler(connected));
		});
	}

	toString(): string {
		return `${this.name} (Model: ${this.model}, Code: ${this.code}, IP Address: ${this.ipAddress})`;
	}

	on(event: DeviceEvent, handler: (connected: boolean) => void) {
		if (event === DeviceEvent.CONNECTION_STATE_CHANGED) {
			this.onConnectionEventHandler.push(handler);
		} else {
			log.error(`Unknown event ${event}`);
		}
	}

	isConnected(): boolean {
		return this.socket.connected;
	}

	async connect(): Promise<void> {
		await this.socket.connect();

		log.verbose(`Connected to device ${this.toString()}`);

		// no need to add this to promise chain
		this.keepAliveInterval = setInterval(() => this.getSequence(), 10000);

		return await this.loadCurrentState();
	}

	async disconnect(): Promise<void> {
		await this.socket.disconnect();

		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval);
			this.keepAliveInterval = undefined;
		}
		this.onConnectionEventHandler = [];
	}

	abstract loadCurrentState(): Promise<void>;
	abstract setPowerOn(on: boolean): Promise<boolean>;

	isPowerOn(): boolean {
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

	protected async sendPacket(packet: Packet): Promise<void> {
		const encryptedPacket = encryptPacket(packet.serializeBinary());

		try {
			await this.socket.send(encryptedPacket);
		} catch (e) {
			await this.connect();
			await this.socket.send(encryptedPacket);
		}
	}

	protected async sendPacketWithResponse(packet: Packet): Promise<Packet> {
		const encryptedPacket = encryptPacket(packet.serializeBinary());

		let response;
		try {
			response = await this.socket.sendWaitForResponse(encryptedPacket);
		} catch (e) {
			await this.connect()
			response = await this.socket.sendWaitForResponse(encryptedPacket);
		}

		const decrypted = decryptResponse(response);

		const packetLength = bufferpack.unpack('<H', decrypted.slice(0, 2))[0];
		const serializedPacket = decrypted.slice(2, packetLength + 2);

		if (isWhiteLightBulb(this.model)) {
			return lakeside.T1012Packet.deserializeBinary(serializedPacket);
		} else if (this.model === Model.T1013) {
			return lakeside.T1013Packet.deserializeBinary(serializedPacket);
		} else if (isPlugOrSwitch(this.model)) {
			return lakeside.T1201Packet.deserializeBinary(serializedPacket);
		} else {
			throw new Error(`Unable to deserialize response for model "${this.model}"`);
		}
	}

	protected async getSequence(): Promise<number> {
		const packet = new lakeside.T1012Packet();
		packet.setSequence(Math.round(Math.random() * 3000000));
		packet.setCode(this.code);

		const ping = new lakeside.Ping();
		ping.setType(0);
		packet.setPing(ping);

		const response = await this.sendPacketWithResponse(packet);

		return response.getSequence() + 1;
	}
}
