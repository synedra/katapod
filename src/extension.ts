const { syncBuiltinESMExports } = require('module');
import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');
const markdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

let terminal: vscode.Terminal;
let panel: vscode.WebviewPanel;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');

	panel = createPanel();
	loadPage({ 'step': 'intro' });

	const locationOptions: vscode.TerminalEditorLocationOptions = {
		viewColumn: vscode.ViewColumn.Beside
	};
	const options: vscode.TerminalOptions = {
		name: 'cqlsh-editor',
		location: locationOptions
	};

	terminal = vscode.window.createTerminal(options);
	terminal.sendText("echo -n 'Waiting for Cassandra to start...'; timeout 60 bash -c 'until cqlsh -e \"describe cluster\" >/dev/null 2>&1; do sleep 2; echo -n \".\"; done'; echo ' Ready!'");

	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendText));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPage));

	vscode.commands.executeCommand('notifications.clearAll');
}

function createPanel () {
	return vscode.window.createWebviewPanel(
		'katapodWebview',
		'KataPod Webview',
		vscode.ViewColumn.Beside,
		{
			enableCommandUris: true,
			enableScripts: true,
			retainContextWhenHidden: true,
			enableFindWidget: true
		}
	);
}

interface Target {
	step: string;
}

function loadPage (target: Target) {

	let workingdir: string | undefined;
	if (!vscode.workspace.workspaceFolders) {
		workingdir = vscode.workspace.rootPath;
	} else {
		workingdir = vscode.workspace.workspaceFolders[0].uri.path;
	}

	const file = vscode.Uri.file(path.join(workingdir, target.step + '.md'));

	const md = new markdownIt({html: true})
		.use(require('markdown-it-textual-uml'))
		.use(markdownItAttrs);

	// process codeblocks
	md.renderer.rules.fence_default = md.renderer.rules.fence;
	md.renderer.rules.fence = function (tokens: any, idx: any, options: any, env: any, slf: any) {
		var token = tokens[idx],
			info = token.info ? md.utils.unescapeAll(token.info).trim() : '';

		if (info) { // Fallback to the default processor
			return md.renderer.rules.fence_default(tokens, idx, options, env, slf);
		}
	  
		return  '<a class="command_link" href="command:katapod.sendText?' + renderCommandUri(tokens[idx].content) + '"><pre' + slf.renderAttrs(token) + '><code>' +
				md.utils.escapeHtml(tokens[idx].content) +
				'</code></pre></a>\n';
	};

	// process links
	let linkOpenDefault = md.renderer.rules.link_open || function(tokens: any, idx: any, options: any, env: any, self: any) { return self.renderToken(tokens, idx, options); };
	md.renderer.rules.link_open = function (tokens: any, idx: any, options: any, env: any, self: any) {
		var href = tokens[idx].attrIndex('href');
	  
		let url = tokens[idx].attrs[href][1];
		if (url.includes('command:katapod.loadPage?')) {
			let uri = url.replace('command:katapod.loadPage?', '');
			tokens[idx].attrs[href][1] = 'command:katapod.loadPage?' + renderStepUri(uri);
		}
	  
		return linkOpenDefault(tokens, idx, options, env, self);
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
	<body>`;
	const post = `</body></html>`;
	var result = md.render((fs.readFileSync(file.fsPath, 'utf8')));

	panel.webview.html = pre + result + post;
}

function sendText (command: any) {
	terminal.sendText(command.command);
}

function renderStepUri (step: string) {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	return uri;
}

function renderCommandUri (command: string) {
	const uri = encodeURIComponent(JSON.stringify([{ 'command': command }])).toString();
	return uri;
}

function inform (message: string) {
	console.log(message);
	vscode.window.showInformationMessage(message);
}

export function deactivate() {}