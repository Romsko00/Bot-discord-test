/**
 * DIAGNOSTIC ET CORRECTION DES SYSTÈMES
 * - Tickets
 * - Soutien
 * - Reactrole
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 DIAGNOSTIC DES SYSTÈMES\n');
console.log('='.repeat(70));

const issues = [];
const fixes = [];

// 1. Vérifier le système de tickets
console.log('\n📋 1. SYSTÈME DE TICKETS\n');

const ticketPath = path.join(__dirname, 'commands', 'gestion', 'ticket.js');
if (fs.existsSync(ticketPath)) {
  console.log('✅ Fichier ticket.js existe');
  
  const content = fs.readFileSync(ticketPath, 'utf8');
  
  // Vérifier les exports
  if (content.includes('module.exports.handleInteraction')) {
    console.log('✅ handleInteraction exporté');
  } else {
    console.log('❌ handleInteraction manquant ou mal exporté');
    issues.push('ticket: handleInteraction manquant');
  }
  
  // Vérifier les doublons d'export
  const exportMatches = content.match(/module\.exports\.handleInteraction\s*=/g);
  if (exportMatches && exportMatches.length > 1) {
    console.log(`⚠️  handleInteraction défini ${exportMatches.length} fois (doublon)`);
    issues.push('ticket: handleInteraction en doublon');
    fixes.push('Supprimer les définitions en doublon de handleInteraction dans ticket.js');
  }
  
} else {
  console.log('❌ Fichier ticket.js MANQUANT');
  issues.push('ticket: fichier manquant');
}

// 2. Vérifier le système de soutien
console.log('\n🆘 2. SYSTÈME DE SOUTIEN\n');

const soutienPath = path.join(__dirname, 'commands', 'gestion', 'soutien.js');
if (fs.existsSync(soutienPath)) {
  console.log('✅ Fichier soutien.js existe');
  
  try {
    const soutienModule = require(soutienPath);
    if (typeof soutienModule.run === 'function') {
      console.log('✅ Fonction run exportée');
    } else {
      console.log('❌ Fonction run manquante');
      issues.push('soutien: fonction run manquante');
    }
  } catch (error) {
    console.log(`❌ Erreur lors du chargement: ${error.message}`);
    issues.push(`soutien: erreur de chargement - ${error.message}`);
  }
} else {
  console.log('❌ Fichier soutien.js MANQUANT');
  issues.push('soutien: fichier manquant');
}

// 3. Vérifier le système reactrole
console.log('\n⚛️  3. SYSTÈME REACTROLE\n');

const reactrolePath = path.join(__dirname, 'commands', 'gestion', 'reactrole.js');
if (fs.existsSync(reactrolePath)) {
  console.log('✅ Fichier reactrole.js existe');
  
  try {
    const reactroleModule = require(reactrolePath);
    if (typeof reactroleModule.run === 'function') {
      console.log('✅ Fonction run exportée');
    } else {
      console.log('❌ Fonction run manquante');
      issues.push('reactrole: fonction run manquante');
    }
  } catch (error) {
    console.log(`❌ Erreur lors du chargement: ${error.message}`);
    issues.push(`reactrole: erreur de chargement - ${error.message}`);
  }
} else {
  console.log('❌ Fichier reactrole.js MANQUANT');
  issues.push('reactrole: fichier manquant');
}

// 4. Vérifier l'événement presenceUpdate pour soutien
console.log('\n👤 4. ÉVÉNEMENT PRESENCE (pour soutien)\n');

const presencePath = path.join(__dirname, 'events', 'presenceUpdate', 'soutien.js');
if (fs.existsSync(presencePath)) {
  console.log('✅ Fichier events/presenceUpdate/soutien.js existe');
} else {
  console.log('❌ Fichier events/presenceUpdate/soutien.js MANQUANT');
  issues.push('soutien: événement presenceUpdate manquant');
}

// Résumé
console.log('\n' + '='.repeat(70));
console.log('\n📊 RÉSUMÉ\n');

if (issues.length === 0) {
  console.log('✅ Aucun problème détecté !');
  console.log('\nSi les systèmes ne fonctionnent toujours pas:');
  console.log('1. Vérifier les logs du bot au démarrage');
  console.log('2. Tester les commandes individuellement');
  console.log('3. Vérifier les permissions du bot\n');
} else {
  console.log(`❌ ${issues.length} problème(s) détecté(s):\n`);
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  
  if (fixes.length > 0) {
    console.log('\n🔧 CORRECTIONS NÉCESSAIRES:\n');
    fixes.forEach((fix, i) => {
      console.log(`   ${i + 1}. ${fix}`);
    });
  }
  
  console.log('\n📖 Consultez CORRECTION_SYSTEMES.md pour les solutions détaillées');
}

console.log('\n' + '='.repeat(70));
console.log('\n💡 COMMANDES DE TEST:\n');
console.log('   Tickets:   !ticket config');
console.log('   Soutien:   !soutien config');
console.log('   Reactrole: !reactrole\n');
console.log('='.repeat(70) + '\n');
