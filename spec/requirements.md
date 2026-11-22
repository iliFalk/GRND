# Requirements — GRND, the fixes an outside audit asked for

Source: security audit `grnd-20261122` over `e7dbb06` (`$HERMES_HOME/audits/grnd-20261122`).
One criterion per finding, each line one trigger and one observable result. Vocabulary: **principal** is
the verified Telegram account behind a request, **own id** is the id inside the verified `initData`,
**data root** is the directory that holds the JSON stores.

AC1  WHEN a request reaches an `/api` route other than `/health` without a valid signed `initData` (hash matching the Telegram data-check-string, `auth_date` at most 24 h old) THE SYSTEM SHALL answer `401` and read or write no data file.
AC2  WHEN a principal requests `/api/workout-data/:userId` with a `:userId` that differs from its own id THE SYSTEM SHALL answer `404` and read or write no plan file.
AC3  WHEN a principal requests `/api/user-profile/:userId` with GET, POST or DELETE and a `:userId` that differs from its own id THE SYSTEM SHALL answer `404` and leave the profiles file unchanged.
AC4  WHEN a principal requests `/api/workout-draft/:userId` with GET, PUT or DELETE and a `:userId` that differs from its own id THE SYSTEM SHALL answer `404` and leave the drafts file unchanged.
AC5  WHEN a principal requests `/api/workout-sessions/:userId`, `/api/muscle-volume/:userId`, `/api/pillars/:userId` or `/api/suggestions/:userId` with a `:userId` that differs from its own id THE SYSTEM SHALL answer `404` and report nothing about that account.
AC6  WHEN a principal requests or deletes `/api/workout-session/:sessionId` for a session whose `userId` is not its own id THE SYSTEM SHALL answer `404` and leave the journal unchanged.
AC7  WHEN a principal lists `/api/training-plans` THE SYSTEM SHALL answer only the plans that carry its own id.
AC8  WHEN a principal sends `PUT` or `DELETE` to `/api/training-plans/:planId` for a plan of another id THE SYSTEM SHALL answer `404` and leave that plan unchanged.
AC9  WHEN `GET /api/me` receives a valid signed `initData` THE SYSTEM SHALL answer `{ "userId": "<id>" }` taken from the verified payload only.
AC10  WHEN a `:userId` route value is empty, longer than 64 characters, or carries any character outside `[A-Za-z0-9_-]` THE SYSTEM SHALL answer `400` and create no file, no directory and no temp file.
AC11  WHEN a `:userId` equals the name of a shared store (`user-profiles`, `workout-sessions`, `workout-drafts`, `training-plans`, `weekly-targets`, `exercise-catalogue`, `exercise-taxonomy`, `equipment`, `pillars`) THE SYSTEM SHALL answer `400` and leave that file unchanged.
AC12  WHEN a `:userId` carries an encoded separator or a dot segment THE SYSTEM SHALL answer `400` and read nothing outside the data root.
AC13  WHEN `POST /api/training-plans` carries `durationWeeks` above 52 or below 1 THE SYSTEM SHALL answer `400` without entering the day-generation loop.
AC14  WHEN a principal already holds 50 plans or a plan already holds 52 weeks THE SYSTEM SHALL refuse the creation or the update with `400`.
AC15  WHEN a session carries more than 50 `completedExercises`, more than 50 sets in one exercise, or a `notes` string longer than 2000 characters THE SYSTEM SHALL answer `400`.
AC16  WHEN `POST /api/pairings` carries more than 50 entries in `selected` THE SYSTEM SHALL answer `400`.
AC17  WHEN a draft `state` serialises to more than 64 KB or the drafts store would exceed 1 MB THE SYSTEM SHALL answer `413`.
AC18  WHEN an upload's declared type is not `image/*` or its `originalname` extension is not one of `png`, `jpg`, `jpeg`, `webp`, `gif` THE SYSTEM SHALL answer `400` and store nothing.
AC19  WHEN an upload is accepted THE SYSTEM SHALL store it under a generated name with one of those extensions.
AC20  WHEN `/uploads` answers THE SYSTEM SHALL send `X-Content-Type-Options: nosniff`.
AC21  WHEN a principal holds 20 files or 50 MB in `uploads/` THE SYSTEM SHALL answer `413`.
AC22  WHEN `/next` is requested with a target that does not begin with a single `/` followed by a non-`/` character THE SYSTEM SHALL answer `400`.
AC23  WHEN any `/api` route throws THE SYSTEM SHALL answer JSON with status `500` from the last error middleware.
AC24  WHEN `GET /api/unsplash-key` is requested THE SYSTEM SHALL answer `404`.
AC25  WHEN `POST /telegram-webhook` arrives without the configured secret THE SYSTEM SHALL answer `401`.
AC26  WHEN `POST /telegram-webhook` arrives while no secret is configured THE SYSTEM SHALL answer `503`.
AC27  WHEN `POST /telegram-webhook` is answered THE SYSTEM SHALL NOT write the update body to the log.
AC28  WHEN the Mini App calls any `/api` route THE SYSTEM SHALL send `Authorization: tma <initData>`.
AC29  WHEN the Mini App needs its identity THE SYSTEM SHALL read it from `GET /api/me` and not from `initDataUnsafe.user.id`, `window.__GRND_USER_ID__` or `default-user`.
AC30  WHEN the server writes a store file or its temp file THE SYSTEM SHALL create it with mode `0600`.
AC31  WHEN the server creates the data root THE SYSTEM SHALL create it with mode `0700`.
AC32  WHEN a drafts file fails to parse THE SYSTEM SHALL keep at most one aside copy and delete it on the next successful write.
AC33  WHEN `.gitignore` is read THE SYSTEM SHALL match every aside copy name of the drafts store.
AC34  WHEN the runtime image is built THE SYSTEM SHALL carry no file from `data/` that holds user data.
AC35  WHEN `GRND_DATA_DIR` is set THE SYSTEM SHALL read and write every store under it and leave the repository's `data/` untouched.
AC36  WHEN `GRND_DATA_DIR` is unset THE SYSTEM SHALL use `<repo>/data`.
AC37  WHEN `GRND_TELEGRAM_BOT_TOKEN` is set THE SYSTEM SHALL verify `initData` with it.
AC38  WHEN `GRND_TELEGRAM_BOT_TOKEN` is unset THE SYSTEM SHALL answer `503` on every `/api` route instead of serving unauthenticated data.
