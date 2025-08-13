document.addEventListener('DOMContentLoaded', function() {
  // 加载已保存的设置
  loadSettings();
  
  // 保存按钮点击事件
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 上传按钮点击事件
  document.getElementById('uploadBtn').addEventListener('click', uploadImage);
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get([
    'apiBase',
    'token', 
    'category',
    'collectorType',
    'questionDirection'
  ], function(result) {
    document.getElementById('apiBase').value = result.apiBase || '';
    document.getElementById('token').value = result.token || '';
    document.getElementById('category').value = result.category || '数学';
    document.getElementById('collectorType').value = result.collectorType || '手动采集';
    document.getElementById('questionDirection').value = result.questionDirection || '计算题';
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    apiBase: document.getElementById('apiBase').value.trim(),
    token: document.getElementById('token').value.trim(),
    category: document.getElementById('category').value.trim(),
    collectorType: document.getElementById('collectorType').value.trim(),
    questionDirection: document.getElementById('questionDirection').value.trim()
  };
  
  // 验证必填字段
  if (!settings.apiBase) {
    showStatus('请输入API基础地址', 'error');
    return;
  }
  
  if (!settings.token) {
    showStatus('请输入用户Token', 'error');
    return;
  }
  
  if (!settings.category || !settings.collectorType || !settings.questionDirection) {
    showStatus('请填写所有参数', 'error');
    return;
  }
  
  // 保存到chrome存储
  chrome.storage.sync.set(settings, function() {
    if (chrome.runtime.lastError) {
      showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('设置保存成功！', 'success');
      // 3秒后隐藏状态消息
      setTimeout(() => {
        document.getElementById('status').style.display = 'none';
      }, 3000);
    }
  });
}

// 显示状态消息
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
}

// 显示上传状态消息
function showUploadStatus(message, type) {
  const statusDiv = document.getElementById('uploadStatus');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
}

// 手动上传图片
function uploadImage() {
  const imageUrl = document.getElementById('imageUrl').value.trim();
  
  if (!imageUrl) {
    showUploadStatus('请输入图片链接', 'error');
    return;
  }
  
  // 验证URL格式
  try {
    new URL(imageUrl);
  } catch (e) {
    showUploadStatus('请输入有效的图片链接', 'error');
    return;
  }
  

  
  processManualUpload(imageUrl);
}

// 处理手动上传
function processManualUpload(imageUrl) {
  showUploadStatus('正在处理图片...', 'success');
  
  // 发送消息给background script
  chrome.runtime.sendMessage({
    action: 'manualUpload',
    imageUrl: imageUrl
  }, (response) => {
    if (chrome.runtime.lastError) {
      showUploadStatus('上传失败: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.success) {
      showUploadStatus('图片上传成功！', 'success');
      document.getElementById('imageUrl').value = ''; // 清空输入框
      // 3秒后隐藏状态消息
      setTimeout(() => {
        document.getElementById('uploadStatus').style.display = 'none';
      }, 3000);
    } else {
      showUploadStatus('上传失败: ' + (response?.error || '未知错误'), 'error');
    }
  });
}