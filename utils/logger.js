const pino = require('pino');
const fs = require('fs');
const path = require('path');


const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}


const resolvedLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const logger = pino({
  level: resolvedLevel,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ level: label })
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
      destination: path.join(logsDir, 'combined.log')
    }
  }
});



function formatError(err) {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      ...err
    };
  }
  return err;
}


logger.errorObj = function (err, message = '') {
  if (err instanceof Error) {
    this.error({ error: formatError(err) }, message);
  } else {
    this.error({ error: formatError(new Error(String(err))) }, message);
  }
};


process.on('uncaughtException', (err) => {
  logger.errorObj(err, 'Erreur non capturée');

  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.errorObj(reason, 'Rejet de promesse non géré');
});


function cleanupOldLogs() {
  const maxLogFiles = 5;
  const logFiles = fs.readdirSync(logsDir).
  filter((file) => file.endsWith('.log')).
  map((file) => ({
    name: file,
    time: fs.statSync(path.join(logsDir, file)).mtime.getTime()
  })).
  sort((a, b) => b.time - a.time);


  logFiles.slice(maxLogFiles).forEach((file) => {
    try {
      fs.unlinkSync(path.join(logsDir, file.name));
      logger.info(`Fichier de log supprimé: ${file.name}`);
    } catch (err) {
      logger.error(`Erreur lors de la suppression du fichier de log ${file.name}:`, err);
    }
  });
}


cleanupOldLogs();


setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

module.exports = logger;
