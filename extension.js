const { syncBuiltinESMExports } = require('module')
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const MarkdownIt = require('markdown-it');

module.exports = {activate, deactivate}

terminal = null
panel = null

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	inform('Katapod is enabled')

// console.log(renderCommandUri('cqlsh'))
// console.log(renderCommandUri('describe keyspaces;'))

	panel = createPanel()
	loadPage({step: 'step1'})

	terminal = vscode.window.createTerminal('cqlsh')
	terminal.show()
	
	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendText));

	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPage));
}

function createPanel () {
	return vscode.window.createWebviewPanel(
		'catWebview',
		'Cat Webview',
		vscode.ViewColumn.One,
		{
			enableCommandUris: true,
			enableScripts: true,
			retainContextWhenHidden: true,
			enableFindWidget: true
		}
	)
}

function loadPage (target) {

	const file = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.path, target.step + '.md'));

	const md = new MarkdownIt({html: true}).use(require('markdown-it-textual-uml'));;

	const pre = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
		<script>mermaid.initialize({startOnLoad:true});</script>
		<style>
			pre code {background-color: lightgray; color: black; margin: 0 10px 0 10px; padding: 10px 10px; width: 100%; display: block;}
		</style>
	</head>
	<body>`
	const post = `</body></html>`
	var result = md.render((fs.readFileSync(file.fsPath, 'utf8')))

	panel.webview.html = pre + result + post
}

function sendText (arguments) {
	terminal.sendText(arguments.command)
}

function renderStepUri (step) {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	console.log(uri)
	return uri
}

function renderCommandUri (command) {
	const uri = encodeURIComponent(JSON.stringify([{ 'command': command }])).toString();
	console.log(uri)
	return uri
}

function inform (message) {
	console.log(message)
	vscode.window.showInformationMessage(message)
}

function deactivate() {}