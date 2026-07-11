/**
 * RÉPARATION D'URGENCE - INDEX.JS
 * 
 * Ce script répare le problème où les bots ne se connectent pas
 */

const fs = require('fs');
const path = require('path');

console.log('\n🚨 RÉPARATION D\'URGENCE - CONNEXION DES BOTS\n');
console.log('='.repeat(70));

const indexPath = path.join(__dirname, 'index.js');

console.log('\n📋 Diagnostic du problème...\n');

// Lire le fichier
let content = fs.readFileSync(indexPath, 'utf8');

// Vérifier le problème
const hasInitClientsCheck = content.includes('if (typeof initClients === \'function\')');
const hasInitClientsDefinition = content.includes('const initClients = async ()');

console.log(`✓ Fonction initClients définie: ${hasInitClientsDefinition ? 'OUI' : 'NON'}`);
console.log(`✓ Vérification conditionnelle: ${hasInitClientsCheck ? 'OUI (PROBLÉMATIQUE)' : 'NON'}`);

if (hasInitClientsCheck) {
  console.log('\n❌ PROBLÈME DÉTECTÉ: Code conditionnel empêche l\'appel d\'initClients\n');
  console.log('🔧 Application de la correction...\n');
  
  // Créer une sauvegarde
  const backupPath = indexPath + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`✅ Sauvegarde créée: ${path.basename(backupPath)}`);
  
  // Remplacer le bloc problématique
  const searchPattern = /logger\.info\('Connexion des clients Discord\.\.\.'\);\s*if \(typeof initClients === 'function'\) \{[\s\S]*?\}\s*else \{[\s\S]*?}\s*}/;
  
  const replacement = `logger.info('Connexion des clients Discord...');
    await initClients();`;
  
  if (searchPattern.test(content)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✅ Correction appliquée: Appel direct à initClients()');
  } else {
    console.log('⚠️  Pattern non trouvé, tentative de correction alternative...');
    
    // Chercher et remplacer manuellement
    const lines = content.split('\n');
    let inBlock = false;
    let blockStart = -1;
    let newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('Connexion des clients Discord')) {
        newLines.push(line);
        newLines.push('    await initClients();');
        inBlock = true;
        blockStart = i;
        continue;
      }
      
      if (inBlock) {
        // Ignorer les lignes du bloc problématique
        if (line.trim().startsWith('}') && !line.includes('for') && !line.includes('if')) {
          // Potentiellement la fin du bloc
          let openBraces = 0;
          for (let j = blockStart; j <= i; j++) {
            openBraces += (lines[j].match(/\{/g) || []).length;
            openBraces -= (lines[j].match(/\}/g) || []).length;
          }
          
          if (openBraces <= 0) {
            inBlock = false;
            continue;
          }
        }
        continue;
      }
      
      newLines.push(line);
    }
    
    content = newLines.join('\n');
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✅ Correction alternative appliquée');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ RÉPARATION TERMINÉE\n');
  console.log('📋 Résumé des modifications:');
  console.log('   • Suppression du bloc conditionnel problématique');
  console.log('   • Appel direct à initClients()');
  console.log('   • Les bots devraient maintenant se connecter\n');
  
} else {
  console.log('\n✅ Aucune correction nécessaire ou déjà appliquée\n');
}

console.log('='.repeat(70));
console.log('\n🚀 PROCHAINES ÉTAPES:\n');
console.log('1. Redémarrer le bot: node index.js');
console.log('2. Surveiller les logs pour:');
console.log('   ✓ "[CLIENT 0] Connexion réussie"');
console.log('   ✓ "=== BOT DÉMARRÉ AVEC SUCCÈS ==="');
console.log('3. Vérifier que les bots sont en ligne sur Discord\n');
console.log('='.repeat(70) + '\n');
