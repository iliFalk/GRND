#!/bin/sh
# The gate for the audit fixes. One executable line per acceptance criterion of spec/requirements.md,
# each running every test file that carries its id. A criterion nobody runs is a requirement nobody checks.
# Measured: `pi-lane spec cover` recognises `def`/`class` names only, so the JS test titles alone read as
# mentions; this file is what turns them into a gate.
set -e
cd "$(dirname "$0")/.."

node --test --test-name-pattern "^(AC1|ac1)[ _]" tests/api-authz.test.js # AC1 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC2|ac2)[ _]" tests/api-authz.test.js # AC2 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC3|ac3)[ _]" tests/api-authz.test.js # AC3 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC4|ac4)[ _]" tests/api-authz.test.js # AC4 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC5|ac5)[ _]" tests/api-authz.test.js # AC5 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC6|ac6)[ _]" tests/api-authz.test.js # AC6 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC7|ac7)[ _]" tests/api-authz.test.js # AC7 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC8|ac8)[ _]" tests/api-authz.test.js # AC8 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC9|ac9)[ _]" tests/api-authz.test.js # AC9 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC10|ac10)[ _]" tests/api-path.test.js # AC10 in tests/api-path.test.js
node --test --test-name-pattern "^(AC11|ac11)[ _]" tests/api-path.test.js # AC11 in tests/api-path.test.js
node --test --test-name-pattern "^(AC12|ac12)[ _]" tests/api-path.test.js # AC12 in tests/api-path.test.js
node --test --test-name-pattern "^(AC13|ac13)[ _]" tests/api-limits.test.js # AC13 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC14|ac14)[ _]" tests/api-limits.test.js # AC14 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC15|ac15)[ _]" tests/api-limits.test.js # AC15 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC16|ac16)[ _]" tests/api-limits.test.js # AC16 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC17|ac17)[ _]" tests/api-limits.test.js # AC17 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC18|ac18)[ _]" tests/api-limits.test.js # AC18 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC19|ac19)[ _]" tests/api-limits.test.js # AC19 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC20|ac20)[ _]" tests/api-limits.test.js # AC20 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC21|ac21)[ _]" tests/api-limits.test.js # AC21 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC22|ac22)[ _]" tests/api-path.test.js # AC22 in tests/api-path.test.js
node --test --test-name-pattern "^(AC23|ac23)[ _]" tests/api-limits.test.js # AC23 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC24|ac24)[ _]" tests/api-limits.test.js # AC24 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC25|ac25)[ _]" tests/api-limits.test.js # AC25 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC26|ac26)[ _]" tests/api-limits.test.js # AC26 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC27|ac27)[ _]" tests/api-limits.test.js # AC27 in tests/api-limits.test.js
npx vitest run --root web -t "AC28_" # AC28 in web/src/lib/api.test.tsx
npx vitest run --root web -t "AC29_" # AC29 in web/src/lib/api.test.tsx
node --test --test-name-pattern "^(AC30|ac30)[ _]" tests/store.test.js # AC30 in tests/store.test.js
node --test --test-name-pattern "^(AC31|ac31)[ _]" tests/api-limits.test.js # AC31 in tests/api-limits.test.js
node --test --test-name-pattern "^(AC32|ac32)[ _]" tests/drafts.test.js # AC32 in tests/drafts.test.js
node --test --test-name-pattern "^(AC33|ac33)[ _]" tests/drafts.test.js # AC33 in tests/drafts.test.js
node --test --test-name-pattern "^(AC34|ac34)[ _]" tests/image-user-data.test.js # AC34 in tests/image-user-data.test.js
node --test --test-name-pattern "^(AC35|ac35)[ _]" tests/api-path.test.js # AC35 in tests/api-path.test.js
node --test --test-name-pattern "^(AC36|ac36)[ _]" tests/api-path.test.js # AC36 in tests/api-path.test.js
node --test --test-name-pattern "^(AC37|ac37)[ _]" tests/api-authz.test.js # AC37 in tests/api-authz.test.js
node --test --test-name-pattern "^(AC38|ac38)[ _]" tests/api-authz.test.js # AC38 in tests/api-authz.test.js
