# GRND — specification

The README covers the start. This file keeps the requirements document and the
implementation plan that were the original blueprint.

## **Project Requirements Document (PRD)**

### 1. Description of the Problem and Overall Purpose
Users need a simple tool. They create, manage, and track workout routines in Telegram.
The Mini App provides a customizable workout planner and an interactive timer.
The app focuses on performance volume for weighted and bodyweight exercises.
The goal is a clear and pleasing experience.
The user plans a routine and then runs a workout with a real-time, user-controlled timer.

### 2. Description of the Input Data

#### 2.1. User-Provided Data
*   **User Profile:**
    *   `telegram_user_id`: The app identifies this value automatically and links the data to the user.
    *   `bodyweight`: A number in kg. The app needs this value to calculate the volume of bodyweight exercises.
*   **Training Plan Data (Stored in a single `user_data.json` file per user):**
    *   The root JSON object holds a list of `Training Plans`.
    *   **`Training Plan` Object:** `plan_id`, `plan_name`, `start_date`, `weeks` (array).
    *   **`Week` Object:** `week_number`, `days` (array).
    *   **`Day` Object:** `day_id`, `day_name`, `day_type` (Enum: 'STANDARD', 'CIRCUIT'), `exercises` (array) OR `circuit_config` (object).
    *   **`Circuit Config` Object:** `target_rounds`, `circuit_exercises` (array).
    *   **`Exercise` Object:** `exercise_id`, `exercise_name`, `description`, `image_url`, `exercise_type` (Enum: 'WEIGHTED', 'BODYWEIGHT'), `bodyweight_load_percentage`, `target_sets`, `target_reps`, `completed_sets` (array of `{reps: Number, weight: Number}`).

#### 2.2. System Data
*   **Bodyweight Exercise Load Table:** A lookup table in the code. The table maps each bodyweight exercise to its load percentage (`% Bodyweight Used`).
*   **`WorkoutSession` Log Object:** The app saves this object after each workout.
    *   `session_id`, `date`, `total_duration`, `total_volume_kg`, `day_id_completed`, `performance_summary`.

### 3. Description of the Output Data
*   **Primary Storage:** The server saves all `Training Plan` data to the user's `.json` file. The app sends `POST` requests.
*   **Workout Logs:** The app saves `WorkoutSession` objects to the user's data file. The log tracks the history.
*   **On-Screen Display:** The Mini App UI shows all data.
    The user views the data and interacts with it.
    The visual style guide controls the look.

### 4. Detailed Logic/Sequence of Tasks

#### 4.1. Volume Calculation Logic
1.  For each completed set/exercise:
2.  **If 'WEIGHTED':** `Set Volume = weight_used × reps_completed`.
3.  **If 'BODYWEIGHT':** `Set Volume = user_bodyweight × bodyweight_load_percentage × reps_completed`.
4.  `total_volume_kg` is the sum of all set volumes for the session.

#### 4.1.1. Weekly Sets per Muscle Group

Kilograms say how heavy the week was. They do not say whether a muscle group got enough work, and that
is the question a trainee asks. The app therefore counts working sets per muscle group per week and
compares every group with an evidence-based band.

Counting rule:

- A set counts **1.0** for each primary muscle group of its exercise.
- A set counts **0.5** for each secondary muscle group.
- A set marked `warmup: true` is not work and counts in no group.
- An exercise the taxonomy does not know is reported as unmapped and is counted in no group.

**Superseded 2026-11-18 (Ilja, `ROADMAP.md` §1c).** This section used to say that a completed round of
a circuit counts as one set, on the same footing as a strength set. A circuit is endurance work: it does
not enter the 10–20 band. The report gives it its own row — rounds and time under load — beside the
groups, and the band counts strength sets only.

The bands live in `data/weekly-targets.json` and name their source: 10 sets per week is the low end that
still grows a muscle, 10 to 20 is the productive band, above 20 the return per set falls. Four sets per
week maintains a muscle; it does not build it.

The mapping from exercise to muscle groups lives in `data/exercise-taxonomy.json`. An explicit entry
wins; a keyword fallback places a new variant; anything left is reported, never guessed.

The report is available at `GET /api/muscle-volume/:userId?week=YYYY-MM-DD` and answers:

```text
week_start, week_end, sessions,
groups[{group, sets, primary_sets, secondary_sets, target, status}],
circuits[{date, rounds, time_under_load, exercises}], circuit_rounds,
unmapped[{name, sets}]
```

`status` is `below` under the low end, `in` inside the productive band, `above` past the top of it and
`high` past the maximum.

#### 4.1.2. The plan is direction, the workout is load

