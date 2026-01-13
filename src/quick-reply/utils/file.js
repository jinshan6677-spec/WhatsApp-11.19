/**
 * File Handling Utilities
 * 
 * Provides utilities for media file operations including copy, delete, and Base64 encoding/decoding.
 */

const fs = require('fs').promises;
const path = require('path');
const StorageError = require('../errors/StorageError');
const { validateFilePath } = require('./validation');

// Handle electron app in test environment
let app;
try {
  app = require('electron').app;
} catch (error) {
  // Mock app for testing
  app = {
    getPath: (name) => {
      if (process.env.NODE_ENV === 'test') {
        return path.join(__dirname, '../../..', 'test-data');
      }
      return '/tmp';
    }
  };
}

/**
 * Sanitizes an account ID for use in file paths
 * Removes or replaces characters that are invalid in file paths
 * @param {string} accountId - Account ID to sanitize
 * @returns {string} - Sanitized account ID safe for file paths
 */
function sanitizeAccountId(accountId) {
  // Replace any character that's not alphanumeric, dash, or underscore with underscore
  return accountId.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/**
 * Gets the media storage directory for an account
 * @param {string} accountId - Account ID
 * @returns {string} - Media directory path
 */
function getMediaDirectory(accountId) {
  const sanitized = sanitizeAccountId(accountId);
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'quick-reply', sanitized, 'media');
}

/**
 * Ensures the media directory exists
 * @param {string} accountId - Account ID
 * @returns {Promise<string>} - Media directory path
 */
async function ensureMediaDirectory(accountId) {
  const sanitized = sanitizeAccountId(accountId);
  const mediaDir = getMediaDirectory(sanitized);
  
  try {
    await fs.mkdir(mediaDir, { recursive: true });
    return mediaDir;
  } catch (error) {
    throw new StorageError(`无法创建媒体目录: ${error.message}`);
  }
}

/**
 * Copies a media file to storage
 * @param {string} sourcePath - Source file path
 * @param {string} accountId - Account ID
 * @param {string} templateId - Template ID
 * @returns {Promise<string>} - Destination file path (relative)
 */
async function copyMediaFile(sourcePath, accountId, templateId) {
  try {
    // Validate source path
    if (!sourcePath || typeof sourcePath !== 'string') {
      throw new StorageError('源文件路径无效');
    }

    // Check if source file exists
    try {
      await fs.access(sourcePath);
    } catch (error) {
      throw new StorageError('源文件不存在');
    }

    // Ensure media directory exists
    const mediaDir = await ensureMediaDirectory(accountId);

    // Get file extension
    const ext = path.extname(sourcePath);
    const fileName = `${templateId}${ext}`;
    const destPath = path.join(mediaDir, fileName);

    // Copy file
    await fs.copyFile(sourcePath, destPath);

    // Return relative path
    return path.join('media', fileName);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`复制媒体文件失败: ${error.message}`);
  }
}

/**
 * Deletes a media file from storage
 * @param {string} relativePath - Relative file path
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteMediaFile(relativePath, accountId) {
  try {
    if (!relativePath) {
      return false;
    }

    // Validate path
    validateFilePath(relativePath);

    const userDataPath = app.getPath('userData');
    const fullPath = path.join(
      userDataPath,
      'quick-reply',
      accountId,
      relativePath
    );

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      // File doesn't exist, consider it deleted
      return true;
    }

    // Delete file
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, consider it deleted
      return true;
    }
    throw new StorageError(`删除媒体文件失败: ${error.message}`);
  }
}

/**
 * Reads a file and converts it to Base64
 * @param {string} relativePath - Relative file path
 * @param {string} accountId - Account ID
 * @returns {Promise<string>} - Base64 encoded string
 */
async function fileToBase64(relativePath, accountId) {
  try {
    if (!relativePath) {
      throw new StorageError('文件路径不能为空');
    }

    // Validate path
    validateFilePath(relativePath);

    const userDataPath = app.getPath('userData');
    const fullPath = path.join(
      userDataPath,
      'quick-reply',
      accountId,
      relativePath
    );

    // Read file
    const buffer = await fs.readFile(fullPath);
    
    // Convert to Base64
    return buffer.toString('base64');
  } catch (error) {
    throw new StorageError(`读取文件失败: ${error.message}`);
  }
}

