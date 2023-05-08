/*
Filesystem and I/O facilities.
*/

const fs = require("fs");
import * as vscode from "vscode";
const path = require("path");
import {log} from "./logging";

import {kpConfigFileName} from "./configuration_constants";


const gitpodYamlFileName = '.gitpod.yml';
const katapodExtensionMatchFragment1 = '.vsix';
const katapodExtensionMatchFragment2 = 'katapod';


export function getWorkingDir(): string | undefined {
	if (vscode.workspace.workspaceFolders) {
		return vscode.workspace.workspaceFolders[0].uri.path;
	}

	return vscode.workspace.rootPath;
}

export function buildFullFileUri(fileName: string): vscode.Uri {
	return vscode.Uri.file(path.join(getWorkingDir(), fileName));
}

export function checkFileExists(fileUri: vscode.Uri): Thenable<vscode.FileStat> {
	return vscode.workspace.fs.stat(fileUri);
}

export function isKatapodScenario(): Promise<Boolean> {
	/*
	We want to check if this is a Katapod scenario or just any other Gitpod project.
	The decision flow (dictated by the requirement of back-compatibility with scenarios lacking a .katapod_config.json) is:
	1. if there is a ".katapod_config.json" => is scenario
	2. else:
		2a. if there is a ".gitpod.yml":
			2a.I if it contains a string of the kind used to load a(ny) katapod extension => is scenario
			2a.II else => is not scenario
		2b. => is not scenario
	*/
	const configFileUri: vscode.Uri = buildFullFileUri(kpConfigFileName);
	const isScenario = new Promise<Boolean>((resolve) => {
		checkFileExists(configFileUri).then(
			function () {
				// 1
				resolve(true);
			},
			function () {
				// 2
				const gYamlFileUri = buildFullFileUri(gitpodYamlFileName);
				checkFileExists(gYamlFileUri).then(
					function() {
						// 2a. We look for a line containing both 'vsix' and 'katapod' and call it a day (a hack...)
						var linesRead = fs.readFileSync(gYamlFileUri.fsPath, 'utf-8').split('\n');
						var katapoddyLines = linesRead
							.map( (l: string) => l.toLowerCase() )
							.filter( (l: string) => l.indexOf(katapodExtensionMatchFragment1) > -1 )
							.filter( (l: string) => l.indexOf(katapodExtensionMatchFragment2) > -1);
						// 2a.I vs 2a.II
						resolve(katapoddyLines.length > 0);
					},
					function() {
						// 2b
						resolve(false);
					}
				);
			}
		);
	});
	return isScenario;
}
