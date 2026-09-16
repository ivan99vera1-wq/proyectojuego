/**
 * Proceso principal de Electron. Carga el build del cliente web (apps/client/dist).
 * El nombre, appId y colores salen de @game/config; aquí se leen del JSON que
 * genera `tools/export-branding.ts` en el paso `compile` (dist/branding.json).
 */
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { readFileSync } from 'node:fs';

interface BrandingJson {
  name: string;
  appId: string;
  colors: { background: string };
}

const branding = JSON.parse(readFileSync(path.join(__dirname, 'branding.json'), 'utf8')) as BrandingJson;
const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: branding.name,
    backgroundColor: branding.colors.background,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../../client/dist/index.html'));
  }
}

app.setName(branding.name);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
