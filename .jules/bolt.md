## 2024-09-04 - Unnecessary nested array traversals in React components
**Learning:** Found an O(N*M) traversal nested inside a `useMemo` in `ComparacaoView.tsx`. The code filtered a `cotacoes` list of length M inside a map over `necessidades` of length N. Then iterated `cotacoes` again to build a lookup. React `useMemo` recalculations can be extremely slow if the data sets are large.
**Action:** By simply grouping `cotacoes` into a Map first `O(N + M)`, we reduced processing time significantly. When doing complex transformations in React, always consider pre-calculating lookup tables using Maps before running `.map()` loops.

## 2024-09-05 - O(N*M) traversal nested inside Mantine React Table column definitions
**Learning:** Found an O(N*M) traversal nested inside cell renderers in `AlocacaoView.tsx`. The code filtered a `cotacoes` list of length M inside table renderers over `necessidades` of length N. React table recalculations can be extremely slow if the data sets are large.
**Action:** By simply grouping `cotacoes` into a Map first `O(N + M)` in a single pass, we reduced processing time significantly. When doing complex transformations in React Tables, always consider pre-calculating lookup tables using Maps before running cell renders.

## 2025-09-05 - Missing DB Indexes
**Learning:** SQLite foreign keys without indexes can trigger full table scans during cascade actions or relation checks, which become significant bottlenecks as the database grows.
**Action:** Add CREATE INDEX statements for every foreign key when designing SQLite schemas.
