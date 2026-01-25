const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * RSA签名和验证工具
 */
class Signature {
  /**
   * 生成RSA密钥对
   * @returns {object} { publicKey, privateKey }
   */
  static generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  /**
   * 使用私钥签名数据
   * @param {object} data - 要签名的数据对象
   * @param {string} privateKey - RSA私钥
   * @returns {string} Base64编码的签名
   */
  static sign(data, privateKey) {
    const dataString = JSON.stringify(data);
    const sign = crypto.createSign('SHA256');
    sign.update(dataString);
    sign.end();
    const signature = sign.sign(privateKey, 'base64');
    return signature;
  }

  /**
   * 使用公钥验证签名
   * @param {object} data - 原始数据对象
   * @param {string} signature - Base64编码的签名
   * @param {string} publicKey - RSA公钥
   * @returns {boolean} 签名是否有效
   */
  static verify(data, signature, publicKey) {
    try {
      const dataString = JSON.stringify(data);
      const verify = crypto.createVerify('SHA256');
      verify.update(dataString);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * 获取内置公钥（用于客户端验证）
   * @returns {string} 公钥
   */
  static getPublicKey() {
    try {
      const publicKeyPath = path.join(__dirname, 'publicKey.pem');
      if (fs.existsSync(publicKeyPath)) {
        return fs.readFileSync(publicKeyPath, 'utf8');
      }
      throw new Error('Public key file not found');
    } catch (error) {
      console.error('Failed to load public key:', error);
      throw error;
    }
  }

  /**
   * 保存密钥对到文件
   * @param {object} keyPair - 密钥对
   * @param {string} dir - 保存目录
   */
  static saveKeyPair(keyPair, dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(dir, 'privateKey.pem'),
      keyPair.privateKey,
      'utf8'
    );

    fs.writeFileSync(
      path.join(dir, 'publicKey.pem'),
      keyPair.publicKey,
      'utf8'
    );
  }
}

module.exports = Signature;