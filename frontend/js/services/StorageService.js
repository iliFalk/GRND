/**
 * StorageService
 * Handles local data storage and caching
 */

export class StorageService {
    constructor() {
        this.cache = new Map();
        this.isAvailable = this.checkStorageAvailability();
    }

    checkStorageAvailability() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('Local storage not available:', e);
            return false;
        }
    }

    async setItem(key, value) {
        try {
            const serialized = JSON.stringify(value);
            
            if (this.isAvailable) {
                localStorage.setItem(`grnd_${key}`, serialized);
            }
            
            // Always update cache
            this.cache.set(key, value);
            
            return true;
        } catch (error) {
            console.error('Failed to set item:', error);
            return false;
        }
    }

    async getItem(key) {
        try {
            // Check cache first
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }
            
            if (!this.isAvailable) {
                return null;
            }
            
            const serialized = localStorage.getItem(`grnd_${key}`);
            if (serialized === null) {
                return null;
            }
            
            const value = JSON.parse(serialized);
            this.cache.set(key, value);
            return value;
            
        } catch (error) {
            console.error('Failed to get item:', error);
            return null;
        }
    }

    async removeItem(key) {
        try {
            if (this.isAvailable) {
                localStorage.removeItem(`grnd_${key}`);
            }
            this.cache.delete(key);
            return true;
        } catch (error) {
            console.error('Failed to remove item:', error);
            return false;
        }
    }

    async clear() {
        try {
            if (this.isAvailable) {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('grnd_')) {
                        localStorage.removeItem(key);
                    }
                });
            }
            this.cache.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    }

    async getAllKeys() {
        try {
            if (!this.isAvailable) {
                return Array.from(this.cache.keys());
            }
            
            const keys = Object.keys(localStorage);
            return keys
                .filter(key => key.startsWith('grnd_'))
                .map(key => key.replace('grnd_', ''));
                
        } catch (error) {
            console.error('Failed to get keys:', error);
            return [];
        }
    }

    async setCache(key, value, ttl = 3600000) { // 1 hour default TTL
        const item = {
            value,
            expiry: Date.now() + ttl
        };
        
        await this.setItem(`cache_${key}`, item);
    }

    async getCache(key) {
        const item = await this.getItem(`cache_${key}`);
        
        if (!item) {
            return null;
        }
        
        if (Date.now() > item.expiry) {
            await this.removeItem(`cache_${key}`);
            return null;
        }
        
        return item.value;
    }
}