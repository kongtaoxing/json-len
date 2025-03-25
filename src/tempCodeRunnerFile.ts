// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

let arrayLengthDecorator: vscode.TextEditorDecorationType;
let fileSizeDecorator: vscode.TextEditorDecorationType;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "json-len" is now active!');

	// 创建装饰器
	arrayLengthDecorator = vscode.window.createTextEditorDecorationType({
		after: {
			color: new vscode.ThemeColor('editorLineNumber.foreground'),
			margin: '0 0 0 1em'
		}
	});

	fileSizeDecorator = vscode.window.createTextEditorDecorationType({
		after: {
			color: new vscode.ThemeColor('editorLineNumber.foreground')
		}
	});

	// 初始化时立即更新当前编辑器
	if (vscode.window.activeTextEditor?.document.languageId === 'json') {
		updateDecorations();
	}

	// 监听活动编辑器变化
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && editor.document.languageId === 'json') {
				updateDecorations();
			}
		})
	);

	// 监听文档变化
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			const editor = vscode.window.activeTextEditor;
			if (editor && event.document === editor.document && editor.document.languageId === 'json') {
				updateDecorations();
			}
		})
	);
}

function updateDecorations() {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.languageId !== 'json') {
		return;
	}

	const text = editor.document.getText();
	const arrayDecorations: vscode.DecorationOptions[] = [];
	const fileSizeDecorations: vscode.DecorationOptions[] = [];

	try {
		// 添加文件大小信息
		const fileSize = Buffer.from(text).length;
		const sizeLine = editor.document.lineAt(0);
		fileSizeDecorations.push({
			range: sizeLine.range,
			renderOptions: {
				after: {
					contentText: `  (${formatFileSize(fileSize)})`
				}
			}
		});

		// 查找所有数组
		const lines = editor.document.getText().split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const bracketIndex = line.indexOf('[');
			if (bracketIndex !== -1) {
				try {
					const arrayContent = getArrayContent(text, editor.document.offsetAt(new vscode.Position(i, 0)) + bracketIndex);
					if (arrayContent) {
						const array = JSON.parse(arrayContent);
						if (Array.isArray(array)) {
							arrayDecorations.push({
								range: new vscode.Range(i, bracketIndex + 1, i, bracketIndex + 1),
								renderOptions: {
									after: {
										contentText: ` (${array.length} items)`
									}
								}
							});
						}
					}
				} catch (e) {
					// 解析错误时跳过
				}
			}
		}
	} catch (e) {
		console.error('Error updating decorations:', e);
	}

	editor.setDecorations(arrayLengthDecorator, arrayDecorations);
	editor.setDecorations(fileSizeDecorator, fileSizeDecorations);
}

function getArrayContent(text: string, startOffset: number): string | null {
	let brackets = 0;
	let start = -1;
	
	for (let i = startOffset; i < text.length; i++) {
		if (text[i] === '[') {
			if (start === -1) {
				start = i;
			}
			brackets++;
		} else if (text[i] === ']') {
			brackets--;
			if (brackets === 0 && start !== -1) {
				return text.substring(start, i + 1);
			}
		}
	}
	return null;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return bytes + ' B';
	}
	if (bytes < 1024 * 1024) {
		return (bytes / 1024).toFixed(1) + ' KB';
	}
	return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (arrayLengthDecorator) {
		arrayLengthDecorator.dispose();
	}
	if (fileSizeDecorator) {
		fileSizeDecorator.dispose();
	}
}
