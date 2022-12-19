/*
Handling and definitions pertaining to "state" of the scenario during its lifetime.
*/

import * as vscode from "vscode";

import {ConfigObject} from "./configuration";


export type TerminalMap = {[terminalId: string]: vscode.Terminal};

export const NO_STEP_YET = Symbol("NoStepYet");

export interface KatapodEnvironment {
    components: {
		terminals: Array<vscode.Terminal>;
		terminalMap: TerminalMap;
		panel: vscode.WebviewPanel;
    },
	configuration: ConfigObject;
	state: {
		stepHistory: Array<string | typeof NO_STEP_YET>;
        codeInvocationCount: {[codeBlockId: string]: number};
	}
}
