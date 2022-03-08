const vscode = require('vscode')
module.exports = {activate, deactivate}

terminal = null

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	inform('Katapod is enabled')

	terminal = vscode.window.createTerminal('cqlsh')

    vscode.window.registerUriHandler({
		handleUri(uri) {
			inform(uri.path)
			
			const words = uri.path.split('/');

			terminal.show()
			terminal.sendText(prepareCommand(words[2]))
		}
	});

	// let disposable1 = vscode.commands.registerCommand('katapod.helloWorld', function () {
	// 	vscode.window.showInformationMessage('Hello World!');
	// });
	// context.subscriptions.push(disposable1);
}

function deactivate() {}

function prepareCommand(rawCommand) {
	command = rawCommand.replace(/_/g, " ");
	
	return command
}

function inform (message) {
	console.log(message)
	vscode.window.showInformationMessage(message)
}
