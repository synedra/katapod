const { syncBuiltinESMExports } = require('module')
const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const MarkdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

module.exports = {activate, deactivate}

terminal = null
panel = null

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	//inform('Katapod is enabled')

	vscode.commands.executeCommand('workbench.action.closeSidebar');

	panel = createPanel()
	loadPage({ 'step': 'intro' })

	terminal = vscode.window.createTerminal('cqlsh')
	terminal.show()
	terminal.sendText("echo -n 'Waiting for Cassandra to start...'; timeout 60 bash -c 'until printf \"\" 2>>/dev/null >>/dev/tcp/localhost/9042; do sleep 2; echo -n \".\"; done'; echo ' Ready!'")

	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendText));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPage));

	vscode.commands.executeCommand('notifications.clearAll');
}

function createPanel () {
	return vscode.window.createWebviewPanel(
		'katapodWebview',
		'KataPod Webview',
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

	if (!vscode.workspace.workspaceFolders[0]) {
		workingdir = vscode.workspace.rootPath;
	} else {
		workingdir = vscode.workspace.workspaceFolders[0].uri.path
	}

	const file = vscode.Uri.file(path.join(workingdir, target.step + '.md'));

	const md = new MarkdownIt({html: true})
		.use(require('markdown-it-textual-uml'))
		.use(markdownItAttrs);

	// process codeblocks
	md.renderer.rules.fence_default = md.renderer.rules.fence  
	md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
		var token = tokens[idx],
			info = token.info ? md.utils.unescapeAll(token.info).trim() : '';

		if (info) { // Fallback to the default processor
			return md.renderer.rules.fence_default(tokens, idx, options, env, slf)
		}
	  
		return  '<a class="command_link" href="command:katapod.sendText?' + renderCommandUri(tokens[idx].content) + '"><pre' + slf.renderAttrs(token) + '><code>' +
				md.utils.escapeHtml(tokens[idx].content) +
				'</code></pre></a>\n';
	};

	// process links
	link_open_default = md.renderer.rules.link_open || function(tokens, idx, options, env, self) { return self.renderToken(tokens, idx, options); };
	md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
		var href = tokens[idx].attrIndex('href');
	  
		url = tokens[idx].attrs[href][1]
		if (url.includes('command:katapod.loadPage?')) {
			uri = url.replace('command:katapod.loadPage?', '')
			tokens[idx].attrs[href][1] = 'command:katapod.loadPage?' + renderStepUri(uri);
		}
	  
		return link_open_default(tokens, idx, options, env, self);
	};

	const pre = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<!-- <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
		<script>mermaid.initialize({startOnLoad:true});</script> -->
		<style>
			pre code {background-color: lightgray; color: black; margin: 0 10px 0 10px; padding: 10px 10px; width: 100%; display: block;}
			a.command_link {text-decoration:none;}
			a.orange_bar {display: block; cursor: pointer; text-decoration: none; color: white; background-color: rgb(253, 119, 0); vertical-align: middle; text-align: middle; padding: 20px; width: 100%; text-transform:uppercase;}
			a.steps {color: white; text-decoration: none;}
			div.top {width:100%; padding: 40px 0 20px 20px; background-color: rgb(28, 131, 165); color: white;}
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
	return uri
}

function renderCommandUri (command) {
	const uri = encodeURIComponent(JSON.stringify([{ 'command': command }])).toString();
	return uri
}

function inform (message) {
	console.log(message)
	vscode.window.showInformationMessage(message)
}

function deactivate() {}