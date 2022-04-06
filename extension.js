const { syncBuiltinESMExports } = require('module')
const vscode = require('vscode')
module.exports = {activate, deactivate}

terminal = null
commands = {} 

commands.call = function (args) {
	inform('External API Call: ' + args)
}

commands.command = function (args) {
	console.log(args)
	terminal.show()
	terminal.sendText(prepareCommand(args))
}

commands.finish = function (args) {
	terminal.sendText(prepareCommand(args))
}

const callbackUri = vscode.env.asExternalUri(
	vscode.Uri.parse(`${vscode.env.uriScheme}://aleks.katapod/auth-complete`)
)

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	inform('Katapod is enabled')

	// const commentCommandUri = vscode.Uri.parse(`command:editor.action.addCommentLine`);
	// inform(commentCommandUri.toString());

	terminal = vscode.window.createTerminal('cqlsh')

    vscode.window.registerUriHandler({
		handleUri(uri) {
			const words = uri.path.split('/');
			commands[words[1]](words[2])
		}
	});

	let disposable1 = vscode.commands.registerCommand('katapod.helloAleks', function () {
		inform('Hello Aleks!');
		inform(callbackUri.toString);
		inform(vscode.env.uriScheme);
	});
	context.subscriptions.push(disposable1);
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
