@echo off
cd /d "%~dp0"
echo Starting the Clinical Reference disease builder...
echo Open http://localhost:8890/ and use the "Add a diagnosis" box.
echo Keep this window open (laptop on) while diseases build.
python add_disease_builder.py
pause
