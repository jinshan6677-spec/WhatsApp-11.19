const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 激活码生成器
 * 使用私钥生成带签名的激活码
 */

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    maxDevices: 3,
    validDays: 365,  // 默认365天
    permanent: false,
    count: 1
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--max-devices' || arg === '-m') {
      params.maxDevices = parseInt(args[++i]);
    } else if (arg === '--days' || arg === '-d') {
      params.validDays = parseInt(args[++i]);
    } else if (arg === '--permanent' || arg === '-p') {
      params.permanent = true;
    } else if (arg === '--count' || arg === '-c') {
      params.count = parseInt(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--expire' || arg === '-e') {
      // 兼容旧的 --expire 参数，转换为天数
      const expireDate = new Date(args[++i]);
      const today = new Date();
      const diffTime = expireDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        params.validDays = diffDays;
      }
    }
  }

  return params;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
激活码生成器 - 使用说明

用法: node activation-code-generator.js [选项]

选项:
  -m, --max-devices <数量>    最大设备数（默认: 3）
  -d, --days <天数>          有效天数（默认: 365）
  -e, --expire <日期>        过期日期（兼容旧版本，自动转换为天数）
  -p, --permanent            永久激活（不过期）
  -c, --count <数量>         生成激活码数量（默认: 1）
  -h, --help                 显示帮助信息

示例:
  # 生成1年有效期激活码（最多3台设备）
  node activation-code-generator.js --days 365

  # 生成3个月有效期激活码（最多5台设备）
  node activation-code-generator.js --days 90 --max-devices 5

  # 生成永久激活码（最多3台设备）
  node activation-code-generator.js --permanent

  # 批量生成10个激活码
  node activation-code-generator.js --days 365 --count 10

注意:
  - 需要先运行 key-generator.js 生成密钥对
  - 私钥文件必须存在于 admin/privateKey.pem
  - 生成的激活码可以离线使用
  - 有效期从首次激活时间开始计算
  - 即使用户修改系统时间也无法绕过过期限制
`);
}

/**
 * 生成激活码
 * @param {object} params - 激活码参数
 * @returns {string} 激活码
 */
function generateActivationCode(params) {
  // 读取私钥
  const privateKeyPath = path.join(__dirname, 'privateKey.pem');
  
  if (!fs.existsSync(privateKeyPath)) {
    console.error('错误: 私钥文件不存在！');
    console.error('请先运行: node key-generator.js');
    process.exit(1);
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // 生成唯一ID
  const id = 'ACT-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  // 准备激活数据（使用相对时间）
  const activationData = {
    id,
    maxDevices: params.maxDevices,
    validDays: params.permanent ? null : params.validDays,  // 有效天数
    createdAt: new Date().toISOString()
  };

  // 计算签名
  const dataToSign = {
    id: activationData.id,
    maxDevices: activationData.maxDevices,
    validDays: activationData.validDays,
    createdAt: activationData.createdAt
  };

  const dataString = JSON.stringify(dataToSign);
  const sign = crypto.createSign('SHA256');
  sign.update(dataString);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');

  // 添加签名到激活数据
  activationData.signature = signature;

  // 转换为Base64编码的激活码
  const activationCode = Buffer.from(JSON.stringify(activationData)).toString('base64');

  return activationCode;
}

/**
 * 格式化激活码（每32个字符换行）
 * @param {string} code - 激活码
 * @returns {string} 格式化后的激活码
 */
function formatActivationCode(code) {
  const chunkSize = 64;
  const chunks = [];
  
  for (let i = 0; i < code.length; i += chunkSize) {
    chunks.push(code.substring(i, i + chunkSize));
  }
  
  return chunks.join('\n');
}

/**
 * 主函数
 */
function main() {
  console.log('========================================');
  console.log('      激活码生成器');
  console.log('========================================\n');

  // 解析参数
  const params = parseArgs();

  // 验证参数
  if (!params.permanent && (!params.validDays || params.validDays < 1)) {
    console.error('错误: 必须指定有效天数或使用 --permanent 选项');
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }

  if (params.maxDevices < 1 || params.maxDevices > 100) {
    console.error('错误: 设备数量必须在 1-100 之间');
    process.exit(1);
  }

  if (params.count < 1 || params.count > 1000) {
    console.error('错误: 生成数量必须在 1-1000 之间');
    process.exit(1);
  }

  // 显示配置
  console.log('激活码配置:');
  console.log('  最大设备数:', params.maxDevices);
  console.log('  有效天数:', params.permanent ? '永久' : params.validDays + '天');
  console.log('  生成数量:', params.count);
  console.log('');

  // 生成激活码
  const activationCodes = [];
  for (let i = 0; i < params.count; i++) {
    const code = generateActivationCode(params);
    activationCodes.push(code);
  }

  // 显示结果
  console.log('✓ 激活码生成成功！\n');
  
  if (params.count === 1) {
    console.log('激活码:');
    console.log('--------');
    console.log(formatActivationCode(activationCodes[0]));
    console.log('--------\n');
  } else {
    console.log('生成的激活码:');
    console.log('--------');
    activationCodes.forEach((code, index) => {
      console.log(`激活码 #${index + 1}:`);
      console.log(formatActivationCode(code));
      console.log('');
    });
    console.log('--------\n');
  }

  // 保存到文件
  const outputPath = path.join(__dirname, 'activation-codes.txt');
  const outputContent = activationCodes.map((code, index) => {
    if (params.count === 1) {
      return formatActivationCode(code);
    } else {
      return `激活码 #${index + 1}:\n${formatActivationCode(code)}`;
    }
  }).join('\n\n');

  fs.writeFileSync(outputPath, outputContent, 'utf8');
  console.log('✓ 激活码已保存到:', outputPath);

  // 显示统计信息
  console.log('\n统计信息:');
  console.log('  生成数量:', params.count);
  console.log('  每个激活码最大设备数:', params.maxDevices);
  console.log('  总可用设备数:', params.count * params.maxDevices);
  console.log('  有效期:', params.permanent ? '永久' : params.validDays + '天（从首次激活开始计算）');
  console.log('\n========================================\n');
}

// 运行
try {
  main();
} catch (error) {
  console.error('生成激活码失败:', error);
  process.exit(1);
}