## 2024-09-04 - Unnecessary nested array traversals in React components
**Learning:** Found an O(N*M) traversal nested inside a `useMemo` in `ComparacaoView.tsx`. The code filtered a `cotacoes` list of length M inside a map over `necessidades` of length N. Then iterated `cotacoes` again to build a lookup. React `useMemo` recalculations can be extremely slow if the data sets are large.
**Action:** By simply grouping `cotacoes` into a Map first `O(N + M)`, we reduced processing time significantly. When doing complex transformations in React, always consider pre-calculating lookup tables using Maps before running `.map()` loops.
## 2025-09-05 - Missing DB Indexes
**Learning:** SQLite foreign keys without indexes can trigger full table scans during cascade actions or relation checks, which become significant bottlenecks as the database grows.
**Action:** Add CREATE INDEX statements for every foreign key when designing SQLite schemas.
