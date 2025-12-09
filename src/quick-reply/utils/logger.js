/**
 * Logger Utility
 * 
 * Provides logging functionality with different log levels.
 */

const fs = require('fs').promises;
const path = require('path');

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
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Logger class
 */
class Logger {
  /**
   * Creates a new Logger instance
   * @param {string} module - Module name for logging context
   * @param {number} minLevel - Minimum log level (default: INFO)
   */
  constructor(module, minLevel = LOG_LEVELS.INFO) {
    this.module = module;
    this.minLevel = minLevel;
    this.logFile = null;
    this.enableFileLogging = false;
  }

  /**
   * Enables file logging
   * @param {string} fileName - Log file name (optional)
   */
  async enableFile(fileName = 'quick-reply.log') {
    try {
      const userDataPath = app.getPath('userData');
      const logDir = path.join(userDataPath, 'logs');
      
      // Ensure log directory exists
      await fs.mkdir(logDir, { recursive: true });
      
      this.logFile = path.join(logDir, fileName);
      this.enableFileLogging = true;
    } catch (error) {
      console.error('Failed to enable file logging:', error);
    }
  }

  /**
   * Disables file logging
   */
  disableFile() {
    this.enableFileLogging = false;
    this.logFile = null;
  }

  /**
   * Formats a log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {*} data - Additional data
   * @returns {string} - Formatted message
   */
  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${this.module}] ${level}: ${message}${dataStr}`;
  }

  /**
   * Writes log to file
   * @param {string} formattedMessage - Formatted log message
   */
  async writeToFile(formattedMessage) {
    if (!this.enableFileLogging || !this.logFile) {
      return;
    }

    try {
      await fs.appendFile(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Logs a message at the specified level
   * @param {number} level - Log level
   * @param {string} levelName - Log level name
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  log(level, levelName, message, data) {
    if (level < this.minLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, data);

    // Console output
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(formattedMessage);
        break;
      case LOG_LEVELS.INFO:
        console.log(formattedMessage);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedMessage);
        break;
      case LOG_LEVELS.ERROR:
        console.error(formattedMessage);
        break;
    }

    // File output (async, don't wait)
    this.writeToFile(formattedMessage);
  }

  /**
   * Logs a debug message
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  debug(message, data) {
    this.log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
  }

  /**
   * Logs an info message
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  info(message, data) {
    this.log(LOG_LEVELS.INFO, 'INFO', message, data);
  }

  /**
   * Logs a warning message
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  warn(message, data) {
    this.log(LOG_LEVELS.WARN, 'WARN', message, data);
  }

  /**
   * Logs an error message
   * @param {string} message - Log message
   * @param {Error|*} error - Error object or additional data
   */
  error(message, error) {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    
    this.log(LOG_LEVELS.ERROR, 'ERROR', message, errorData);
  }

  /**
   * Sets the minimum log level
   * @param {number} level - Minimum log level
   */
  setLevel(level) {
    this.minLevel = level;
  }

  /**
   * Creates a child logger with a sub-module name
   * @param {string} subModule - Sub-module name
   * @returns {Logger} - Child logger
   */
  child(subModule) {
    const childLogger = new Logger(`${this.module}:${subModule}`, this.minLevel);
    childLogger.enableFileLogging = this.enableFileLogging;
    childLogger.logFile = this.logFile;
    return childLogger;
  }
}

/**
 * Creates a logger instance
 * @param {string} module - Module name
 * @param {number} minLevel - Minimum log level
 * @returns {Logger} - Logger instance
 */
function createLogger(module, minLevel) {
  return new Logger(module, minLevel);
}

/**
 * Gets the appropriate log level for the current environment
 * @returns {number} - Log level
 */
function getDefaultLogLevel() {
  if (process.env.NODE_ENV === 'development') {
    return LOG_LEVELS.DEBUG;
  }
  if (process.env.NODE_ENV === 'test') {
    return LOG_LEVELS.WARN;
  }
  return LOG_LEVELS.INFO;
}

module.exports = {
  Logger,
  LOG_LEVELS,
  createLogger,
  getDefaultLogLevel
};
