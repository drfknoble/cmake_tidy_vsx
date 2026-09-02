# Change Log

All notable changes to the "cmake-tidy" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- In-place document reformatting for `CMakeLists.txt` and `.cmake` files.
- Selection-range reformatting support (`cmake-tidy.runSelectedText` & range formatting provider).
- VS Code document and range formatting provider integration (`Format Document`, `Format Selection`, `formatOnSave`).
- Automatic Python virtual environment (`.venv`, `VIRTUAL_ENV`) executable resolution.
- Variable expansion (`~`, `${workspaceFolder}`, `${env:VAR}`) for `cmake-tidy.executable`.
- Editor context menu integration for CMake files.