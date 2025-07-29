/**
 * ImageUploader Component
 * Reusable image upload component with file upload and Unsplash search
 */

export class ImageUploader {
    constructor(container, apiService, options = {}) {
        this.container = container;
        this.apiService = apiService;
        this.options = {
            maxFileSize: options.maxFileSize || 5 * 1024 * 1024, // 5MB
            allowedTypes: options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'],
            onImageSelect: options.onImageSelect || (() => {}),
            onError: options.onError || (() => {}),
            ...options
        };
        
        this.isUploading = false;
        this.isSearching = false;
        this.searchResults = [];
        this.selectedImage = null;
        
        this.init();
    }

    init() {
        this.render();
    }

    async handleFileUpload(file) {
        if (!file) return;

        // Validate file
        if (!this.validateFile(file)) {
            return;
        }

        this.isUploading = true;
        this.render();

        try {
            const result = await this.apiService.uploadImage(file);
            this.selectedImage = result.url;
            this.options.onImageSelect(this.selectedImage);
            this.render();
        } catch (error) {
            console.error('Failed to upload image:', error);
            this.options.onError('Failed to upload image. Please try again.');
        } finally {
            this.isUploading = false;
            this.render();
        }
    }

    async handleUnsplashSearch(query) {
        if (!query.trim()) {
            this.searchResults = [];
            this.render();
            return;
        }

        this.isSearching = true;
        this.render();

        try {
            // This would integrate with Unsplash API
            // For now, we'll simulate search results
            this.searchResults = await this.simulateUnsplashSearch(query);
        } catch (error) {
            console.error('Failed to search images:', error);
            this.options.onError('Failed to search images. Please try again.');
            this.searchResults = [];
        } finally {
            this.isSearching = false;
            this.render();
        }
    }

    async simulateUnsplashSearch(query) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return mock results
        return [
            {
                id: '1',
                url: `https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80&fit=crop`,
                description: `${query} exercise demonstration`,
                photographer: 'Photo 1'
            },
            {
                id: '2',
                url: `https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=80&fit=crop`,
                description: `${query} workout image`,
                photographer: 'Photo 2'
            },
            {
                id: '3',
                url: `https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80&fit=crop`,
                description: `${query} training photo`,
                photographer: 'Photo 3'
            }
        ];
    }

    validateFile(file) {
        if (!this.options.allowedTypes.includes(file.type)) {
            this.options.onError('Invalid file type. Please upload JPEG, PNG, or WebP images.');
            return false;
        }

        if (file.size > this.options.maxFileSize) {
            this.options.onError('File too large. Maximum size is 5MB.');
            return false;
        }

        return true;
    }

    handleImageSelect(url) {
        this.selectedImage = url;
        this.options.onImageSelect(url);
        this.render();
    }

    handleRemoveImage() {
        this.selectedImage = null;
        this.searchResults = [];
        this.options.onImageSelect(null);
        this.render();
    }

    renderSearchResult(result) {
        return `
            <div class="search-result" data-url="${result.url}">
                <img src="${result.url}" alt="${result.description}" loading="lazy">
                <div class="result-overlay">
                    <button class="select-btn">Select</button>
                </div>
                <div class="result-info">
                    <span class="photographer">by ${result.photographer}</span>
                </div>
            </div>
        `;
    }

    render() {
        this.container.innerHTML = `
            <div class="image-uploader">
                <div class="upload-section">
                    <h4>Upload Image</h4>
                    <div class="upload-zone">
                        <input type="file" id="file-upload" accept="image/*" style="display: none;">
                        <div class="upload-prompt">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <p>Drag & drop or <button type="button" class="upload-link">browse</button> to upload</p>
                            <small>JPEG, PNG, WebP up to 5MB</small>
                        </div>
                    </div>
                </div>

                <div class="search-section">
                    <h4>Search Unsplash</h4>
                    <div class="search-input">
                        <input type="text" id="search-query" placeholder="Search for exercise images...">
                        <button type="button" class="search-btn" ${this.isSearching ? 'disabled' : ''}>
                            ${this.isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                    
                    ${this.isSearching ? `
                        <div class="search-loading">
                            <div class="spinner"></div>
                            <p>Searching images...</p>
                        </div>
                    ` : this.searchResults.length > 0 ? `
                        <div class="search-results">
                            ${this.searchResults.map(result => this.renderSearchResult(result)).join('')}
                        </div>
                    ` : ''}
                </div>

                ${this.selectedImage ? `
                    <div class="selected-image">
                        <h4>Selected Image</h4>
                        <div class="image-preview">
                            <img src="${this.selectedImage}" alt="Selected exercise image">
                            <button type="button" class="btn-icon remove-image-btn" title="Remove image">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        this.addEventListeners();
    }

    addEventListeners() {
        // File upload
        const fileInput = this.container.querySelector('#file-upload');
        const uploadLink = this.container.querySelector('.upload-link');
        const uploadZone = this.container.querySelector('.upload-zone');

        uploadLink.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        });

        // Search
        const searchBtn = this.container.querySelector('.search-btn');
        const searchInput = this.container.querySelector('#search-query');

        searchBtn.addEventListener('click', () => {
            this.handleUnsplashSearch(searchInput.value);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUnsplashSearch(searchInput.value);
            }
        });

        // Search results
        const searchResults = this.container.querySelectorAll('.search-result');
        searchResults.forEach(result => {
            result.addEventListener('click', (e) => {
                const url = e.target.closest('.search-result').dataset.url;
                this.handleImageSelect(url);
            });
        });

        // Remove image
        const removeImageBtn = this.container.querySelector('.remove-image-btn');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => this.handleRemoveImage());
        }
    }
}