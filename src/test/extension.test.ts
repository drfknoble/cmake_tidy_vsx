import * as assert from 'assert';
import * as vscode from 'vscode';

suite('CMake Tidy Extension Test Suite', () => {
	test('Commands registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('cmake-tidy.runCurrentFile'));
		assert.ok(commands.includes('cmake-tidy.runSelectedText'));
	});
});
