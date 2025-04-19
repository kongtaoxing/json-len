// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { parseTree, findNodeAtLocation } from 'jsonc-parser';

let arrayLengthDecorator: vscode.TextEditorDecorationType;
let fileSizeDecorator: vscode.TextEditorDecorationType;

// 添加配置接口
interface JsonLenConfiguration {
	maxFileSize: number;
	fileSizeUnit: 'KB' | 'MB' | 'GB';
}

// 添加语言相关的消息配置
const messages = {
	'zh-cn': {
		sizeWarning: (fileSize: string, maxSize: number, unit: string) => 
			`文件大小 (${fileSize}) 超过设定阈值 (${maxSize}${unit})。是否继续渲染数组长度？`,
		continue: '继续',
		cancel: '取消',
		openSettings: '打开设置'
	},
	'en': {
		sizeWarning: (fileSize: string, maxSize: number, unit: string) => 
			`File size (${fileSize}) exceeds threshold (${maxSize}${unit}). Continue rendering array lengths?`,
		continue: 'Continue',
		cancel: 'Cancel',
		openSettings: 'Open Settings'
	}
};

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
			margin: '0 0.1em 0 0.1em'
		}
	});

	fileSizeDecorator = vscode.window.createTextEditorDecorationType({
		before: {
			color: new vscode.ThemeColor('editorLineNumber.foreground'),
			// margin: '0 0.1em'
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

	// 注册美化预览命令
	let disposable = vscode.commands.registerCommand('json-len.beautifyPreview', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.languageId !== 'json') {
			return;
		}

		const text = editor.document.getText().trim();
		if (!text) {
			return;
		}

		try {
			const jsonObj = JSON.parse(text);
			const beautifiedJson = JSON.stringify(jsonObj, null, 2);

			// 如果内容没有变化，不需要进行操作
			if (text === beautifiedJson) {
				const currentLanguage = vscode.env.language.toLowerCase();
				const message = currentLanguage.startsWith('zh') ? 
					'JSON 已经是格式化的状态' : 
					'JSON is already formatted';
				vscode.window.showInformationMessage(message);
				return;
			}

			// 创建预览
			const previewDoc = await vscode.workspace.openTextDocument({
				content: beautifiedJson,
				language: 'json'
			});

			// 显示预览
			await vscode.window.showTextDocument(previewDoc, {
				viewColumn: vscode.ViewColumn.Beside,
				preview: true
			});

			// 询问是否替换原内容
			const currentLanguage = vscode.env.language.toLowerCase();
			const replaceMessage = currentLanguage.startsWith('zh') ? 
				'是否用格式化后的内容替换原内容？' : 
				'Do you want to replace the original content with the formatted JSON?';
			const replaceButton = currentLanguage.startsWith('zh') ? '替换' : 'Replace';
			const keepButton = currentLanguage.startsWith('zh') ? '保持原样' : 'Keep Original';

			const choice = await vscode.window.showInformationMessage(
				replaceMessage,
				replaceButton,
				keepButton
			);

			if (choice === replaceButton) {
				await editor.edit(editBuilder => {
					const fullRange = new vscode.Range(
						editor.document.positionAt(0),
						editor.document.positionAt(text.length)
					);
					editBuilder.replace(fullRange, beautifiedJson);
				});
			}
		} catch (error) {
			const currentLanguage = vscode.env.language.toLowerCase();
			const errorMessage = currentLanguage.startsWith('zh') ? 
				'无效的 JSON 格式' : 
				'Invalid JSON format';
			vscode.window.showErrorMessage(errorMessage);
		}
	});

	context.subscriptions.push(disposable);
}

