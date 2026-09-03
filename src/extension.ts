import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('CMake Tidy');

	const documentSelector: vscode.DocumentFilter[] = [
		{ language: 'cmake' },
		{ pattern: '**/CMakeLists.txt' },
		{ pattern: '**/*.cmake' },
	];

	// Command: Run CMake Tidy on Current File
	const commandRunFile = vscode.commands.registerCommand('cmake-tidy.runCurrentFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('CMake Tidy needs an active CMake file.');
			return;
		}

		const document = editor.document;
		if (!isCMakeFile(document)) {
			vscode.window.showErrorMessage('CMake Tidy only runs on CMakeLists.txt and .cmake files.');
			return;
		}

		output.clear();
		output.show(true);

		try {
			const fullRange = getFullDocumentRange(document);
			const formattedText = await formatSnippet(document.getText(), document, output);
			if (formattedText !== null) {
				const currentText = document.getText();
				if (formattedText !== currentText) {
					await editor.edit((editBuilder) => editBuilder.replace(fullRange, formattedText));
					vscode.window.showInformationMessage('CMake Tidy: Document reformatted.');
				} else {
					vscode.window.showInformationMessage('CMake Tidy: File is already formatted.');
				}
			}
		} catch (error) {
			handleError(error, output);
		}
	});

	// Command: Run CMake Tidy on Selection
	const commandRunSelection = vscode.commands.registerCommand('cmake-tidy.runSelectedText', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('CMake Tidy needs an active CMake file.');
			return;
		}

		const document = editor.document;
		if (!isCMakeFile(document)) {
			vscode.window.showErrorMessage('CMake Tidy only runs on CMakeLists.txt and .cmake files.');
			return;
		}

		if (editor.selection.isEmpty) {
			vscode.window.showInformationMessage('No text selected. Select a region to reformat.');
			return;
		}

		output.clear();
		output.show(true);

		try {
			const result = await formatRange(document, editor.selection, output);
			if (result) {
				const currentText = document.getText(result.range);
				if (result.formattedText !== currentText) {
					await editor.edit((editBuilder) => editBuilder.replace(result.range, result.formattedText));
					vscode.window.showInformationMessage('CMake Tidy: Selection reformatted.');
				} else {
					vscode.window.showInformationMessage('CMake Tidy: Selection is already formatted.');
				}
			}
		} catch (error) {
			handleError(error, output);
		}
	});

	// Formatting Provider: Full Document (e.g. Format Document / Format on Save)
	const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
		documentSelector,
		{
			async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
				try {
					const fullRange = getFullDocumentRange(document);
					const formattedText = await formatSnippet(document.getText(), document, output);
					if (formattedText !== null && formattedText !== document.getText()) {
						return [vscode.TextEdit.replace(fullRange, formattedText)];
					}
				} catch (error) {
					handleError(error, output, false);
				}
				return [];
			},
		}
	);

	// Range Formatting Provider: Selection (e.g. Format Selection)
	const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
		documentSelector,
		{
			async provideDocumentRangeFormattingEdits(
				document: vscode.TextDocument,
				range: vscode.Range
			): Promise<vscode.TextEdit[]> {
				try {
					const result = await formatRange(document, range, output);
					if (result) {
						const currentText = document.getText(result.range);
						if (result.formattedText !== currentText) {
							return [vscode.TextEdit.replace(result.range, result.formattedText)];
						}
					}
				} catch (error) {
					handleError(error, output, false);
				}
				return [];
			},
		}
	);

	context.subscriptions.push(
		output,
		commandRunFile,
		commandRunSelection,
		formattingProvider,
		rangeFormattingProvider
	);
}

/**
 * Format a range within a document by expanding selection to full lines.
 */
async function formatRange(
	document: vscode.TextDocument,
	range: vscode.Range,
	output: vscode.OutputChannel
): Promise<{ range: vscode.Range; formattedText: string } | null> {
	const startLine = range.start.line;
	const endLine = range.end.character === 0 && range.end.line > startLine ? range.end.line - 1 : range.end.line;
	const fullLineRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);

	const textToFormat = document.getText(fullLineRange);
	const stdout = await formatSnippet(textToFormat, document, output);
	if (stdout === null) {
		return null;
	}

	const formattedText = stdout.replace(/\r?\n$/, '');
	return { range: fullLineRange, formattedText };
}

