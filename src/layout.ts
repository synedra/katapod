/*
Creating and managing VSCode layout.
*/

import * as vscode from "vscode";

import {log} from "./logging";
import {ConfigObject, ConfigTerminal} from "./configuration";
import {KatapodEnvironment, TerminalMap, NO_STEP_YET} from "./state";


function createPanel(config: ConfigObject): vscode.WebviewPanel {
	/*
	Create the left-panel Webview for the rendered html
	in the scenario. Return the panel itself (not a Promise).
	*/
	log("debug", "[createPanel] Creating WebViewPanel...");
	return vscode.window.createWebviewPanel(
		"datastax.katapod",
		"FusionAuth Hands-On Labs",
		vscode.ViewColumn.One,
		{
			enableCommandUris: true,
			enableScripts: true,
			retainContextWhenHidden: true,
			enableFindWidget: true
		}
	);
}

async function setTerminalLayout(config: ConfigObject): Promise<TerminalMap> {
	/*
		Create as many stacked terminals as requested.
		NOTE: VSCode seems to support at most 8 with this setup
		(cf. https://github.com/microsoft/vscode/blob/e19f06e48a975c9d953c2bd3199b582cb70ea5db/src/vs/workbench/api/common/extHostTypes.ts#L1739-L1751)
		Return a Promise of a map string->Terminal for the created objects
	*/
	const terminalViewColumns = [
		vscode.ViewColumn.Two,
		vscode.ViewColumn.Three,
		vscode.ViewColumn.Four,
		vscode.ViewColumn.Five,
		vscode.ViewColumn.Six,
		vscode.ViewColumn.Seven,
		vscode.ViewColumn.Eight,
		vscode.ViewColumn.Nine,
	];
	const configTerminals: Array<ConfigTerminal> = config.layout.terminals;
	const numTerminals: number = configTerminals.length;
	var termPromise = new Promise<TerminalMap>(async function (resolve, reject) {
		if (numTerminals <= terminalViewColumns.length) {
			// This is apparently not needed (it happens already in setupLayout):
			//  await vscode.commands.executeCommand("workbench.action.editorLayoutTwoColumns");
			let terminalMap: {[id: string]: vscode.Terminal} = {};
			for(let i: number = 0; i < numTerminals; i++){
				// Undocumented no-wrap way to shift focus to the next group:
				// (found a reference here, https://github.com/microsoft/vscode/issues/107873 , lol)
				await vscode.commands.executeCommand("workbench.action.focusRightGroupWithoutWrap");
				if (i < numTerminals - 1){
					// when creating the last terminal, no need to further split the stack and make room for the next.
					await vscode.commands.executeCommand("workbench.action.splitEditorDown");
				}
				const termPosition = terminalViewColumns[i];
				const configTerminal = configTerminals[i];
				const terminalId: string = configTerminal.id;
				const terminalName: string = configTerminal.name || terminalId;
				log("debug", `[setTerminalLayout] Creating terminal ${configTerminal.id}/"${terminalName}" (${i+1}/${numTerminals})`);
				const locationOptions: vscode.TerminalEditorLocationOptions = {
					viewColumn: termPosition,
				};
				const terminalOptions: vscode.TerminalOptions = {
					name: terminalName,
					location: locationOptions
				};
				terminalMap[configTerminal.id] = vscode.window.createTerminal(terminalOptions);
			}
			resolve(terminalMap);
		} else {
			reject(new Error("Too many terminals."));
		}
	});
	return termPromise;
}

export function setupLayout(katapodConfiguration: ConfigObject): Promise<KatapodEnvironment> {
	/*
	Prepare the whole Katapod layout as required by the configuration.
	Return a Promise of an "environment" object. 
	*/
    // return (promise of) a full just-started "katapod environment" object
    let panel: vscode.WebviewPanel = createPanel(katapodConfiguration);
    const envPromise = new Promise<KatapodEnvironment>((resolve, reject) => {
		vscode.commands.executeCommand("workbench.action.editorLayoutTwoColumns").then(
			async function () {
				setTerminalLayout(katapodConfiguration).then(
					terminalMap => {
						// build full environment
						const environment: KatapodEnvironment = {
							components: {
								terminals: katapodConfiguration.layout.terminals.map( (term: ConfigTerminal) => terminalMap[term.id] ),
								terminalMap: terminalMap,
								panel: panel,
							},
							configuration: katapodConfiguration,
							state: {
								stepHistory: [NO_STEP_YET],
								codeInvocationCount: {},
							}
						};
						resolve(environment);
					},
					rej => reject(rej)
				);
			}
		);
    });
    return envPromise;
}
