"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionUtil = void 0;
const crypto_1 = require("crypto");
class EncryptionUtil {
    static getKey() {
        const envKey = process.env.ENCRYPTION_KEY;
        if (!envKey) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }
        return (0, crypto_1.scryptSync)(envKey, 'ai-agent-team-salt', this.KEY_LENGTH);
    }
    static encrypt(text) {
        try {
            const key = this.getKey();
            const iv = (0, crypto_1.randomBytes)(this.IV_LENGTH);
            const cipher = (0, crypto_1.createCipheriv)(this.ALGORITHM, key, iv);
            let encrypted = cipher.update(text, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            const authTag = cipher.getAuthTag();
            return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
        }
        catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
    static decrypt(encryptedData) {
        try {
            const key = this.getKey();
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            const iv = Buffer.from(parts[0], 'base64');
            const authTag = Buffer.from(parts[1], 'base64');
            const encrypted = parts[2];
            if (iv.length !== this.IV_LENGTH) {
                throw new Error('Invalid IV length');
            }
            if (authTag.length !== this.AUTH_TAG_LENGTH) {
                throw new Error('Invalid auth tag length');
            }
            const decipher = (0, crypto_1.createDecipheriv)(this.ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    static encryptMany(keys) {
        return keys.map(key => this.encrypt(key));
    }
    static decryptMany(encryptedKeys) {
        return encryptedKeys.map(key => this.decrypt(key));
    }
}
exports.EncryptionUtil = EncryptionUtil;
EncryptionUtil.ALGORITHM = 'aes-256-gcm';
EncryptionUtil.IV_LENGTH = 16;
EncryptionUtil.AUTH_TAG_LENGTH = 16;
EncryptionUtil.KEY_LENGTH = 32;
exports.default = EncryptionUtil;
//# sourceMappingURL=encryption.util.js.map