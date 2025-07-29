/**
 * GRND Telegram Mini App
 * Main application entry point
 */

import { GRNDApp } from './components/GRNDApp.js';
import { StorageService } from './services/StorageService.js';
import { PlanList } from './components/PlanList.js';
import { PlanEditor } from './components/PlanEditor.js';
import { DayEditor } from './components/DayEditor.js';
import { ExerciseEditor } from './components/ExerciseEditor.js';

// Make components globally available
window.PlanList = PlanList;
window.PlanEditor = PlanEditor;
window.DayEditor = DayEditor;
window.ExerciseEditor = ExerciseEditor;

// Initialize Telegram Web App
let tg = null;

try {
    tg = window.Telegram.WebApp;
    console.log('Telegram Web App initialized:', tg);
} catch (error) {
    console.warn('Telegram Web App not available:', error);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('GRND App initializing...');

    // Initialize storage service
    const storageService = new StorageService();

    // Create main app instance
    const app = new GRNDApp(tg, storageService);

    // Initialize the app
    await app.init();

    // Make app globally available for debugging
    window.grndApp = app;

    console.log('GRND App initialized successfully');
});

// Handle Telegram Web App events
if (tg) {
    tg.ready();

    tg.onEvent('viewportChanged', (event) => {
        console.log('Viewport changed:', event);
    });

    tg.onEvent('themeChanged', (event) => {
        console.log('Theme changed:', event);
        document.body.className = tg.colorScheme;
    });

    // Set initial theme
    document.body.className = tg.colorScheme || 'light';
}