async function updateDecorations() {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.languageId !== 'json') {
		console.log('不是 JSON 文件或没有活动编辑器');
		return;
	}

	const text = editor.document.getText();
	const arrayDecorations: vscode.DecorationOptions[] = [];
	const fileSizeDecorations: vscode.DecorationOptions[] = [];

	try {
		// 添加单行JSON检测逻辑
		const lines = text.split('\n');
		if (lines.length === 1 && text.trim()) {
			try {
				const jsonObj = JSON.parse(text);
				const isSimpleJson = (text === '{}' || text === '[]') || 
					(Array.isArray(jsonObj) && jsonObj.every(item => 
						typeof item !== 'object' || item === null
					)) ||
					(!Array.isArray(jsonObj) && typeof jsonObj === 'object' && jsonObj !== null && 
						Object.values(jsonObj).every(value => 
							typeof value !== 'object' || value === null
						));

				if (!isSimpleJson) {
					const currentLanguage = vscode.env.language.toLowerCase();
					const formatMessage = currentLanguage.startsWith('zh') ? 
						'检测到复杂的单行 JSON，是否需要格式化以便阅读？' : 
						'Complex single-line JSON detected, would you like to format it for better readability?';
					const previewButton = currentLanguage.startsWith('zh') ? '预览' : 'Preview';
					const formatButton = currentLanguage.startsWith('zh') ? '格式化' : 'Format';
					const keepButton = currentLanguage.startsWith('zh') ? '保持原样' : 'Keep Original';

					const choice = await vscode.window.showInformationMessage(
						formatMessage,
						previewButton,
						formatButton,
						keepButton
					);

					if (choice === formatButton) {
						const beautifiedJson = JSON.stringify(jsonObj, null, 2);
						await editor.edit(editBuilder => {
							const fullRange = new vscode.Range(
								editor.document.positionAt(0),
								editor.document.positionAt(text.length)
							);
							editBuilder.replace(fullRange, beautifiedJson);
						});
						return; // 格式化后退出当前函数
					} else if (choice === previewButton) {
						const beautifiedJson = JSON.stringify(jsonObj, null, 2);
						const previewDoc = await vscode.workspace.openTextDocument({
							content: beautifiedJson,
							language: 'json'
						});
						// 保存预览编辑器的引用
						const previewEditor = await vscode.window.showTextDocument(previewDoc, {
							viewColumn: vscode.ViewColumn.Beside,
							preview: true
						});

						const formatButton = vscode.env.language.toLowerCase().startsWith('zh') ? '格式化' : 'Format';
						const formatChoice = await vscode.window.showInformationMessage(
							vscode.env.language.toLowerCase().startsWith('zh') ? 
								'是否要格式化原文件?' : 
								'Do you want to format the original file?',
							formatButton
						);

						if (formatChoice === formatButton) {
							await editor.edit(editBuilder => {
								const fullRange = new vscode.Range(
									editor.document.positionAt(0),
									editor.document.positionAt(text.length)
								);
								editBuilder.replace(fullRange, beautifiedJson);
							});
							// 清空预览内容后关闭
							await previewEditor.edit(editBuilder => {
								const fullRange = new vscode.Range(
									previewDoc.positionAt(0),
									previewDoc.positionAt(previewDoc.getText().length)
								);
								editBuilder.delete(fullRange);
							});
							await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
						}
					}
				}
			} catch (e) {
				// JSON解析错误，继续执行其他逻辑
				console.log('JSON 解析错误:', e);
			}
		}

		// 原有的文件大小检测和数组长度装饰器逻辑
		const fileSize = Buffer.from(text).length;
		const config = vscode.workspace.getConfiguration('jsonLen');
		const maxFileSize = config.get<number>('maxFileSize') || 100;
		const fileSizeUnit = config.get<'KB' | 'MB' | 'GB'>('fileSizeUnit') || 'MB';
		
		// 转换阈值为字节
		const threshold = maxFileSize * (fileSizeUnit === 'KB' ? 1024 : 
									  fileSizeUnit === 'MB' ? 1024 * 1024 : 
									  1024 * 1024 * 1024);

		// 添加文件大小信息到虚拟行
		fileSizeDecorations.push({
			range: new vscode.Range(0, 0, 0, 0),
			renderOptions: {
				before: {
					contentText: `(${formatFileSize(fileSize)})\n`,
				}
			}
		});

		// 检查文件大小是否超过阈值
		if (fileSize > threshold) {
			// 获取 VSCode 的语言设置
			const currentLanguage = vscode.env.language.toLowerCase();
			// 选择语言配置，如果不是中文则使用英文
			const lang = currentLanguage.startsWith('zh') ? 'zh-cn' : 'en';
			const msg = messages[lang];

			const answer = await vscode.window.showWarningMessage(
				msg.sizeWarning(formatFileSize(fileSize), maxFileSize, fileSizeUnit),
				msg.continue,
				msg.cancel,
				msg.openSettings
			);

			if (answer === msg.openSettings) {
				vscode.commands.executeCommand('workbench.action.openSettings', 'jsonLen');
				editor.setDecorations(fileSizeDecorator, fileSizeDecorations);
				return;
			} else if (answer !== msg.continue) {
				editor.setDecorations(fileSizeDecorator, fileSizeDecorations);
				return;
			}
		}

		// 检查文本是否为空或只包含空白字符
		if (text.trim()) {
			try {
				// 使用 jsonc-parser 解析 JSON 并获取 AST
				const tree = parseTree(text);
				if (tree) {
					const processNode = (node: any) => {
						if (node.type === 'array') {
							// 获取数组的起始位置
							const pos = editor.document.positionAt(node.offset);
							// 计算数组的长度
							let arrayLength = 0;
							if (node.children) {
								// 过滤掉逗号节点，只计算实际的数组元素
								arrayLength = node.children.filter((child: any) => 
									child.type !== 'comma'
								).length;
							}

							// 添加装饰器
							arrayDecorations.push({
								range: new vscode.Range(pos.line, pos.character + 1, pos.line, pos.character + 1),
								renderOptions: {
									after: {
										contentText: `(${arrayLength} items)`
									}
								}
							});
						}

						// 递归处理子节点
						if (node.children) {
							node.children.forEach((child: any) => processNode(child));
						}
					};

					processNode(tree);
				}
				
				console.log('找到的数组装饰数量：', arrayDecorations.length);
			} catch (e: any) {
				console.log('JSON 解析错误:', e.message);
			}
		} else {
			console.log('文件内容为空');
		}
	} catch (e) {
		console.error('装饰器更新错误:', e);
	}

	console.log('应用装饰器 - 文件大小数量:', fileSizeDecorations.length);
	console.log('应用装饰器 - 数组长度数量:', arrayDecorations.length);
	
	editor.setDecorations(arrayLengthDecorator, arrayDecorations);
	editor.setDecorations(fileSizeDecorator, fileSizeDecorations);
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
