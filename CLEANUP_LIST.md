# Files That Can Be Deleted

## 🗑️ **SAFE TO DELETE**

### Root Level Files
- `create-placeholders.cjs` - Old placeholder creation script
- `create-placeholders.js` - Duplicate placeholder script
- `debug-api.sh` - Debug script no longer needed
- `debug-network.js` - Network debugging script
- `temp-index.html` - Temporary HTML file
- `test-backend.js` - Old backend test script
- `test-direct.html` - Direct test HTML file
- `github-actions-trust-policy.json` - Example policy (keep for reference or delete)

### Development/Debug Files
- `.kiro/` - Entire directory (development specs)
- `packages/backend/.env` - Local environment file (keep .env.example)
- `packages/backend/.env.local` - Local override file
- `packages/frontend/.env` - Local environment file (keep .env.example)
- `packages/frontend/.env.production` - Generated file
- `packages/frontend/.env.production.local` - Generated file

### Build Artifacts
- `packages/backend/tsconfig.tsbuildinfo` - TypeScript build cache
- `packages/shared/tsconfig.tsbuildinfo` - TypeScript build cache
- `packages/infrastructure/cdk.out/` - CDK build output (regenerated on deploy)
- `packages/infrastructure/lib/` - Compiled JavaScript (regenerated from src/)

### Test Files (Optional - Keep for Testing)
- `packages/backend/src/examples/` - Example files
- `packages/frontend/src/examples/` - Example files
- `packages/frontend/src/test/` - Test utilities (if not used)

### Duplicate Assets
- `assets/images_raw/` - Raw images (move to backend/assets/themes/ then delete)
- `assets/themes/` - Empty theme directories (use backend/assets/themes/)

## ⚠️ **REVIEW BEFORE DELETING**

### Documentation Files
- `DEPLOY.md` - Deployment guide (useful reference)
- `SECURITY_FIXES_SUMMARY.md` - Security fixes log (useful reference)
- `packages/backend/PRIVACY_COMPLIANCE.md` - Privacy documentation
- `packages/backend/SECURITY.md` - Security documentation
- `packages/infrastructure/README-CICD.md` - CI/CD documentation

### Configuration Files
- `packages/infrastructure/cdk.context.json` - CDK context (regenerated)
- `packages/infrastructure/jest.config.js` - Jest config (if not using Jest)

## 🔄 **MOVE THEN DELETE**

### Theme Assets
1. **Move** `assets/images_raw/` contents to `packages/backend/assets/themes/`
2. **Organize** by theme subdirectories
3. **Delete** `assets/images_raw/` and `assets/themes/`

## 📋 **CLEANUP COMMANDS**

```bash
# Delete safe files
rm create-placeholders.cjs create-placeholders.js
rm debug-api.sh debug-network.js
rm temp-index.html test-backend.js test-direct.html
rm -rf .kiro/

# Delete build artifacts
rm packages/backend/tsconfig.tsbuildinfo
rm packages/shared/tsconfig.tsbuildinfo
rm -rf packages/infrastructure/cdk.out/
rm -rf packages/infrastructure/lib/

# Delete environment files (keep .env.example)
rm packages/backend/.env packages/backend/.env.local
rm packages/frontend/.env packages/frontend/.env.production packages/frontend/.env.production.local

# Move theme assets (if you have generated images)
# mv assets/images_raw/* packages/backend/assets/themes/
# rm -rf assets/

# Optional: Delete example directories
rm -rf packages/backend/src/examples/
rm -rf packages/frontend/src/examples/
```

## 💾 **ESTIMATED SPACE SAVINGS**
- **Build artifacts**: ~50-100MB
- **Duplicate files**: ~10-20MB
- **Debug/temp files**: ~5-10MB
- **Total**: ~65-130MB

## ✅ **AFTER CLEANUP**
- Run `npm run build` to verify everything still works
- Test deployment pipeline
- Commit cleaned up repository