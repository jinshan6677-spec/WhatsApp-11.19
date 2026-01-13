/**
 * IStorage
 * 
 * Abstract storage interface for data persistence.
 * All storage implementations should extend this class.
 */

class IStorage {
  /**
   * Save data
   * @param {Object} data - Data to save
   * @returns {Promise<Object>} Saved data
   */
  async save(data) {
    throw new Error('save() must be implemented');
  }

  /**
   * Get data by ID
   * @param {string} id - Data ID
   * @returns {Promise<Object>} Retrieved data
   */
  async get(id) {
    throw new Error('get() must be implemented');
  }

  /**
   * Get all data
   * @returns {Promise<Array>} All data
   */
  async getAll() {
    throw new Error('getAll() must be implemented');
  }

  /**
   * Update data
   * @param {string} id - Data ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated data
   */
  async update(id, updates) {
    throw new Error('update() must be implemented');
  }

  /**
   * Delete data
   * @param {string} id - Data ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('delete() must be implemented');
  }
}

module.exports = IStorage;
