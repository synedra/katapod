/*
Filesystem and I/O facilities.
*/

import * as vscode from "vscode";
const path = require("path");


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
