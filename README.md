# Shuttle Stealth

"Shuttle Stealth" is a modern, high-performance web-based proxy application that provides a seamless "Virtual Browser" experience. Built on the **Ultraviolet** engine and **BareMux** transport, it allows for secure, tab-based web navigation through a robust Service Worker architecture.

## 🚀 One-Click Deploy

Deploy Shuttle Stealth to your favorite platform with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shuttlenetwork/shuttle-stealth)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/shuttlenetwork/shuttle-stealth)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/shuttlenetwork/shuttle-stealth)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shuttlenetwork/shuttle-stealth)

---

## ✨ Features

- **Virtual Browser UI**: Manage multiple browsing sessions with an intuitive tab-based interface.
- **Ultraviolet Engine**: Advanced URL rewriting and proxying for maximum website compatibility.
- **Wisp/Vector Transport**: High-speed network proxying via the latest transport protocols.
- **Zero Configuration**: Works out-of-the-box with pre-configured backend endpoints.
- **CDN Optimized**: Fully compatible with `esm.sh` and other module-based CDNs.
- **Highly Portable**: Runs on any static hosting service (Vercel, Netlify, S3, etc.).

## 💻 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/shuttlenetwork/shuttle-stealth.git
   cd shuttle-stealth
   ```

2. Serve the directory:
   ```bash
   npx serve .
   # OR
   python3 -m http.server 8080
   ```

3. Open `http://localhost:8080` in your browser.

## 📐 Architecture

- **`index.html`**: UI powered by Alpine.js.
- **`shader-canvas.js`**: Tab and iframe manager.
- **`shader-client.js`**: Core Ultraviolet client logic.
- **`compute.js`**: The proxy Service Worker.
- **`.mjs` Files**: Optimized core scripts for CDN delivery.

## 📄 License

This project is open-source. See the repository for license details.
