// 创建右键菜单
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background收到消息:', request);
  
  if (request.action === 'manualUpload') {
    handleManualUpload(request.imageUrl)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('手动上传失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // 返回true表示异步响应
    return true;
  }
});

// 处理手动上传
async function handleManualUpload(imageUrl) {
  console.log('开始手动上传图片:', imageUrl);
  
  try {
    // 获取设置
    console.log('正在获取设置...');
    const settings = await getSettings();
    console.log('获取到的设置:', settings);
    
    if (!settings.apiBase || !settings.token) {
      throw new Error('请先在插件设置中配置API地址和Token');
    }
    
    showNotification('处理中', '正在下载图片...');
    
    // 下载图片
    const imageBlob = await downloadImage(imageUrl);
    
    showNotification('处理中', '正在添加图片信息...');
    
    // 添加图片信息
    const imageInfo = await addImageInfo(settings);
    
    if (!imageInfo || !imageInfo.id) {
      throw new Error('添加图片信息失败');
    }
    
    showNotification('处理中', '正在上传图片...');
    
    // 上传图片
    await uploadImage(settings, imageBlob, imageInfo.id);
    
    showNotification('成功', '图片已成功下载并上传到数据库！');
    
    console.log('手动上传完成');
    
  } catch (error) {
    console.error('手动上传失败:', error);
    console.error('错误堆栈:', error.stack);
    showNotification('错误', '上传失败: ' + error.message);
    throw error;
  }
}

// 处理图片下载和上传
async function handleImageDownloadAndUpload(info, tab) {
  console.log('handleImageDownloadAndUpload 函数被调用');
  try {
    // 获取设置
    console.log('正在获取设置...');
    const settings = await getSettings();
    console.log('获取到的设置:', settings);
    
    if (!settings.apiBase || !settings.token) {
      console.log('设置不完整，缺少API地址或Token');
      showNotification('错误', '请先在插件设置中配置API地址和Token');
      return;
    }
    
    showNotification('处理中', '正在下载图片...');
    
    // 下载图片
    const imageBlob = await downloadImage(info.srcUrl);
    
    showNotification('处理中', '正在添加图片信息...');
    
    // 添加图片信息
    const imageInfo = await addImageInfo(settings);
    
    if (!imageInfo || !imageInfo.id) {
      throw new Error('添加图片信息失败');
    }
    
    showNotification('处理中', '正在上传图片...');
    
    // 上传图片
    await uploadImage(settings, imageBlob, imageInfo.id);
    
    // 标记图片为已处理
    chrome.tabs.sendMessage(tab.id, {
      action: 'markImageProcessed',
      imageUrl: info.srcUrl
    });
    
    showNotification('成功', '图片已成功下载并上传到数据库！');
    
  } catch (error) {
    console.error('处理图片失败:', error);
    console.error('错误堆栈:', error.stack);
    showNotification('错误', '处理失败: ' + error.message);
    
    // 发送错误信息到content script（如果可能）
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showError',
        error: error.message
      });
    } catch (msgError) {
      console.error('发送错误消息失败:', msgError);
    }
  }
}

// 获取设置
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'apiBase',
      'token',
      'category',
      'collectorType', 
      'questionDirection'
    ], resolve);
  });
}

