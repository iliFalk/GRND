/**
 * Workout Editor
 * Basic UI for creating/editing a workout, including color picker
 */
export default class WorkoutEditor {
  constructor(container, initialData = {}, onSubmit) {
    this.container = container;
    // Read color from workout model, default to #4A90E2 if not provided
    this.data = Object.assign({ id: null, name: '', description: '', color: '#4A90E2' }, initialData);
    this.onSubmit = onSubmit || (() => {});
    this.render();
  }

  render() {
    // Use the color from the workout model or default to #4A90E2
    const colorValue = this.data.color || '#4A90E2';
    // Escape helper
    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
    this.container.innerHTML = `
      <form id="workout-form" class="workout-editor">
        <div class="field">
          <label for="workout-name">Name</label>
          <input type="text" id="workout-name" value="${esc(this.data.name)}" required />
        </div>
        <div class="field">
          <label for="workout-description">Description</label>
          <textarea id="workout-description" rows="3">${esc(this.data.description)}</textarea>
        </div>
        <div class="field">
          <label for="workout-color">Color</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="color" id="workout-color" value="${colorValue}" />
            <!-- Color preview circle that reflects the currently selected color -->
            <div id="color-preview" style="width: 24px; height: 24px; border-radius: 50%; background: ${colorValue}; border: 1px solid #ccc;"></div>
          </div>
        </div>
        <div class="field">
          <button type="submit">Save Workout</button>
        </div>
      </form>
    `;
    
    // Add event listener to update color preview when color changes
    const colorInput = this.container.querySelector('#workout-color');
    const colorPreview = this.container.querySelector('#color-preview');
    colorInput.addEventListener('input', (e) => {
      colorPreview.style.background = e.target.value;
    });
    
    const form = this.container.querySelector('#workout-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const payloadColor = this.container.querySelector('#workout-color').value;
      const payload = {
        id: this.data.id,
        name: this.container.querySelector('#workout-name').value.trim(),
        description: this.container.querySelector('#workout-description').value.trim(),
        // Write color back to the workout model
        color: payloadColor
      };
      // The color property is persisted via the existing save flow (onSubmit callback)
      // and must match the Workout model's color field
      this.onSubmit(payload);
    });
  }
}