declare module 'bufferpack' {
	// TODO: this doesn't return any
	const unpack: (format: string, buffer: Buffer, position?: number) => any;

	// actually correct (I think)
	const pack: (format: string, values: Uint8Array) => Buffer | false;
	const packTo: (format: string, buffer: Buffer, position: number, values: Uint8Array) => Buffer | false;
	const calcLength: (format: string, values: Uint8Array) => number;

	export { pack, packTo, unpack, calcLength };
}
