// QA图片采集插件 - Background Script
// 修复版本：移除重复函数，添加缺失函数，优化逻辑

// =============================================================================
// 工具函数
// =============================================================================

// 调试Blob对象的工具函数
function debugBlob(blob, name) {
  console.log(`${name} 调试信息:`);
  console.log('- 类型:', typeof blob);
  console.log('- instanceof Blob:', blob instanceof Blob);
  console.log('- size:', blob?.size);
  console.log('- type:', blob?.type);
  console.log('- 对象:', blob);
}

// 获取插件设置
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'apiBase',
      'token',
      'categoryID',
      'collectorTypeID', 
      'questionDirectionID',
      'categoryName',
      'collectorTypeName',
      'questionDirectionName',
      'currentTask'
    ], resolve);
  });
}

// 显示通知
// 使用Chrome内置图标
// 禁用通知功能，使用console.log代替
function showNotification(title, message) {
  // 在控制台显示消息，不使用Chrome通知
  console.log(`[${title}] ${message}`);

}

// =============================================================================
// Chrome扩展事件监听器
// =============================================================================

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('QA插件已安装，正在创建右键菜单...');
  chrome.contextMenus.create({
    id: 'downloadAndUploadImage',
    title: '下载并上传图片到数据库',
    contexts: ['image']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('创建右键菜单失败:', chrome.runtime.lastError);
    } else {
      console.log('右键菜单创建成功');
    }
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('右键菜单被点击:', info.menuItemId);
  if (info.menuItemId === 'downloadAndUploadImage') {
    console.log('开始处理图片:', info.srcUrl);
    handleImageDownloadAndUpload(info, tab);
  }
});

// 监听来自popup的消息
// 简化消息监听器，只处理必要的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background收到消息:', request);
  
  // 🎯 只处理真正需要的消息
  if (request.action === 'getImageInfo') {
    // 处理获取图片信息的请求
    sendResponse({ success: true });
  }
  // 移除manualUpload处理，因为popup.js已经直接处理
  
  return false; // 同步响应
});

// =============================================================================
// 主要功能函数
// =============================================================================

// 处理手动上传
async function handleManualUpload(imageUrl) {
  console.log('开始手动上传图片:', imageUrl);
  
  try {
    // 获取设置
    const settings = await getSettings();
    
    // 验证配置
    if (!settings.apiBase || !settings.token) {
      throw new Error('请先在插件设置中配置API地址和Token');
    }
    
    // 验证任务
    if (!settings.currentTask || !settings.currentTask.workID) {
      throw new Error('请先选择一个工作任务');
    }
    
    showNotification('处理中', '正在下载图片...');
    
    // 下载图片
    const imageBlob = await downloadImage(imageUrl);
    debugBlob(imageBlob, '下载的图片');
    
    // 验证下载结果
    if (!imageBlob || !(imageBlob instanceof Blob)) {
      throw new Error('图片下载失败：无效的Blob对象');
    }
    
    showNotification('处理中', '正在上传图片...');
    
    // 上传图片
    const result = await uploadImage(settings, imageBlob, settings.currentTask.workID);
    
    showNotification('成功', `图片已成功上传到任务 ${settings.currentTask.workID}！`);
    console.log('手动上传完成', result);
    
    // 🎯 简化版本：只在上传成功后增加本地计数
    await incrementLocalTaskProgress();
    
  } catch (error) {
    console.error('手动上传失败:', error);
    showNotification('错误', '上传失败: ' + error.message);
    throw error;
  }
}

// 处理右键上传
async function handleImageDownloadAndUpload(info, tab) {
  console.log('开始处理右键图片上传:', info.srcUrl);
  
  try {
    const settings = await getSettings();
    
    if (!settings.apiBase || !settings.token) {
      console.error('未配置API设置');
      return;
    }
    
    if (!settings.currentTask || !settings.currentTask.workID) {
      console.error('未选择工作任务');
      return;
    }
    
    console.log('开始下载图片:', info.srcUrl);
    const imageBlob = await downloadImage(info.srcUrl);
    
    if (!imageBlob) {
      throw new Error('图片下载失败');
    }
    
    console.log('开始上传图片');
    const result = await uploadImage(settings, imageBlob, settings.currentTask.workID);
    
    console.log('右键上传成功:', result);
    await incrementLocalTaskProgress(); // 添加这行
    
    // 尝试标记页面上的图片（如果可能）
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'markImageProcessed',
        imageUrl: info.srcUrl
      });
    } catch (error) {
      console.log('标记图片失败（正常情况）:', error.message);
    }
    
  } catch (error) {
    console.error('右键上传失败:', error);
  }
}

// =============================================================================
// 图片处理函数
// =============================================================================

