## 2024-05-18 - Prism Refactor

**Learning:** When refactoring deeply nested components in a strict mode migration, `useCallback` dependency array omissions can cause silent bugs that appear correctly typed. Wait until the component decomposition is clean before refactoring dependencies. The backend `pytest` issues were existing segmentation faults related to the `inspireface` Python C-extensions within `multiprocessing` on `aiosqlite` threads.
**Action:** When decomposing large Zustand stores (like `nleStore.ts`), create an explicit `types.ts` within the module scope and have all slices inherit `StoreState` rather than circularly referencing the barrel export, which causes `tsc` inference blowups and maximum call stack errors.
