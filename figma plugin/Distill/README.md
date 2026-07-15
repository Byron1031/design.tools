# Distill

Figma plugin for safely extracting design tokens from selected frames, auditing existing local and referenced libraries, renaming new tokens, and applying token groups manually.

## Use in Figma

Import `manifest.json` from this folder in Figma Desktop:

`figma plugin/Distill/manifest.json`

The bundled `code.js` is committed so the plugin can be imported directly.

## Develop

```bash
npm install
npm run check
npm test
npm run build
```
