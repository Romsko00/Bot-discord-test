const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

class FileManager {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.logsDir = path.join(__dirname, '../logs');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  async sendResultsToUser(user, channel, content, filename, type) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fullFilename = `${type}_${filename}_${timestamp}.txt`;
      const filePath = path.join(this.tempDir, fullFilename);


      fs.writeFileSync(filePath, content, 'utf8');


      const attachment = new AttachmentBuilder(filePath, { name: fullFilename });


      await user.send({
        content: `📤 Résultats de votre recherche ${type}:`,
        files: [attachment]
      });


      await channel.send(`📤 Résultats envoyés en DM ! Fichier: \`${fullFilename}\``);


      setTimeout(() => {
        this.deleteFile(filePath);
      }, 10 * 60 * 1000);

    } catch (error) {
      console.error('Erreur lors de l\'envoi des résultats:', error);
      await channel.send('<a:_:1483497365863399536> Erreur lors de l\'envoi des résultats en DM.');
    }
  }

  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Fichier supprimé: ${filePath}`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
    }
  }

  async cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();


        if (fileAge > 60 * 60 * 1000) {
          this.deleteFile(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`Nettoyage terminé: ${deletedCount} fichiers supprimés`);
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  }

  async logError(error, context = '') {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.stack || error.message || error}\n`;

      const logFile = path.join(this.logsDir, `error_${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, logEntry);

      console.error(`Erreur loggée: ${context}`, error);
    } catch (logError) {
      console.error('Erreur lors du logging:', logError);
    }
  }
}

module.exports = { FileManager };
