# Shuttle Stealth - Project Overview

"Shuttle Stealth" is a modern, web-based proxy application that provides a "Virtual Browser" experience within a single page. It utilizes the **Shader Proxy engine** and **BareMux** transport to enable secure and efficient web navigation through a service worker.

## Architecture

The project follows a modular, tab-based architecture:

- **`index.html`**: The main entry point and UI, utilizing **Alpine.js** for state management and reactive components.
- **`shader-canvas.js`**: A high-level controller (**ShaderCanvas**) that manages multiple browsing "surfaces" (tabs). It handles iframe lifecycle, tab switching, and event bubbling.
- **`shader-client.js`**: The core client logic (**ShaderClient**). Each tab has its own instance that manages its transport connection, URL encoding/decoding, and navigation state.
- **`compute.js`**: The **Service Worker** (registered under the scope `./`). It intercepts network requests from the managed iframes and proxies them using the Shader Proxy engine.
- **`shader.config.mjs`**: Central configuration for the Shader Proxy, defining prefixes, transport URLs, and script paths.
- **Shader Proxy (Shader)**: The underlying proxy engine.
- **Global Dependencies**: Shader Proxy scripts like `shader.handler.mjs` expect both `self.ShaderCanvas` and `self.UVClient` to be defined globally.

## Key Technologies

- **Vector (Vector)**: The underlying proxy engine.
- **BareMux**: Transport management library for communication between the main thread and the worker.
- **Alpine.js**: Lightweight frontend framework for the UI.
- **ES Modules (.mjs)**: The project uses `.mjs` files for core libraries to ensure stable delivery from CDNs like `esm.sh`.

## Building and Running

This is a static frontend project.

### Running Locally

You can serve the project using any static file server:

- `python3 -m http.server 8080`
- `npx serve .`

### Deployment

The project is optimized for delivery via **esm.sh**. Due to the way `esm.sh` transforms `.js` files into ES modules, the following rules apply:

- **Core Libraries**: Renamed to `.mjs` to bypass automatic wrapping.
- **Service Worker**: Registered as a **module** worker (`{ type: 'module' }`) to support ESM imports.
- **Raw Content**: Use `?raw=true` query parameters when classic script behavior is required for `.js` files.

## Development Conventions

- **CDN Compatibility**: Maintain the `.mjs` extension for shared library files.
- **Service Worker**: Always register with `scope: './'` to support path-based hosting (e.g., in subdirectories or on CDNs).
- **Global Dependencies**: Vector scripts like `shader.handler.mjs` expect both `self.ShaderCanvas` and `self.UVClient` to be defined globally.
- **Path Resolution**: Use `new URL(path, location.href).href` for absolute path resolution in workers to ensure assets are found regardless of the hosting depth.
- **Code Integrity**: Avoid using placeholders like `...` in code modification tools to prevent literal syntax errors in the minified sources.
