import * as crypto from 'crypto';

const keyBytes: Uint8Array = new Uint8Array([
	0x24, 0x4E, 0x6D, 0x8A, 0x56, 0xAC, 0x87, 0x91, 0x24, 0x43, 0x2D, 0x8B, 0x6C, 0xBC, 0xA2, 0xC4
]);
const ivBytes: Uint8Array = new Uint8Array([
	0x77, 0x24, 0x56, 0xF2, 0xA7, 0x66, 0x4C, 0xF3, 0x39, 0x2C, 0x35, 0x97, 0xE9, 0x3E, 0x57, 0x47
]);

export const encryptPacket = (rawPacket: Uint8Array): Buffer => {
	const extendedRawPacket = new Uint8Array(rawPacket.length + 16 - (rawPacket.length % 16));
	extendedRawPacket.set(rawPacket);

	const cipher = crypto.createCipheriv('aes-128-cbc', keyBytes, ivBytes);
	const encrypted = cipher.update(extendedRawPacket);

	return Buffer.from(encrypted);
};

export const decryptResponse = (encryptedData: Buffer): Buffer => {
	const cipher = crypto.createDecipheriv('aes-128-cbc', keyBytes, ivBytes);
	cipher.setAutoPadding(false)

	const buffer = cipher.update(encryptedData);

	return Buffer.from(buffer);
};
