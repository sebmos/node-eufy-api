import { AbstractDevice, Packet } from './device-base';
import { RgbColors, HslColors } from './colors';
const lakeside = require('./lakeside_pb.js');

export class PowerPlugOrSwitch extends AbstractDevice {
	private async getState(): Promise<Packet> {
		const packet = new lakeside.T1201Packet();
		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		packet.setSwitchinfo(new lakeside.SwitchInfo());
		packet.getSwitchinfo().setType(1);

		return await this.sendPacketWithResponse(packet);
	}

	async loadCurrentState(): Promise<void> {
		const response = await this.getState();

		this.power = response
			.getSwitchinfo()
			.getPacket()
			.getSwitchstatus()
			.getPower() === 1;
	}

	async setPowerOn(powerOn: boolean): Promise<boolean> {
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

		await this.sendPacket(packet);

		await this.loadCurrentState();

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
