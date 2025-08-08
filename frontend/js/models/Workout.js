/**
 * Workout Model
 * Represents a workout definition (name, color, description, etc.)
 */
export class Workout {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.color = data.color || null; // hex color assigned to this workout
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
