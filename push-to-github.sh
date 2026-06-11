#!/bin/bash
git remote set-url origin "https://ahkm1000:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/eadala/adala-ai.git"
git push origin main
echo "Done!"
