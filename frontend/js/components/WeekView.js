/**
 * WeekView Component
 * Shows a vertical list of days for a selected week and allows editing dayType and navigating to DayEditor.
 */

export class WeekView {
  constructor(container, apiService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.navigation = navigationService;
    this.week = null;
    this.plan = null;
  }

  init(week, plan) {
    this.week = week || null;
    this.plan = plan || null;
    this.render();
  }

  render() {
    if (!this.container) return;

    const planName = this.plan ? (this.plan.name || this.plan.plan_name || 'Plan') : 'Plan';
    const weekName = this.week ? (this.week.name || `Week ${this.week.weekNumber}`) : 'Week';
    const days = (this.week && Array.isArray(this.week.days)) ? this.week.days : [];

    this.container.innerHTML = `
      <div class="week-view">
        <div class="week-header">
          <button class="btn-secondary back-to-weeks">Back</button>
          <h2>${this.escapeHtml(planName)} — ${this.escapeHtml(weekName)}</h2>
          <div class="week-actions">
            <button class="btn-primary add-day-block-btn">Add Block</button>
          </div>
        </div>

        <div class="days-list">
          ${days.map((d, idx) => this.renderDayCard(d, idx)).join('')}
        </div>
      </div>
    `;

    this.addEventListeners();
  }

  renderDayCard(day, index) {
    const blocksCount = (Array.isArray(day.blocks) ? day.blocks.length : 0);
    const dayType = day.dayType || day.day_type || 'Rest';
    const dayLabel = day.dayOfWeek || day.day_name || `Day ${index + 1}`;

    return `
      <div class="day-card" data-day-index="${index}" role="region" aria-label="${this.escapeHtml(dayLabel)}">
        <div class="day-card-left">
          <h4 class="day-name">${this.escapeHtml(dayLabel)}</h4>
          <div class="day-meta">
            <span class="day-type">${this.escapeHtml(dayType)}</span>
            <span class="day-blocks">${blocksCount} block${blocksCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="day-card-right">
          <select class="day-type-select" data-day-index="${index}" aria-label="Day type for ${this.escapeHtml(dayLabel)}">
            <option value="Rest" ${dayType === 'Rest' ? 'selected' : ''}>Rest</option>
            <option value="Workout" ${dayType === 'Workout' ? 'selected' : ''}>Workout</option>
            <option value="Play Training" ${dayType === 'Play Training' ? 'selected' : ''}>Play Training</option>
          </select>
          <button class="btn-secondary edit-day-btn" data-day-index="${index}" title="Edit Day">Edit</button>
        </div>
      </div>
    `;
  }

  addEventListeners() {
    // Back button
    const backBtn = this.container.querySelector('.back-to-weeks');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.navigation && typeof this.navigation.navigateTo === 'function') {
          this.navigation.navigateTo('plan-editor', { plan: this.plan });
        }
      });
    }

    // Add block (opens DayEditor for the first Workout day or prompts to select a day)
    const addBlockBtn = this.container.querySelector('.add-day-block-btn');
    if (addBlockBtn) {
      addBlockBtn.addEventListener('click', () => {
        // Prefer to open the first Workout day; if none, open first day
        let targetDay = null;
        if (Array.isArray(this.week.days)) {
          targetDay = this.week.days.find(d => (d.dayType === 'Workout' || d.day_type === 'Workout'));
          if (!targetDay) targetDay = this.week.days[0];
        }
        if (targetDay && this.navigation && typeof this.navigation.navigateTo === 'function') {
          this.navigation.navigateTo('day-editor', { day: targetDay, week: this.week, plan: this.plan });
        }
      });
    }

    // Handle day-type select changes
    const selects = this.container.querySelectorAll('.day-type-select');
    selects.forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.dayIndex, 10);
        const newType = e.target.value;
        this.updateDayType(idx, newType);
      });
    });

    // Edit day buttons
    const editBtns = this.container.querySelectorAll('.edit-day-btn');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.dayIndex, 10);
        const day = this.week.days[idx];
        if (this.navigation && typeof this.navigation.navigateTo === 'function') {
          this.navigation.navigateTo('day-editor', { day, week: this.week, plan: this.plan });
        }
      });
    });
  }

  updateDayType(dayIndex, newType) {
    if (!this.week || !Array.isArray(this.week.days) || !this.week.days[dayIndex]) return;
    const day = this.week.days[dayIndex];

    // Update local model
    day.dayType = newType;
    // Also support legacy key
    day.day_type = newType;

    // Re-render current view to reflect change
    this.render();

    // Optional: persist change via API if plan has id and backend supports day updates.
    // For now, only client-side update is performed. Future: call PUT /api/days/:id
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }
}
