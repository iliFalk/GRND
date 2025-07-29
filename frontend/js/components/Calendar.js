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
    
    // Create calendar header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    let calendarHTML = `
      <div class="calendar-header">
        <button class="nav-btn" id="prev-month"><</button>
        <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
        <button class="nav-btn" id="next-month">></button>
        <button class="today-btn" id="today-btn">Today</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-header">Mon</div>
        <div class="calendar-day-header">Tue</div>
        <div class="calendar-day-header">Wed</div>
        <div class="calendar-day-header">Thu</div>
        <div class="calendar-day-header">Fri</div>
        <div class="calendar-day-header">Sat</div>
        <div class="calendar-day-header">Sun</div>
    `;
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayIndex; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isWorkoutDay = this.isWorkoutScheduled(date);
      const isCompleted = this.isWorkoutCompleted(date);
      const isMissed = this.isWorkoutMissed(date);
      
      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (isWorkoutDay) dayClass += ' workout-day';
      if (isCompleted) dayClass += ' completed';
      if (isMissed) dayClass += ' missed';
      
      const workout = this.getWorkoutForDate(date);
      
      calendarHTML += `
        <div class="${dayClass}" data-date="${date.toISOString().split('T')[0]}" title="${workout ? workout.name : ''}">
          <div class="day-number">${day}</div>
          ${isWorkoutDay ? '<div class="workout-indicator"></div>' : ''}
          ${isCompleted ? '<div class="completion-indicator">✓</div>' : ''}
          ${isMissed ? '<div class="missed-indicator"></div>' : ''}
        </div>
      `;
    }
    
    calendarHTML += '</div>';
    
    this.container.innerHTML = calendarHTML;
    this.addEventListeners();
    this.addTouchListeners();
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
    
    // Day click events
    const dayElements = this.container.querySelectorAll('.calendar-day:not(.empty)');
    dayElements.forEach(dayElement => {
      dayElement.addEventListener('click', (e) => {
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
    // In a real implementation, this would check against the user's workout plan
    // For now, we'll simulate some workout days
    const dayOfWeek = date.getDay();
    // Simulate workouts on Monday, Wednesday, and Friday
    return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
  }
  
  getWorkoutForDate(date) {
    // In a real implementation, this would return the actual workout for the date
    // For now, we'll return a mock workout
    if (this.isWorkoutScheduled(date)) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 1) {
        return { name: 'Upper Body Strength', type: 'strength' };
      } else if (dayOfWeek === 3) {
        return { name: 'Lower Body Power', type: 'strength' };
      } else if (dayOfWeek === 5) {
        return { name: 'Cardio & Core', type: 'cardio' };
      }
    }
    return null;
  }

  isWorkoutCompleted(date) {
    // Check if workout was completed on this date
    return this.workoutSessions.some(session => 
      session.date.toDateString() === date.toDateString() && session.completed
    );
  }

  isWorkoutMissed(date) {
    // Check if workout was missed (scheduled but not completed and in the past)
    const today = new Date();
    return this.isWorkoutScheduled(date) && 
           !this.isWorkoutCompleted(date) && 
           date < today;
  }

  onDayClick(date) {
    // Handle day click event
    console.log('Day clicked:', date);
    // In a real implementation, this might show workout details or navigate to workout view
  }

  // Method to update calendar with new data
  async updateData() {
    await this.fetchWorkoutData();
    this.render();
  }

  // Method to navigate to a specific date
  goToToday() {
    this.currentDate = new Date();
    this.render();
  }

  // Method to navigate to a specific month
  goToMonth(year, month) {
    this.currentDate = new Date(year, month, 1);
    this.render();
  }
}