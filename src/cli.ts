import chalk from 'chalk';
import { saveCredentials, loadCredentials, deleteCredentials } from './credentials-cache.js';
import inquirer from 'inquirer';
import { ListChoiceOptions } from 'inquirer';
import { loadDevices, Device } from './index.js';
import * as log from './log.js';

const { prompt } = inquirer;

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

	try {
		await device.connect();
	} catch (error) {
		log.error('Error connecting to device:', error.message || error);
		process.exit();
	}

	return device;
};

const deviceMenu = async (device: Device): Promise<void> => {
	const menuOptions: ListChoiceOptions[] = [{
		name: `Turn ${device.isPowerOn() ? 'off' : 'on'}`,
		value: 'power'
	}];

	if (device.supportsBrightness()) {
		const brightnessOption: ListChoiceOptions = {
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
		const temperatureOption: ListChoiceOptions = {
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
			try {
				const newStatus = await device.setPowerOn(!device.isPowerOn());
				log.success(`Power is now ${newStatus ? 'on' : 'off'}`);
			} catch (error) {
				log.error('Error toggling power:', error.message || error);
			}

			break;

		case 'brightness':
			const { newBrightness } = await prompt([{
				type: 'input',
				name: 'newBrightness',
				message: 'Enter brightness (between 0 and 100)',
				validate: (value: string) => {
					const number = parseInt(value, 10);
					if (isNaN(number) || number < 0 || number > 100) {
						return 'Please enter a number between 0 and 100';
					} else {
						return true;
					}
				}
			}]);

			try {
				const updatedBrightness = await device.setBrightness(parseInt(newBrightness, 10));
				log.success(`Brightness is now ${Math.round(updatedBrightness)}`);
			} catch (error) {
				log.error('Error changing brightness:', error.message || error);
			}

			break;

		case 'temperature':
			const { newTemperature } = await prompt([{
				type: 'input',
				name: 'newTemperature',
				message: 'Enter color temperature (between 0 and 100)',
				validate: (value: string) => {
					const number = parseInt(value, 10);
					if (isNaN(number) || number < 0 || number > 100) {
						return 'Please enter a number between 0 and 100';
					} else {
						return true;
					}
				}
			}]);

			try {
				const updatedTemperature = await device.setTemperature(parseInt(newTemperature, 10));
				log.success(`Color temperature is now ${Math.round(updatedTemperature)}`);
			} catch (error) {
				log.error('Error changing color temperature:', error.message || error);
			}

			break;

		case 'color':
			const { newColors } = await prompt([{
				type: 'input',
				name: 'newColors',
				message: 'Enter color values in the format "{red}/{green}/{blue}" (each number between 0 and 255)',
				validate: (value: string) => {
					const colors = value.split('/');
					if (colors.length !== 3) {
						return 'Please provide the three values separated with a "\"';
					} else if (colors.find((color: string) => {
						const number = parseInt(color, 10);
						return isNaN(number) || number < 0 || number > 255;
					})) {
						return 'The numbers should be between 0 and 255';
					} else {
						return true;
					}
				}
			}]);


			try {
				const newColorsParsed = newColors.split('/').map((v: string) => parseInt(v, 10));
				const updatedColor = await device.setRgbColors(newColorsParsed[0], newColorsParsed[1], newColorsParsed[2]);
				log.success(`Colors are now ${updatedColor.red}/${updatedColor.green}/${updatedColor.blue}`);
			} catch (error) {
				log.error('Error changing colors:', error.message || error);
			}

			break;

		case 'exit':
			return;
	}

	await deviceMenu(device);
};

(async () => {
	log.setLogVerbosity(process.argv.slice(2).indexOf('--verbose') > -1 ? log.Verbosity.ALL : log.Verbosity.INFO);

	let devices: Device[];

	let email: string;
	let password: string;
	let usedCachedCredentials: boolean = true;
	try {
		const cachedCredentials = await loadCredentials();
		if (cachedCredentials) {
			email = cachedCredentials.email;
			password = cachedCredentials.password;
		} else {
			usedCachedCredentials = false;

			const { enteredEmail, enteredPassword } = await prompt([
				{
					type: 'input',
					name: 'enteredEmail',
					message: 'Eufy account email address'
				},
				{
					type: 'password',
					name: 'enteredPassword',
					message: 'Eufy account password'
				}
			]);

			email = enteredEmail;
			password = enteredPassword;
		}

		devices = await loadDevices(email, password);
	} catch (e) {
		log.error(e.message || e);

		if (usedCachedCredentials) {
			const { shouldDeleteCredentials } = await prompt({
				type: 'confirm',
				default: true,
				name: 'shouldDeleteCredentials',
				message: 'Delete locally cached credentials?'
			})
	
			if (shouldDeleteCredentials) {
				await deleteCredentials();
			}
		}

		return;
	}

	if (!usedCachedCredentials) {
		const { shouldSaveCredentials } = await prompt({
			type: 'confirm',
			default: false,
			name: 'shouldSaveCredentials',
			message: 'Save credentials locally for future use?'
		})

		if (shouldSaveCredentials) {
			await saveCredentials(email, password);
		}
	}

	if (devices.length === 0) {
		log.warn('No devices found, exiting');
		return;
	}

	log.lineBreak();
	await startMenu(devices);
})();
