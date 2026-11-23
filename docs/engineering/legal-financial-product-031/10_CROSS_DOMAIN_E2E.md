# 10 — Cross-Domain E2E

Harness covers A–E synthetically (API + browser):
A Fee agreement → invoice link  
B Appointment → portal reschedule/cancel  
C Client message → lawyer reply → client view  
D Payment → refund → credit note (fake)  
E Reconciliation → score  

Browser: Playwright Chromium against same-origin portal shell (not API-only labeled as browser).
