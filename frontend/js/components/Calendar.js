  /**
  * Calendar Component
  * Displays a monthly calendar with workout schedule information
  *
  * This component renders a calendar where each day cell shows:
  * - The day number
  * - Background color based on the scheduled workout (if any)
  * - Status text ("Done" or "Missed") based on workout session completion
  *
  * Implementation notes:
  * - Workout colors are read from the workout data associated with each session
  * - Status is determined by checking if any workout session for the date is completed
  * - If multiple workouts exist on the same day, the first one's color is used
  * - The component uses mock data for demonstration but is structured to work with API data
  */

export class Calendar {
  constructor(container, apiService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.navigation = navigationService;
    this.currentDate = new Date();
    this.workoutData = [];
    this.workoutSessions = [];
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.init();
  }

  async init() {
    // Fetch workout data
    await this.fetchWorkoutData();
    this.render();
  }

  async fetchWorkoutData() {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use the existing mock data structure but with proper model instances
      
      // Create workout data using the Workout model
      this.workoutData = [
        { id: 1, name: 'Upper Body Strength', description: 'Focus on chest, back, and shoulders', color: '#e74c3c' },
        { id: 2, name: 'Lower Body Power', description: 'Focus on legs and glutes', color: '#3498db' }
      ];
      
      // Create workout sessions using the WorkoutSession model structure
      // These would typically be fetched from an API or storage service
      this.workoutSessions = [
        { date: new Date(2025, 6, 15), completed: true, workoutId: 1 },
        { date: new Date(2025, 6, 20), completed: false, workoutId: 2 },
        { date: new Date(2025, 6, 25), completed: true, workoutId: 1 }
      ];
      
      // Note: In a production app, this would be replaced with:
      // this.workoutData = await this.api.getWorkouts();
      // this.workoutSessions = await this.api.getWorkoutSessions();
    } catch (error) {
      console.error('Failed to fetch workout data:', error);
    }
  }

  hexToRgb(hex) {
    if (!hex) return null;
    let h = hex.startsWith('#') ? hex.slice(1) : hex;
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const int = parseInt(h, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return { r, g, b };
  }

  getForegroundForBackground(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#000';
    let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const toLinear = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    r = toLinear(r); g = toLinear(g); b = toLinear(b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.5 ? '#000' : '#fff';
  }

  getColorForDate(date) {
    // Find all sessions for the specified date, sorted by time
    const sessionsForDate = this.workoutSessions
      .filter(s => s.date.toDateString() === date.toDateString())
      .sort((a, b) => a.date - b.date);
    
    // Look for the first session with a color
    for (const sess of sessionsForDate) {
      // First check if the session itself has a color property
      let colorCandidate = sess.color;
      
      // If not, get the color from the associated workout data
      if (!colorCandidate) {
        const w = this.workoutData.find(w => w.id === sess.workoutId);
        colorCandidate = w?.color ?? null;
      }
      
      // Return the first color found (for multiple workouts on same day)
      if (colorCandidate) return colorCandidate;
    }
    
    return null;
  }

  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Monday as the first day of the week
    const startDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const today = new Date();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let calendarHTML = `
      <div class="calendar">
        <div class="calendar-header">
          <div class="calendar-left" id="calendar-left"></div>
          <div class="month"><span class="month-year">${year}</span><span class="month-name">${monthNames[month]}</span></div>
          <div class="calendar-right">
            <div class="controls">
              <button class="btn-secondary calendar-nav" id="prev-month" data-dir="prev" aria-label="Previous month">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <polyline points="15 6 9 12 15 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
              </button>
              <button class="btn-secondary calendar-nav" id="next-month" data-dir="next" aria-label="Next month">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <polyline points="9 6 15 12 9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="calendar-weekdays">
          ${weekdayNames.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">
    `;
    
    // Add empty cells leading from previous month
    for (let i = 0; i < startDayIndex; i++) {
      calendarHTML += '<div class="calendar-cell dimmed" aria-hidden="true"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      
      // Get workout color for this date
      const color = this.getColorForDate(date);
      
      // Determine workout status for this date
      const status = this.getWorkoutStatus(date);
      
      // Build cell classes
      const classes = ["calendar-cell"];
      if (isToday) classes.push("today");
      
      // Color style handling - apply workout color as background if available
      let styleAttr = '';
      if (color) {
        styleAttr = ` style="background-color:${color}"`;
      }

      // Status text to display under the day number
      let statusText = '';
      if (status === 'completed') {
        statusText = '<div class="calendar-status calendar-status--completed">Done</div>';
      } else if (status === 'missed') {
        statusText = '<div class="calendar-status calendar-status--missed">Missed</div>';
      }

      calendarHTML += `
        <div class="${classes.join(' ')}" data-date="${date.toISOString().split('T')[0]}"${styleAttr}>
          <div class="calendar-day-number">${day}</div>
          ${statusText}
        </div>
      `;
    }

    calendarHTML += `
        </div>
      </div>
    `;
    
    this.container.innerHTML = calendarHTML;
    this.addEventListeners();
    this.addTouchListeners();

    // Populate left side with today's date (e.g., Thu, Aug 7)
    const leftEl = this.container.querySelector('#calendar-left');
    if (leftEl) {
      const leftDate = new Date();
      const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      leftEl.textContent = formatter.format(leftDate);
    }

    // Fallback: if SVG icons are not visible, show text chevrons
    const prev = this.container.querySelector('#prev-month');
    const next = this.container.querySelector('#next-month');
    [prev, next].forEach(btn => {
      if (!btn) return;
      const svg = btn.querySelector('svg');
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      if (!box.width || !box.height) {
        btn.classList.add('no-icon');
      }
    });
  }

  addEventListeners() {
    // Previous month button
    const prevBtn = this.container.querySelector('#prev-month');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
      });
    }
    
    // Next month button
    const nextBtn = this.container.querySelector('#next-month');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
      });
    }
    
    // Today button (optional; not present in header but keep for compatibility)
    const todayBtn = this.container.querySelector('#today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDate = new Date();
        this.render();
      });
    }
    
    // Day click events with selection toggle
    const dayElements = this.container.querySelectorAll('.calendar-cell:not(.dimmed)');
    dayElements.forEach(dayElement => {
      dayElement.addEventListener('click', (e) => {
        const currentSelected = this.container.querySelector('.calendar-cell.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        e.currentTarget.classList.add('selected');
        const date = e.currentTarget.dataset.date;
        this.onDayClick(date);
      });
    });
  }

  addTouchListeners() {
    const calendarElement = this.container.querySelector('.calendar-grid');
    if (!calendarElement) return;

    calendarElement.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, false);

    calendarElement.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipeGesture();
    }, false);
  }

  handleSwipeGesture() {
    const swipeThreshold = 50; // Minimum distance for a swipe
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next month
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      } else {
        // Swipe right - previous month
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      }
      this.render();
    }
  }

  isWorkoutScheduled(date) {
    return this.workoutSessions.some(session => session.date.toDateString() === date.toDateString());
  }

  isWorkoutCompleted(date) {
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? session.completed : false;
  }

  isWorkoutMissed(date) {
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? (!session.completed) : false;
  }

  getWorkoutForDate(date) {
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? this.workoutData.find(workout => workout.id === session.workoutId) : null;
  }

  /**
   * Determines the workout status for a given date
   * @param {Date} date - The date to check
   * @returns {string} - 'completed' if any workout session for this date is completed,
   *                    'missed' if sessions exist but none are completed,
   *                    null if no workout is scheduled
   *
   * Status determination logic:
   * - First finds all workout sessions scheduled for the specified date
   * - If no sessions exist, returns null (no workout scheduled)
   * - If any session for the date has completed=true, returns 'completed'
   * - If sessions exist but none are completed, returns 'missed'
   */
  getWorkoutStatus(date) {
    // Find all sessions for this date
    const sessionsForDate = this.workoutSessions.filter(session =>
      session.date.toDateString() === date.toDateString()
    );
    
    // If no sessions, return null
    if (sessionsForDate.length === 0) {
      return null;
    }
    
    // Check if any session is completed
    const hasCompletedSession = sessionsForDate.some(session => session.completed);
    
    if (hasCompletedSession) {
      return 'completed';
    } else {
      return 'missed';
    }
  }

  onDayClick(date) {
    // Handle the event when a day is clicked
    const workout = this.getWorkoutForDate(new Date(date));
    if (workout) {
      this.navigation.navigateToWorkoutDetail(workout.id);
    }
  }
}

// Make Calendar component globally available
window.Calendar = Calendar;
