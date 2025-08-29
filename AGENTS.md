
## Coding rules

- Modularization
- Less than 500 lines of code per file
- Simple functions (input/output)
- State functions follows hooks/composable pattern
- use typescript (tsc, npx tsc)
- IMPORTANT: If file lines of code > 500, add new logic in new files and use composable pattern to avoid file size increase

## Structure

- src
    - utils
    - services
    - routes
    - index.ts
    - views
    - composables
      - useDb.ts
      - useAgent.ts
      - etc