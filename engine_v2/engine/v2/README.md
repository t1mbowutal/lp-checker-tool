# Engine V2 (Strict + Graded)

Ziel: Strenges, aber fein abgestuftes Scoring (Engine-only). `scoreV1` bleibt unberührt; `scoreV2` wird über ENV aktiviert.

## Struktur
engine/v2/
  ├─ config/weights_v2_strict_grades.json
  ├─ src/types.ts
  ├─ src/scoreV2.ts
  ├─ src/index.ts
  └─ test/examples/{good.json,bad.json}

## Integration
```ts
import cfg from "@/engine/v2/config/weights_v2_strict_grades.json";
import { scoreV2 } from "@/engine/v2/src";
const ENGINE = process.env.SCORE_ENGINE ?? process.env.NEXT_PUBLIC_SCORE_ENGINE ?? process.env.ENGINE_VERSION ?? "v1";
const result = ENGINE === "v2" ? scoreV2(featureSet, cfg) : scoreV1(featureSet, v1cfg);
```

## Rollback
ENV `SCORE_ENGINE` zurück auf `v1` oder Ordner `engine/v2` entfernen.