// 下载图片
async function downloadImage(imageUrl) {
  console.log('开始下载图片:', imageUrl);
  
  try {
    // 方法1: 使用fetch下载
    const blob = await downloadImageWithFetch(imageUrl);
    
    // 转换图片格式
    const convertedBlob = await convertImageFormat(blob);
    
    return convertedBlob;
  } catch (fetchError) {
    console.warn('Fetch下载失败，尝试备用方法:', fetchError.message);
    
    try {
      // 方法2: 使用备用配置下载
      const blob = await downloadImageWithChromeAPI(imageUrl);
      
      // 转换图片格式
      const convertedBlob = await convertImageFormat(blob);
      
      return convertedBlob;
    } catch (chromeError) {
      console.warn('备用方法也失败，尝试页面注入下载:', chromeError.message);
      
      try {
        // 方法3: 通过content script在页面环境下载
        const blob = await downloadImageViaContentScript(imageUrl);
        
        // 转换图片格式
        const convertedBlob = await convertImageFormat(blob);
        
        return convertedBlob;
      } catch (contentError) {
        console.error('所有下载方法都失败了');
        throw new Error(`所有下载方法都失败了，请检查网络连接或图片链接是否有效。对于某些受保护的图片，可能需要在浏览器中手动下载。`);
      }
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
  
  console.log('使用请求头:', headers);
  
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

// 使用简化的备用下载方法
async function downloadImageWithChromeAPI(imageUrl) {
  console.log('使用备用方法下载图片:', imageUrl);
  
  // 尝试不同的fetch配置
  const alternativeConfigs = [
    // 配置1: 无CORS模式
    {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    },
    // 配置2: 最简配置
    {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    },
    // 配置3: 模拟移动端
    {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
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

// 通过content script在页面环境下载图片
async function downloadImageViaContentScript(imageUrl) {
  console.log('使用页面注入方法下载图片:', imageUrl);
  
  return new Promise((resolve, reject) => {
    // 获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        reject(new Error('无法获取当前标签页'));
        return;
      }
      
      const tabId = tabs[0].id;
      
      // 向content script发送下载请求
      chrome.tabs.sendMessage(tabId, {
        action: 'downloadImageInPage',
        imageUrl: imageUrl
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('无法与页面通信: ' + chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          // 将base64数据转换为blob
          try {
            const byteCharacters = atob(response.imageData.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.mimeType || 'image/jpeg' });
            
            console.log('页面注入下载成功, 大小:', blob.size, 'bytes, 类型:', blob.type);
            resolve(blob);
          } catch (error) {
            reject(new Error('转换图片数据失败: ' + error.message));
          }
        } else {
          reject(new Error(response?.error || '页面下载失败'));
        }
      });
    });
  });
}

// 转换图片格式
async function convertImageFormat(blob) {
  return new Promise((resolve, reject) => {
    // 如果已经是常见格式，直接返回
    if (blob.type === 'image/jpeg' || blob.type === 'image/png' || blob.type === 'image/webp') {
      console.log('图片格式无需转换:', blob.type);
      resolve(blob);
      return;
    }
    
    console.log('开始转换图片格式，原格式:', blob.type);
    
    // 创建图片元素
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 创建图片URL
    const imageUrl = URL.createObjectURL(blob);
    
    img.onload = function() {
      // 清理URL对象
      URL.revokeObjectURL(imageUrl);
      
      try {
        // 设置画布尺寸
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制图片到画布
        ctx.drawImage(img, 0, 0);
        
        // 转换为JPEG格式
        canvas.toBlob((convertedBlob) => {
          if (convertedBlob) {
            console.log('图片格式转换完成:', convertedBlob.type, '大小:', convertedBlob.size);
            resolve(convertedBlob);
          } else {
            reject(new Error('图片格式转换失败'));
          }
        }, 'image/jpeg', 0.9); // 90%质量的JPEG
        
      } catch (error) {
        console.error('图片转换过程中出错:', error);
        reject(error);
      }
    };
    
    img.onerror = function() {
      // 清理URL对象
      URL.revokeObjectURL(imageUrl);
      console.error('图片加载失败，使用原始格式');
      resolve(blob); // 如果转换失败，返回原始blob
    };
    
    // 加载图片
    img.src = imageUrl;
  });
}

// 添加图片信息
async function addImageInfo(settings) {
  const response = await fetch(settings.apiBase + '/api/image/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': settings.token
    },
    body: JSON.stringify({
      category: settings.category,
      collector_type: settings.collectorType,
      question_direction: settings.questionDirection
    })
  });
  
  if (!response.ok) {
    throw new Error('添加图片信息失败: ' + response.statusText);
  }
  
  const result = await response.json();
  
  if (result.code !== 200) {
    throw new Error('添加图片信息失败: ' + result.message);
  }
  
  return result.data;
}

// 上传图片
async function uploadImage(settings, imageBlob, imageId) {
  const formData = new FormData();
  formData.append('file', imageBlob, 'image.jpg');
  formData.append('image_id', imageId.toString());
  
  const response = await fetch(settings.apiBase + '/api/image/upload', {
    method: 'POST',
    headers: {
      'Authorization': settings.token
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('上传图片失败: ' + response.statusText);
  }
  
  const result = await response.json();
  
  if (result.code && result.code !== 200) {
    throw new Error('上传图片失败: ' + result.message);
  }
  
  return result;
}

// 显示通知
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.svg',
    title: title,
    message: message
  });
}