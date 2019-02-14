import { existsSync, readFile, writeFile, unlink } from 'fs';

const CREDENTIALS_FILE_NAME = '.credentials';

export const loadCredentials = async (): Promise<{ email: string, password: string } | undefined> => {
	return new Promise((resolve, reject) => {
		if (!existsSync(CREDENTIALS_FILE_NAME)) {
			return resolve();
		}

		readFile(
			CREDENTIALS_FILE_NAME,
			'utf8',
			(err?: Error, data?: string) => {
				if (err) {
					reject(err);
				} else if (data) {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(e);
					}
				} else {
					resolve();
				}
			}
		);
	});
};

export const saveCredentials = async (email: string, password: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		writeFile(
			CREDENTIALS_FILE_NAME,
			JSON.stringify({ email, password }),
			'utf8',
			(err?: Error) => {
				if (err) {
					return reject(err);
				} else {
					resolve();
				}
			}
		);
	});
};

export const deleteCredentials = async (): Promise<void> => {
	return new Promise((resolve, reject) => {
		unlink(
			CREDENTIALS_FILE_NAME,
			(err?: Error) => {
				if (err) {
					return reject(err);
				} else {
					resolve();
				}
			}
		);
	});
};