/**
 * Converts Base64 string to file
 * @param {string} base64Data - Base64 encoded string
 * @param {string} accountId - Account ID
 * @param {string} templateId - Template ID
 * @param {string} extension - File extension (e.g., '.jpg')
 * @returns {Promise<string>} - Relative file path
 */
async function base64ToFile(base64Data, accountId, templateId, extension) {
  try {
    if (!base64Data) {
      throw new StorageError('Base64数据不能为空');
    }

    // Ensure media directory exists
    const mediaDir = await ensureMediaDirectory(accountId);

    // Create file name
    const fileName = `${templateId}${extension}`;
    const filePath = path.join(mediaDir, fileName);

    // Convert Base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Write file
    await fs.writeFile(filePath, buffer);

    // Return relative path
    return path.join('media', fileName);
  } catch (error) {
    throw new StorageError(`保存Base64文件失败: ${error.message}`);
  }
}

/**
 * Gets the full path of a media file
 * @param {string} relativePath - Relative file path
 * @param {string} accountId - Account ID
 * @returns {string} - Full file path
 */
function getFullMediaPath(relativePath, accountId) {
  if (!relativePath) {
    return null;
  }

  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'quick-reply', accountId, relativePath);
}

/**
 * Checks if a media file exists
 * @param {string} relativePath - Relative file path
 * @param {string} accountId - Account ID
 * @returns {Promise<boolean>} - True if file exists
 */
async function mediaFileExists(relativePath, accountId) {
  try {
    if (!relativePath) {
      return false;
    }

    const fullPath = getFullMediaPath(relativePath, accountId);
    await fs.access(fullPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets file size in bytes
 * @param {string} relativePath - Relative file path
 * @param {string} accountId - Account ID
 * @returns {Promise<number>} - File size in bytes
 */
async function getFileSize(relativePath, accountId) {
  try {
    const fullPath = getFullMediaPath(relativePath, accountId);
    const stats = await fs.stat(fullPath);
    return stats.size;
  } catch (error) {
    throw new StorageError(`获取文件大小失败: ${error.message}`);
  }
}

/**
 * Gets file extension from path
 * @param {string} filePath - File path
 * @returns {string} - File extension (e.g., '.jpg')
 */
function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * Gets MIME type from file extension
 * @param {string} extension - File extension (e.g., '.jpg')
 * @returns {string} - MIME type
 */
function getMimeType(extension) {
  const mimeTypes = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    
    // Audio
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.aac': 'audio/aac',
    
    // Video
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime'
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Cleans up orphaned media files (files without corresponding templates)
 * @param {string} accountId - Account ID
 * @param {Array} templates - Array of template objects
 * @returns {Promise<number>} - Number of files deleted
 */
async function cleanupOrphanedFiles(accountId, templates) {
  try {
    const mediaDir = getMediaDirectory(accountId);

    // Check if directory exists
    try {
      await fs.access(mediaDir);
    } catch (error) {
      // Directory doesn't exist, nothing to clean
      return 0;
    }

    // Get all files in media directory
    const files = await fs.readdir(mediaDir);

    // Get all media paths from templates
    const usedPaths = new Set();
    templates.forEach(template => {
      if (template.content && template.content.mediaPath) {
        const fileName = path.basename(template.content.mediaPath);
        usedPaths.add(fileName);
      }
    });

    // Delete orphaned files
    let deletedCount = 0;
    for (const file of files) {
      if (!usedPaths.has(file)) {
        const filePath = path.join(mediaDir, file);
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    throw new StorageError(`清理孤立文件失败: ${error.message}`);
  }
}

module.exports = {
  sanitizeAccountId,
  getMediaDirectory,
  ensureMediaDirectory,
  copyMediaFile,
  deleteMediaFile,
  fileToBase64,
  base64ToFile,
  getFullMediaPath,
  mediaFileExists,
  getFileSize,
  getFileExtension,
  getMimeType,
  cleanupOrphanedFiles
};
