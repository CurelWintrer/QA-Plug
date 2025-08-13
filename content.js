// Content script for QA image collection plugin
// This script runs in the context of web pages

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImageInfo') {
    // 可以在这里添加获取图片额外信息的逻辑
    // 比如图片的alt文本、周围的文本内容等
    const img = document.querySelector(`img[src="${request.imageUrl}"]`);
    const imageInfo = {
      alt: img ? img.alt : '',
      title: img ? img.title : '',
      width: img ? img.naturalWidth : 0,
      height: img ? img.naturalHeight : 0
    };
    sendResponse(imageInfo);
  }
});

// 可以添加一些页面交互功能
// 比如高亮显示已处理的图片等
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

// 监听来自background的标记消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script 收到消息:', request);
  
  if (request.action === 'markImageProcessed') {
    markImageAsProcessed(request.imageUrl);
    showSuccessMessage('图片上传成功！已保存到数据库');
    sendResponse({success: true});
  } else if (request.action === 'showError') {
    showErrorOnPage(request.error);
    sendResponse({success: true});
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

// 在页面上显示成功信息
 function showSuccessMessage(message) {
   // 创建成功提示框
   const successDiv = document.createElement('div');
   successDiv.style.cssText = `
     position: fixed;
     top: 20px;
     right: 20px;
     background: #d4edda;
     color: #155724;
     border: 1px solid #c3e6cb;
     border-radius: 4px;
     padding: 15px;
     max-width: 300px;
     z-index: 10000;
     font-family: Arial, sans-serif;
     font-size: 14px;
     box-shadow: 0 2px 10px rgba(0,0,0,0.1);
     animation: slideIn 0.3s ease-out;
   `;
   successDiv.innerHTML = `
     <strong>✅ QA插件:</strong><br>
     ${message}
     <button onclick="this.parentElement.remove()" style="
       float: right;
       background: none;
       border: none;
       font-size: 16px;
       cursor: pointer;
       color: #155724;
     ">×</button>
   `;
   
   // 添加动画样式
   if (!document.getElementById('qa-plugin-styles')) {
     const style = document.createElement('style');
     style.id = 'qa-plugin-styles';
     style.textContent = `
       @keyframes slideIn {
         from {
           transform: translateX(100%);
           opacity: 0;
         }
         to {
           transform: translateX(0);
           opacity: 1;
         }
       }
     `;
     document.head.appendChild(style);
   }
   
   document.body.appendChild(successDiv);
   
   // 3秒后自动移除
   setTimeout(() => {
     if (successDiv.parentElement) {
       successDiv.style.animation = 'slideIn 0.3s ease-out reverse';
       setTimeout(() => {
         if (successDiv.parentElement) {
           successDiv.remove();
         }
       }, 300);
     }
   }, 3000);
 }
 
 // 在页面上显示错误信息
 function showErrorOnPage(errorMessage) {
   // 创建错误提示框
   const errorDiv = document.createElement('div');
   errorDiv.style.cssText = `
     position: fixed;
     top: 20px;
     right: 20px;
     background: #f8d7da;
     color: #721c24;
     border: 1px solid #f5c6cb;
     border-radius: 4px;
     padding: 15px;
     max-width: 300px;
     z-index: 10000;
     font-family: Arial, sans-serif;
     font-size: 14px;
     box-shadow: 0 2px 10px rgba(0,0,0,0.1);
   `;
   errorDiv.innerHTML = `
     <strong>❌ QA插件错误:</strong><br>
     ${errorMessage}
     <button onclick="this.parentElement.remove()" style="
       float: right;
       background: none;
       border: none;
       font-size: 16px;
       cursor: pointer;
       color: #721c24;
     ">×</button>
   `;
   
   document.body.appendChild(errorDiv);
   
   // 5秒后自动移除
   setTimeout(() => {
     if (errorDiv.parentElement) {
       errorDiv.remove();
     }
   }, 5000);
 }

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