A plan day states **what** is trained and in which shape: the exercises, the day type, and for a heavy
basic exercise the rep range. It does not state the numbers of a particular session.

A circuit day stores the exercises and nothing else — no time, no reps. Before each workout the user
chooses the total time and the reps of each exercise, and that session records what actually happened.
The rule behind it: a plan is held to even on a flat day, so doing less is allowed and leaving the plan's
direction is not.

#### 4.2. Data Persistence Logic
1.  **Load:** At app start, the app sends a `GET` request to `/api/workout-data/:userId`.
    The server returns the user's JSON file.
2.  **Save:** The user updates a plan or completes a workout.
    The app sends the full updated JSON object to the server with a `POST` request to `/api/workout-data/:userId`.
    The server overwrites the user's file.

#### 4.3. Workout Execution & Timer Logic
1.  The user starts a workout. A **"Timer Setup" modal** opens.
    The user sets `Total Workout Time`, `Preparation Time`, and `Default Rest Time`.
2.  **If `day_type` is 'STANDARD':**
    *   The app shows one exercise at a time. The user taps `FINISH SET`.
    *   A **"Log Set" modal** opens. The fields already have values.
        The user changes them with the `+`/`-` buttons.
    *   The user confirms. The rest timer starts.
        The app goes to the next set or exercise.
3.  **If `day_type` is 'CIRCUIT':**
    *   The app shows all exercises for the current round.
    *   The user does all exercises. Then the user taps one `FINISH ROUND` button.
    *   A **"Log Round" modal** opens. The modal has a field for each exercise in the round.
    *   The user confirms. A longer rest between rounds starts.
        The app goes to the next round.

### 5. Description of Interfaces (GUI)
*   **Screen 1: Main Dashboard:** A layout of cards.
    It shows "Today's Focus" with performance data from the last attempt, quick stats widgets, and a workout calendar.
*   **Screen 2: Plan Builder:** A view to `Create`, `Edit`, or `Delete` plans.
    The user taps a plan to open Weeks -> Days.
    When the user creates a Day, the user selects 'Standard' or 'Circuit' type.
    The type changes the editor UI that comes next.
*   **Screen 3: Exercise Editor (Full-Screen):** Fields for exercise details. The screen includes an image uploader and an Unsplash API search feature.
*   **Screen 4: Active Workout Screen:**
    *   **Header:** The `Total Timer` (elapsed/remaining) sits in the middle.
        The `End Workout` button sits on the left.
    *   **Main Content:** The content depends on the workout type. 'Standard' shows one exercise.
        'Circuit' shows all exercises for the round in separate vertical cards.
    *   **Action Button:** A large, round, green button at the bottom (`FINISH SET` or `FINISH ROUND`).

### 6. UI/UX Structure and Interaction Patterns
*   **Navigation:** A bottom navigation bar holds `Dashboard`, `Plans`, and `Settings`.
*   **Hierarchy:** The user drills down: Plan -> Week -> Day.
*   **Logging:** Modals log sets and rounds. The user stays in the workout context.
    The user adjusts reps with large `+`/`-` buttons. The buttons make the change easy.

### 7. Visual Design and UI Style Guide
*   **Inspiration:** The design uses the provided visual reference.
*   **Layout:** A modular, card-based system on a light grey background (`#F0F2F5`). The cards are white with rounded corners.
*   **Color Palette:** A light mode with accent colors for interactive elements. The primary action buttons are green.
*   **Typography:** A clean, sans-serif font with a strong visual hierarchy.

### 8. Proposed Tech Stack
*   **Frontend (Mini App):** HTML5, CSS3, JavaScript (ES6+). Use a framework such as Vue.js or Svelte.
*   **Backend:** Node.js with Express.js.
*   **Image Search:** Unsplash API (or similar free service).

### 9. Key Constraints & Assumptions
*   **Constraint:** The app must work as a Telegram Mini App.
*   **Constraint:** The app stores data in a single JSON file per user on the server.
*   **Assumption:** The app serves one user. It has no data sharing features.
*   **Assumption:** The initial Bodyweight Load % Table is sufficient for V1.

---
The Implementation Plan below is the developer's roadmap.
It divides the project into logical, manageable modules and tasks, from backend setup to final UI integration.
It answers how to build the app.
## **Implementation Plan**

### **Module 1: Project Setup and Backend Foundation**
*   **Task 1.1: Initialize Backend Project:** Set up a Node.js project with `npm init`. Install these dependencies: `express`, `cors`, `body-parser`.
*   **Task 1.2: Create Server Entry Point:** Create `server.js`. Set up a basic Express server that listens on a port.
*   **Task 1.3: Implement Data Storage Logic:** Create a `/data` directory.
    Write helper functions in the server.
    The functions read and write `<userId>.json` files with the `fs` module.
