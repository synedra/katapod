/*
Parsing/rendering markdown, code blocks and other elements.
*/

import * as vscode from "vscode";
import * as path from "path";
const fs = require("fs");
const markdownIt = require("markdown-it");
const markdownItAttrs = require("markdown-it-attrs");
const highlightjs = require('highlight.js'); // https://highlightjs.org

import {runCommandsPerTerminal, ConfigCommand, FullCommand, cbIdSeparator} from "./runCommands";
import {buildFullFileUri} from "./filesystem";
import {KatapodEnvironment} from "./state";
import {log} from "./logging";


const executionInfoPrefix = "### ";
const defaultCodeBlockMaxInvocations = "unlimited";

const stepPageHtmlPrefix = `
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/default.min.css">
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/css/katapodv2.css" />
		<script src="https://datastax-academy.github.io/katapod-shared-assets/js/katapod.js"></script>
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/quiz/quiz.css" />
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/quiz/page.css" />
		<script src="https://datastax-academy.github.io/katapod-shared-assets/quiz/quiz.js"></script>
		<script src="https://datastax-academy.github.io/katapod-shared-assets/quiz/main.js"></script>
	</head>
	<body>
`;
const stepPageHtmlPostfix = `
		<script>
			// adapted from: https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing
			window.addEventListener("message", event => {
				const message = event.data;
				switch(message.command){
					case "scroll_to_top":
						window.scrollTo(0, 0);
						break;
					case "mark_executed_block":
						const codeBlock = document.getElementById(message.blockId);
						if (codeBlock) {
							codeBlock.classList.add("executed");
							break;
						}
				}
			});
		</script>
	</body>
</html>
`;
const fullRemoteUriSnippet = '://';

// this must be a FullCommand with "command" and "codeBlockId" removed!
interface CodeBlockExecutionInfo {
    terminalId?: string;
    execute?: boolean;
	maxInvocations: number | "unlimited";
}

export interface TargetStep {
	step: string;
}


function parseCodeBlockContent(step: string, index: number, cbContent: string): FullCommand {
    /*
    Parse a code-block "raw string", such as
        ### {"terminalId": "myTermId"}
        ls
    or
        ls
    or
        ### myTermId
    into a FullCommand object.
    Notes:
        - Codeblocks with no "### "-prefixed lines will just work
        - For codeblocks with multiple "### ", only the last one is used
          and the previous ones are silently discarded.
    */
    let actualLines: Array<string> = [];
    let infoLine: string | undefined = undefined;
    const rawLines = cbContent.split("\n");
    //
	rawLines.forEach( (line) => {
		if (line.slice(0,4) === executionInfoPrefix) {
			infoLine = line.slice(executionInfoPrefix.length).trim();
		}else{
			actualLines.push(line);
		}
	});
    //
    const bareCommand: string = actualLines.join("\n");
	const contextData = {
		codeBlockId: `inPage${cbIdSeparator}${step}${cbIdSeparator}${index}`,
	};
    //
    if (infoLine) {
        // this might be just-a-terminal-Id, a fully-formed JSON
        let executionInfo: CodeBlockExecutionInfo;
        try{
            executionInfo = {
				...{maxInvocations: defaultCodeBlockMaxInvocations},
				...JSON.parse(infoLine),
			 } as CodeBlockExecutionInfo;
        }catch(e) {
            // we take the line to be a naked terminalId
            executionInfo = {
				terminalId: infoLine,
				maxInvocations: defaultCodeBlockMaxInvocations,
			};
        }
        return {
			...contextData,
            ...executionInfo,
            ...{command: bareCommand},
        };
    }else{
        return {
			...contextData,
			...{
				maxInvocations: defaultCodeBlockMaxInvocations,
            	command: bareCommand,
			},
        };
    }
}

function renderStepUri(step: string): string {
	const uri = encodeURIComponent(JSON.stringify([{step: step}])).toString();
	return uri;
}

function renderCommandUri(fullCommand: FullCommand): string {
	const uri = encodeURIComponent(JSON.stringify([fullCommand])).toString();
	return uri;
}

export function reloadPage(command: any, env: KatapodEnvironment) {
	const currentStep = env.state.stepHistory.slice(-1)[0];
	if (typeof currentStep === "string") {
		loadPage({step: currentStep}, env);
	}
}

export function isLocalImageSrc(imgSrc: string): boolean {
	/*
	Determine if the "src" attribute of an image embedded in the markdown
	is a reference to a file local in the scenario repo. 
	*/
	return imgSrc.indexOf(fullRemoteUriSnippet) < 0;
}

function normalizeSyntaxLanguage(lang0: string): string {
	if (lang0.toLowerCase() === 'cql') {
		// Note: maybe one day we will add CQL syntax to hightlight.js ...
		return 'sql';
	} else {
		return lang0.toLowerCase();
	}
}