// 下载图片主函数
async function downloadImage(imageUrl) {
  console.log('开始下载图片:', imageUrl);
  
  try {
    // 使用fetch方法下载
    const blob = await downloadImageWithFetch(imageUrl);
    console.log('✅ 图片下载成功:', blob.size, 'bytes, 类型:', blob.type);
    
    // 转换图片格式
    const convertedBlob = await convertImageFormat(blob);
    console.log('✅ 图片处理完成:', convertedBlob.size, 'bytes, 类型:', convertedBlob.type);
    
    return convertedBlob;
    
  } catch (fetchError) {
    console.warn('Fetch下载失败，尝试备用方法:', fetchError.message);
    
    try {
      // 使用备用方法下载
      const blob = await downloadImageWithChromeAPI(imageUrl);
      const convertedBlob = await convertImageFormat(blob);
      return convertedBlob;
    } catch (chromeError) {
      console.error('❌ 所有下载方法都失败了');
      throw new Error(`图片下载失败: ${fetchError.message}`);
    }
  }
}

// 使用fetch下载图片
async function downloadImageWithFetch(imageUrl) {
  console.log('使用Fetch方法下载图片:', imageUrl);
  
  // 添加模拟浏览器的请求头
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  // 尝试从URL中提取Referer
  try {
    const url = new URL(imageUrl);
    headers['Referer'] = `${url.protocol}//${url.host}/`;
  } catch (e) {
    console.log('无法提取Referer，跳过设置');
  }
  
  const response = await fetch(imageUrl, {
    method: 'GET',
    headers: headers,
    mode: 'cors',
    credentials: 'omit'
  });
  
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }
  
  const blob = await response.blob();
  console.log('Fetch下载完成, 大小:', blob.size, 'bytes, 类型:', blob.type);
  
  return blob;
}

// 备用下载方法
async function downloadImageWithChromeAPI(imageUrl) {
  console.log('使用备用方法下载图片:', imageUrl);
  
  const alternativeConfigs = [
    {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    },
    {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
      }
    }
  ];
  
  for (let i = 0; i < alternativeConfigs.length; i++) {
    try {
      console.log(`尝试备用配置 ${i + 1}:`, alternativeConfigs[i]);
      
      const response = await fetch(imageUrl, alternativeConfigs[i]);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log(`备用配置 ${i + 1} 下载成功, 大小:`, blob.size, 'bytes, 类型:', blob.type);
        return blob;
      } else {
        console.log(`备用配置 ${i + 1} 失败:`, response.status, response.statusText);
      }
    } catch (error) {
      console.log(`备用配置 ${i + 1} 异常:`, error.message);
    }
  }
  
  throw new Error('所有备用下载方法都失败了');
}

// 转换图片格式（简化版，适用于Service Worker环境）
async function convertImageFormat(blob) {
  console.log('图片格式转换 - 输入:', blob.type, blob.size);
  
  // 在Service Worker中无法使用Canvas进行转换
  // 直接返回原始blob，让服务器处理格式转换
  if (blob.type === 'image/jpeg' || blob.type === 'image/png' || blob.type === 'image/webp') {
    console.log('图片格式无需转换:', blob.type);
    return blob;
  }
  
  // 对于其他格式，创建一个JPEG类型的blob
  console.log('转换图片格式为JPEG');
  const convertedBlob = new Blob([blob], { type: 'image/jpeg' });
  return convertedBlob;
}

// =============================================================================
// API调用函数
// =============================================================================

// 上传图片到服务器
async function uploadImage(settings, imageBlob, workId) {
  console.log('🚀 开始上传图片');
  console.log('参数检查:');
  console.log('- workId:', workId, typeof workId);
  console.log('- imageBlob type:', imageBlob?.type);
  console.log('- imageBlob size:', imageBlob?.size);
  console.log('- imageBlob instanceof Blob:', imageBlob instanceof Blob);
  
  // 验证参数
  if (!imageBlob || !(imageBlob instanceof Blob)) {
    throw new Error('图片数据无效：不是有效的Blob对象');
  }
  
  if (!workId) {
    throw new Error('工作ID无效');
  }
  
  // 创建FormData
  const formData = new FormData();
  
  try {
    formData.append('file', imageBlob, 'image.jpg');
    formData.append('workID', String(workId));
    console.log('✅ FormData创建成功');
  } catch (formError) {
    console.error('❌ FormData创建失败:', formError);
    throw new Error('FormData创建失败: ' + formError.message);
  }
  
  // 发送请求
  const response = await fetch(settings.apiBase + '/api/image/work', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + settings.token
    },
    body: formData
  });
  
  console.log('请求响应状态:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`上传失败: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('✅ 上传成功:', result);
  
  // 检查响应格式
  if (result.code && result.code !== 200) {
    throw new Error('上传失败: ' + result.message);
  }
  
  return result;
}


// 修改incrementLocalTaskProgress函数，完全移除消息发送
async function incrementLocalTaskProgress() {
  try {
    const settings = await getSettings();
    if (settings.currentTask) {
      const newCount = (settings.currentTask.currentCount || 0) + 1;
      const updatedTask = {
        ...settings.currentTask,
        currentCount: newCount
      };
      
      // 保存更新的任务数据
      await new Promise((resolve) => {
        chrome.storage.sync.set({ currentTask: updatedTask }, () => {
          console.log('💾 本地任务进度已更新:', `${updatedTask.currentCount}/${updatedTask.targetCount}`);
          resolve();
        });
      });
 
    }
  } catch (error) {
    console.error('❌ 更新本地进度失败:', error);
  }
}
