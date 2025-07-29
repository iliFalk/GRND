/**
 * ExerciseEditor Component
 * Full-screen modal for editing exercise details with image upload
 */

import { Exercise } from '../models/Exercise.js';

export class ExerciseEditor {
    constructor(container, apiService, navigationService) {
        this.container = container;
        this.apiService = apiService;
        this.navigationService = navigationService;
        this.exercise = null;
        this.day = null;
        this.week = null;
        this.plan = null;
        this.isLoading = false;
        this.isSaving = false;
        this.isUploading = false;
        this.error = null;

        this.init();
    }

    init() {
        this.render();
    }

    setExercise(exercise, day, week, plan) {
        this.exercise = exercise ? new Exercise(exercise) : new Exercise();
        this.day = day;
        this.week = week;
        this.plan = plan;
        this.render();
    }

    async handleSave() {
        if (this.isSaving) return;

        const formData = this.getFormData();
        if (!this.validateForm(formData)) {
            return;
        }

        this.setSaving(true, null);

        try {
            // Update exercise with form data
            Object.assign(this.exercise, formData);

            // Add to day if new exercise
            if (!this.exercise.id) {
                this.exercise.id = Date.now().toString();
                this.day.exercises.push(this.exercise);
            }

            // Navigate back to day editor
            this.navigationService.navigateTo('day-editor', {
                day: this.day,
                week: this.week,
                plan: this.plan
            });
        } catch (error) {
            console.error('Failed to save exercise:', error);
            this.setSaving(false, 'Failed to save exercise. Please try again.');
        }
    }

    handleCancel() {
        this.navigationService.navigateTo('day-editor', {
            day: this.day,
            week: this.week,
            plan: this.plan
        });
    }

    async handleImageUpload(file) {
        if (!file || this.isUploading) return;

        this.setUploading(true, null);

        try {
            const result = await this.apiService.uploadImage(file);
            this.exercise.imageUrl = result.url;
            this.render();
        } catch (error) {
            console.error('Failed to upload image:', error);
            this.setUploading(false, 'Failed to upload image. Please try again.');
        }
    }

    handleImageSearch() {
        // This would integrate with Unsplash API
        // For now, we'll show a placeholder
        alert('Image search functionality will be implemented with Unsplash API');
    }

    handleImageUrlChange(url) {
        this.exercise.imageUrl = url;
        this.render();
    }

    getFormData() {
        const form = this.container.querySelector('.exercise-form');
        const type = form.querySelector('#exercise-type').value;

        const data = {
            name: form.querySelector('#exercise-name').value,
            description: form.querySelector('#exercise-description').value,
            type: type,
            muscleGroups: form.querySelector('#exercise-muscle-groups').value
                .split(',')
                .map(m => m.trim())
                .filter(m => m),
            equipment: form.querySelector('#exercise-equipment').value,
            instructions: form.querySelector('#exercise-instructions').value,
            videoUrl: form.querySelector('#exercise-video').value,
            imageUrl: this.exercise.imageUrl || ''
        };

        // Exercise parameters based on type
        if (type === 'strength') {
            data.sets = parseInt(form.querySelector('#exercise-sets').value) || 0;
            data.reps = parseInt(form.querySelector('#exercise-reps').value) || 0;
            data.weight = parseFloat(form.querySelector('#exercise-weight').value) || 0;
            data.restTime = parseInt(form.querySelector('#exercise-rest').value) || 60;
        } else if (type === 'cardio') {
            data.duration = parseInt(form.querySelector('#exercise-duration').value) || 0;
            data.distance = parseFloat(form.querySelector('#exercise-distance').value) || 0;
        } else if (type === 'flexibility') {
            data.duration = parseInt(form.querySelector('#exercise-duration').value) || 0;
        }

        // Circuit-specific fields
        if (this.day && this.day.type === 'Circuit') {
            data.circuitOrder = parseInt(form.querySelector('#circuit-order').value) || 0;
            data.circuitRounds = parseInt(form.querySelector('#circuit-rounds').value) || 1;
        }

        return data;
    }

