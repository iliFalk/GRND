# GRND
Following Project Requirements Document (PRD) is the official blueprint. It details the project's purpose, features, data structures, user flows, and visual style. It answers what to build and why.

---

## **Project Requirements Document (PRD) - V1.4**

### 1. Description of the Problem and Overall Purpose
Users need a simple yet powerful tool to create, manage, and track their workout routines within the convenience of Telegram. This Mini App provides a highly customizable workout planner and an interactive timer, with a specific focus on tracking performance volume for both weighted and bodyweight exercises. The goal is a seamless, visually appealing experience, from planning a routine to executing a workout with a real-time, user-controlled timer.

### 2. Description of the Input Data

#### 2.1. User-Provided Data
*   **User Profile:**
    *   `telegram_user_id`: Automatically identified for data association.
    *   `bodyweight`: A numerical value in kg, required for volume calculation of bodyweight exercises.
*   **Training Plan Data (Stored in a single `user_data.json` file per user):**
    *   A root JSON object containing a list of `Training Plans`.
    *   **`Training Plan` Object:** `plan_id`, `plan_name`, `start_date`, `weeks` (array).
    *   **`Week` Object:** `week_number`, `days` (array).
    *   **`Day` Object:** `day_id`, `day_name`, `day_type` (Enum: 'STANDARD', 'CIRCUIT'), `exercises` (array) OR `circuit_config` (object).
    *   **`Circuit Config` Object:** `target_rounds`, `circuit_exercises` (array).
    *   **`Exercise` Object:** `exercise_id`, `exercise_name`, `description`, `image_url`, `exercise_type` (Enum: 'WEIGHTED', 'BODYWEIGHT'), `bodyweight_load_percentage`, `target_sets`, `target_reps`, `completed_sets` (array of `{reps: Number, weight: Number}`).

#### 2.2. System Data
*   **Bodyweight Exercise Load Table:** A hardcoded lookup table mapping specific bodyweight exercises to their load percentage (`% Bodyweight Used`).
*   **`WorkoutSession` Log Object:** Saved after each workout.
    *   `session_id`, `date`, `total_duration`, `total_volume_kg`, `day_id_completed`, `performance_summary`.

### 3. Description of the Output Data
*   **Primary Storage:** All `Training Plan` data is saved to the user's `.json` file on the server via `POST` requests.
*   **Workout Logs:** `WorkoutSession` objects are saved to the user's data file to track history.
*   **On-Screen Display:** The Mini App's UI renders all data for viewing and interaction according to the visual style guide.

### 4. Detailed Logic/Sequence of Tasks

#### 4.1. Volume Calculation Logic
1.  For each completed set/exercise:
2.  **If 'WEIGHTED':** `Set Volume = weight_used × reps_completed`.
3.  **If 'BODYWEIGHT':** `Set Volume = user_bodyweight × bodyweight_load_percentage × reps_completed`.
4.  `total_volume_kg` is the sum of all set volumes for the session.

#### 4.2. Data Persistence Logic
1.  **Load:** On app start, a `GET` request to `/api/workout-data/:userId` retrieves the user's JSON file from the server.
2.  **Save:** On plan update or workout completion, a `POST` request to `/api/workout-data/:userId` sends the entire updated JSON object to the server, which overwrites the user's file.

#### 4.3. Workout Execution & Timer Logic
1.  User starts a workout. A **"Timer Setup" modal** appears to configure `Total Workout Time`, `Preparation Time`, and `Default Rest Time`.
2.  **If `day_type` is 'STANDARD':**
    *   The app presents one exercise at a time. User taps `FINISH SET`.
    *   A **"Log Set" modal** appears (pre-filled, adjustable with `+`/`-` buttons).
    *   User confirms, rest timer starts. The app proceeds to the next set or exercise.
