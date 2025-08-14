document.addEventListener('DOMContentLoaded', function() {
  // 加载已保存的设置
  loadSettings();
  
  // 初始化级联选择
  initCascadeSelects();
  
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
    'categoryID',
    'collectorTypeID',
    'questionDirectionID'
  ], function(result) {
    document.getElementById('apiBase').value = result.apiBase || '';
    document.getElementById('token').value = result.token || '';
    
    // 如果有保存的设置，在加载完类目后恢复选择
    if (result.apiBase && result.token) {
      loadCategories().then(() => {
        if (result.categoryID) {
          document.getElementById('category').value = result.categoryID;
          loadCollectorTypes(result.categoryID).then(() => {
            if (result.collectorTypeID) {
              document.getElementById('collectorType').value = result.collectorTypeID;
              loadQuestionDirections(result.collectorTypeID).then(() => {
                if (result.questionDirectionID) {
                  document.getElementById('questionDirection').value = result.questionDirectionID;
                }
              });
            }
          });
        }
      });
    }
  });
}

// 保存设置
function saveSettings() {
  const categorySelect = document.getElementById('category');
  const collectorTypeSelect = document.getElementById('collectorType');
  const questionDirectionSelect = document.getElementById('questionDirection');
  
  const settings = {
    apiBase: document.getElementById('apiBase').value.trim(),
    token: document.getElementById('token').value.trim(),
    categoryID: categorySelect.value,
    collectorTypeID: collectorTypeSelect.value,
    questionDirectionID: questionDirectionSelect.value,
    categoryName: categorySelect.options[categorySelect.selectedIndex]?.text || '',
    collectorTypeName: collectorTypeSelect.options[collectorTypeSelect.selectedIndex]?.text || '',
    questionDirectionName: questionDirectionSelect.options[questionDirectionSelect.selectedIndex]?.text || ''
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
  
  // if (!settings.categoryID || !settings.collectorTypeID || !settings.questionDirectionID) {
  //   showStatus('请填写所有参数', 'error');
  //   return;
  // }
  
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

// 初始化级联选择
function initCascadeSelects() {
  const categorySelect = document.getElementById('category');
  const collectorTypeSelect = document.getElementById('collectorType');
  const questionDirectionSelect = document.getElementById('questionDirection');
  
  // 类目选择变化事件
  categorySelect.addEventListener('change', function() {
    const categoryID = this.value;
    
    // 重置下级选择
    resetSelect(collectorTypeSelect, '请先选择类目');
    resetSelect(questionDirectionSelect, '请先选择采集类型');
    
    if (categoryID) {
      loadCollectorTypes(categoryID);
    }
  });
  
  // 采集类型选择变化事件
  collectorTypeSelect.addEventListener('change', function() {
    const collectorTypeID = this.value;
    
    // 重置下级选择
    resetSelect(questionDirectionSelect, '请先选择采集类型');
    
    if (collectorTypeID) {
      loadQuestionDirections(collectorTypeID);
    }
  });
}

// 重置选择框
function resetSelect(selectElement, placeholder) {
  selectElement.innerHTML = `<option value="">${placeholder}</option>`;
  selectElement.disabled = true;
}

// 加载类目列表
async function loadCategories() {
  const apiBase = document.getElementById('apiBase').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!apiBase || !token) {
    return;
  }
  
  try {
    const response = await fetch(`${apiBase}/api/category/`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取类目失败: ' + response.statusText);
    }
    
    const result = await response.json();
    
    if (result.code !== 200) {
      throw new Error('获取类目失败: ' + result.message);
    }
    
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">请选择类目...</option>';
    
    result.data.forEach(category => {
      const option = document.createElement('option');
      option.value = category.categoryID;
      option.textContent = category.categoryName;
      categorySelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('加载类目失败:', error);
    showStatus('加载类目失败: ' + error.message, 'error');
  }
}

// 加载采集类型列表
async function loadCollectorTypes(categoryID) {
  const apiBase = document.getElementById('apiBase').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!apiBase || !token || !categoryID) {
    return;
  }
  
  try {
    const response = await fetch(`${apiBase}/api/category/${categoryID}/collector-types`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取采集类型失败: ' + response.statusText);
    }
    
    const result = await response.json();
    
    if (result.code !== 200) {
      throw new Error('获取采集类型失败: ' + result.message);
    }
    
    const collectorTypeSelect = document.getElementById('collectorType');
    collectorTypeSelect.innerHTML = '<option value="">请选择采集类型...</option>';
    collectorTypeSelect.disabled = false;
    
    result.data.forEach(collectorType => {
      const option = document.createElement('option');
      option.value = collectorType.collectorTypeID;
      option.textContent = collectorType.collectorTypeName;
      collectorTypeSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('加载采集类型失败:', error);
    showStatus('加载采集类型失败: ' + error.message, 'error');
  }
}

// 加载问题方向列表
async function loadQuestionDirections(collectorTypeID) {
  const apiBase = document.getElementById('apiBase').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!apiBase || !token || !collectorTypeID) {
    return;
  }
  
  try {
    const response = await fetch(`${apiBase}/api/category/collector-types/${collectorTypeID}/question-directions`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取问题方向失败: ' + response.statusText);
    }
    
    const result = await response.json();
    
    if (result.code !== 200) {
      throw new Error('获取问题方向失败: ' + result.message);
    }
    
    const questionDirectionSelect = document.getElementById('questionDirection');
    questionDirectionSelect.innerHTML = '<option value="">请选择问题方向...</option>';
    questionDirectionSelect.disabled = false;
    
    result.data.forEach(questionDirection => {
      const option = document.createElement('option');
      option.value = questionDirection.questionDirectionID;
      option.textContent = questionDirection.questionDirectionName;
      questionDirectionSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('加载问题方向失败:', error);
    showStatus('加载问题方向失败: ' + error.message, 'error');
  }
}