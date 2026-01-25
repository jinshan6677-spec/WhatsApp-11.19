const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * RSA密钥对生成工具
 * 用于生成管理后台的私钥和客户端的公钥
 */
function generateKeyPair() {
  console.log('正在生成RSA密钥对...\n');

  // 生成密钥对
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

  // 确保admin目录存在
  const adminDir = path.join(__dirname);
  if (!fs.existsSync(adminDir)) {
    fs.mkdirSync(adminDir, { recursive: true });
  }

  // 保存私钥（管理后台使用，严格保密）
  const privateKeyPath = path.join(adminDir, 'privateKey.pem');
  fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
  console.log('✓ 私钥已保存到:', privateKeyPath);
  console.log('⚠️  请妥善保管私钥文件，不要泄露给任何人！\n');

  // 保存公钥（客户端使用，可以公开）
  const publicKeyPath = path.join(adminDir, 'publicKey.pem');
  fs.writeFileSync(publicKeyPath, publicKey, 'utf8');
  console.log('✓ 公钥已保存到:', publicKeyPath);
  console.log('✓ 公钥需要复制到客户端的 src/activation/crypto/ 目录下\n');

  // 复制公钥到客户端目录
  const clientPublicKeyPath = path.join(__dirname, '..', 'src', 'activation', 'crypto', 'publicKey.pem');
  const clientCryptoDir = path.dirname(clientPublicKeyPath);
  
  if (!fs.existsSync(clientCryptoDir)) {
    fs.mkdirSync(clientCryptoDir, { recursive: true });
  }
  
  fs.writeFileSync(clientPublicKeyPath, publicKey, 'utf8');
  console.log('✓ 公钥已自动复制到客户端目录:', clientPublicKeyPath);
  console.log('✓ 客户端现在可以使用这个公钥验证激活码了\n');

  console.log('密钥对生成完成！');
  console.log('========================================');
  console.log('私钥路径:', privateKeyPath);
  console.log('公钥路径:', publicKeyPath);
  console.log('客户端公钥路径:', clientPublicKeyPath);
  console.log('========================================\n');
}

// 运行生成器
try {
  generateKeyPair();
} catch (error) {
  console.error('生成密钥对失败:', error);
  process.exit(1);
}