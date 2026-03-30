# Infinite Workspace

> An infinite canvas workspace for VS Code — freely arrange terminals, browsers, and file explorers on a zoomable, draggable canvas.

## ✨ Features

- **Infinite Canvas** — Pan and zoom freely across an unlimited workspace
- **Draggable Terminal Windows** — Spawn multiple terminals and position them anywhere on the canvas
- **Built-in Browser Windows** — Open web pages side-by-side with your terminals
- **File Explorer Windows** — Browse your project files directly on the canvas
- **Snap Guides** — Smart alignment guides help you organize windows neatly
- **State Persistence** — Your layout is saved and restored automatically
- **Context Menu** — Right-click to create new windows at any position
- **Favorites** — Save frequently used terminal commands, URLs, and paths
- **Dark Theme** — Designed to match VS Code's native dark aesthetic
- **Works in GitHub Codespaces** — Supports VS Code for the Web (browser-based) with graceful degradation

## 🚀 Getting Started

1. Install the extension from the VS Code Marketplace
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"Infinite Workspace: Open Infinite Workspace"**
4. Right-click on the canvas to create terminal, browser, or file explorer windows

## 🖥️ Desktop vs Web Support

| Feature | VS Code Desktop | VS Code Web (Codespaces) |
|---------|:-:|:-:|
| Infinite Canvas | ✅ | ✅ |
| Terminal Windows | ✅ | ⚠️ Use integrated terminal |
| Browser Windows | ✅ | ✅ |
| File Explorer | ✅ | ✅ |
| State Persistence | ✅ | ✅ |

> **Note:** In VS Code for the Web, terminal windows show a friendly message directing you to use VS Code's built-in integrated terminal. All other features work fully.

## ⌨️ Shortcuts

| Action | Shortcut |
|--------|----------|
| Pan canvas | Click and drag on background |
| Zoom | Scroll wheel |
| Move window | Drag the title bar |
| Resize window | Drag the bottom-right corner |
| Create window | Right-click on canvas |

## 📋 Requirements

- VS Code 1.85.0 or higher
- For terminal support: Desktop version of VS Code (or Remote SSH / WSL)

## 🛠️ Extension Settings

Access settings via the gear icon in the toolbar:

- **Show Grid** — Toggle the background dot grid
- **Enable Snap** — Toggle snap-to-guide alignment
- **Snap Threshold** — Adjust snap distance sensitivity

## 📝 Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## 📄 License

[MIT](LICENSE) © Lakphy
