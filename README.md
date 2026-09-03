# CMake Tidy

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-29abe0?logo=ko-fi&logoColor=white)](https://ko-fi.com/drfknoble) ![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)

Run and format CMake files or selected code regions with `cmake-tidy` inside Visual Studio Code.

## Features

- **Document Formatting**: Reformat entire `CMakeLists.txt` or `.cmake` files in place via the Command Palette or right-click context menu.
- **Selection Formatting**: Select a block of CMake code to format only the selected lines (`Ctrl+K Ctrl+F` / `Cmd+K Cmd+F`).
- **VS Code Formatter Integration**: Native integration with VS Code's `Format Document` and `Format Selection` commands, including support for `"editor.formatOnSave": true`.
- **Automatic Virtual Environment Discovery**: Automatically detects `cmake-tidy` in active virtual environments (`.venv`, `venv`, `env`) or user-configured Python environments.
- **Dirty Buffer Support**: Safely formats unsaved active buffers without requiring file saves beforehand.

## Requirements

Install `cmake-tidy` via pip:

```sh
pip install cmake-tidy
```

Ensure `cmake-tidy` is in your `PATH`, or set `cmake-tidy.executable` in VS Code settings.

## Usage

1. Open a `CMakeLists.txt` or `.cmake` file.
2. Use any of the following methods to format:
   - **Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)**:
     - `CMake Tidy: Run CMake Tidy on Current File`
     - `CMake Tidy: Run CMake Tidy on Selection`
   - **Context Menu**: Right-click inside any CMake file to run CMake Tidy on the document or active selection.
   - **Keyboard Shortcuts**:
     - Format Document: `Shift+Alt+F` (Windows/Linux) or `Option+Shift+F` (macOS)
     - Format Selection: `Ctrl+K Ctrl+F` (Windows/Linux) or `Cmd+K Cmd+F` (macOS)

## Settings

- `cmake-tidy.executable`: Executable command name or path for `cmake-tidy`. Defaults to `cmake-tidy`. Supports `~`, `${workspaceFolder}`, and `${env:VAR}` variable expansion.
- `cmake-tidy.arguments`: Extra arguments passed to `cmake-tidy` before the file target. Defaults to `["format"]`.