function renderHighlightedCode(codeStr: string, lang: string, markdownIt: any): string {
	// adapted from: https://github.com/markdown-it/markdown-it#syntax-highlighting
	const langNorm = normalizeSyntaxLanguage(lang);
	if (langNorm && highlightjs.getLanguage(langNorm)) {
		try {
			return highlightjs.highlight(codeStr, { language: langNorm }).value;
		} catch (__) {}
	}	
	return markdownIt.utils.escapeHtml(codeStr); // use external default escaping
};

export function loadPage(target: TargetStep, env: KatapodEnvironment) {
	env.state.stepHistory.push(target.step);
	log("debug", `[loadPage] Step history: ${env.state.stepHistory.map(s => s.toString()).join(" => ")}`);

	const file = buildFullFileUri(`${target.step}.md`);

	const md = new markdownIt({html: true})
		.use(require("markdown-it-textual-uml"))
		.use(markdownItAttrs);

	let blockIndex = 0;

	// process inline code
	md.renderer.rules.code_inline = function (tokens: any, idx: any, options: any, env: any, slf: any) {
		// modified from: https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js#L21-L27
		var token = tokens[idx];
		return  '<code class="inline_code"' + slf.renderAttrs(token) + '>' +
				md.utils.escapeHtml(token.content) +
				'</code>';
	};
	
	// process codeblocks
	md.renderer.rules.fence_default = md.renderer.rules.fence;
	md.renderer.rules.fence = function (tokens: any, idx: any, options: any, env: any, slf: any) {
		var token = tokens[idx];
		// 'info' is assumed to be a single word = a syntax specifier, or ''.
		var info = token.info ? md.utils.unescapeAll(token.info).trim() : "";

		const parsedCommand: FullCommand = parseCodeBlockContent(target.step, blockIndex, tokens[idx].content);
		var renderedCode: string = renderHighlightedCode(parsedCommand.command, info, md);

		blockIndex++;

		const suppressExecution = parsedCommand.execute === false;

		const executionHref = `command:katapod.sendText?${renderCommandUri(parsedCommand)}`;
		const aSpanEle = suppressExecution ? '<span>': `<a class="codeblock" title="Click to execute" href="${executionHref}">`;
		const aSpanEleCloser = suppressExecution ? '</span>': '</a>';
		const preEle = `<pre` + slf.renderAttrs(token) + `>`;
		const codeEleClasses = suppressExecution ? "codeblock nonexecutable" : "codeblock executable";
		const codeEle = `<code id="${parsedCommand.codeBlockId}" class="${codeEleClasses}">`;

		return `${aSpanEle}${preEle}${codeEle}${renderedCode}</code></pre>${aSpanEleCloser}`;

	};

	// process links
	let linkOpenDefault = md.renderer.rules.link_open || function(tokens: any, idx: any, options: any, env: any, self: any) { return self.renderToken(tokens, idx, options); };
	md.renderer.rules.link_open = function (tokens: any, idx: any, options: any, env: any, self: any) {
		var href = tokens[idx].attrIndex("href");
		let url = tokens[idx].attrs[href][1];
		if (url.includes("command:katapod.loadPage?")) {
			let uri = url.replace("command:katapod.loadPage?", "");
			tokens[idx].attrs[href][1] = "command:katapod.loadPage?" + renderStepUri(uri);
		}
	  
		return linkOpenDefault(tokens, idx, options, env, self);
	};

	// process images
	const _webview = env.components.panel.webview;
	let imageDefault = md.renderer.rules.image || function(tokens: any, idx: any, options: any, env: any, self: any) { return self.renderToken(tokens, idx, options); };
	md.renderer.rules.image = function(tokens: any, idx: any, options: any, env: any, self: any) {
		var srcIndex = tokens[idx].attrIndex("src");
		var srcValue = tokens[idx].attrs[srcIndex][1];
		if (isLocalImageSrc(srcValue)){
			// replace the (relative) path to the image file to the VSCode special URI
			// as described here: https://code.visualstudio.com/api/extension-guides/webview#loading-local-content
			const imgUri = buildFullFileUri(srcValue);
			const imgPanelUri = _webview.asWebviewUri(imgUri);
			tokens[idx].attrs[srcIndex][1] = imgPanelUri;
		}
		return imageDefault(tokens, idx, options, env, self);
	};

	var result = md.render((fs.readFileSync(file.fsPath, "utf8")));

	env.components.panel.webview.html = stepPageHtmlPrefix + result + stepPageHtmlPostfix;

	// process step-scripts, if present:
	const stepScripts = (env.configuration.navigation?.onLoadCommands || {})[target.step] || {};
	runCommandsPerTerminal(target.step, stepScripts, env, `onLoad[${target.step}]`);

	vscode.commands.executeCommand("notifications.clearAll").then( () => {
		env.components.panel.webview.postMessage({command: "scroll_to_top"});
	});
}