3.  **If `day_type` is 'CIRCUIT':**
    *   The app displays the full list of exercises for the current round.
    *   User performs all exercises, then taps a single `FINISH ROUND` button.
    *   A **"Log Round" modal** appears with fields for each exercise in the round.
    *   User confirms, a longer rest period between rounds begins. The app proceeds to the next round.

### 5. Description of Interfaces (GUI)
*   **Screen 1: Main Dashboard:** A card-based layout showing "Today's Focus" with historical performance data from the last attempt, quick stats widgets, and a workout calendar.
*   **Screen 2: Plan Builder:** A view to `Create`, `Edit`, or `Delete` plans. Tapping a plan drills down into Weeks -> Days. When creating a Day, the user must select 'Standard' or 'Circuit' type, which changes the subsequent editor UI.
*   **Screen 3: Exercise Editor (Full-Screen):** Fields for exercise details, including an image uploader and an Unsplash API search feature.
*   **Screen 4: Active Workout Screen:**
    *   **Header:** `Total Timer` (elapsed/remaining) in the middle, `End Workout` button on the left.
    *   **Main Content:** Varies by workout type. 'Standard' shows one exercise. 'Circuit' shows a list of all exercises for the round in separate vertical cards.
    *   **Action Button:** A large, round, green button at the bottom (`FINISH SET` or `FINISH ROUND`).

### 6. UI/UX Structure and Interaction Patterns
*   **Navigation:** A bottom navigation bar for `Dashboard`, `Plans`, and `Settings`.
*   **Hierarchy:** Drill-down navigation for Plan -> Week -> Day.
*   **Logging:** Modals are used for logging sets/rounds to keep the user in the context of the workout. Reps are adjusted with large `+`/`-` buttons for ease of use.

### 7. Visual Design and UI Style Guide
*   **Inspiration:** Based on the provided visual reference.
*   **Layout:** Modular, card-based system on a light grey background (`#F0F2F5`). Cards are white with rounded corners.
*   **Color Palette:** Light mode with accent colors for interactive elements. Primary action buttons are green.
*   **Typography:** Clean, sans-serif font with strong visual hierarchy.

### 8. Proposed Tech Stack
*   **Frontend (Mini App):** HTML5, CSS3, JavaScript (ES6+). A framework like Vue.js or Svelte is recommended.
*   **Backend:** Node.js with Express.js.
*   **Image Search:** Unsplash API (or similar free service).

### 9. Key Constraints & Assumptions
*   **Constraint:** Must function as a Telegram Mini App.
*   **Constraint:** Data persistence uses a single JSON file per user on the server.
*   **Assumption:** The app is for a single user; no data sharing features.
*   **Assumption:** The initial Bodyweight Load % Table is sufficient for V1.

---
Following Implementation Plan is the developer's roadmap. It breaks down the entire project into logical, manageable modules and tasks, from the backend setup to the final UI integration. It answers how to build it.
## **Implementation Plan**

### **Module 1: Project Setup and Backend Foundation**
*   **Task 1.1: Initialize Backend Project:** Set up a Node.js project with `npm init`. Install dependencies: `express`, `cors`, `body-parser`.
*   **Task 1.2: Create Server Entry Point:** Create `server.js`. Set up a basic Express server to listen on a port.
*   **Task 1.3: Implement Data Storage Logic:** Create a `/data` directory. Implement helper functions in the server to read from and write to `<userId>.json` files using the `fs` module.
*   **Task 1.4: Define API Endpoints:** Implement the routes in `server.js`:
    *   `GET /api/workout-data/:userId`: Reads and returns the user's JSON file.
    *   `POST /api/workout-data/:userId`: Parses the request body and overwrites the user's JSON file.
*   **Task 1.5: Initialize Frontend Project:** Create a `/frontend` directory with `index.html`, `style.css`, and `app.js`. Link the CSS and JS files in the HTML.