    validateForm(data) {
        if (!data.name.trim()) {
            this.setError('Exercise name is required');
            return false;
        }
        if (data.type === 'strength' && (data.sets <= 0 || data.reps <= 0)) {
            this.setError('Sets and reps must be greater than 0 for strength exercises');
            return false;
        }
        return true;
    }

    setSaving(isSaving, error = null) {
        this.isSaving = isSaving;
        this.error = error;
        this.render();
    }

    setUploading(isUploading, error = null) {
        this.isUploading = isUploading;
        this.error = error;
        this.render();
    }

    setError(message) {
        this.error = message;
        this.render();
    }

    renderImageSection() {
        return `
            <div class="image-section">
                <h4>Exercise Image</h4>
                <div class="image-upload-container">
                    ${this.exercise.imageUrl ? `
                        <div class="image-preview">
                            <img src="${this.exercise.imageUrl}" alt="${this.exercise.name}" />
                            <button type="button" class="btn-icon remove-image-btn" title="Remove image">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    ` : `
                        <div class="image-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <p>No image selected</p>
                        </div>
                    `}

                    <div class="image-actions">
                        <input type="file" id="image-upload" accept="image/*" style="display: none;">
                        <button type="button" class="btn-secondary upload-btn" ${this.isUploading ? 'disabled' : ''}>
                            ${this.isUploading ? 'Uploading...' : 'Upload Image'}
                        </button>
                        <button type="button" class="btn-secondary search-btn">
                            Search Unsplash
                        </button>
                    </div>

                    <div class="image-url-input">
                        <label for="image-url">Or enter image URL</label>
                        <input type="url" id="image-url" value="${this.exercise.imageUrl || ''}" 
                               placeholder="https://example.com/image.jpg">
                    </div>
                </div>
            </div>
        `;
    }

