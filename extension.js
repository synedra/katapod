const { syncBuiltinESMExports } = require('module')
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const MarkdownIt = require('markdown-it');

module.exports = {activate, deactivate}

terminal = null

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

	const md = new MarkdownIt().use(require('markdown-it-textual-uml'));;

	const pre = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
		<script>mermaid.initialize({startOnLoad:true});</script>
	</head>
	<body>`
	const post = `</body></html>`
	var result = md.render((fs.readFileSync(file.fsPath, 'utf8')))

	panel.webview.html = pre + result + post

	terminal = vscode.window.createTerminal('cqlsh')

	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', function () {
		terminal.sendText('cqlsh')
		// console.log('sendText')
	}));
}

function inform (message) {
	console.log(message)
	vscode.window.showInformationMessage(message)
}

function deactivate() {}