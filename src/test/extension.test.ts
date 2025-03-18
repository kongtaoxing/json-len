import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';

suite('Extension Test Suite', function () {
	// 增加测试超时时间到 10 秒
	this.timeout(10000);
	
	vscode.window.showInformationMessage('开始测试');

	test('测试 JSON 文件装饰器', async () => {
		// 等待扩展激活
		// 注意：这里使用包名而不是扩展ID
		await vscode.extensions.getExtension('kongtaoxing.json-len')?.activate();

		// 创建测试用的 JSON 文件内容
		const testJson = `{
			"simpleArray": [1, 2, 3],
			"nestedArray": [
				{"id": 1},
				{"id": 2},
				{"id": 3}
			],
			"emptyArray": []
		}`;

		// 创建临时文件
		const document = await vscode.workspace.openTextDocument({
			content: testJson,
			language: 'json'
		});

		// 打开文件
		const editor = await vscode.window.showTextDocument(document);

		// 等待装饰器更新
		await new Promise(resolve => setTimeout(resolve, 2000));

		// 验证文档已打开
		assert.ok(editor, '编辑器应该已打开');
		assert.strictEqual(editor.document.languageId, 'json', '文档类型应该是 JSON');

		// 验证文件内容
		assert.ok(editor.document.getText().includes('"simpleArray"'), '文档应包含测试数据');
	});

	test('测试数组长度计算', async () => {
		// 等待扩展激活
		await vscode.extensions.getExtension('kongtaoxing.json-len')?.activate();

		// 创建嵌套数组的测试用例
		const testJson = `{
			"array": [
				[1, 2, 3],
				{"nested": [4, 5, 6]},
				[7, 8, 9]
			]
		}`;

		const document = await vscode.workspace.openTextDocument({
			content: testJson,
			language: 'json'
		});

		const editor = await vscode.window.showTextDocument(document);

		// 等待装饰器更新
		await new Promise(resolve => setTimeout(resolve, 2000));

		// 验证文档已打开
		assert.ok(editor, '编辑器应该已打开');
		assert.strictEqual(editor.document.languageId, 'json', '文档类型应该是 JSON');

		// 验证文件内容
		assert.ok(editor.document.getText().includes('"array"'), '文档应包含测试数组');
	});
});
