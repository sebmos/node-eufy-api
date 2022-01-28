import fetch from 'node-fetch';
import { Device, DeviceType, Model, getTypeForModel } from './device-base.js';
import { LightBulb } from './device-light-bulb.js';
import { PowerPlugOrSwitch } from './device-power-plug-or-switch.js';
import * as log from './log.js';

export type { Device };
export { DeviceEvent, DeviceType, Model, getTypeForModel } from './device-base.js';
export { setLogVerbosity, Verbosity } from './log.js';

const clientId: string = 'eufyhome-app';
const clientSecret: string = 'GQCpr9dSp3uQpsOMgJ4xQ';

export const createDevice = (model: Model | string, code: string, ipAddress: string, name?: string): Device => {
    let deviceClass;
    switch (getTypeForModel(model as Model)) {
        case DeviceType.LIGHT_BULB:
            deviceClass = LightBulb;
            break;

        case DeviceType.POWER_PLUG:
        case DeviceType.SWITCH:
            deviceClass = PowerPlugOrSwitch;
            break;

        default:
            throw new Error('Could not find devic');
    }

    return new deviceClass(model as Model, code, ipAddress, name);
}

export const loadDevices = async (email: string, password: string): Promise<Device[]> => {
    log.info('Logging in');

    const payload: { [key: string]: string } = {
        client_id: clientId,
        client_Secret: clientSecret,
        email,
        password
    };

    const authResult = await fetch(
        'https://home-api.eufylife.com/v1/user/email/login',
        {
            method: 'POST',
            body: JSON.stringify(payload)
        }
    );

    const authJson = await authResult.json() as any;

    let accessToken: string;
    if (authJson.res_code === 1) {
        accessToken = authJson['access_token'];
    } else if (authJson.message) {
        throw new Error(authJson.message);
    } else {
        throw new Error(JSON.stringify(authJson));
    }

    log.info('Loading devices');

    const devicesResult = await fetch('https://home-api.eufylife.com/v1/device/list/devices-and-groups', {
        headers: {
            token: accessToken,
            category: 'Home'
        }
    });

    const devicesJson = await devicesResult.json() as any;

    if (devicesJson.res_code === 1) {
        let devices: Device[] = [];
        (devicesJson.items || {}).forEach((item: any) => {
            if (item.device && item.device.id && item.device.local_code && item.device.wifi && item.device.wifi.lan_ip_addr) {
                const model: Model = item.device.product.product_code;

                try {
                    devices.push(createDevice(
                        model,
                        item.device.local_code,
                        item.device.wifi.lan_ip_addr,
                        item.device.alias_name || item.device.name
                    ));
                } catch {
                    log.error(`Unknown device model "${model}"`);
                }
            }
        });

        log.success('Logged in, devices loaded');

        return devices;
    } else if (devicesJson.message) {
        throw new Error(devicesJson.message);
    } else {
        throw new Error(JSON.stringify(devicesJson));
    }
};
