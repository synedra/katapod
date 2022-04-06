const { syncBuiltinESMExports } = require('module')
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')

const MarkdownIt = require('markdown-it');

module.exports = {activate, deactivate}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	inform('Katapod is enabled')

    // console.log(vscode.workspace.workspaceFolders[0].uri.path)

	const panel = vscode.window.createWebviewPanel(
		'catWebview',
		'Cat Webview',
		vscode.ViewColumn.One,
		{
			enableCommandUris: true,
			enableScripts: true,
			retainContextWhenHidden: true
		}
	)

	const file = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.path, 'step1.md'));

	const md = new MarkdownIt();

	var result = md.render((fs.readFileSync(file.fsPath, 'utf8')))

	panel.webview.html = result
}

function inform (message) {
	console.log(message)
	vscode.window.showInformationMessage(message)
}

function deactivate() {}