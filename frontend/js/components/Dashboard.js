import { Calendar } from './Calendar.js';
import { WorkoutHistory } from './WorkoutHistory.js';

export class Dashboard {
  constructor(container, apiService, navigationService, storageService) {
    this.container = container;
    this.api = apiService;
    this.navigation = navigationService;
    this.storage = storageService;
    this.workoutData = null;
    this.stats = null;
    this.calendar = null;
    this.workoutHistory = null;
  }

  async init() {
      try {
          // Fetch dashboard data
          const [workout, stats] = await Promise.all([
              this.api.getTodaysWorkout(),
              this.api.getQuickStats()
          ]);
          
          this.workoutData = workout;
          this.stats = stats;
          this.render();
          this.initCalendar();
      } catch (error) {
          console.error('Failed to load dashboard data:', error);
          this.container.innerHTML = `<div class="error">Failed to load dashboard data</div>`;
      }
  }

  render() {
      // Extract today's workout from the plan
      let todaysWorkout = null;
      let lastPerformance = [];
      
      if (this.workoutData && this.workoutData.weeks) {
          // Find today's workout (simplified logic - in a real app, this would be more complex)
          const today = new Date().getDay();
          const dayIndex = today === 0 ? 6 : today - 1; // Convert to 0-6 (Mon-Sun)
          
          // For now, just get the first week's workout for the current day
          if (this.workoutData.weeks.length > 0) {
              const currentWeek = this.workoutData.weeks[0];
              if (currentWeek.days && currentWeek.days.length > dayIndex) {
                  todaysWorkout = currentWeek.days[dayIndex];
              }
          }
      }
      
      let lastPerfHTML = '';

      // Helper to abbreviate numbers (reuse if already defined above)
      const abbr = (n) => {
        if (n == null) return '0';
        const abs = Math.abs(n);
        if (abs >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
        if (abs >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'k';
        return String(n);
      };

      const perf = this.workoutData?.lastPerformance;

      if (Array.isArray(perf) && perf.length) {
        const workoutType = this.workoutData?.name || 'Workout';
        const totalSets = perf.reduce((sum, it) => sum + (Number(it.sets) || 0), 0);
        const totalVolumeRaw = perf.reduce((sum, it) => {
          const sets = Number(it.sets) || 0;
          const reps = Number(it.reps) || 0;
          const weight = Number(it.weight) || 0;
          return sum + (sets * reps * weight);
        }, 0);
        const totalVolume = `${abbr(totalVolumeRaw)} kg`;
        const durationMin = this.workoutData?.durationMinutes ?? this.workoutData?.duration ?? null;
        const durationLabel = durationMin != null ? `${durationMin} min` : '—';

        const detailsItems = perf.map(it => {
          const sets = it.sets != null ? `${it.sets} sets` : '';
          const pattern = `${it.weight ?? ''}kg x ${it.reps ?? ''} reps`;
          return `<li>${it.exercise}: ${sets ? sets + ' · ' : ''}${pattern}</li>`;
        }).join('');

        lastPerfHTML = `
          <div class="info-card" id="last-performance-card" role="button" aria-expanded="false">
            <div class="info-header">
              <h4>Last Performance</h4>
            </div>
            <div class="summary" aria-hidden="true">
              <span class="type">${workoutType}</span>
              <span class="dot"></span>
              <span class="sets">${totalSets} sets</span>
              <span class="dot"></span>
              <span class="volume">${totalVolume}</span>
              <span class="dot"></span>
              <span class="duration">${durationLabel}</span>
            </div>
            <div class="info-body">
              <ul class="details-list">${detailsItems}</ul>
            </div>
          </div>
        `;
      }

      this.container.innerHTML = `
          <div class="dashboard">
              <!-- Workout Calendar (moved to top) -->
              <div class="card calendar-container" id="calendar-container">
              </div>
              
              ${lastPerfHTML}
              
              <!-- Today's Focus Card -->
              <div class="card focus-card">
                  <h2>Today's Focus</h2>
                  ${this.workoutData ? `
                      <h3>${this.workoutData.name}</h3>
                      <p>${this.workoutData.description || 'No description available'}</p>
                      
                      <button class="primary-btn" id="start-workout-dashboard-btn" data-day-id="${this.workoutData.id}">
                          Start Workout
                      </button>
                  ` : `
                      <p>No workout scheduled for today</p>
                  `}
              </div>
              
              <!-- Quick Stats Widgets -->
              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-title">Weekly Volume 
                        <span class="stat-icon-inline" aria-hidden="true" style="color: var(--accent-green);">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 17 9 11 13 15 21 7"></polyline>
                          </svg>
                        </span>
                        <span class="stat-trend" id="kpi-volume-delta"></span>
                      </div>
                      <div class="stat-big" id="kpi-volume">${this.stats?.weeklyVolume ?? 0} kg</div>
                      <div class="stat-caption">${this.stats?.weeklyGoal ? `Goal: ${this.stats.weeklyGoal} kg` : `—`}</div>
                  </div>
                  
                  <div class="stat-card">
                      <div class="stat-title">Workout Streak 
                        <span class="stat-icon-inline" aria-hidden="true" style="color: var(--accent-indigo);">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </span>
                      </div>
                      <div class="stat-big" id="kpi-streak-num">${this.stats?.streak ?? 0}</div>
                      <div class="stat-caption">days in a row</div>
                  </div>
                  
                  <div class="stat-card">
                      <div class="stat-title">Last Workout 
                        <span class="stat-icon-inline" aria-hidden="true" style="color: #F59E0B;">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </span>
                      </div>
                      <div class="stat-big" id="kpi-last-name">${this.stats?.lastWorkout ?? '—'}</div>
                      <div class="stat-caption" id="kpi-last-ago"></div>
                  </div>
                  
                  <div class="stat-card">
                      <div class="stat-title">Monthly Exercises 
                        <span class="stat-icon-inline" aria-hidden="true" style="color: var(--accent-green);">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12c3-6 6 6 9 0s6 6 9-2"></path>
                          </svg>
                        </span>
                      </div>
                      <div class="stat-big" id="kpi-monthly-exercises">${this.stats?.monthlyExercises ?? 0}</div>
                      <div class="stat-caption">completed</div>
                  </div>
              </div>
              
              <!-- Workout History section removed -->
          </div>
      `;

      // Toggle collapse for last performance card
      const perfCard = this.container.querySelector('#last-performance-card');
      if (perfCard) {
        perfCard.addEventListener('click', () => {
          const expanded = perfCard.classList.toggle('expanded');
          perfCard.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
      }

      // Fill deltas and fallbacks
      const volumeEl = this.container.querySelector('#kpi-volume');
      if (volumeEl && this.stats?.weeklyVolume != null) volumeEl.textContent = `${abbr(this.stats.weeklyVolume)} kg`;
      const deltaEl = this.container.querySelector('#kpi-volume-delta');
      if (deltaEl && this.stats?.weeklyDelta != null) deltaEl.textContent = `${this.stats.weeklyDelta > 0 ? '+' : ''}${this.stats.weeklyDelta}%`;

      const streakNum = this.container.querySelector('#kpi-streak-num');
      if (streakNum && this.stats?.streak != null) streakNum.textContent = `${this.stats.streak}`;

      const lastNameEl = this.container.querySelector('#kpi-last-name');
      if (lastNameEl && this.stats?.lastWorkout) lastNameEl.textContent = this.stats.lastWorkout;
      const lastAgoEl = this.container.querySelector('#kpi-last-ago');
      if (lastAgoEl) {
        if (this.stats?.lastWorkoutDaysAgo != null) lastAgoEl.textContent = `${this.stats.lastWorkoutDaysAgo} days ago`;
        else lastAgoEl.textContent = '';
      }

      const monthlyEl = this.container.querySelector('#kpi-monthly-exercises');
      if (monthlyEl && this.stats?.monthlyExercises != null) monthlyEl.textContent = `${this.stats.monthlyExercises}`;

      // keep progress bar/dots updates if present
      const progressBar = this.container.querySelector('.kpi-progress > span');
      if (progressBar) {
        const width = progressBar.style.width;
        progressBar.style.width = '0%';
        requestAnimationFrame(() => { progressBar.style.width = width; });
      }

      const dotsWrap = this.container.querySelector('#streak-dots');
      if (dotsWrap) {
        const dots = Array.from(dotsWrap.querySelectorAll('.streak-dot'));
        const streak = Number(this.stats?.streak ?? 0);
        const clamped = Math.max(0, Math.min(5, streak));
        const full = Math.floor(clamped);
        const half = clamped - full >= 0.5 ? 1 : 0;
        dots.forEach((dot, i) => {
          dot.classList.remove('filled', 'half');
          if (i < full) dot.classList.add('filled');
          else if (i === full && half) dot.classList.add('half');
        });
      }

      // Add event listener for start workout button (dashboard)
      const startBtn = this.container.querySelector('#start-workout-dashboard-btn');
      if (startBtn) {
          startBtn.addEventListener('click', (e) => {
              const dayId = e.target.dataset.dayId;
              if (dayId) {
                  this.navigation.navigateToWorkout(dayId);
              }
          });
      }
      
      // Add event listener for view all history button
      const viewAllHistoryBtn = this.container.querySelector('#view-all-history');
      if (viewAllHistoryBtn) {
          viewAllHistoryBtn.addEventListener('click', () => {
              this.navigation.navigateTo('workout-history');
          });
      }
      
      // Initialize workout history section
      this.initWorkoutHistory();
  }

  initCalendar() {
      const calendarContainer = this.container.querySelector('#calendar-container');
      if (calendarContainer) {
          this.calendar = new Calendar(calendarContainer, this.api, this.navigation);
      }
  }
  
  async initWorkoutHistory() {
      const historyContainer = this.container.querySelector('#workout-history-content');
      if (historyContainer) {
          try {
              // Get user from storage (not from ApiService)
              const user = this.storage ? await this.storage.getItem('user') : (window?.grndApp?.storage ? await window.grndApp.storage.getItem('user') : null);
              if (!user) {
                  // Display a message to the user instead of throwing an error
                  historyContainer.innerHTML = `
                      <div class="no-user-message">
                          <p>Please log in or create a profile to view your workout history.</p>
                          <button class="btn-primary" id="login-btn">Log In</button>
                      </div>
                  `;
                  const loginBtn = historyContainer.querySelector('#login-btn');
                  if (loginBtn) {
                      loginBtn.addEventListener('click', () => {
                          this.navigation.navigateTo('login');
                      });
                  }
                  return;
              }

              // Fetch recent workout sessions (last 5)
              const sessions = await this.api.getUserWorkoutSessions(user.id);
              
              if (!sessions || sessions.length === 0) {
                  historyContainer.innerHTML = '<p>No recent workouts found.</p>';
                  return;
              }
              
              // Render simplified workout list
              let historyHTML = '<div class="recent-workouts-list">';
              
              sessions.forEach(session => {
                  const workoutDate = new Date(session.startTime);
                  const formattedDate = workoutDate.toLocaleDateString();
                  const formattedTime = workoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  historyHTML += `
                      <div class="recent-workout-item" data-workout-id="${session.id}">
                          <div class="workout-summary">
                              <h4>${session.day?.name || 'Workout'}</h4>
                              <p class="workout-meta">${formattedDate} at ${formattedTime}</p>
                          </div>
                          <div class="workout-stats">
                              <span class="duration">${this.formatDuration(session.duration)}</span>
                              <span class="volume">${session.totalVolume || 0} kg</span>
                          </div>
                      </div>
                  `;
              });
              
              historyHTML += '</div>';
              historyContainer.innerHTML = historyHTML;
              
              // Add click handlers for workout items
              const workoutItems = historyContainer.querySelectorAll('.recent-workout-item');
              workoutItems.forEach(item => {
                  item.addEventListener('click', (e) => {
                      const workoutId = e.currentTarget.dataset.workoutId;
                      this.navigation.navigateTo('workout-detail', { workoutId });
                  });
              });
          } catch (error) {
              console.error('Failed to load workout history:', error);
              historyContainer.innerHTML = '<p>Failed to load workout history.</p>';
          }
      }
  }
  
  formatDuration(seconds) {
      if (!seconds) return '0:00';
      
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
