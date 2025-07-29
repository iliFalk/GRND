/**
 * WorkoutHistory Component
 * Displays user's workout history with filtering and search capabilities
 */

export class WorkoutHistory {
  constructor(container, apiService, storageService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.storage = storageService;
    this.navigation = navigationService;
    this.workouts = [];
    this.filteredWorkouts = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.isLoading = false;
    this.cacheKey = 'workout_history';
    
    // Filter and search state
    this.filters = {
      dateRange: 'all', // all, week, month, custom
      startDate: null,
      endDate: null,
      searchQuery: ''
    };
    
    // Performance metrics
    this.volumeTrends = [];
    this.personalRecords = [];
    this.consistencyMetrics = {};
  }

  async init() {
    this.render();
    await this.loadWorkouts();
  }

  render() {
    this.container.innerHTML = `
      <div class="workout-history">
        <!-- Header with title and controls -->
        <div class="history-header">
          <h2>Workout History</h2>
          <div class="history-controls">
            <button class="btn-secondary" id="export-csv-btn">Export CSV</button>
          </div>
        </div>
        
        <!-- Filter and search controls -->
        <div class="history-filters">
          <div class="filter-group">
            <select id="date-range-filter">
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
            
            <div class="custom-date-range hidden" id="custom-date-range">
              <input type="date" id="start-date" placeholder="Start Date">
              <input type="date" id="end-date" placeholder="End Date">
              <button id="apply-date-range">Apply</button>
            </div>
          </div>
          
          <div class="search-group">
            <input type="text" id="search-input" placeholder="Search workouts...">
            <button id="search-btn">Search</button>
          </div>
        </div>
        
        <!-- Stats summary -->
        <div class="stats-summary card">
          <div class="stat-item">
            <h4>Total Workouts</h4>
            <p class="stat-value">${this.workouts.length}</p>
          </div>
          <div class="stat-item">
            <h4>Avg. Volume</h4>
            <p class="stat-value">${this.getAverageVolume()} kg</p>
          </div>
          <div class="stat-item">
            <h4>Consistency</h4>
            <p class="stat-value">${this.getConsistencyRate()}%</p>
          </div>
        </div>
        
        <!-- Volume trend chart -->
        <div class="volume-trend card">
          <h3>Volume Trend</h3>
          <div class="chart-container" id="volume-chart">
            <!-- Chart will be rendered here -->
          </div>
        </div>
        
        <!-- Workout list -->
        <div class="workout-list">
          ${this.isLoading ? `
            <div class="loading">
              <div class="spinner"></div>
              <p>Loading workout history...</p>
            </div>
          ` : this.filteredWorkouts.length > 0 ? `
            ${this.renderWorkoutList()}
            ${this.workouts.length > this.itemsPerPage ? `
              <div class="pagination">
                <button id="prev-page" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
                <span>Page ${this.currentPage} of ${Math.ceil(this.filteredWorkouts.length / this.itemsPerPage)}</span>
                <button id="next-page" ${this.currentPage >= Math.ceil(this.filteredWorkouts.length / this.itemsPerPage) ? 'disabled' : ''}>Next</button>
              </div>
            ` : ''}
          ` : `
            <div class="empty-state">
              <p>No workout history found.</p>
              ${this.filters.searchQuery || this.filters.dateRange !== 'all' ? `
                <button id="clear-filters">Clear Filters</button>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;
    
    this.attachEventListeners();
  }

  renderWorkoutList() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const workoutsToShow = this.filteredWorkouts.slice(startIndex, endIndex);
    
    return `
      ${workoutsToShow.map(workout => this.renderWorkoutCard(workout)).join('')}
    `;
  }

  renderWorkoutCard(workout) {
    const workoutDate = new Date(workout.startTime);
    const formattedDate = workoutDate.toLocaleDateString();
    const formattedTime = workoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check if this workout has any PRs
    const hasPRs = this.personalRecords.some(pr => pr.workoutId === workout.id);
    
    return `
      <div class="workout-card card" data-workout-id="${workout.id}">
        <div class="workout-header">
          <div class="workout-info">
            <h3>${workout.day?.name || 'Workout'}</h3>
            <p class="workout-date">${formattedDate} at ${formattedTime}</p>
          </div>
          <div class="workout-stats">
            <span class="duration">${workout.formattedDuration || '0:00'}</span>
            <span class="volume">${workout.totalVolume || 0} kg</span>
          </div>
        </div>
        
        <div class="workout-details">
          <div class="exercises-summary">
            <h4>Exercises (${workout.totalSets || 0} sets)</h4>
            ${workout.day?.exercises ? `
              <ul>
                ${workout.day.exercises.slice(0, 3).map(exercise => `
                  <li>${exercise.name} - ${exercise.completedSets || 0} sets</li>
                `).join('')}
                ${workout.day.exercises.length > 3 ? `
                  <li>+${workout.day.exercises.length - 3} more exercises</li>
                ` : ''}
              </ul>
            ` : `
              <p>No exercises recorded</p>
            `}
          </div>
          
          ${hasPRs ? `
            <div class="pr-indicator">
              <span class="pr-badge">PR</span>
              <span>New personal record achieved!</span>
            </div>
          ` : ''}
        </div>
        
        <div class="workout-actions">
          <button class="btn-secondary view-details" data-workout-id="${workout.id}">View Details</button>
          <button class="btn-secondary delete-workout" data-workout-id="${workout.id}">Archive</button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Date range filter
    const dateRangeFilter = this.container.querySelector('#date-range-filter');
    if (dateRangeFilter) {
      dateRangeFilter.addEventListener('change', (e) => {
        this.filters.dateRange = e.target.value;
        if (e.target.value === 'custom') {
          this.container.querySelector('#custom-date-range').classList.remove('hidden');
        } else {
          this.container.querySelector('#custom-date-range').classList.add('hidden');
          this.applyFilters();
        }
      });
    }
    
    // Custom date range apply
    const applyDateRangeBtn = this.container.querySelector('#apply-date-range');
    if (applyDateRangeBtn) {
      applyDateRangeBtn.addEventListener('click', () => {
        const startDate = this.container.querySelector('#start-date').value;
        const endDate = this.container.querySelector('#end-date').value;
        
        if (startDate && endDate) {
          this.filters.startDate = new Date(startDate);
          this.filters.endDate = new Date(endDate);
          this.applyFilters();
        }
      });
    }
    
    // Search functionality
    const searchInput = this.container.querySelector('#search-input');
    const searchBtn = this.container.querySelector('#search-btn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.searchQuery = e.target.value;
        // Debounce search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.applyFilters();
        }, 300);
      });
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.applyFilters();
      });
    }
    
    // View details buttons
    const viewDetailButtons = this.container.querySelectorAll('.view-details');
    viewDetailButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const workoutId = e.target.dataset.workoutId;
        this.viewWorkoutDetails(workoutId);
      });
    });
    
    // Delete/archive buttons
    const deleteButtons = this.container.querySelectorAll('.delete-workout');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const workoutId = e.target.dataset.workoutId;
        this.archiveWorkout(workoutId);
      });
    });
    
    // Export CSV button
    const exportBtn = this.container.querySelector('#export-csv-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToCSV();
      });
    }
    
    // Pagination buttons
    const prevBtn = this.container.querySelector('#prev-page');
    const nextBtn = this.container.querySelector('#next-page');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(this.filteredWorkouts.length / this.itemsPerPage);
        if (this.currentPage < maxPage) {
          this.currentPage++;
          this.render();
        }
      });
    }
    
    // Clear filters button
    const clearFiltersBtn = this.container.querySelector('#clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }
  }

  async loadWorkouts() {
    this.isLoading = true;
    this.render();
    
    try {
      // Try to get from cache first
      const cachedData = await this.storage.getCache(this.cacheKey);
      if (cachedData) {
        this.workouts = cachedData;
        this.filteredWorkouts = [...this.workouts];
        this.isLoading = false;
        this.render();
        return;
      }
      
      // Get current user ID
      const user = await this.storage.getItem('user');
      if (!user) {
        throw new Error('User not found');
      }
      
      // Fetch workout sessions
      const sessions = await this.api.getWorkoutSessions(user.id, {
        limit: 100 // Fetch a reasonable number of recent workouts
      });
      
      this.workouts = sessions.map(session => {
        // Ensure session has proper structure
        return {
          id: session.id,
          userId: session.userId,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          totalVolume: session.totalVolume || 0,
          totalSets: session.totalSets || 0,
          totalReps: session.totalReps || 0,
          day: session.day || null,
          formattedDuration: this.formatDuration(session.duration)
        };
      });
      
      this.filteredWorkouts = [...this.workouts];
      
      // Cache the data
      await this.storage.setCache(this.cacheKey, this.workouts, 300000); // 5 minutes cache
      
      // Calculate performance metrics
      this.calculatePerformanceMetrics();
    } catch (error) {
      console.error('Failed to load workout history:', error);
      // Show error state
      this.container.innerHTML = `
        <div class="error-state">
          <p>Failed to load workout history. Please try again later.</p>
          <button id="retry-load">Retry</button>
        </div>
      `;
      
      const retryBtn = this.container.querySelector('#retry-load');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.loadWorkouts();
        });
      }
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  applyFilters() {
    this.currentPage = 1; // Reset to first page when filters change
    
    let filtered = [...this.workouts];
    
    // Apply date range filter
    if (this.filters.dateRange === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filtered = filtered.filter(workout => new Date(workout.startTime) >= oneWeekAgo);
    } else if (this.filters.dateRange === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      filtered = filtered.filter(workout => new Date(workout.startTime) >= oneMonthAgo);
    } else if (this.filters.dateRange === 'custom' && this.filters.startDate && this.filters.endDate) {
      filtered = filtered.filter(workout => {
        const workoutDate = new Date(workout.startTime);
        return workoutDate >= this.filters.startDate && workoutDate <= this.filters.endDate;
      });
    }
    
    // Apply search filter
    if (this.filters.searchQuery) {
      const query = this.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(workout => {
        // Search in workout name
        const nameMatch = workout.day?.name && workout.day.name.toLowerCase().includes(query);
        
        // Search in exercise names
        const exerciseMatch = workout.day?.exercises && workout.day.exercises.some(exercise => 
          exercise.name && exercise.name.toLowerCase().includes(query)
        );
        
        // Search in date
        const dateMatch = workout.startTime && new Date(workout.startTime).toLocaleDateString().includes(query);
        
        return nameMatch || exerciseMatch || dateMatch;
      });
    }
    
    this.filteredWorkouts = filtered;
    this.render();
  }

  clearFilters() {
    this.filters = {
      dateRange: 'all',
      startDate: null,
      endDate: null,
      searchQuery: ''
    };
    
    // Reset UI elements
    const dateRangeFilter = this.container.querySelector('#date-range-filter');
    if (dateRangeFilter) {
      dateRangeFilter.value = 'all';
    }
    
    const searchInput = this.container.querySelector('#search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.container.querySelector('#custom-date-range').classList.add('hidden');
    
    this.filteredWorkouts = [...this.workouts];
    this.currentPage = 1;
    this.render();
  }

  calculatePerformanceMetrics() {
    // Calculate volume trends (weekly)
    this.volumeTrends = this.calculateVolumeTrends();
    
    // Identify personal records
    this.personalRecords = this.identifyPersonalRecords();
    
    // Calculate consistency metrics
    this.consistencyMetrics = this.calculateConsistencyMetrics();
    
    // Render the volume trend chart
    this.renderVolumeChart();
  }

  calculateVolumeTrends() {
    // Group workouts by week and calculate total volume per week
    const weeklyVolumes = {};
    
    this.workouts.forEach(workout => {
      if (workout.startTime && workout.totalVolume) {
        const workoutDate = new Date(workout.startTime);
        // Get week start (Monday)
        const weekStart = new Date(workoutDate);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyVolumes[weekKey]) {
          weeklyVolumes[weekKey] = 0;
        }
        weeklyVolumes[weekKey] += workout.totalVolume;
      }
    });
    
    // Convert to array and sort by date
    return Object.entries(weeklyVolumes)
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  identifyPersonalRecords() {
    const prs = [];
    
    // Group exercises by name
    const exerciseGroups = {};
    
    this.workouts.forEach(workout => {
      if (workout.day?.exercises) {
        workout.day.exercises.forEach(exercise => {
          if (!exerciseGroups[exercise.name]) {
            exerciseGroups[exercise.name] = [];
          }
          exerciseGroups[exercise.name].push({
            workoutId: workout.id,
            exercise,
            date: workout.startTime
          });
        });
      }
    });
    
    // For each exercise, find the max volume
    Object.entries(exerciseGroups).forEach(([exerciseName, records]) => {
      let maxVolume = 0;
      let prWorkoutId = null;
      
      records.forEach(record => {
        const volume = record.exercise.totalVolume || 0;
        if (volume > maxVolume) {
          maxVolume = volume;
          prWorkoutId = record.workoutId;
        }
      });
      
      if (prWorkoutId) {
        prs.push({
          exerciseName,
          workoutId: prWorkoutId,
          volume: maxVolume
        });
      }
    });
    
    return prs;
  }

  calculateConsistencyMetrics() {
    if (this.workouts.length === 0) {
      return {
        totalWorkouts: 0,
        weeklyAverage: 0,
        streak: 0
      };
    }
    
    // Calculate total workouts
    const totalWorkouts = this.workouts.length;
    
    // Calculate weekly average (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const recentWorkouts = this.workouts.filter(workout => 
      new Date(workout.startTime) >= fourWeeksAgo
    );
    
    const weeklyAverage = recentWorkouts.length / 4;
    
    // Calculate current streak
    let streak = 0;
    const sortedWorkouts = [...this.workouts].sort((a, b) => 
      new Date(b.startTime) - new Date(a.startTime)
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentDate = today;
    let hasWorkoutToday = sortedWorkouts.some(workout => {
      const workoutDate = new Date(workout.startTime);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate.getTime() === currentDate.getTime();
    });
    
    if (hasWorkoutToday) {
      streak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Continue checking previous days
      while (true) {
        const hasWorkout = sortedWorkouts.some(workout => {
          const workoutDate = new Date(workout.startTime);
          workoutDate.setHours(0, 0, 0, 0);
          return workoutDate.getTime() === currentDate.getTime();
        });
        
        if (hasWorkout) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    
    return {
      totalWorkouts,
      weeklyAverage: weeklyAverage.toFixed(1),
      streak
    };
  }

  renderVolumeChart() {
    const chartContainer = this.container.querySelector('#volume-chart');
    if (!chartContainer || this.volumeTrends.length === 0) return;
    
    // Simple bar chart implementation
    const maxVolume = Math.max(...this.volumeTrends.map(t => t.volume));
    const chartHeight = 150;
    const barWidth = 30;
    const barSpacing = 10;
    
    let chartHTML = `
      <div class="chart" style="height: ${chartHeight}px; position: relative;">
    `;
    
    this.volumeTrends.forEach((trend, index) => {
      const barHeight = maxVolume > 0 ? (trend.volume / maxVolume) * (chartHeight - 20) : 0;
      const xPos = index * (barWidth + barSpacing);
      
      chartHTML += `
        <div class="chart-bar" style="
          position: absolute;
          bottom: 0;
          left: ${xPos}px;
          width: ${barWidth}px;
          height: ${barHeight}px;
          background-color: var(--accent-color);
          border-radius: 4px 4px 0 0;
        " title="${trend.date}: ${trend.volume}kg">
          <div class="bar-label" style="
            position: absolute;
            top: -20px;
            left: 0;
            width: 100%;
            text-align: center;
            font-size: 10px;
          ">${trend.volume}</div>
        </div>
      `;
    });
    
    chartHTML += `</div>`;
    
    // Add date labels
    chartHTML += `
      <div class="chart-labels" style="display: flex; justify-content: space-between; margin-top: 10px;">
        ${this.volumeTrends.map(trend => {
          const date = new Date(trend.date);
          return `<span style="font-size: 10px;">${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>`;
        }).join('')}
      </div>
    `;
    
    chartContainer.innerHTML = chartHTML;
  }

  getAverageVolume() {
    if (this.workouts.length === 0) return 0;
    
    const totalVolume = this.workouts.reduce((sum, workout) => sum + (workout.totalVolume || 0), 0);
    return Math.round(totalVolume / this.workouts.length);
  }

  getConsistencyRate() {
    if (this.workouts.length === 0) return 0;
    
    // Simple calculation based on workouts in the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const recentWorkouts = this.workouts.filter(workout => 
      new Date(workout.startTime) >= oneMonthAgo
    );
    
    // Assuming 4 workouts per week as target
    const expectedWorkouts = 16; // 4 weeks * 4 workouts
    const rate = Math.min(100, Math.round((recentWorkouts.length / expectedWorkouts) * 100));
    
    return rate;
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  viewWorkoutDetails(workoutId) {
    // Navigate to workout details view
    this.navigation.navigateTo('workout-detail', { workoutId });
  }

  async archiveWorkout(workoutId) {
    if (!confirm('Are you sure you want to archive this workout?')) {
      return;
    }
    
    try {
      // In a real implementation, we would call an API to archive the workout
      // For now, we'll just remove it from the local list
      this.workouts = this.workouts.filter(workout => workout.id !== workoutId);
      this.filteredWorkouts = this.filteredWorkouts.filter(workout => workout.id !== workoutId);
      
      // Update cache
      await this.storage.setCache(this.cacheKey, this.workouts, 300000);
      
      // Re-render
      this.render();
      
      console.log(`Workout ${workoutId} archived`);
    } catch (error) {
      console.error('Failed to archive workout:', error);
      alert('Failed to archive workout. Please try again.');
    }
  }

  exportToCSV() {
    try {
      // Create CSV content
      let csvContent = 'Date,Workout,Duration,Volume,Sets,Reps\n';
      
      this.filteredWorkouts.forEach(workout => {
        const date = new Date(workout.startTime).toLocaleDateString();
        const name = workout.day?.name || 'Workout';
        const duration = workout.formattedDuration || '0:00';
        const volume = workout.totalVolume || 0;
        const sets = workout.totalSets || 0;
        const reps = workout.totalReps || 0;
        
        csvContent += `"${date}","${name}","${duration}",${volume},${sets},${reps}\n`;
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `workout_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Workout history exported to CSV');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export workout history. Please try again.');
    }
  }

  // Method to refresh data
  async refresh() {
    await this.loadWorkouts();
  }
}