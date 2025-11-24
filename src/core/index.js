/**
 * 核心模块统一导出
 * 
 * 提供所有核心模块的统一导入接口
 */

const managers = require('./managers');
const models = require('./models');
const services = require('./services');

module.exports = {
  managers,
  models,
  services
};
