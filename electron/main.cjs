const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: "Hung Tran Finance",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL || "http://localhost:5173");
  } else {
    const indexHtml = path.join(app.getAppPath(), "dist", "index.html");
    win.loadFile(indexHtml).catch((err) => {
      console.error("Failed to load app UI:", indexHtml, err);
    });
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
      console.error("did-fail-load", { code, desc, url });
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
