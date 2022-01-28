import { AbstractDevice, Message, getProto } from './device-base.js';
import { RgbColors, HslColors } from './colors.js';
import * as log from './log.js';

export class PowerPlugOrSwitch extends AbstractDevice {
	private async getState(): Promise<Message> {
		log.verbose('PowerPlugOrSwitch.getState', 'Loading current device state');

		const proto = await getProto();
		const packetType = proto.lookupType('lakeside.T1201Packet');
		const packet = packetType.encode({
			sequence: await this.getSequence(),
			code: this.code,
			switchinfo: {
				type: 1
			}
		}).finish();

		log.verbose('PowerPlugOrSwitch.getState', 'Sending request to device');

		return await this.sendPacketWithResponse(packet);
	}

	async loadCurrentState(): Promise<void> {
		log.verbose('PowerPlugOrSwitch.loadCurrentState', 'Loading current device state');

		const response = await this.getState();

		this.power = response.switchinfo.packet.switchstatus.power === 1;

		log.verbose('PowerPlugOrSwitch.loadCurrentState', 'Current power state:', this.power);
	}

	async setPowerOn(powerOn: boolean): Promise<boolean> {
		log.verbose('PowerPlugOrSwitch.setPowerOn', 'Change to:', powerOn);

		const proto = await getProto();
		const packetType = proto.lookupType('lakeside.T1201Packet');
		const packet = packetType.encode({
			switchinfo: {
				type: 0,
				packet: {
					unknown1: 100,
					switchset: {
						command: 7,
						state: powerOn ? 1 : 0
					}
				}
			},
			sequence: await this.getSequence(),
			code: this.code
		}).finish();

		log.verbose('PowerPlugOrSwitch.setState', 'Sending packet');

		await this.sendPacket(packet);

		log.verbose('PowerPlugOrSwitch.setState', 'Reloading state');

		await this.loadCurrentState();

		log.verbose('PowerPlugOrSwitch.setState', 'New power state:', this.power);

		return this.power!;
	}

	supportsBrightness(): boolean {
		return false;
	}

	getBrightness(): number {
		throw new Error('Plug or switch doesn\'t support brightness');
	}

	setBrightness(brightness: number): Promise<number> {
		return Promise.reject(new Error('Plug or switch doesn\'t support brightness'));
	}

	supportsTemperature(): boolean {
		return false;
	}

	getTemperature(): number {
		throw new Error('Plug or switch doesn\'t support temperature');
	}

	setTemperature(temperature: number): Promise<number> {
		return Promise.reject(new Error('Plug or switch doesn\'t support temperature'));
	}

	supportsColors(): boolean {
		return false;
	}

	getRgbColors(): RgbColors {
		throw new Error('Plug or switch doesn\'t support colors');
	}

	setRgbColors(red: number, green: number, blue: number): Promise<RgbColors> {
		return Promise.reject(new Error('Plug or switch doesn\'t support colors'));
	}

	getHslColors(): HslColors {
		throw new Error('Plug or switch doesn\'t support colors');
	}

	setHslColors(hue: number, saturation: number, lightness: number): Promise<HslColors> {
		return Promise.reject(new Error('Plug or switch doesn\'t support colors'));
	}
}
