

let processedImages = new Set();

// 标记已处理的图片
function markImageAsProcessed(imageUrl) {
  processedImages.add(imageUrl);
  const img = document.querySelector(`img[src="${imageUrl}"]`);
  if (img) {
    img.style.border = '2px solid #4CAF50';
    img.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
    img.title = (img.title || '') + ' [已上传到数据库]';
  }
}

// 统一的消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script 收到消息:', request);
  
  if (request.action === 'getImageInfo') {
    // 获取图片额外信息的逻辑
    const img = document.querySelector(`img[src="${request.imageUrl}"]`);
    const imageInfo = {
      alt: img ? img.alt : '',
      title: img ? img.title : '',
      width: img ? img.naturalWidth : 0,
      height: img ? img.naturalHeight : 0
    };
    sendResponse(imageInfo);
  // 移除浏览器悬浮通知相关的消息处理
  } else if (request.action === 'downloadImageInPage') {
    // 在页面环境中下载图片
    downloadImageInPageEnvironment(request.imageUrl)
      .then(result => {
        sendResponse({ success: true, ...result });
      })
      .catch(error => {
        console.error('页面下载失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // 返回true表示异步响应
    return true;
  }
});

// 移除浏览器悬浮通知功能
 
// 移除错误悬浮通知功能

// 在页面环境中下载图片
async function downloadImageInPageEnvironment(imageUrl) {
  console.log('在页面环境中下载图片:', imageUrl);
  
  return new Promise((resolve, reject) => {
    // 创建一个隐藏的图片元素
    const img = new Image();
    
    // 设置跨域属性
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
      try {
        // 创建canvas来获取图片数据
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制图片到canvas
        ctx.drawImage(img, 0, 0);
        
        // 转换为base64数据
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('页面环境下载成功, 图片尺寸:', img.width, 'x', img.height);
        
        resolve({
          imageData: dataURL,
          mimeType: 'image/jpeg',
          width: img.width,
          height: img.height
        });
        
      } catch (error) {
        console.error('Canvas处理失败:', error);
        reject(new Error('Canvas处理失败: ' + error.message));
      }
    };
    
    img.onerror = function() {
      console.error('页面环境图片加载失败');
      reject(new Error('页面环境图片加载失败'));
    };
    
    // 开始加载图片
    img.src = imageUrl;
    
    // 设置超时
    setTimeout(() => {
      reject(new Error('页面下载超时'));
    }, 15000); // 15秒超时
  });
}