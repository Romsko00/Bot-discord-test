@echo off
chcp 65001 > nul
cls
color 0E

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                                                                  ║
echo ║   🔍 DIAGNOSTIC DES SYSTÈMES                                    ║
echo ║   (Tickets, Soutien, Reactrole)                                 ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo.
echo 📋 Analyse en cours...
echo.

node diagnostic-systemes.js

echo.
echo ═══════════════════════════════════════════════════════════════════
echo.

if errorlevel 1 (
    color 0C
    echo ❌ Des problèmes ont été détectés
) else (
    color 0A
    echo ✅ Diagnostic terminé
)

echo.
echo 📖 Consultez CORRECTION_SYSTEMES.md pour les solutions
echo.
echo ═══════════════════════════════════════════════════════════════════
echo.
pause
