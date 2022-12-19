/*
Logging facilities for the extension.
*/

type LogLevel = "debug" | "warning" | "error";


const logTitle = "KataPod";


export function log(level: LogLevel, message: string) {
	console.log(buildLogMessage(level, message));
}

export function buildLogMessage(level: LogLevel, message: string) {
	return `${logTitle} [${level.toUpperCase()}] ${message}`;
}
