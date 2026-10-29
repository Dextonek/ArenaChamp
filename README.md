# VFX Tool

A browser-based real-time VFX editor and playground (Three.js 0.186, Vite, TypeScript): a particle editor, 144
effects from small strikes to fully cinematic hero spells, a targeted arena with enemies, and a MOBA-style hero
mode with five playable hero kits and rigged hero models.

![The five heroes](docs/heroes/ingame_sheet.jpg)

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Pick a category and a mode in the panel; press **H** for hero mode (click to move,
**Q W E R** to aim and cast). `npm run typecheck` and `npm run build` check and build the project.

## Documentation

Everything is in the knowledge base: **[docs/README.md](docs/README.md)**.

| Start here if you want to | Page |
|---|---|
| Use the tool | [Using the tool](docs/guide/using-the-tool.md) |
| See what exists | [Effect catalog](docs/catalog/effects.md), [heroes](docs/catalog/heroes/README.md) |
| Change the code | [Architecture overview](docs/architecture/overview.md) |
| Make new effects in our style | [Art bible](docs/ART_BIBLE.md), [workflow](docs/pipeline/workflow.md) |
| Pick up where the last session stopped | [Status](docs/STATUS.md) |
