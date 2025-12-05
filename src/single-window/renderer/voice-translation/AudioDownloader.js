/**
 * 音频下载器
 * 从 blob URL 下载音频数据并转换为所需格式
 */

class AudioDownloader {
    constructor() {
        this.downloadCache = new Map();
        this.sizes = new Map();
        this.maxItems = 32;
        this.maxBytes = 20 * 1024 * 1024;
        this.currentBytes = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }

    /**
     * 从 blob URL 下载音频
     * @param {string} blobUrl - blob URL
     * @returns {Promise<Blob>} 音频 Blob 对象
     */
    async download(blobUrl) {
        // 检查缓存
        if (this.downloadCache.has(blobUrl)) {
            this.cacheHits++;
            const cached = this.downloadCache.get(blobUrl);
            this.downloadCache.delete(blobUrl);
            this.downloadCache.set(blobUrl, cached);
            return cached;
        }
        this.cacheMisses++;

        try {
            console.log('[AudioDownloader] 开始下载音频:', blobUrl);

            const response = await fetch(blobUrl);
            if (!response.ok) {
                throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log('[AudioDownloader] 音频下载成功:', {
                size: blob.size,
                type: blob.type
            });

            this._setCache(blobUrl, blob);

            return blob;
        } catch (error) {
            console.error('[AudioDownloader] 下载音频失败:', error);
            throw new Error(`下载音频失败: ${error.message}`);
        }
    }

    /**
     * 将 Blob 转换为 ArrayBuffer
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<ArrayBuffer>}
     */
    async blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsArrayBuffer(blob);
        });
    }

    /**
     * 将 Blob 转换为 Base64
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<string>} Base64 字符串（不包含 data URL 前缀）
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 将 Blob 转换为 File 对象
     * @param {Blob} blob - Blob 对象
     * @param {string} filename - 文件名
     * @returns {File}
     */
    blobToFile(blob, filename = 'audio.ogg') {
        return new File([blob], filename, { type: blob.type });
    }

    /**
     * 将 Blob 转换为 Data URL
     * @param {Blob} blob - Blob 对象
     * @returns {Promise<string>} Data URL
     */
    async blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('读取 Blob 失败'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 创建音频对象 URL（用于播放）
     * @param {Blob} blob - Blob 对象
     * @returns {string} Object URL
     */
    createObjectURL(blob) {
        return URL.createObjectURL(blob);
    }

    /**
     * 释放音频对象 URL
     * @param {string} objectUrl - Object URL
     */
    revokeObjectURL(objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }

    /**
     * 清除下载缓存
     */
    clearCache() {
        this.downloadCache.clear();
        this.sizes.clear();
        this.currentBytes = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('[AudioDownloader] 缓存已清除');
    }

    /**
     * 获取缓存大小
     * @returns {number}
     */
    getCacheSize() {
        return this.downloadCache.size;
    }

    getStats() {
        return {
            items: this.downloadCache.size,
            bytes: this.currentBytes,
            maxItems: this.maxItems,
            maxBytes: this.maxBytes,
            hitRate: this.cacheHits + this.cacheMisses > 0 ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100) : 0
        };
    }

    _setCache(key, blob) {
        const size = blob && blob.size ? blob.size : 0;
        if (this.downloadCache.has(key)) {
            const oldSize = this.sizes.get(key) || 0;
            this.currentBytes -= oldSize;
            this.downloadCache.delete(key);
            this.sizes.delete(key);
        }
        this.downloadCache.set(key, blob);
        this.sizes.set(key, size);
        this.currentBytes += size;
        this._evictIfNeeded();
    }

    _evictIfNeeded() {
        while (this.downloadCache.size > this.maxItems || this.currentBytes > this.maxBytes) {
            const oldestKey = this.downloadCache.keys().next().value;
            const oldSize = this.sizes.get(oldestKey) || 0;
            this.downloadCache.delete(oldestKey);
            this.sizes.delete(oldestKey);
            this.currentBytes -= oldSize;
        }
    }
}

// Export for browser environment
if (typeof window !== 'undefined') {
    window.AudioDownloader = AudioDownloader;
}
