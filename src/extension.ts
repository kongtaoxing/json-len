// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

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
		const fileSize = Buffer.from(text).length;
		const config = vscode.workspace.getConfiguration('jsonLen');
		const maxFileSize = config.get<number>('maxFileSize') || 100;
		const fileSizeUnit = config.get<'KB' | 'MB' | 'GB'>('fileSizeUnit') || 'MB';
		
		// 转换阈值为字节
		const threshold = maxFileSize * (fileSizeUnit === 'KB' ? 1024 : 
									  fileSizeUnit === 'MB' ? 1024 * 1024 : 
									  1024 * 1024 * 1024);

		// 添加文件大小信息到第一行
		const sizeLine = editor.document.lineAt(0);
		fileSizeDecorations.push({
			range: sizeLine.range,
			renderOptions: {
				after: {
					contentText: `  (${formatFileSize(fileSize)})`
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
				console.log('尝试解析 JSON：', text.substring(0, 100) + '...');  // 只显示前100个字符
				const jsonContent = JSON.parse(text);
				console.log('JSON 解析成功');

				// 修改后的递归函数
				const findArrays = (obj: any, startOffset: number) => {
					if (Array.isArray(obj)) {
						const arrayStr = JSON.stringify(obj, null, 2);
						const pos = editor.document.positionAt(startOffset);
						const line = editor.document.lineAt(pos.line);
						const bracketIndex = line.text.indexOf('[');
						
						if (bracketIndex !== -1) {
							arrayDecorations.push({
								range: new vscode.Range(pos.line, bracketIndex + 1, pos.line, bracketIndex + 1),
								renderOptions: {
									after: {
										contentText: ` (${obj.length} items)`
									}
								}
							});
						}

						// 处理数组中的每个元素
						obj.forEach((item: any) => {
							if (item && typeof item === 'object') {
								const itemStr = JSON.stringify(item, null, 2);
								const itemOffset = text.indexOf(itemStr, startOffset);
								if (itemOffset !== -1) {
									findArrays(item, itemOffset);
								}
							}
						});
					} else if (obj && typeof obj === 'object') {
						// 处理对象的每个属性
						for (const key in obj) {
							const value = obj[key];
							if (value && typeof value === 'object') {
								const valueStr = JSON.stringify(value, null, 2);
								const valueOffset = text.indexOf(valueStr, startOffset);
								if (valueOffset !== -1) {
									findArrays(value, valueOffset);
								}
							}
						}
					}
				};

				// 从文档开始位置开始查找
				findArrays(jsonContent, 0);
				
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
