// Configuración de empaquetado. appId y productName se leen de la config del juego.
const branding = require('./dist/branding.json');

module.exports = {
  appId: branding.appId,
  productName: branding.name,
  directories: { output: 'release' },
  files: ['dist/**/*', { from: '../client/dist', to: 'client/dist' }],
  win: { target: ['nsis'] },
  mac: { target: ['dmg'], category: 'public.app-category.games' },
  linux: { target: ['AppImage'] },
};
