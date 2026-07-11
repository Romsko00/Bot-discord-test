#!/usr/bin/env node
/**
 * patch-deps.js — Applique les patches nécessaires à node_modules après npm install.
 * Lancé automatiquement via "postinstall" dans package.json.
 * Peut aussi être relancé manuellement : node scripts/patch-deps.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Patch à ajouter à la fin de chaque v10.js
const PATCH = `
// === PATCH AUTOMATIQUE VNSBOT ===
// Ajoute les ComponentType manquants pour Components V2 (discord.js 14.14.x)
if (exports.ComponentType && !exports.ComponentType.Container) {
  const newTypes = { Section: 9, TextDisplay: 10, Thumbnail: 11, MediaGallery: 12, File: 13, Separator: 14, ContentInventoryEntry: 16, Container: 17 };
  for (const [key, val] of Object.entries(newTypes)) {
    exports.ComponentType[key] = val;
    exports.ComponentType[val] = key;
  }
}
if (!exports.SeparatorSpacingSize) {
  exports.SeparatorSpacingSize = { Small: 1, Large: 2 };
  exports.SeparatorSpacingSize[1] = 'Small';
  exports.SeparatorSpacingSize[2] = 'Large';
}
if (!exports.ApplicationIntegrationType) {
  exports.ApplicationIntegrationType = { GuildInstall: 0, UserInstall: 1 };
  exports.ApplicationIntegrationType[0] = 'GuildInstall';
  exports.ApplicationIntegrationType[1] = 'UserInstall';
}
if (!exports.InteractionContextType) {
  exports.InteractionContextType = { Guild: 0, BotDM: 1, PrivateChannel: 2 };
  exports.InteractionContextType[0] = 'Guild';
  exports.InteractionContextType[1] = 'BotDM';
  exports.InteractionContextType[2] = 'PrivateChannel';
}
// === FIN PATCH VNSBOT ===
`;

// Fichiers à patcher
const TARGETS = [
  'node_modules/discord-api-types/v10.js',
  'node_modules/@discordjs/builders/node_modules/discord-api-types/v10.js',
  'node_modules/@discordjs/rest/node_modules/discord-api-types/v10.js',
  'node_modules/@discordjs/ws/node_modules/discord-api-types/v10.js',
  'node_modules/@discordjs/voice/node_modules/discord-api-types/v10.js',
];

let patched = 0;
let skipped = 0;
let missing = 0;

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { missing++; continue; }
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('PATCH AUTOMATIQUE VNSBOT')) { skipped++; continue; }
  fs.writeFileSync(file, content + PATCH, 'utf8');
  patched++;
  console.log(`[patch-deps] ✅ Patché : ${rel}`);
}

if (skipped > 0) console.log(`[patch-deps] ⏭️  Déjà patchés : ${skipped} fichier(s)`);
if (missing > 0) console.log(`[patch-deps] ⚠️  Introuvables (normal si optionnels) : ${missing} fichier(s)`);
console.log(`[patch-deps] Terminé — ${patched} patch(es) appliqué(s).`);
