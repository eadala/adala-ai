# Repository Creation Evidence

```
gh repo create eadala/adala-ai-secure-backup --private ...
→ GraphQL: Resource not accessible by integration (createRepository)  EXIT=1

gh api -X POST /user/repos -f name=adala-ai-secure-backup -F private=true -F auto_init=false
→ HTTP 403 Rate Limit Exceeded / integration restriction  EXIT=1

cursor-github get_repository(eadala/adala-ai-secure-backup)
→ scm_repo_not_accessible; accessibleMatches: eadala/adala-ai
```

No repository was created. No visibility change to public origin. Tokens not printed.
