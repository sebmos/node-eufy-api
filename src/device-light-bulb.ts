import { AbstractDevice, Model, Packet, isWhiteLightBulb } from './device-base';
import { RgbColors, rgb2hsl, HslColors, hsl2rgb } from './colors';
import * as log from './log';
const lakeside = require('./lakeside_pb.js');

interface BulbState {
	brightness: number;
	temperature?: number;
	colors?: RgbColors;
}

export class LightBulb extends AbstractDevice {
	private state?: BulbState;

	private async getState(): Promise<Packet> {
		log.verbose('LightBulb.getState', 'Loading current device state');

		const packet = new lakeside.T1012Packet();
		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		const bulbInfo = new lakeside.BulbInfo();
		bulbInfo.setType(1);
		packet.setBulbinfo(bulbInfo);

		log.verbose('LightBulb.getState', 'Sending request to device');

		return await this.sendPacketWithResponse(packet);
	}

	async loadCurrentState(): Promise<void> {
		log.verbose('LightBulb.loadCurrentState', 'Loading current device state');

		const response = await this.getState();

		if (isWhiteLightBulb(this.model)) {
			log.verbose('LightBulb.loadCurrentState', 'Parsing current state as white light bulb');

			const bulbState = response.getBulbinfo().getPacket().getBulbstate();

			this.power = bulbState.getPower() === 1;
			log.verbose('LightBulb.loadCurrentState', 'Current power state:', this.power);

			this.state = {
				brightness: bulbState.getValues().getBrightness(),
				temperature: bulbState.getValues().getTemperature()
			};

			log.verbose('LightBulb.loadCurrentState', `Current brightness: ${this.state!.brightness} (might be unsupported)`);
			log.verbose('LightBulb.loadCurrentState', `Current temperature: ${this.state!.temperature} (might be unsupported)`);
		} else {
			log.verbose('LightBulb.loadCurrentState', 'Parsing current state as color light bulb');

			const info = response.getBulbinfo().getPacket().getInfo();
	
			this.power = info.getPower() === 1;
			log.verbose('LightBulb.loadCurrentState', 'Current power state:', this.power);

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

				log.verbose('LightBulb.loadCurrentState', 'No color information returned');
			}

			log.verbose('LightBulb.loadCurrentState', 'Current state:', JSON.stringify(this.state!));
		}
	}

	private parseValueAsNumber(label: string, value: any, maxValue: number): number {
		log.verbose('LightBulb.parseValueAsNumber', `Input: "${value}" (Max Value: ${maxValue})`);

		let newValue: number;
		if (typeof value === 'number') {
			newValue = value;
		} else {
			newValue = parseInt(value, 10);
		}

		if (isNaN(newValue) || newValue < 0 || newValue > maxValue) {
			throw new Error(`The ${label} value needs to be a number between 0 and ${Math.round(maxValue)}`);
		}

		log.verbose('LightBulb.parseValueAsNumber', 'Result:', newValue);

		return newValue;
	}

	private async setState(options: Partial<BulbState> & { power?: boolean }): Promise<void> {
		log.verbose('LightBulb.setState', 'Change to:', JSON.stringify(options));

		if (this.state === undefined) {
			throw new Error(`Unknown bulb state - call loadCurrentState()`);
		}

		let newBrightness: number | undefined;
		if (options.brightness !== undefined) {
			if (!this.supportsBrightness()) {
				throw new Error('Changing brightness is not supported by this device');
			}

			newBrightness = this.parseValueAsNumber('brightness', options.brightness, 100);

			log.verbose('LightBulb.setState', 'Brightness:', newBrightness);
		}

		let newTemperature: number | undefined;
		if (options.temperature !== undefined) {
			if (!this.supportsTemperature()) {
				throw new Error('Changing color temperature is not supported by this device');
			}

			newTemperature = this.parseValueAsNumber('temperature', options.temperature, 100);

			log.verbose('LightBulb.setState', 'Temperature:', newTemperature);
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

			log.verbose('LightBulb.setState', 'Colors:', JSON.stringify(newColors));
		}

		let packet: Packet;
		if (isWhiteLightBulb(this.model)) {
			log.verbose('LightBulb.setState', 'Treat as white light bulb (T1012Packet)');

			packet = new lakeside.T1012Packet();

			packet.setBulbinfo(new lakeside.BulbInfo());
			packet.getBulbinfo().setType(0);

			packet.getBulbinfo().setPacket(new lakeside.BulbPacket());
			packet.getBulbinfo().getPacket().setUnknown1(100);

			packet.getBulbinfo().getPacket().setBulbset(new lakeside.BulbState());
			packet.getBulbinfo().getPacket().getBulbset().setCommand(7);

			if (options.power !== undefined) {
				packet.getBulbinfo().getPacket().getBulbset().setPower(options.power ? 1 : 0);

				log.verbose('LightBulb.setState', 'Change power to', options.power);
			}

			const bulbValues = new lakeside.BulbValues();
			let bulbValueSet = false;
			if (newBrightness !== undefined) {
				bulbValues.setBrightness(newBrightness);
				bulbValueSet = true;

				log.verbose('LightBulb.setState', 'Change brightness to', newBrightness);
			}
			if (newTemperature !== undefined) {
				bulbValues.setTemperature(newTemperature);
				bulbValueSet = true;

				log.verbose('LightBulb.setState', 'Change temperature to', newTemperature);
			}

			if (bulbValueSet) {
				packet.getBulbinfo().getPacket().getBulbset().setValues(bulbValues);

				log.verbose('LightBulb.setState', 'Apply bulb values');
			}
		} else {
			log.verbose('LightBulb.setState', 'Treat as color bulb (T1013Packet)');

			packet = new lakeside.T1013Packet();

			packet.setBulbinfo(new lakeside.T1013BulbInfo());
			packet.getBulbinfo().setType(0);

			packet.getBulbinfo().setPacket(new lakeside.T1013State());
			packet.getBulbinfo().getPacket().setUnknown1(10);
			packet.getBulbinfo().getPacket().setControl(new lakeside.T1013Control());
			packet.getBulbinfo().getPacket().getControl().setCommand(7);

			if (options.power !== undefined) {
				packet.getBulbinfo().getPacket().getControl().setPower(options.power ? 1 : 0);

				log.verbose('LightBulb.setState', 'Change power to', options.power);
			}

			if (newColors) {
				log.verbose('LightBulb.setState', 'Change colors to:', JSON.stringify(newColors));

				const colors = new lakeside.T1013Color();
				colors.setRed(newColors.red);
				colors.setGreen(newColors.green);
				colors.setBlue(newColors.blue);
				if (newBrightness !== undefined) {
					colors.setBrightness(newBrightness);

					log.verbose('LightBulb.setState', 'Change brightness to', newBrightness);
				} else {
					colors.setBrightness(this.state.brightness);

					log.verbose('LightBulb.setState', 'Keep brightness at', this.state.brightness);
				}

				packet.getBulbinfo().getPacket().getControl().setColor(1);
				packet.getBulbinfo().getPacket().getControl().setColors(colors);
			} else {
				log.verbose('LightBulb.setState', 'No colors');

				const values = new lakeside.BulbValues();
				if (newBrightness !== undefined) {
					values.setBrightness(newBrightness);

					log.verbose('LightBulb.setState', 'Change brightness to', newBrightness);
				} else {
					values.setBrightness(this.state.brightness);

					log.verbose('LightBulb.setState', 'Keep brightness at', this.state.brightness);
				}
				if (newTemperature !== undefined) {
					values.setTemperature(newTemperature);

					log.verbose('LightBulb.setState', 'Change temperature to', newTemperature);
				} else {
					values.setTemperature(this.state.temperature);

					log.verbose('LightBulb.setState', 'Keep temperature at', this.state.temperature);
				}

				packet.getBulbinfo().getPacket().getControl().setColor(0);
				packet.getBulbinfo().getPacket().getControl().setValues(values);
			}
		}

		packet.setSequence(await this.getSequence());
		packet.setCode(this.code);

		log.verbose('LightBulb.setState', 'Sending packet');

		await this.sendPacket(packet);

		log.verbose('LightBulb.setState', 'Reloading state');

		await this.loadCurrentState();
	}

	async setPowerOn(power: boolean): Promise<boolean> {
		log.verbose('LightBulb.setPowerOn', 'Change to:', power);

		await this.setState({ power });

		log.verbose('LightBulb.setPowerOn', 'New power state:', this.power);

		return this.power!;
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
		log.verbose('LightBulb.setBrightness', 'Change to:', brightness);

		await this.setState({ brightness });

		log.verbose('LightBulb.setBrightness', 'New brightness:', this.state!.brightness);

		return this.state!.brightness;
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
		log.verbose('LightBulb.setTemperature', 'Change to:', temperature);

		await this.setState({ temperature });

		log.verbose('LightBulb.setTemperature', 'New temperature:', this.state!.brightness);

		return this.state!.temperature!;
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
		log.verbose('LightBulb.setRgbColors', 'Change to R:', red, '- G:', green, '- B:', blue);

		await this.setState({ colors: { red, green, blue } });

		log.verbose('LightBulb.setRgbColors', 'New colors:', JSON.stringify(this.state!.colors));

		return this.state!.colors!;
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
		log.verbose('LightBulb.setHslColors', 'Change to H:', hue, '- S:', saturation, '- L:', lightness);

		const rgbColors = hsl2rgb(
			this.parseValueAsNumber('hue', hue, 1),
			this.parseValueAsNumber('saturation', saturation, 1),
			this.parseValueAsNumber('lightness', lightness, 1)
		);

		await this.setState({ colors: rgbColors });

		log.verbose('LightBulb.setHslColors', 'New colors:', JSON.stringify(this.state!.colors));

		const { red, green, blue } = this.state!.colors!;

		return rgb2hsl(red, green, blue);
	}
}
