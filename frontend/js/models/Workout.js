/**
 * Workout Model
 * Represents a workout definition (name, color, description, etc.)
 */
export class Workout {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    // Color property for UI components (calendar, planner).
    // Defaults to a generic blue (#4A90E2) if not provided.
    this.color = data.color || "#4A90E2";
    // Optional metadata
    this.duration = data.duration || 0;
    this.category = data.category || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      color: this.color,
      duration: this.duration,
      category: this.category
    };
  }

  static fromJSON(data) {
    return new Workout(data);
  }
}


// TODO: Update WorkoutEditor component to include UI for modifying the 'color' property.