/**
 * Executes `cmake-tidy` on a string snippet using a temporary file.
 */
async function formatSnippet(
	text: string,
	document: vscode.TextDocument,
	output: vscode.OutputChannel
): Promise<string | null> {
	const settings = vscode.workspace.getConfiguration('cmake-tidy');
	const configuredExecutable = settings.get<string>('executable', 'cmake-tidy');
	const argumentsList = settings.get<string[]>('arguments', ['format']);

	const executable = resolveExecutablePath(configuredExecutable);

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmake-tidy-'));
	const fileName = document.fileName ? path.basename(document.fileName) : 'CMakeLists.txt';
	const targetPath = path.join(tempDir, fileName);
	fs.writeFileSync(targetPath, text, 'utf-8');

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const cwd = workspaceFolder || (document.uri.fsPath ? path.dirname(document.uri.fsPath) : undefined);

	output.appendLine(`Running: ${executable} ${[...argumentsList, targetPath].join(' ')}`);

	try {
		const useShell = !path.isAbsolute(executable);
		const { stdout, stderr } = await execFileAsync(executable, [...argumentsList, targetPath], {
			shell: useShell,
			cwd,
		});
		if (stderr) {
			output.append(stderr);
		}
		return stdout;
	} finally {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	}
}

function getFullDocumentRange(document: vscode.TextDocument): vscode.Range {
	const lastLine = document.lineCount - 1;
	return new vscode.Range(0, 0, lastLine, document.lineAt(lastLine).text.length);
}

function handleError(error: unknown, output: vscode.OutputChannel, showUserPopup = true): void {
	const message = error instanceof Error ? error.message : String(error);
	output.appendLine(message);
	if (showUserPopup) {
		if (message.includes('not found') || message.includes('ENOENT')) {
			vscode.window.showErrorMessage(
				`cmake-tidy executable not found. Please set 'cmake-tidy.executable' in VS Code Settings.`
			);
		} else {
			vscode.window.showErrorMessage(`CMake Tidy failed. See the CMake Tidy output for details.`);
		}
	}
}

function resolveExecutablePath(executable: string): string {
	if (executable.startsWith('~/') || executable === '~') {
		executable = path.join(os.homedir(), executable.slice(1));
	}

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (workspaceFolder) {
		executable = executable.replace(/\${workspaceFolder}/g, workspaceFolder);
	}

	executable = executable.replace(/\${env:([^}]+)}/g, (_, varName) => process.env[varName] || '');

	if (executable.includes('/') || executable.includes('\\')) {
		return executable;
	}

	if (executable === 'cmake-tidy') {
		const isWindows = process.platform === 'win32';
		const venvSubdir = isWindows ? 'Scripts' : 'bin';
		const exeName = isWindows ? 'cmake-tidy.exe' : 'cmake-tidy';

		if (process.env.VIRTUAL_ENV) {
			const venvCandidate = path.join(process.env.VIRTUAL_ENV, venvSubdir, exeName);
			if (fs.existsSync(venvCandidate)) {
				return venvCandidate;
			}
		}

		if (workspaceFolder) {
			for (const venvDir of ['.venv', 'venv', 'env']) {
				const candidate = path.join(workspaceFolder, venvDir, venvSubdir, exeName);
				if (fs.existsSync(candidate)) {
					return candidate;
				}
			}
		}

		const home = os.homedir();
		const commonVenvs = [
			path.join(home, '.venv', venvSubdir, exeName),
			isWindows
				? path.join(home, 'AppData', 'Roaming', 'Python', 'Scripts', exeName)
				: path.join(home, '.local', 'bin', exeName),
		];
		for (const candidate of commonVenvs) {
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}

	return executable;
}

function isCMakeFile(document: vscode.TextDocument): boolean {
	return document.languageId === 'cmake'
		|| document.fileName.endsWith('CMakeLists.txt')
		|| document.fileName.endsWith('.cmake');
}