### **Module 2: Plan Builder and Data Structures**
*   **Task 2.1: Define Frontend Data Models:** In `app.js`, create JavaScript classes or objects that mirror the JSON structure defined in the PRD (`TrainingPlan`, `Week`, `Day`, `Exercise`).
*   **Task 2.2: Build the 'Plan List' View:** Create the UI for Screen 2. Fetch and display a list of all training plans. Include buttons for `Create New Plan` and to edit/delete existing ones.
*   **Task 2.3: Build the 'Plan Editor' View:** Create a full-screen view to edit a plan's name and manage its weeks.
*   **Task 2.4: Build the 'Day Editor' View:** This is a critical task.
    *   Create a component that first asks the user to select `Day Type` ('Standard' or 'Circuit').
    *   The UI will then conditionally render the correct editor for adding/managing exercises for that day type.
*   **Task 2.5: Build the 'Exercise Editor' View:** Create the full-screen UI for adding/editing an exercise with all its fields (name, sets, reps, type, etc.).
*   **Task 2.6: Implement Image Search & Upload:**
    *   Integrate with the Unsplash API for the "Search for Image" feature.
    *   Implement the "Upload Image" functionality, which will require an additional backend endpoint to handle file uploads.
*   **Task 2.7: Connect to Backend:** Wire up the "Save" buttons in the Plan Builder to make `POST` requests to the backend API, sending the updated plan data.

### **Module 3: The Main Dashboard**
*   **Task 3.1: Build the Dashboard Layout:** Using the visual style guide, create the main card-based layout for Screen 1 in `index.html` and `style.css`.
*   **Task 3.2: Implement the Calendar Component:** Create a dynamic calendar that can render the days of the month.
*   **Task 3.3: Implement Workout History Logic:**
    *   When the dashboard loads, fetch workout logs.
    *   Implement a function to find the most recent log for "Today's scheduled workout."
    *   Display the historical performance data in the "Today's Focus" card.
    *   Visually mark days with completed workouts on the calendar.
*   **Task 3.4: Build Quick Stats Widgets:** Create the UI components for "Weekly Volume," "Last Workout," etc., and populate them with data.

### **Module 4: The Workout Engine (Standard & Circuit Mode)**
*   **Task 4.1: Build the Base Workout Screen UI:** Create the HTML/CSS for the active workout screen, including the header for the timer, the main content area, and the large action button footer.
*   **Task 4.2: Implement the Core Timer Logic:** In `app.js`, create the logic for the `Total Workout Timer`, `Preparation Timer`, and `Rest Timer`.
*   **Task 4.3: Build the 'Standard' Workout Flow:**
    *   Implement the logic to display one exercise at a time.
    *   Create the "Log Set" modal.
    *   Wire the `FINISH SET` button to show the modal, and on confirmation, log the data and start the rest timer.
*   **Task 4.4: Build the 'Circuit' Workout Flow:**
    *   Implement the logic to display the full list of exercises for the current round.
    *   Wire the `FINISH ROUND` button to a "Log Round" modal that has fields for every exercise.
    *   On confirmation, log data for all exercises and start the between-round rest timer.
*   **Task 4.5: Implement Volume Calculation:** After each set/round is logged, call the volume calculation logic and update the session's total volume.

### **Module 5: Settings and Final Integration**
*   **Task 5.1: Build the Settings Screen:** Create a simple view where the user can input and save their `bodyweight`.
*   **Task 5.2: Integrate Bodyweight into Volume Calc:** Ensure the workout engine can access the user's saved bodyweight for calculations.
*   **Task 5.3: Telegram Mini App Integration:**
    *   Add the Telegram Web App script (`telegram-web-app.js`) to `index.html`.
    *   Use the script to retrieve `telegram_user_id` for API calls.
    *   Adapt the UI to use Telegram's theme parameters for a native look and feel (e.g., background color, button styles).
*   **Task 5.4: Final Testing and Debugging:** Perform end-to-end testing of all features: creating a plan, running both standard and circuit workouts, checking dashboard history, and saving all data correctly.
