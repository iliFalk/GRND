/**
 * WeeksOverview Component
 * Renders a vertical list of weeks for a given plan and allows navigating into a week.
 */

export class WeeksOverview {
  constructor(container, apiService, navigationService) {
    this.container = container;
    this.api = apiService;
    this.navigation = navigationService;
    this.plan = null;
  }

  init(plan) {
    this.plan = plan || null;
    this.render();
  }

  render() {
    if (!this.container) return;
    const planName = this.plan ? (this.plan.name || this.plan.plan_name || 'Plan') : 'Plan';
    const weeks = (this.plan && Array.isArray(this.plan.weeks)) ? this.plan.weeks : [];

    this.container.innerHTML = `
      <div class="weeks-overview">
        <div class="weeks-header">
          <button class="btn-secondary back-to-plans">Back</button>
          <h2>Weeks Overview — ${this.escapeHtml(planName)}</h2>
          <div class="weeks-actions">
            <button class="btn-primary create-week-btn">Add Week</button>
          </div>
        </div>

        <div class="weeks-list">
          ${weeks.map((w, idx) => this.renderWeekCard(w, idx)).join('')}
        </div>
      </div>
    `;

    this.addEventListeners();
  }

  renderWeekCard(week, index) {
    const daysCount = Array.isArray(week.days) ? week.days.length : 0;
    const workouts = (Array.isArray(week.days))
      ? week.days.reduce((acc, d) => acc + ((d.blocks && d.blocks.length) ? d.blocks.length : 0), 0)
      : 0;

    return `
      <div class="week-card" data-week-index="${index}" role="button" tabindex="0">
        <div class="week-card-header">
          <h3>${this.escapeHtml(week.name || `Week ${week.weekNumber || index + 1}`)}</h3>
          <div class="week-card-meta">
            <span>${daysCount} days</span>
            <span>${workouts} workouts</span>
          </div>
        </div>
        <p class="week-card-sub">Week ${week.weekNumber || index + 1}</p>
      </div>
    `;
  }

  addEventListeners() {
    // Back button
    const backBtn = this.container.querySelector('.back-to-plans');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.navigation && typeof this.navigation.navigateTo === 'function') {
          this.navigation.navigateTo('plan-list');
        }
      });
    }

    // Create week (client-only add)
    const createWeekBtn = this.container.querySelector('.create-week-btn');
    if (createWeekBtn) {
      createWeekBtn.addEventListener('click', () => {
        this.createWeek();
      });
    }

    // Click on week card
    const cards = this.container.querySelectorAll('.week-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const idx = parseInt(card.dataset.weekIndex, 10);
        const week = this.plan.weeks[idx];
        if (this.navigation && typeof this.navigation.navigateTo === 'function') {
          this.navigation.navigateTo('week-view', { week, plan: this.plan });
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          card.click();
        }
      });
    });
  }

  createWeek() {
    if (!this.plan) return;
    const newWeekNumber = (this.plan.weeks && this.plan.weeks.length) ? this.plan.weeks.length + 1 : 1;
    const weekId = `w-${Date.now()}`;
    const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const days = daysOfWeek.map((d, i) => ({
      id: `${weekId}-d${i+1}`,
      weekId,
      dayOfWeek: d,
      dayType: 'Rest',
      blocks: []
    }));
    const newWeek = {
      id: weekId,
      planId: this.plan.id || this.plan.plan_id || null,
      weekNumber: newWeekNumber,
      name: `Week ${newWeekNumber}`,
      days
    };

    if (!Array.isArray(this.plan.weeks)) this.plan.weeks = [];
    this.plan.weeks.push(newWeek);

    // Re-render
    this.render();
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
