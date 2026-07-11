@echo off
setlocal enabledelayedexpansion

echo [Zoom BOT] Installation des dépendances...

:: Vérifier si Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installé. Veuillez installer Node.js 16 ou supérieur depuis https://nodejs.org/
    pause
    exit /b 1
)

:: Vérifier la version de Node.js
for /f "tokens=*" %%a in ('node -v') do set NODE_VERSION=%%a
set NODE_VERSION=!NODE_VERSION:~1,2!
if !NODE_VERSION! LSS 16 (
    echo [ERREUR] Version de Node.js trop ancienne. Version 16 ou supérieure requise.
    echo Version détectée: !NODE_VERSION!
    pause
    exit /b 1
)

:: Créer le dossier des logs s'il n'existe pas
if not exist logs mkdir logs

echo [VNS BOT] Nettoyage de l'installation précédente...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist .next rmdir /s /q .next

echo [VNS BOT] Installation de PM2 globalement...
npm install -g pm2@latest
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Échec de l'installation de PM2
    pause
    exit /b 1
)

echo [VNS BOT] Installation des dépendances principales...
call npm install --no-optional --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Échec de l'installation des dépendances principales
    pause
    exit /b 1
)

echo [VNS BOT] Installation des dépendances optionnelles...
call npm install @discordjs/opus@0.9.0 @discordjs/voice@0.16.1 --no-optional --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Certaines dépendances optionnelles n'ont pas pu être installées
)

echo [VNS BOT] Installation terminée avec succès!
echo.
echo [VNS BOT] Pour démarrer le bot avec PM2, utilisez la commande suivante :
echo     pm2 start ecosystem.config.js
echo.
echo [VNS BOT] Pour surveiller les logs en temps réel :
echo     pm2 logs zoom-bot
echo.

pause
