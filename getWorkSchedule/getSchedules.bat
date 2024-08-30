@echo off
E:
cd getScheduleData
node main.js
notepad parsed_schedule.json
exit