/**
 * ImageService
 * Handles Unsplash API integration for exercise images
 */

export class ImageService {
    constructor(accessKey = 'YOUR_UNSPLASH_ACCESS_KEY') {
        this.accessKey = accessKey;
        this.baseUrl = 'https://api.unsplash.com';
        this.cache = new Map();
    }

    async searchExerciseImages(query, count = 5) {
        const cacheKey = `${query}_${count}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=squarish`,
                {
                    headers: {
                        'Authorization': `Client-ID ${this.accessKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch images from Unsplash');
            }

            const data = await response.json();
            const images = data.results.map(img => ({
                id: img.id,
                url: img.urls.regular,
                thumbnail: img.urls.thumb,
                small: img.urls.small,
                author: img.user.name,
                authorUrl: img.user.links.html,
                description: img.description || img.alt_description
            }));

            // Cache the results
            this.cache.set(cacheKey, images);
            return images;

        } catch (error) {
            console.error('Error fetching exercise images:', error);
            return this.getFallbackImages(query);
        }
    }

    async getExerciseImage(exerciseName) {
        const images = await this.searchExerciseImages(exerciseName, 1);
        return images.length > 0 ? images[0] : null;
    }

    getFallbackImages(query) {
        // Return fallback images when API fails
        const exerciseImageMap = {
            'squat': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
            'bench press': 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400',
            'deadlift': 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=400',
            'pull up': 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400',
            'push up': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
            'plank': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
            'running': 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400',
            'cycling': 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=400',
            'yoga': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400'
        };

        const lowerQuery = query.toLowerCase();
        const matchingKey = Object.keys(exerciseImageMap).find(key => 
            lowerQuery.includes(key)
        );

        return [{
            id: 'fallback',
            url: matchingKey ? exerciseImageMap[matchingKey] : 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
            thumbnail: matchingKey ? exerciseImageMap[matchingKey] : 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
            small: matchingKey ? exerciseImageMap[matchingKey] : 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
            author: 'GRND',
            authorUrl: '#',
            description: `Exercise: ${query}`
        }];
    }

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    async preloadExerciseImages(exercises) {
        const promises = exercises.map(exercise => 
            this.preloadImage(exercise.imageUrl || this.getFallbackImages(exercise.name)[0].url)
        );
        
        return Promise.allSettled(promises);
    }
}