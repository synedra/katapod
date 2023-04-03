/*
Tools to run commands and scripts on the terminals.
*/

import { TIMEOUT } from "dns";
import * as vscode from "vscode";
import { moveMessagePortToContext } from "worker_threads";

import {log} from "./logging";
import {KatapodEnvironment} from "./state";


export const cbIdSeparator = "_";

type Macro = "ctrl_c" | "no_op";

// Command-execution-specific structures
export interface ConfigCommand {
	command: string;
	execute?: boolean;
	maxInvocations?: number | "unlimited";
	macrosBefore?: Array<Macro>;
}
// the above would become the following, with defaults and added stuff
export interface FullCommand {
	command: string;
	execute?: boolean;
	terminalId?: string;
	codeBlockId: string;
	maxInvocations: number | "unlimited";
	macrosBefore?: Array<Macro>;
}


export function runCommand(fullCommand: FullCommand, env: KatapodEnvironment) {
	// i.e. only if *explicitly* false (a default of true implemented)
	if (fullCommand.execute !== false) {
		// pick target terminal, with care and fallbacks
		const targetTerminal: vscode.Terminal = (
			fullCommand.terminalId?
			env.components.terminalMap[fullCommand.terminalId]:
			env.components.terminals[0]
		) || env.components.terminals[0];
		// do we run the command?
		const invocationCountSoFar = env.state.codeInvocationCount[fullCommand.codeBlockId] || 0;
		if ( (fullCommand.maxInvocations === "unlimited") || (invocationCountSoFar < fullCommand.maxInvocations)){
			const macrosBefore: Array<Macro> = fullCommand.macrosBefore || [];
			if (macrosBefore) {
				for(let macro of macrosBefore){
					log("debug", `[runCommand]: Running macro "${macro.toString()}"`);
					if(macro === "ctrl_c"){
						// and "end-of-text" character, cf. https://github.com/microsoft/vscode/blob/f9928a18462204b6725f141bc9af2303cabd2e82/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts#L836
						targetTerminal.sendText("\x03", false);
					}else if(macro === "no_op"){
						// do nothing
					}
				}
			}
			// run the command
			log("debug", `[runCommand]: Running ${JSON.stringify(fullCommand)} (invocations until now: ${invocationCountSoFar})`);
			// increment the execution counter for this command:
			env.state.codeInvocationCount[fullCommand.codeBlockId] = (env.state.codeInvocationCount[fullCommand.codeBlockId] || 0) +1;
			// actually launch the command:
			targetTerminal.sendText(fullCommand.command);
			vscode.commands.executeCommand("notifications.clearAll").then( () => {
				env.components.panel.webview.postMessage({command: "mark_executed_block", "blockId": fullCommand.codeBlockId});
			});
		} else {
			log("debug", `[runCommand]: Refusing to execute ${JSON.stringify(fullCommand)} (invocations detected: ${invocationCountSoFar})`);
		}
	} else {
		log("debug", `[runCommand]: Refusing to execute ${JSON.stringify(fullCommand)} ("execute" flag set to false)`);
	}
}

export function runCommandsPerTerminal(step: string, commandMap: {[terminalId: string]: Array<ConfigCommand>}, env: KatapodEnvironment, logContext: string) {
	Object.entries(commandMap).forEach(([terminalId, configCommands]) => {
		configCommands.forEach(configCommand => {
			log("debug", `[runCommandsPerTerminal/${logContext}]: running map entry ${terminalId} => ${JSON.stringify(configCommand)}`);
			const fullCommand: FullCommand = {
				...{
					terminalId: terminalId,
					codeBlockId: `onLoad${cbIdSeparator}${step}${cbIdSeparator}${terminalId}`,
					maxInvocations: 1,
				},
				...configCommand,
			};
			runCommand(fullCommand, env);
		});
	});
}
