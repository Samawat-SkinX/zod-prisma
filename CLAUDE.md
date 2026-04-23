# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (CJS output via dts-cli)
yarn build

# Watch mode
yarn start

# Run all tests (Jest via dts-cli)
yarn test

# Run a single test file
yarn test --testPathPattern=src/__tests__/config.test.ts

# Type-check and lint
yarn lint
```

## Architecture

This is a **Prisma generator** (`@prisma/generator-helper`) that reads Prisma's DMMF (Data Model Meta Format) and outputs Zod validation schema `.ts` files.

### Generation Pipeline

1. **`index.ts`** — Registers the generator with Prisma, receives DMMF, orchestrates file creation, triggers optional middleware/shield/json-helper generation.
2. **`config.ts`** — Zod-validated generator config (`Config` type). Options include `relationModel`, `modelCase`, `modelSuffix`, `useDecimalJs`, `imports`, `prismaJsonNullability`, `languages`, `withMiddleware`, `withShield`.
3. **`generator.ts`** — Core generation logic. Key functions:
   - `populateModelFile()` — entry point per model, calls all write functions
   - `writeImportsForModel()` — emits import statements
   - `generateSchemaForModel()` — scalar fields + `@zod` modifiers
   - `generateRelatedSchemaForModel()` — relation fields wrapped in `z.lazy()` to handle circular dependencies
   - `generateBarrelFile()` — creates the `index.ts` re-export barrel
4. **`types.ts`** — `getZodConstructor()` maps Prisma scalar/enum/object types → Zod validators, applying list/nullable/custom modifiers.
5. **`docs.ts`** — Parses `/// @zod` directives in Prisma comments to extract custom validators and modifiers.
6. **`util.ts`** — Helpers for `ts-morph` `CodeBlockWriter`, model name formatting, path normalization.
7. **`middlewareGenerator.ts`** — Emits `middleware.ts` (parse/safeParse wrappers per model) when `withMiddleware: true`.
8. **`shieldGenerator.ts`** — Emits `shield.ts` (GraphQL Shield rules) when `withShield: true`.
9. **`jsonHelper.ts`** — Emits `utils/json.ts` (JsonValue/jsonSchema) when JSON fields are present.

### Code Generation Approach

All output files are generated using **`ts-morph`** (`SourceFile`, `CodeBlockWriter`). This avoids raw string templating — prefer ts-morph APIs when adding new generation logic.

### Multi-language / Translation Fields

The generator has SkinX-specific logic for `languages` config. When set, it generates a `*TrModel` response variant for models with translatable JSON fields (identified by a `Tr` suffix convention).

### Testing

Tests use **Jest** via `dts-cli`. Functional test fixtures live under `src/test/functional/` and are excluded from linting. Unit tests are in `src/__tests__/`.
