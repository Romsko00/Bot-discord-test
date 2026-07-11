@echo off
echo === Zoom Bot - Démarrage ===

REM Vérifier si Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Erreur: Node.js n'est pas installé ou n'est pas dans le PATH.
    echo Téléchargez-le depuis https://nodejs.org/
    pause
    exit /b 1
)

echo Vérification des dépendances...
if not exist "node_modules" (
    echo Installation des dépendances...
    call npm install --legacy-peer-deps
    if %ERRORLEVEL% NEQ 0 (
        echo Erreur lors de l'installation des dépendances.
        pause
        exit /b 1
    )
    
    echo Installation des dépendances spécifiques...
    call npm install @discordjs/opus@0.9.0 @discordjs/voice@0.16.1 --legacy-peer-deps
    if %ERRORLEVEL% NEQ 0 (
        echo Erreur lors de l'installation des dépendances spécifiques.
        pause
        exit /b 1
    )
)

REM Vérifier si PM2 est installé
pm2 --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installation de PM2 en cours...
    call npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo Erreur lors de l'installation de PM2.
        pause
        exit /b 1
    )
)

echo Création du dossier de logs...
if not exist "logs" mkdir logs

echo Démarrage du bot avec PM2...
call pm2 delete zoom-bot-main zoom-bot-tasks 2>nul
call pm2 start pm2.config.js

if %ERRORLEVEL% NEQ 0 (
    echo Erreur lors du démarrage du bot avec PM2.
    pause
    exit /b 1
)

echo.
echo === Succès ===
echo Le bot a été démarré avec succès !
echo.
echo Commandes utiles :
echo - pm2 logs            ^> Voir les logs en temps réel
echo - pm2 status         ^> Voir l'état des processus
echo - pm2 restart all    ^> Redémarrer tous les processus
echo - pm2 stop all       ^> Arrêter tous les processus
echo - pm2 save           ^> Sauvegarder la configuration actuelle
echo.
echo Appuyez sur une touche pour afficher les logs...
pause >nul

call pm2 logs --lines 20

pause
