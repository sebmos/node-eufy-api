import { AbstractDevice, Model, Packet, isWhiteLightBulb } from './device-base';
import { RgbColors, rgb2hsl, HslColors, hsl2rgb } from './colors';
const lakeside = require('./lakeside_pb.js');

interface BulbState {
	brightness: number;
	temperature?: number;
	colors?: RgbColors;
}

export class LightBulb extends AbstractDevice {
	private state?: BulbState;

	private async getState(): Promise<Packet> {
		const packet = new lakeside.T1012Packet();
		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		const bulbInfo = new lakeside.BulbInfo();
		bulbInfo.setType(1);
		packet.setBulbinfo(bulbInfo);

		return await this.sendPacketWithResponse(packet);
	}

	async loadCurrentState(): Promise<void> {
		const response = await this.getState();
		const info = response.getBulbinfo().getPacket().getInfo();

		this.power = info.getPower() === 1;
		if (info.getColor() === 1) {
			this.state = {
				brightness: info.getColors().getBrightness(),
				temperature: 50,
				colors: {
					red: info.getColors().getRed(),
					green: info.getColors().getGreen(),
					blue: info.getColors().getBlue()
				}
			};
		} else {
			this.state = {
				brightness: info.getValues().getBrightness(),
				temperature: info.getValues().getTemperature()
			};
		}
	}

	private parseValueAsNumber(label: string, value: any, maxValue: number): number {
		let newValue: number;
		if (typeof value === 'number') {
			newValue = value;
		} else {
			newValue = parseInt(value, 2);
		}

		if (isNaN(newValue) || newValue < 0 || newValue > maxValue) {
			throw new Error(`The ${label} value needs to be a number between 0 and ${Math.round(maxValue)}`);
		}

		return newValue;
	}

	private async setState(options: Partial<BulbState> & { power?: boolean }): Promise<void> {
		if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		let newBrightness: number | undefined;
		if (options.brightness !== undefined) {
			if (!this.supportsBrightness()) {
				throw new Error('Changing brightness is not supported by this device');
			}

			newBrightness = this.parseValueAsNumber('brightness', options.brightness, 100);
		}

		let newTemperature: number | undefined;
		if (options.temperature !== undefined) {
			if (!this.supportsTemperature()) {
				throw new Error('Changing color temperature is not supported by this device');
			}

			newTemperature = this.parseValueAsNumber('temperature', options.temperature, 100);
		}

		let newColors: RgbColors | undefined;
		if (options.colors !== undefined) {
			if (!this.supportsColors()) {
				throw new Error('Changing colors is not supported by this device');
			}

			newColors = {
				red: Math.round(this.parseValueAsNumber('red color', options.colors.red, 255)),
				green: Math.round(this.parseValueAsNumber('green color', options.colors.green, 255)),
				blue: Math.round(this.parseValueAsNumber('blue color', options.colors.blue, 255))
			};
		}

		let packet: Packet;
		if (isWhiteLightBulb(this.model)) {
			packet = new lakeside.T1012Packet();

			const bulbInfo = new lakeside.BulbInfo();
			bulbInfo.setType(0);

			const bulbPacket = new lakeside.BulbPacket();
			bulbInfo.setPacket(bulbPacket);
			bulbPacket.setUnknown1(100);

			const bulbState = new lakeside.BulbState();
			bulbPacket.setBulbset(bulbState);
			bulbState.setCommand(7);

			const bulbValues = new lakeside.BulbValues();
			bulbState.setValues(bulbValues);

			if (options.power !== undefined) {
				bulbState.setPower(options.power ? 1 : 0);
			}
			if (newBrightness !== undefined) {
				bulbValues.setBrightness(newBrightness);
			}
			if (newTemperature !== undefined) {
				bulbValues.setBrightness(newTemperature);
			}
		} else {
			packet = new lakeside.T1013Packet();

			packet.setBulbinfo(new lakeside.T1013BulbInfo());
			packet.getBulbinfo().setType(1);

			packet.getBulbinfo().setPacket(new lakeside.T1013State());
			packet.getBulbinfo().getPacket().setUnknown1(10);
			packet.getBulbinfo().getPacket().setControl(new lakeside.T1013Control());
			packet.getBulbinfo().getPacket().getControl().setCommand(7);

			if (options.power !== undefined) {
				packet.getBulbinfo().getPacket().getControl().setPower(options.power ? 1 : 0);
			}
			if (newColors) {
				const colors = new lakeside.T1013Color();
				colors.setRed(newColors.red);
				colors.setGreen(newColors.green);
				colors.setBlue(newColors.blue);
				if (newBrightness !== undefined) {
					colors.setBrightness(newBrightness);
				} else {
					colors.setBrightness(this.state.brightness);
				}

				packet.getBulbinfo().getPacket().getControl().setColor(1);
				packet.getBulbinfo().getPacket().getControl().setColors(colors);
			} else {
				const values = new lakeside.BulbValues();
				if (newBrightness !== undefined) {
					values.setBrightness(newBrightness);
				} else {
					values.setBrightness(this.state.brightness);
				}
				if (newTemperature !== undefined) {
					values.setTemperature(newTemperature);
				} else {
					values.setTemperature(this.state.temperature);
				}

				packet.getBulbinfo().getPacket().getControl().setColor(0);
				packet.getBulbinfo().getPacket().getControl().setValues(values);
				packet.getBulbinfo().getPacket().getControl().setPower(options.power ? 1 : 0);
			}
		}

		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		await this.sendPacket(packet);
		await this.getState();
	}

	async setPowerOn(power: boolean): Promise<boolean> {
		return this.setState({ power })
			.then(() => this.power!);
	}

	supportsBrightness(): boolean {
		// all current bulbs support changing brightness
		return true;
	}

	getBrightness(): number {
		if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		return this.state.brightness;
	}

	async setBrightness(brightness: number): Promise<number> {
		return this.setState({ brightness })
			.then(() => this.state!.brightness)
	}

	supportsTemperature(): boolean {
		return [Model.T1012, Model.T1013].indexOf(this.model) > -1;
	}

	getTemperature(): number {
		if (!this.supportsTemperature()) {
			throw new Error(`Bulb does not support temperature`);
		} else if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		return this.state.temperature!;
	}

	async setTemperature(temperature: number): Promise<number> {
		return this.setState({ temperature })
			.then(() => this.state!.temperature!)
	}

	supportsColors(): boolean {
		return [Model.T1013].indexOf(this.model) > -1;
	}

	getRgbColors(): RgbColors {
		if (!this.supportsColors()) {
			throw new Error(`Bulb does not support colors`);
		} else if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		return this.state.colors!;
	}

	async setRgbColors(red: number, green: number, blue: number): Promise<RgbColors> {
		return this.setState({ colors: { red, green, blue } })
			.then(() => this.state!.colors!)
	}

	getHslColors(): HslColors {
		if (!this.supportsColors()) {
			throw new Error(`Bulb does not support colors`);
		} else if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		return rgb2hsl(this.state.colors!.red, this.state.colors!.green, this.state.colors!.blue);
	}

	async setHslColors(hue: number, saturation: number, lightness: number): Promise<HslColors> {
		const rgbColors = hsl2rgb(
			this.parseValueAsNumber('hue', hue, 1),
			this.parseValueAsNumber('saturation', saturation, 1),
			this.parseValueAsNumber('lightness', lightness, 1)
		);

		return this.setState({ colors: rgbColors })
			.then(() => {
				const { red, green, blue } = this.state!.colors!;

				return rgb2hsl(red, green, blue);
			});
	}
}
