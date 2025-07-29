import { Calendar } from './Calendar.js';
import { WorkoutHistory } from './WorkoutHistory.js';

export class Dashboard {
  constructor(container, apiService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.navigation = navigationService;
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
      
      this.container.innerHTML = `
          <div class="dashboard">
              <!-- Today's Focus Card -->
              <div class="card focus-card">
                  <h2>Today's Focus</h2>
                  ${this.workoutData ? `
                      <h3>${this.workoutData.name}</h3>
                      <p>${this.workoutData.description || 'No description available'}</p>
                      
                      <div class="performance">
                          <h4>Last Performance</h4>
                          ${this.workoutData.lastPerformance && this.workoutData.lastPerformance.length > 0 ? `
                              <ul>
                                  ${this.workoutData.lastPerformance.map(item => `
                                      <li>${item.exercise}: ${item.result}</li>
                                  `).join('')}
                              </ul>
                          ` : `
                              <p>No previous performance data</p>
                          `}
                      </div>
                      
                      <button class="primary-btn" id="start-workout-btn" data-day-id="${this.workoutData.id}">
                          Start Workout
                      </button>
                  ` : `
                      <p>No workout scheduled for today</p>
                  `}
              </div>
              
              <!-- Quick Stats Widgets -->
              <div class="stats-grid">
                  <div class="stat-card">
                      <h3>Weekly Volume</h3>
                      <p>${this.stats?.weeklyVolume || '0'} kg</p>
                  </div>
                  
                  <div class="stat-card">
                      <h3>Last Workout</h3>
                      <p>${this.stats?.lastWorkout || 'N/A'}</p>
                  </div>
                  
                  <div class="stat-card">
                      <h3>Streak</h3>
                      <p>${this.stats?.streak || '0'} days</p>
                  </div>
              </div>
              
              <!-- Workout Calendar -->
              <div class="card calendar-container" id="calendar-container">
              </div>
              
              <!-- Workout History -->
              <div class="card workout-history-container" id="workout-history-container">
                  <h3>Recent Workouts</h3>
                  <div id="workout-history-content">
                      <div class="loading">
                          <div class="spinner"></div>
                          <p>Loading workout history...</p>
                      </div>
                  </div>
                  <button class="btn-secondary" id="view-all-history">View All History</button>
              </div>
          </div>
      `;

      // Add event listener for start workout button
      const startBtn = this.container.querySelector('#start-workout-btn');
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
              // Create a simplified workout history component for the dashboard
              const user = await this.api.storage.getItem('user');
              if (!user) {
                  throw new Error('User not found');
              }
              
              // Fetch recent workout sessions (last 5)
              const sessions = await this.api.getWorkoutSessions(user.id, {
                  limit: 5,
                  sort: 'startTime:desc'
              });
              
              if (sessions.length === 0) {
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