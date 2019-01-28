import chalk from 'chalk';
import { prompt, objects } from 'inquirer';
import { loadDevices, Device } from './index';
import * as log from './log';

const startMenu = async (devices: Device[]) => {
	const device = await chooseDevice(devices);

	await deviceMenu(device);
	await startMenu(devices);
};

const chooseDevice = async (devices: Device[]): Promise<Device> => {
	const { deviceCode } = await prompt({
		type: 'list',
		name: 'deviceCode',
		message: 'Choose device',
		choices: [
			...devices.map(device => ({
				name: device.toString(),
				value: device.code
			})),
			{
				name: chalk.red('Exit'),
				value: ''
			}
		]
	});

	if (!deviceCode) {
		await Promise.all(devices.map(d => d.disconnect()));
		process.exit();
	}

	const device = devices.find(device => device.code === deviceCode)!;

	await device.connect();

	return device;
};

const deviceMenu = async (device: Device): Promise<void> => {
	const menuOptions: objects.ChoiceOption[] = [{
		name: `Turn ${device.isPowerOn() ? 'off' : 'on'}`,
		value: 'power'
	}];

	if (device.supportsBrightness()) {
		const brightnessOption: objects.ChoiceOption = {
			name: 'Change brightness',
			value: 'brightness'
		};
		if (device.isPowerOn()) {
			brightnessOption.name += ` (currently ${device.getBrightness()}/100)`;
		} else {
			brightnessOption.disabled = 'Turn on first';
		}
		menuOptions.push(brightnessOption);
	}

	if (device.supportsTemperature()) {
		const temperatureOption: objects.ChoiceOption = {
			name: 'Change temperature',
			value: 'temperature'
		};
		if (device.isPowerOn()) {
			temperatureOption.name += ` (currently ${device.getTemperature()}/100)`;
		} else {
			temperatureOption.disabled = 'Turn on first';
		}
		menuOptions.push(temperatureOption);
	}

	if (device.supportsColors()) {
		menuOptions.push({
			name: `Change color`,
			value: 'color',
			disabled: device.isPowerOn() ? undefined : 'Turn on first'
		});
	}

	menuOptions.push({
		name: chalk.red('Back to Menu'),
		value: 'exit'
	});

	const { action } = await prompt([{
		type: 'list',
		name: 'action',
		message: 'Options',
		choices: menuOptions
	}]);

	switch (action) {
		case 'power':
			const newStatus = await device.setPowerOn(!device.isPowerOn());
			log.success(`Power is now ${newStatus ? 'on' : 'off'}`);

			break;

		case 'brightness':
			const { newBrightness } = await prompt([{
				type: 'input',
				name: 'newBrightness',
				message: 'Enter brightness (between 0 and 100)',
				validate: (value: string) => {
					const number = parseInt(value, 10);
					if (number === NaN || number < 0 || number > 100) {
						return 'Please enter a number between 0 and 100';
					} else {
						return true;
					}
				}
			}]);

			const updatedBrightness = await device.setBrightness(parseInt(newBrightness, 10));
			log.success(`Brightness is now ${Math.round(updatedBrightness)}`);

			break;

		case 'temperature':
			const { newTemperature } = await prompt([{
				type: 'input',
				name: 'newTemperature',
				message: 'Enter brightness (between 0 and 100)',
				validate: (value: string) => {
					const number = parseInt(value, 10);
					if (number === NaN || number < 0 || number > 100) {
						return 'Please enter a number between 0 and 100';
					} else {
						return true;
					}
				}
			}]);

			const updatedTemperature = await device.setBrightness(parseInt(newTemperature, 10));
			log.success(`Temperature is now ${Math.round(updatedTemperature)}`);

			break;

		case 'color':
			const { newColors } = await prompt([{
				type: 'input',
				name: 'newColors',
				message: 'Enter color values in the format "{red}/{green}/{blue}" (each number between 0 and 255)',
				validate: value => {
					const colors = value.split('/');
					if (colors.length !== 3) {
						return 'Please provide the three values separated with a "\"';
					} else if (colors.find((color: string) => {
						const number = parseInt(color, 10);
						return number === NaN || number < 0 || number > 255;
					})) {
						return 'The numbers should be between 0 and 255';
					} else {
						return true;
					}
				}
			}]);

			const newColorsParsed = newColors.split('/').map((v: string) => parseInt(v, 10));
			const updatedColor = await device.setRgbColors(newColorsParsed[0], newColorsParsed[1], newColorsParsed[2]);
			log.success(`Colors are now ${updatedColor.red}/${updatedColor.green}/${updatedColor.blue}`);

			break;

		case 'exit':
			return;
	}

	await deviceMenu(device);
};

(async () => {
	let devices: Device[];
	try {
		const { email, password } = await prompt([
			{
				type: 'input',
				name: 'email',
				message: 'Eufy account email address'
			},
			{
				type: 'password',
				name: 'password',
				message: 'Eufy account password'
			}
		]);

		devices = await loadDevices(email, password);
	} catch (e) {
		log.error(e.message);
		return;
	}

	log.success('Logged in!');

	if (devices.length === 0) {
		log.warn('No devices found, exiting');
		return;
	}

	log.lineBreak();
	await startMenu(devices);
})();
