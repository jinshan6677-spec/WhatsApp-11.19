const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('测试激活码生成和验证流程...\n');

// 读取密钥
const privateKey = fs.readFileSync(path.join(__dirname, 'admin', 'privateKey.pem'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, 'src', 'activation', 'crypto', 'publicKey.pem'), 'utf8');

console.log('✓ 密钥加载成功\n');

// 模拟管理后台生成激活码
console.log('=== 管理后台生成激活码 ===');
const id = `TEST-${Date.now()}`;
const codeData = {
  id,
  maxDevices: 3,
  validDays: 30,
  createdAt: new Date().toISOString(),
  notes: '测试备注'
};

console.log('1. 签名数据:', JSON.stringify(codeData, null, 2));

const dataString = JSON.stringify(codeData);
console.log('2. 数据字符串:', dataString);

const sign = crypto.createSign('SHA256');
sign.update(dataString);
sign.end();
const signature = sign.sign(privateKey, 'base64');

console.log('3. 签名结果:', signature.substring(0, 50) + '...');

const fullCode = {
  ...codeData,
  signature
};

const base64Code = Buffer.from(JSON.stringify(fullCode)).toString('base64');
console.log('4. Base64激活码:', base64Code.substring(0, 100) + '...\n');

// 模拟客户端验证激活码
console.log('=== 客户端验证激活码 ===');

// 1. 解析激活码
const parsedData = JSON.parse(Buffer.from(base64Code, 'base64').toString('utf8'));
console.log('1. 解析数据:', JSON.stringify(parsedData, null, 2));

// 2. 验证签名（问题在这里！）
const verifyData = {
  id: parsedData.id,
  maxDevices: parsedData.maxDevices,
  validDays: parsedData.validDays,
  createdAt: parsedData.createdAt
  // 注意：这里没有包含 notes 字段！
};

console.log('2. 验证数据（不包含notes）:', JSON.stringify(verifyData, null, 2));

const verify = crypto.createVerify('SHA256');
verify.update(JSON.stringify(verifyData));
verify.end();
const isValid = verify.verify(publicKey, signature, 'base64');

console.log('3. 验证结果:', isValid);

if (!isValid) {
  console.log('\n✗ 签名验证失败！');
  console.log('原因：签名时包含 notes 字段，但验证时没有包含 notes 字段');
  console.log('解决方案：验证时也要包含 notes 字段\n');

  // 测试包含 notes 的验证
  console.log('=== 测试包含 notes 的验证 ===');
  const verifyDataWithNotes = {
    id: parsedData.id,
    maxDevices: parsedData.maxDevices,
    validDays: parsedData.validDays,
    createdAt: parsedData.createdAt,
    notes: parsedData.notes
  };

  console.log('验证数据（包含notes）:', JSON.stringify(verifyDataWithNotes, null, 2));

  const verify2 = crypto.createVerify('SHA256');
  verify2.update(JSON.stringify(verifyDataWithNotes));
  verify2.end();
  const isValid2 = verify2.verify(publicKey, signature, 'base64');

  console.log('验证结果:', isValid2);
  if (isValid2) {
    console.log('✓ 包含 notes 字段后验证成功！');
  }
} else {
  console.log('\n✓ 签名验证成功！');
}