@echo off
chcp 65001 > nul
cls
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                                                                  ║
echo ║   🚀 TEST DE DÉMARRAGE DU BOT                                   ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo.
echo 📋 Vérification avant démarrage...
echo.

REM Vérifier que index.js existe
if not exist "index.js" (
    color 0C
    echo ❌ ERREUR: index.js introuvable
    echo.
    pause
    exit /b 1
)
echo ✅ index.js trouvé

REM Vérifier que node_modules existe
if not exist "node_modules" (
    color 0E
    echo ⚠️  ATTENTION: node_modules introuvable
    echo.
    echo Exécutez d'abord: npm install
    echo.
    pause
    exit /b 1
)
echo ✅ node_modules trouvé

REM Vérifier que config.json existe
if not exist "config.json" (
    color 0C
    echo ❌ ERREUR: config.json introuvable
    echo.
    pause
    exit /b 1
)
echo ✅ config.json trouvé

echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
echo ✅ Tout est OK ! Le bot peut démarrer.
echo.
echo 💡 ASTUCE: Surveillez les logs pour:
echo    ✅ "eventLoader chargé avec succès"
echo    ✅ "Événement welcome enregistré"
echo    ✅ "BOT DÉMARRÉ AVEC SUCCÈS"
echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
echo 🚀 Démarrage du bot dans 3 secondes...
timeout /t 3 /nobreak > nul

cls
echo.
echo ═══════════════════════════════════════════════════════════════════
echo   🤖 BOT EN COURS DE DÉMARRAGE...
echo ═══════════════════════════════════════════════════════════════════
echo.

node index.js

echo.
echo.
echo ═══════════════════════════════════════════════════════════════════
echo   Le bot s'est arrêté
echo ═══════════════════════════════════════════════════════════════════
echo.
pause