*   **Task 1.4: Define API Endpoints:** Implement the routes in `server.js`:
    *   `GET /api/workout-data/:userId`: The route reads the user's JSON file and returns it.
    *   `POST /api/workout-data/:userId`: The route reads the request body and overwrites the user's JSON file.
*   **Task 1.5: Initialize Frontend Project:** Create a `/frontend` directory with `index.html`, `style.css`, and `app.js`.
    Link the CSS and JS files in the HTML.

### **Module 2: Plan Builder and Data Structures**
*   **Task 2.1: Define Frontend Data Models:** In `app.js`, create JavaScript classes or objects.
    They match the JSON structure in the PRD (`TrainingPlan`, `Week`, `Day`, `Exercise`).
*   **Task 2.2: Build the 'Plan List' View:** Create the UI for Screen 2.
    Fetch and show a list of all training plans.
    Include buttons for `Create New Plan`, edit, and delete.
*   **Task 2.3: Build the 'Plan Editor' View:** Create a full-screen view. The user edits a plan name and manages the weeks.
*   **Task 2.4: Build the 'Day Editor' View:** This task is critical.
    *   Create a component. The component first asks the user to select `Day Type` ('Standard' or 'Circuit').
    *   Then the UI shows the correct editor. The user adds or manages exercises for that day type.
*   **Task 2.5: Build the 'Exercise Editor' View:** Create the full-screen UI to add or edit an exercise.
    The UI has all fields (name, sets, reps, type, and so on).
*   **Task 2.6: Implement Image Search & Upload:**
    *   Connect the app to the Unsplash API for the "Search for Image" feature.
    *   Implement the "Upload Image" feature. This feature needs one more backend endpoint for file uploads.
*   **Task 2.7: Connect to Backend:** Connect the "Save" buttons in the Plan Builder to the backend API.
    The buttons send `POST` requests with the updated plan data.

### **Module 3: The Main Dashboard**
*   **Task 3.1: Build the Dashboard Layout:** Use the visual style guide. Create the main card-based layout for Screen 1 in `index.html` and `style.css`.
*   **Task 3.2: Implement the Calendar Component:** Create a dynamic calendar. The calendar shows the days of the month.
*   **Task 3.3: Implement Workout History Logic:**
    *   When the dashboard loads, fetch the workout logs.
    *   Write a function. The function finds the most recent log for "Today's scheduled workout."
    *   Show the performance data in the "Today's Focus" card.
    *   Mark the days with completed workouts on the calendar.
*   **Task 3.4: Build Quick Stats Widgets:** Create the UI components for "Weekly Volume," "Last Workout," and others. Fill them with data.

### **Module 4: The Workout Engine (Standard & Circuit Mode)**
*   **Task 4.1: Build the Base Workout Screen UI:** Create the HTML/CSS for the active workout screen.
    Include the header for the timer, the main content area, and the large action button footer.
*   **Task 4.2: Implement the Core Timer Logic:** In `app.js`, write the logic for the `Total Workout Timer`, `Preparation Timer`, and `Rest Timer`.
*   **Task 4.3: Build the 'Standard' Workout Flow:**
    *   Write the logic to show one exercise at a time.
    *   Create the "Log Set" modal.
    *   Connect the `FINISH SET` button to the modal. On confirmation, log the data and start the rest timer.
*   **Task 4.4: Build the 'Circuit' Workout Flow:**
    *   Write the logic to show all exercises for the current round.
    *   Connect the `FINISH ROUND` button to a "Log Round" modal. The modal has a field for every exercise.
    *   On confirmation, log the data for all exercises. Start the rest timer between rounds.
*   **Task 4.5: Implement Volume Calculation:** After the app logs each set or round, call the volume calculation logic.
    Update the total volume of the session.

### **Module 5: Settings and Final Integration**
*   **Task 5.1: Build the Settings Screen:** Create a simple view. The user enters and saves the `bodyweight`.
*   **Task 5.2: Integrate Bodyweight into Volume Calc:** Make sure the workout engine can read the saved bodyweight for the calculations.
*   **Task 5.3: Telegram Mini App Integration:**
    *   Add the Telegram Web App script (`telegram-web-app.js`) to `index.html`.
    *   Use the script to get `telegram_user_id` for the API calls.
    *   Change the UI to use Telegram theme parameters. This change gives a native look and feel (for example, background color and button styles).
*   **Task 5.4: Final Testing and Debugging:** Do an end-to-end test of all features.
    Create a plan, run a standard workout and a circuit workout, check the dashboard history, and save all data.
    Check that the data is correct.
