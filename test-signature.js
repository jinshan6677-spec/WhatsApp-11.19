const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('测试签名算法...\n');

// 读取私钥和公钥
const privateKeyPath = path.join(__dirname, 'admin', 'privateKey.pem');
const publicKeyPath = path.join(__dirname, 'src', 'activation', 'crypto', 'publicKey.pem');

console.log('私钥路径:', privateKeyPath);
console.log('公钥路径:', publicKeyPath);

if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ 私钥文件不存在');
  process.exit(1);
}

if (!fs.existsSync(publicKeyPath)) {
  console.error('❌ 公钥文件不存在');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

console.log('✓ 密钥文件加载成功\n');

// 测试数据
const testData = {
  id: 'TEST-ACTIVATION-CODE',
  maxDevices: 3,
  validDays: 30,
  createdAt: new Date().toISOString()
};

console.log('测试数据:', JSON.stringify(testData, null, 2));

// 客户端签名方式（SHA256, base64）
const dataString = JSON.stringify(testData);
console.log('\n数据字符串:', dataString);

const sign = crypto.createSign('SHA256');
sign.update(dataString);
sign.end();
const signature = sign.sign(privateKey, 'base64');

console.log('签名结果:', signature);
console.log('签名长度:', signature.length);

// 创建完整激活码
const fullCode = {
  ...testData,
  signature
};

const base64Code = Buffer.from(JSON.stringify(fullCode)).toString('base64');
console.log('\nBase64激活码:', base64Code.substring(0, 100) + '...');

// 验证签名（客户端验证方式）
console.log('\n开始验证签名...');

try {
  // 解析激活码
  const parsedData = JSON.parse(Buffer.from(base64Code, 'base64').toString('utf8'));
  console.log('解析数据:', JSON.stringify(parsedData, null, 2));

  // 验证签名
  const verify = crypto.createVerify('SHA256');
  verify.update(dataString);
  verify.end();
  const isValid = verify.verify(publicKey, signature, 'base64');

  console.log('\n✓ 验证结果:', isValid);

  if (isValid) {
    console.log('\n✓ 签名算法匹配，激活码格式正确');
  } else {
    console.log('\n✗ 签名验证失败');
  }

} catch (error) {
  console.error('\n✗ 验证过程出错:', error.message);
  console.error('堆栈:', error.stack);
}