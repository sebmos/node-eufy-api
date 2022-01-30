# node-eufy-api
A simple JavaScript API to control [eufy's](https://www.eufylife.com/) smart light bulbs, switches and power plugs. Ported from [python-lakeside](https://github.com/google/python-lakeside).

This project is not developed, supported or endorsed by eufy.

## 🛑 Warning: Eufy firmware bug

This package does not work reliable for all devices due to a firmware bug, which means the device will, when receiving a message via your local network, simply close the connection.

There is no known workaround for this problem.

## Supported Devices
|Device Code|Device Name|Comment|
|--|--|--|
|T1201|Smart Plug||
|T1202|Smart Plug Mini||
|T1203|Smart WiFi Plug (UK)||
|T1211|Smart Light Switch|Untested|
|T1011|Lumos Smart Bulb - White||
|T1012|Lumos Smart Bulb - Tunable White|Untested|
|T1013|Lumos Smart Bulb - White & Color||

All devices listed above should work, since they are supported in _python-lakeside_. Because an error might have occurred during the porting process, some are marked as *untested*.

If you own one of these untested, or any new  devices that aren't listed, please consider running the [command-line interface](#command-line-interface) and [open an issue](https://github.com/sebmos/node-eufy-api/issues/new) to confirm whether or not they work.

### Unsupported Devices
|Device Code|Device Name|
|--|--|
|T1015|Lumos Smart Bulb - Tunable White|
|T1018|Lumos Smart Bulb 2.0 Lite - White & Color|

## Usage
### Homebridge (HomeKit support)
The [`homebridge-eufy`](https://github.com/sebmos/homebridge-eufy) plugin lets you add HomeKit support for your Eufy (and other) devices. Find out further details on the [plugin page](https://github.com/sebmos/homebridge-eufy).

### Installation via NPM
Add the node-eufy-api package to your project:
```bash
npm install node-eufy-api --save
```

The package exposes the functions `loadDevices` and `createDevice`, as well as several TypeScript interfaces. The [API Reference](#api-reference) section below contains details about the API.

### Command-line Interface
To run the Eufy command-line interface, run the following commands:

```bash
# Clone repository to your computer
git clone git@github.com:sebmos/node-eufy-api.git
cd node-eufy-api/
# Install dependencies
npm install
# Build code
npm run build
# Run CLI (usual way)
npm run cli
# Alternative: Run CLI (with verbose logging)
npm run cli:verbose
```

After authenticating, this command lists all available eufy devices, models, codes & IP addresses and lets you control them.

### About eufy API
It is necessary to connect and authenticate with eufy's API to identify the device model, code and IP address. With this information, devices can be controlled directly, without connecting to eufy's API.

Since the devices are controlled through a local socket connection, node-eufy-api needs to run on the same WiFi network as the devices.

### What is my device's model, code and IP address?
To identify the devices you have, as well as their models, codes and IP addresses, use the [command-line interface](#command-line-interface) or run the `loadDevices(email: string, password: string): Promise<Device[]>` function.

## Troubleshooting

* Try restarting (unplugging & replugging) the device.
* Try pinging the device's IP address from the computer this code is running from.
* To verify what WiFi network the device is on, look in the device settings in the EufyHome app.

## API Reference

#### `loadDevices(email: string, password: string): Promise<Device[]>`
Loads devices connected to the provided eufy account.

```es6
import { loadDevices } from 'node-eufy-api';

loadDevices("email@example.com", "s3cr3t").then(devices => {
	console.log('Devices loaded:', devices);
});
```

#### `createDevice(model: Model | string, code: string, ipAddress: string: name?: string): Device`
To create a `Device` object without authenticating via `loadDevices`, call the `createDevice` function.

The device name is optional, but may be useful for users of your app. (`loadDevices` will use the name set in the eufy app.) If no name is available, it will be auto-generated.

```es6
import { createDevice, Model } from 'node-eufy-api';

const powerPlug = createDevice(Model.T1203, 'DEVICE-CODE-FROM-API', '192.168.0.123', 'My Power Plug');
const lightBulb = createDevice('T1013', 'DIFFERENT-DEVICE-CODE', '192.168.0.124');
```

#### `getTypeForModel(model: string): DeviceType`
Returns the device type from a device model.

```es6
import { getTypeForModel, DeviceType } from 'node-eufy-api';

getTypeForModel('T1203') === DeviceType.POWER_PLUG;
getTypeForModel('T1211') === DeviceType.SWITCH;
getTypeForModel('T1013') === DeviceType.LIGHT_BULB;
```

#### `Device.model: Model`, `Device.code: string` & `Device.ipAddress: string`
eufy's model number for the device, the device-specific code required to establish a connection to the device, and the IP address, are required to create a `Device` object without running `loadDevices` first.

```es6
console.log('Model:', powerPlug.model);
console.log('Code:', powerPlug.code);
console.log('IP Address:', powerPlug.ipAddress);
```

#### `Device.deviceType: DeviceType`
The deviceType field is either `LIGHT_BULB`, `POWER_PLUG` or `SWITCH`.

```es6
if (powerPlugOrSwitch.deviceType === DeviceType.SWITCH) {
	console.log('This is a switch');
} else {
	console.log('This is a power plug');
}
```

#### `Device.on('CONNECTION_STATE_CHANGED', handler: (connected: boolean) => void): void`
Handler is called each time the connection stops or starts again. It is not necessary call `Device.connect()` to reconnect, since this will be attempted automatically. Calling `Device.disconnect()` removes the event handler.

```es6
import { DeviceEvent } from 'node-eufy-api';

lightBulb.on(DeviceEvent.CONNECTION_STATE_CHANGED, connected => {
	console.log('Device is ' + (connected ? 'connected' : 'disconnected'));
});
```

#### `Device.isConnected(): boolean`
Returns whether or not there is an open socket connection to the device.

```es6
console.log('The device is currently ' + (lightBulb.isConnected() ? 'connected' : 'disconnected'));
```

#### `Device.connect(): Promise<void>`
Establishes a connection to the device and calls `loadCurrentState()`.

```es6
lightBulb.connect().then(() => {
	console.log('Device connected');
});
```

#### `Device.disconnect(): Promise<void>`
Disconnects the socket connection to the device and removes any CONNECTION_STATE_CHANGED event handlers. The socket connection disconnects automatically when the node process stops running.

```es6
lightBulb.disconnect().then(() => {
	console.log('The device is now disconnected');
});
```

#### `Device.loadCurrentState(): Promise<void>`
Refreshes the current state of the device. (Power on/off, light brightness, etc.) It returns a Promise that resolves when the status is updated.

This method is called when the device is connected, and when its state is changed.

```es6
lightBulb.loadCurrentState().then(() => {
	console.log('Device state refreshed');
});
```

#### `Device.isPowerOn(): boolean`
Returns whether or not the light bulb, power plug or switch are on.

```es6
console.log('The light is currently ' + (lightBulb.isPowerOn() ? 'on' : 'off'));
```

#### `Device.setPowerOn(on: boolean): Promise<boolean>`
Changes the light bulb/power plug/switch power status. Returns a Promise with the new power state of the device when the change has been confirmed.

```es6
switch.setPowerOn(false).then(powerState => {
	console.log('Power is now off');
});
```

#### `Device.supportsBrightness(): boolean`
To determine whether the device supports setting brightness. Always returns false for power plugs/switches, and always returns true for the currently available light bulbs.

```es6
if (lightBulb.supportsBrightness()) {
	console.log('We can change the brightness for this device');
}
```

#### `Device.getBrightness(): number`
Returns the brightness setting of the light bulb, as a percentage. This method throws an exception if it is not supported.

```es6
if (lightBulb.supportsBrightness()) {
	console.log('The current brightness is: ' + lightBulb.getBrightness());
}
```

#### `Device.setBrightness(newBrightness: number): Promise<number>`
Changes the brightness of the light. The parameter is a percentage value. This method returns a Promise that rejects if changing the brightness isn't supported, and resolves with the new brightness value once the change is confirmed.

```es6
if (lightBulb.supportsBrightness()) {
	lightBulb.setBrightness(80).then(newBrightness => {
		console.log('The brightness is now set to:', newBrightness);
	});
}
```

#### `Device.supportsTemperature(): boolean`
To determine whether the device supports changing the color temperature. Always returns false for power plugs/switches.

```es6
if (lightBulb.supportsTemperature()) {
	console.log('We can change the color temperature for this device');
}
```

#### `Device.getTemperature(): number`
Returns the color temperature setting of the light bulb, as a percentage. This method throws an exception if it is not supported.

```es6
if (lightBulb.supportsTemperature()) {
	console.log('The current color temperature is: ' + lightBulb.getTemperature());
}
```

#### `Device.setTemperature(newTemperature: number): Promise<number>`
Changes the color temperature of the light. The parameter is a percentage value, with 0 being the warmest color and 100 the coldest. This method returns a Promise that rejects if changing the temperature is not supported, and resolves with the new color temperature value once the change is confirmed.

```es6
if (lightBulb.supportsTemperature()) {
	lightBulb.setTemperature(80).then(newTemperature => {
		console.log('The color temperature is now set to:', newTemperature);
	});
}
```

#### `Device.supportsColors(): boolean`
To determine whether the device supports changing its color. Always returns false for power plugs/switches.

```es6
if (lightBulb.supportsColors()) {
	console.log('We can change the color for this device');
}
```

#### `Device.getRgbColors(): { red: number, green: number, blue: number }`
Returns the colors of the light bulb, in three numbers (red, green, blue) between 0 and 255. This method throws an exception if changing the colors are not supported.

```es6
if (lightBulb.supportsColors()) {
	console.log('The current red value is: ' + lightBulb.getRgbColors().red);
}
```

#### `Device.setRgbColors(red: number, green: number, blue: number): Promise<{ red: number, green: number, blue: number }>`
Changes the color of the light. The parameters are numbers between 0 and 255. This method returns a Promise that rejects if changing the color is not supported, and resolves with the new color values once the change is confirmed.

```es6
if (lightBulb.supportsColors()) {
	lightBulb.setRgbColors(255, 0, 0).then(newColors => {
		console.log('The color is now red:', newColors);
	});
}
```

#### `Device.getHslColors(): { hue: number, saturation: number, lightness: number }`
Returns the colors of the light bulb, in hue, saturation and lightness - numbers between 0 and 1. This method throws an exception if colors are not supported.

```es6
if (lightBulb.supportsColors()) {
	console.log('The saturation of the color is:', lightBulb.getHslColors().saturation.toLocaleString(undefined, { style: 'percent' }));
}
```

#### `Device.setHslColors(hue: number, saturation: number, lightness: number): Promise<{ hue: number, saturation: number, lightness: number }>`
Changes the color of the light. The parameters are numbers between 0 and 1. The method returns a Promise that rejects if changing the color is not supported, and resolves with the new color values once the change is confirmed.

```es6
if (lightBulb.supportsColors()) {
	lightBulb.setHslColors(0, 1, 0.5).then(newColors => {
		console.log('The color is now red:', newColors);
	});
}
```

#### `setLogVerbosity(verbosity: Verbosity): void`
Loads devices connected to the provided eufy account.

```es6
import { setLogVerbosity, Verbosity } from 'node-eufy-api';

setLogVerbosity(Verbosity.ALL);
setLogVerbosity(Verbosity.INFO); // used for CLI
setLogVerbosity(Verbosity.WARNING);
setLogVerbosity(Verbosity.ERROR); // used when running homebridge-eufy
setLogVerbosity(Verbosity.SUCCESS);
setLogVerbosity(Verbosity.NONE);
```

##  Unsupported
* Energy Reporting
* Controlling devices remotely/not from within the same WiFi connection
