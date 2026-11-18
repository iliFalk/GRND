# Suggestions — what to add when a muscle group is short

`backend/utils/muscleSuggestions.js` answers one question: a group has fewer sets this week than its band
needs, which exercises can close the gap with the equipment at home.

## The contract

```js
const { suggestForReport } = require('./backend/utils/muscleSuggestions.js');

suggestForReport(report, options) -> Array<{
  group: string,
  sets: number,        // what the week already has
  short: number,       // how many sets are missing, rounded to one decimal
  suggestions: Array<{ name: string, equipment: string, primary: string[], secondary: string[] }>
}>
```

`report` is the object `GET /api/muscle-volume` already returns: `{ groups: [{ group, sets, target, status }] }`.
`options`:

| Key | Default | Meaning |
|---|---|---|
| `equipment` | the ids of `data/equipment.json` with `available: true` | what may be used |
| `limit` | 3 | how many exercises per group |
| `taxonomy` | `data/exercise-taxonomy.json` | the table to read |

## Rules

1. Only a group whose `status` is `below` gets an entry. A group `in`, `above`, `high` or `unknown` is
   absent from the answer, not present with an empty list.
2. `short` is `target.min - sets`, rounded to one decimal. `target` comes from the report row.
3. An exercise is eligible when it trains the group as a **primary** group and its `equipment` is in the
   allowed list. A secondary-only exercise never appears: half a set does not close a gap.
4. An exercise whose `equipment` is `any` is eligible whenever `bodyweight` is allowed.
5. No exercise appears twice in one group's list.
6. Order: groups by `short` descending, then by group name ascending. Within a group, exercises by name
   ascending.
7. `options.limit` cuts each list to its first items. An empty or unknown `equipment` list yields an entry
   for the group with `suggestions: []`, so the UI can say that nothing at home closes this.
8. A report with no groups, or no group below its band, yields `[]`.
9. The method never throws for a missing file: a broken option falls back to the file, and an unreadable
   file yields `[]`.

## Tests

`tests/muscleSuggestions.test.js` covers the rules with `node:test` and names each test after its rule:
`test_only_below_groups`, `test_short_is_the_gap`, `test_primary_only`, `test_equipment_filter`,
`test_order_and_limit`, `test_empty_equipment`, `test_empty_report`. `npm test` must stay green.