    renderExerciseParameters() {
        const type = this.exercise.type || 'strength';

        if (type === 'strength') {
            return `
                <div class="exercise-parameters">
                    <h4>Exercise Parameters</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="exercise-sets">Sets</label>
                            <input type="number" id="exercise-sets" value="${this.exercise.sets || 3}" min="1" max="10">
                        </div>
                        <div class="form-group">
                            <label for="exercise-reps">Reps</label>
                            <input type="number" id="exercise-reps" value="${this.exercise.reps || 10}" min="1" max="100">
                        </div>
                        <div class="form-group">
                            <label for="exercise-weight">Weight (lbs)</label>
                            <input type="number" id="exercise-weight" value="${this.exercise.weight || 0}" min="0" step="0.5">
                        </div>
                        <div class="form-group">
                            <label for="exercise-rest">Rest (seconds)</label>
                            <input type="number" id="exercise-rest" value="${this.exercise.restTime || 60}" min="0" max="300">
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'cardio') {
            return `
                <div class="exercise-parameters">
                    <h4>Exercise Parameters</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="exercise-duration">Duration (seconds)</label>
                            <input type="number" id="exercise-duration" value="${this.exercise.duration || 60}" min="1">
                        </div>
                        <div class="form-group">
                            <label for="exercise-distance">Distance (miles)</label>
                            <input type="number" id="exercise-distance" value="${this.exercise.distance || 0}" min="0" step="0.1">
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="exercise-parameters">
                    <h4>Exercise Parameters</h4>
                    <div class="form-group">
                        <label for="exercise-duration">Duration (seconds)</label>
                        <input type="number" id="exercise-duration" value="${this.exercise.duration || 30}" min="1">
                    </div>
                </div>
            `;
        }
    }

    renderCircuitFields() {
        if (!this.day || this.day.type !== 'Circuit') return '';
        
        return `
            <div class="circuit-fields">
                <h4>Circuit Settings</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="circuit-order">Exercise Order</label>
                        <input type="number" id="circuit-order" value="${this.exercise.circuitOrder || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="circuit-rounds">Rounds in Circuit</label>
                        <input type="number" id="circuit-rounds" value="${this.exercise.circuitRounds || 1}" min="1">
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        this.container.innerHTML = `
            <div class="exercise-editor-overlay">
                <div class="exercise-editor-modal">
                    <div class="exercise-editor-header">
                        <h2>${this.exercise.id ? 'Edit Exercise' : 'Add New Exercise'}</h2>
                        <button class="close-btn" title="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div class="exercise-editor-content">
                        ${this.error ? `
                            <div class="error-message">
                                ${this.error}
                            </div>
                        ` : ''}

                        <form class="exercise-form">
                            <div class="form-group">
                                <label for="exercise-name">Exercise Name *</label>
                                <input type="text" id="exercise-name" value="${this.exercise.name || ''}" required>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="exercise-type">Type</label>
                                    <select id="exercise-type">
                                        <option value="strength" ${this.exercise.type === 'strength' ? 'selected' : ''}>Strength</option>
                                        <option value="cardio" ${this.exercise.type === 'cardio' ? 'selected' : ''}>Cardio</option>
                                        <option value="flexibility" ${this.exercise.type === 'flexibility' ? 'selected' : ''}>Flexibility</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="exercise-equipment">Equipment</label>
                                    <input type="text" id="exercise-equipment" value="${this.exercise.equipment || ''}" 
                                           placeholder="e.g., Barbell, Dumbbell, Bodyweight">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="exercise-muscle-groups">Muscle Groups</label>
                                <input type="text" id="exercise-muscle-groups" value="${this.exercise.muscleGroups.join(', ') || ''}" 
                                       placeholder="e.g., Chest, Triceps, Shoulders">
                            </div>

                            <div class="form-group">
                                <label for="exercise-description">Description</label>
                                <textarea id="exercise-description" rows="3">${this.exercise.description || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label for="exercise-instructions">Instructions</label>
                                <textarea id="exercise-instructions" rows="4" 
                                          placeholder="Step-by-step instructions...">${this.exercise.instructions || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label for="exercise-video">Video URL</label>
                                <input type="url" id="exercise-video" value="${this.exercise.videoUrl || ''}" 
                                       placeholder="https://youtube.com/watch?v=...">
                            </div>

                            ${this.renderExerciseParameters()}
                            ${this.renderCircuitFields()}
                            ${this.renderImageSection()}
                        </form>
                    </div>

                    <div class="exercise-editor-footer">
                        <button type="button" class="btn-secondary cancel-btn">Cancel</button>
                        <button type="button" class="btn-primary save-btn" ${this.isSaving ? 'disabled' : ''}>
                            ${this.isSaving ? 'Saving...' : 'Save Exercise'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.addEventListeners();
    }

    addEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.handleCancel());

        // Cancel button
        const cancelBtn = this.container.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => this.handleCancel());

        // Save button
        const saveBtn = this.container.querySelector('.save-btn');
        saveBtn.addEventListener('click', () => this.handleSave());

        // Exercise type change
        const exerciseTypeSelect = this.container.querySelector('#exercise-type');
        exerciseTypeSelect.addEventListener('change', () => this.render());

        // Image upload
        const uploadBtn = this.container.querySelector('.upload-btn');
        const fileInput = this.container.querySelector('#image-upload');

        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageUpload(file);
            }
        });

        // Image search
        const searchBtn = this.container.querySelector('.search-btn');
        searchBtn.addEventListener('click', () => this.handleImageSearch());

        // Image URL change
        const imageUrlInput = this.container.querySelector('#image-url');
        imageUrlInput.addEventListener('change', (e) => {
            this.handleImageUrlChange(e.target.value);
        });

        // Remove image
        const removeImageBtn = this.container.querySelector('.remove-image-btn');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                this.exercise.imageUrl = '';
                this.render();
            });
        }

        // Close on overlay click
        const overlay = this.container.querySelector('.exercise-editor-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.handleCancel();
            }
        });
    }
}