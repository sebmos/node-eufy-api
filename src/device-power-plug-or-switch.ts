import { AbstractDevice, Packet } from './device-base';
import { RgbColors, HslColors } from './colors';
import * as log from './log';
const lakeside = require('./lakeside_pb.js');

export class PowerPlugOrSwitch extends AbstractDevice {
	private async getState(): Promise<Packet> {
		log.verbose('PowerPlugOrSwitch.getState', 'Loading current device state');

		const packet = new lakeside.T1201Packet();
		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		packet.setSwitchinfo(new lakeside.SwitchInfo());
		packet.getSwitchinfo().setType(1);

		log.verbose('PowerPlugOrSwitch.getState', 'Sending request to device');

		return await this.sendPacketWithResponse(packet);
	}

	async loadCurrentState(): Promise<void> {
		log.verbose('PowerPlugOrSwitch.loadCurrentState', 'Loading current device state');

		const response = await this.getState();

		this.power = response
			.getSwitchinfo()
			.getPacket()
			.getSwitchstatus()
			.getPower() === 1;

		log.verbose('PowerPlugOrSwitch.loadCurrentState', 'Current power state:', this.power);
	}

	async setPowerOn(powerOn: boolean): Promise<boolean> {
		log.verbose('PowerPlugOrSwitch.setPowerOn', 'Change to:', powerOn);

		const packet = new lakeside.T1201Packet();

		packet.setSwitchinfo(new lakeside.SwitchInfo());
		packet.getSwitchinfo().setType(0);

		packet.getSwitchinfo().setPacket(new lakeside.SwitchPacket());
		packet.getSwitchinfo().getPacket().setUnknown1(100);

		packet.getSwitchinfo().getPacket().setSwitchset(new lakeside.SwitchState());
		packet.getSwitchinfo().getPacket().getSwitchset().setCommand(7);
		packet.getSwitchinfo().getPacket().getSwitchset().setState(powerOn ? 1 : 0);

		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

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
