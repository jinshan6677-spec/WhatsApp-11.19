const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('测试修复后的激活码验证...\n');

// 读取密钥
const privateKey = fs.readFileSync(path.join(__dirname, 'admin', 'privateKey.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, 'src', 'activation', 'crypto', 'publicKey.pem'), 'utf8');

// 模拟管理后台生成激活码
const codeData = {
  id: `FIXED-TEST-${Date.now()}`,
  maxDevices: 3,
  validDays: 30,
  createdAt: new Date().toISOString(),
  notes: '测试备注'
};

const dataString = JSON.stringify(codeData);
const sign = crypto.createSign('SHA256');
sign.update(dataString);
sign.end();
const signature = sign.sign(privateKey, 'base64');

const fullCode = { ...codeData, signature };
const base64Code = Buffer.from(JSON.stringify(fullCode)).toString('base64');

console.log('生成的激活码:', base64Code.substring(0, 100) + '...\n');

// 模拟修复后的客户端验证逻辑
const parsedData = JSON.parse(Buffer.from(base64Code, 'base64').toString('utf8'));

console.log('解析数据:', JSON.stringify(parsedData, null, 2));

// 修复后的验证逻辑
const verifyData = {
  id: parsedData.id,
  maxDevices: parsedData.maxDevices,
  validDays: parsedData.validDays,
  createdAt: parsedData.createdAt
};

// 如果有 notes 字段，也要包含在验证数据中
if (parsedData.notes !== undefined) {
  verifyData.notes = parsedData.notes;
}

console.log('\n验证数据:', JSON.stringify(verifyData, null, 2));

const verify = crypto.createVerify('SHA256');
verify.update(JSON.stringify(verifyData));
verify.end();
const isValid = verify.verify(publicKey, signature, 'base64');

console.log('\n验证结果:', isValid);

if (isValid) {
  console.log('✓ 签名验证成功！修复有效！');
} else {
  console.log('✗ 签名验证失败');
}