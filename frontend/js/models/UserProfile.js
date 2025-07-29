/**
 * UserProfile Model
 * Represents a user's profile with bodyweight information
 */
export class UserProfile {
    constructor(data = {}) {
        this.userId = data.userId || null;
        this.bodyweight = data.bodyweight || 0; // in kg
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    }

    validate() {
        if (!this.userId || typeof this.userId !== 'string') {
            throw new Error('userId is required and must be a string');
        }

        if (typeof this.bodyweight !== 'number' || isNaN(this.bodyweight) ||
            this.bodyweight < 30 || this.bodyweight > 300) {
            throw new Error('bodyweight is required and must be a number between 30 and 300');
        }

        return true;
    }

    toJSON() {
        return {
            userId: this.userId,
            bodyweight: this.bodyweight,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    static fromJSON(data) {
        return new UserProfile(data);
    }
}