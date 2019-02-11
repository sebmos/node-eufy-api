import chalk from 'chalk';

export const custom = (message: any, ...optionalParams: any[]) => {
	console.log(message, ...optionalParams);
};

export const warn = (message: any, ...optionalParams: any[]) => {
	custom(chalk.keyword('orange')(message, ...optionalParams));
};

export const error = (message: any, ...optionalParams: any[]) => {
	custom(chalk.bold.red(message, ...optionalParams));
};

export const success = (message: any, ...optionalParams: any[]) => {
	custom(chalk.bold.green(message, ...optionalParams));
};

export const log = (message: any, ...optionalParams: any[]) => {
	custom(message, ...optionalParams);
};

let verboseOutputEnabled = false;
export const setVerboseOutputEnabled = (enabled: boolean) => {
	verboseOutputEnabled = enabled;
};

export const verbose = (callerFunctionName: string, message: any, ...optionalParams: any[]) => {
	if (verboseOutputEnabled) {
		custom(chalk.gray(`(${callerFunctionName})`, message, ...optionalParams));
	}
};

export const lineBreak = () => {
	custom('');
};
