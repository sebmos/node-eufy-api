import chalk from 'chalk';

export enum Verbosity {
	ALL = 0,
	INFO = 1,
	WARNING = 2,
	ERROR = 3,
	SUCCESS = 4,
	NONE = 5
}

export const custom = (message: any, ...optionalParams: any[]) => {
	console.log(message, ...optionalParams);
};

let logVerbosity: Verbosity = Verbosity.INFO;
export const setLogVerbosity = (verbosity: Verbosity) => {
	logVerbosity = verbosity;
};

export const verbose = (callerFunctionName: string, message: any, ...optionalParams: any[]) => {
	if (logVerbosity <= Verbosity.ALL) {
		custom(chalk.gray(`(${callerFunctionName})`, message, ...optionalParams));
	}
};

export const info = (message: any, ...optionalParams: any[]) => {
	if (logVerbosity <= Verbosity.INFO) {
		custom(message, ...optionalParams);
	}
};

export const warn = (message: any, ...optionalParams: any[]) => {
	if (logVerbosity <= Verbosity.WARNING) {
		custom(chalk.cyan(message, ...optionalParams));
	}
};

export const error = (message: any, ...optionalParams: any[]) => {
	if (logVerbosity <= Verbosity.ERROR) {
		custom(chalk.bold.red(message, ...optionalParams));
	}
};

export const success = (message: any, ...optionalParams: any[]) => {
	if (logVerbosity <= Verbosity.SUCCESS) {
		custom(chalk.bold.green(message, ...optionalParams));
	}
};

export const lineBreak = () => {
	custom('');
};
