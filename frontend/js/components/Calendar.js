/**
 * Calendar Component
 * Displays a monthly calendar with workout schedule information
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
      // Fetch user's workout schedule
      // For now, we'll use a mock implementation since we don't have user-specific data
      this.workoutData = [
        // Mock data for demonstration
        { id: 1, name: 'Upper Body Strength', description: 'Focus on chest, back, and shoulders' },
        { id: 2, name: 'Lower Body Power', description: 'Focus on legs and glutes' }
      ];
      
      // Fetch workout sessions for completion status
      // In a real implementation, we would get the current user ID
      // For now, we'll use a mock implementation
      this.workoutSessions = [
        // Mock data for demonstration
        { date: new Date(2025, 6, 15), completed: true },
        { date: new Date(2025, 6, 20), completed: false },
        { date: new Date(2025, 6, 25), completed: true }
      ];
    } catch (error) {
      console.error('Failed to fetch workout data:', error);
    }
  }

  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const startDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday as first day
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
      const isWorkoutDay = this.isWorkoutScheduled(date);
      const isCompleted = this.isWorkoutCompleted(date);
      const isMissed = this.isWorkoutMissed(date);
      const workout = this.getWorkoutForDate(date);

      const classes = ["calendar-cell"]; 
      if (isToday) classes.push("today");
      // selected state can be added by interaction later

      const badges = [];
      if (isWorkoutDay) {
        badges.push(`<span class="badge primary" title="Workout scheduled">${workout?.type === 'cardio' ? 'Cardio' : 'Workout'}</span>`);
      }
      if (isCompleted) {
        badges.push(`<span class="badge success" title="Completed">Done</span>`);
      } else if (isMissed) {
        badges.push(`<span class="badge" title="Missed">Missed</span>`);
      }

      calendarHTML += `
        <div class="${classes.join(' ')}" data-date="${date.toISOString().split('T')[0]}">
          <div class="calendar-date">${day}</div>
          <div class="calendar-badges">${badges.join('')}</div>
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
    
    // Today button
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
    // Check if a workout is scheduled for the given date
    return this.workoutData.some(workout => {
      return this.workoutSessions.some(session => {
        return session.date.toDateString() === date.toDateString();
      });
    });
  }

  isWorkoutCompleted(date) {
    // Check if the workout for the given date is completed
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? session.completed : false;
  }

  isWorkoutMissed(date) {
    // Check if the workout for the given date is missed
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? !session.completed : false;
  }

  getWorkoutForDate(date) {
    // Get the workout details for a specific date
    const session = this.workoutSessions.find(session => session.date.toDateString() === date.toDateString());
    return session ? this.workoutData.find(workout => workout.id === session.workoutId) : null;
  }

  onDayClick(date) {
    // Handle the event when a day is clicked
    const workout = this.getWorkoutForDate(new Date(date));
    if (workout) {
      this.navigation.navigateToWorkoutDetail(workout.id);
    }
  }
}