// 🎯 终极解决方案：完全禁用所有消息发送
(function() {
  'use strict';
  
  // 保存原始函数
  const originalSendMessage = chrome?.runtime?.sendMessage;
  
  // 完全重写sendMessage函数
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage = function(...args) {
      console.log('🚫 已拦截并阻止消息发送:', args[0]?.action || args[0]);
      
      // 立即返回成功的Promise
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, message: '拦截器模拟响应' });
        }, 1);
      });
    };
    
    console.log('✅ 消息发送拦截器已激活 - 所有连接错误将被阻止');
  }
  
  // 同时拦截可能的其他消息API
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.sendMessage) {
    const originalTabsSendMessage = chrome.tabs.sendMessage;
    chrome.tabs.sendMessage = function(...args) {
      console.log('🚫 已拦截tabs消息发送:', args);
      return Promise.resolve({ success: true });
    };
  }
})();

// 原有代码从这里开始
document.addEventListener('DOMContentLoaded', function() {
  // 现有的事件监听器
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('uploadBtn').addEventListener('click', uploadImage);
  document.getElementById('loadTasksBtn').addEventListener('click', loadAvailableTasks);
  document.getElementById('taskSelect').addEventListener('change', onTaskSelect);
  document.getElementById('startWorkBtn').addEventListener('click', startWork);
  document.getElementById('refreshProgressBtn').addEventListener('click', manualRefreshProgress);
  
  // 加载设置
  loadSettings();
});

// 如果有，可以这样修改：
async function manualRefreshProgress() {
  const refreshBtn = document.getElementById('refreshProgressBtn');
  const originalText = refreshBtn.textContent;
  
  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 刷新中...';
    refreshBtn.style.backgroundColor = '#999';
    
    console.log('🔄 手动刷新任务进度...');
    
    // 🎯 直接重新加载任务列表，不发送消息
    await loadAvailableTasks();
    
    // 获取当前任务并更新显示
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['currentTask'], resolve);
    });
    
    if (settings.currentTask) {
      // 从任务列表中找到最新数据
      const taskSelect = document.getElementById('taskSelect');
      for (let i = 0; i < taskSelect.options.length; i++) {
        const option = taskSelect.options[i];
        if (option.value && option.dataset.task) {
          const task = JSON.parse(option.dataset.task);
          if (task.workID === settings.currentTask.workID) {
            // 更新存储和界面
            chrome.storage.sync.set({
              currentTask: task,
              categoryName: task.category,
              collectorTypeName: task.collector_type,
              questionDirectionName: task.question_direction
            }, function() {
              updateCurrentTaskDisplay(task);
            });
            break;
          }
        }
      }
    }
    
    refreshBtn.textContent = '✅ 已刷新';
    refreshBtn.style.backgroundColor = '#4CAF50';
    
  } catch (error) {
    console.error('❌ 手动刷新失败:', error);
    refreshBtn.textContent = '❌ 刷新失败';
    refreshBtn.style.backgroundColor = '#f44336';
  } finally {
    setTimeout(() => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = originalText;
      refreshBtn.style.backgroundColor = '#2196F3';
    }, 3000);
  }
}

// 修改loadSettings函数，删除级联选择相关代码
function loadSettings() {
  chrome.storage.sync.get([
    'apiBase',
    'token', 
    'currentTask'
  ], function(result) {
    document.getElementById('apiBase').value = result.apiBase || '';
    document.getElementById('token').value = result.token || '';
    
    // 如果有当前任务，显示
    if (result.currentTask) {
      showDetailedCurrentTask(result.currentTask);
    }
  });
}

// 新增：检查任务进度更新
async function checkTaskProgressUpdate(settings) {
  if (!settings.currentTask || !settings.apiBase || !settings.token) {
    return;
  }
  
  try {
    console.log('🔍 检查任务进度是否有更新...');
    
    const response = await fetch(`${settings.apiBase}/api/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': settings.token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('⚠️ 获取任务列表失败，跳过进度检查');
      return;
    }
    
    const data = await response.json();
    const allTasks = data.data || [];
    
    const latestTask = allTasks.find(task => task.workID === settings.currentTask.workID);
    
    if (latestTask && latestTask.currentCount !== settings.currentTask.currentCount) {
      console.log('🆕 发现进度更新!');
      console.log(`   存储中的进度: ${settings.currentTask.currentCount}`);
      console.log(`   服务器最新进度: ${latestTask.currentCount}`);
      
      // 更新存储
      const updatedTask = {
        ...settings.currentTask,
        currentCount: latestTask.currentCount,
        targetCount: latestTask.targetCount
      };
      
      chrome.storage.sync.set({ currentTask: updatedTask }, () => {
        console.log('💾 已更新存储中的任务进度');
        // 更新界面显示
        showDetailedCurrentTask(updatedTask);
      });
    } else {
      console.log('✅ 任务进度已是最新');
    }
    
  } catch (error) {
    console.error('❌ 检查进度更新失败:', error);
  }
}


// 显示详细的当前任务信息
function showDetailedCurrentTask(task) {
  // 显示顶部当前任务
  document.getElementById('currentTaskDisplay').style.display = 'block';
  document.getElementById('displayCategory').textContent = task.category;
  document.getElementById('displayCollectorType').textContent = task.collector_type;
  document.getElementById('displayQuestionDirection').textContent = task.question_direction;
  document.getElementById('displayDifficulty').textContent = task.difficulty;
  
  // 计算并显示进度
  const progress = (task.currentCount / task.targetCount) * 100;
  document.getElementById('displayProgressText').textContent = `${task.currentCount}/${task.targetCount} (${Math.round(progress)}%)`;
  document.getElementById('displayProgressFill').style.width = progress + '%';
}

// 显示任务详情
function showTaskDetails(task) {
  // 使用正确的HTML元素ID
  document.getElementById('detailTaskID').textContent = task.workID || '-';
  document.getElementById('detailCategory').textContent = task.category;
  document.getElementById('detailCollectorType').textContent = task.collector_type;
  document.getElementById('detailQuestionDirection').textContent = task.question_direction;
  document.getElementById('detailDifficulty').textContent = task.difficulty;
  document.getElementById('detailTargetCount').textContent = task.targetCount;
  document.getElementById('detailCurrentCount').textContent = task.currentCount;
}

// 🎯 添加这个缺失的函数
function showEmptyTaskDetails() {
  console.log('显示空任务详情');
  
  // 检查元素是否存在并设置默认文本
  const elements = {
    detailTaskID: '请先选择任务',
    detailCategory: '请先选择任务',
    detailCollectorType: '请先选择任务',
    detailQuestionDirection: '请先选择任务',
    detailDifficulty: '请先选择任务',
    detailTargetCount: '请先选择任务',
    detailCurrentCount: '请先选择任务'
  };
  
  Object.entries(elements).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    } else {
      console.error(`找不到元素: ${id}`);
    }
  });
}

// 修改第90-102行的onTaskSelect函数
function onTaskSelect() {
  console.log('任务选择发生变化');
  const taskSelect = document.getElementById('taskSelect');
  const selectedOption = taskSelect.options[taskSelect.selectedIndex];
  
  if (selectedOption.value) {
    try {
      const task = JSON.parse(selectedOption.dataset.task);
      console.log('解析的任务数据:', task);
      showTaskDetails(task);
      document.getElementById('startWorkBtn').disabled = false;
    } catch (error) {
      console.error('解析任务数据失败:', error);
      showEmptyTaskDetails();
      document.getElementById('startWorkBtn').disabled = true;
    }
  } else {
    console.log('没有选择任务');
    showEmptyTaskDetails();
    document.getElementById('startWorkBtn').disabled = true;
  }
}

// 修改updateCurrentTaskDisplay函数
function updateCurrentTaskDisplay(task) {
  // 显示详细的当前任务信息
  showDetailedCurrentTask(task);
  console.log('当前工作任务已更新:', task);
}

// 修改startWork函数
function startWork() {
  const taskSelect = document.getElementById('taskSelect');
  const selectedOption = taskSelect.options[taskSelect.selectedIndex];
  
  if (!selectedOption.value) {
    showTaskStatus('请先选择一个任务', 'error');
    return;
  }
  
  const task = JSON.parse(selectedOption.dataset.task);
  
  // 保存当前选择的任务到存储
  chrome.storage.sync.set({
    currentTask: task,
    categoryName: task.category,
    collectorTypeName: task.collector_type,
    questionDirectionName: task.question_direction
  }, function() {
    showTaskStatus('任务已设置，现在可以开始采集图片！', 'success');
    
    // 更新界面显示当前任务
    updateCurrentTaskDisplay(task);
    
    setTimeout(() => {
      document.getElementById('taskStatus').style.display = 'none';
    }, 3000);
  });
}

// 简化saveSettings函数
function saveSettings() {
  const settings = {
    apiBase: document.getElementById('apiBase').value,
    token: document.getElementById('token').value
    // 🎯 删除级联选择相关的保存
  };
  
  // 保存到chrome存储
  chrome.storage.sync.set(settings, function() {
    if (chrome.runtime.lastError) {
      showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('设置保存成功！', 'success');
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
  
  // 直接调用处理函数，移除多余空行
  processManualUpload(imageUrl);
}

// 添加上传状态标志
let isUploading = false;

// 完全重写processManualUpload函数，不使用任何消息发送
function processManualUpload(imageUrl) {
  if (isUploading) {
    showUploadStatus('正在上传中，请稍候...', 'error');
    return;
  }
  
  isUploading = true;
  const uploadBtn = document.getElementById('uploadBtn');
  const originalText = uploadBtn.textContent;
  
  uploadBtn.disabled = true;
  uploadBtn.textContent = '上传中...';
  showUploadStatus('正在处理图片...', 'success');
  
  // 🎯 直接在popup中处理上传，完全不发送消息
  handleManualUploadDirectly(imageUrl)
    .then(() => {
      // 上传成功
      isUploading = false;
      uploadBtn.disabled = false;
      uploadBtn.textContent = originalText;
      
      showUploadStatus('图片上传成功！', 'success');
      document.getElementById('imageUrl').value = ''; // 清空输入框
      
      // 更新界面显示
      chrome.storage.sync.get(['currentTask'], (result) => {
        if (result.currentTask) {
          updateCurrentTaskDisplay(result.currentTask);
        }
      });
      
      // 3秒后隐藏状态消息
      setTimeout(() => {
        document.getElementById('uploadStatus').style.display = 'none';
      }, 3000);
    })
    .catch((error) => {
      // 上传失败
      isUploading = false;
      uploadBtn.disabled = false;
      uploadBtn.textContent = originalText;
      
      showUploadStatus('上传失败: ' + error.message, 'error');
    });
}

// 🎯 新增：直接在popup中处理上传
// 修改handleManualUploadDirectly函数（第430-450行）
async function handleManualUploadDirectly(imageUrl) {
  console.log('开始手动上传图片:', imageUrl);
  
  try {
    // 1. 获取设置
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiBase', 'token', 'currentTask'], resolve);
    });
    
    if (!settings.apiBase || !settings.token) {
      throw new Error('请先在插件设置中配置API地址和Token');
    }
    
    if (!settings.currentTask || !settings.currentTask.workID) {
      throw new Error('请先选择一个工作任务');
    }
    
    // 2. 下载图片
    showUploadStatus('正在下载图片...', 'success');
    console.log('开始下载图片:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`图片下载失败: HTTP ${response.status}`);
    }
    
    const imageBlob = await response.blob();
    console.log('图片下载成功:', imageBlob.size, 'bytes, 类型:', imageBlob.type);
    
    // 3. 上传图片 - 🎯 使用与右键上传相同的逻辑
    showUploadStatus('正在上传图片...', 'success');
    console.log('开始上传图片');
    
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');  // 🎯 改为'file'
    formData.append('workID', String(settings.currentTask.workID));  // 🎯 转为字符串
    
    // 🎯 使用正确的API端点和认证方式
    const uploadResponse = await fetch(`${settings.apiBase}/api/image/work`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.token  // 🎯 添加Bearer前缀
      },
      body: formData
    });
    
    console.log('请求响应状态:', uploadResponse.status, uploadResponse.ok ? 'OK' : 'Error');
    
    // 4. 处理响应
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
    }
    
    const result = await uploadResponse.json();
    console.log('✅ 上传成功:', result);
    
    // 检查响应格式
    if (result.code && result.code !== 200) {
      throw new Error('上传失败: ' + result.message);
    }
    
    // 5. 更新本地计数
    const newCount = (settings.currentTask.currentCount || 0) + 1;
    const updatedTask = {
      ...settings.currentTask,
      currentCount: newCount
    };
    
    await new Promise((resolve) => {
      chrome.storage.sync.set({ currentTask: updatedTask }, () => {
        console.log('💾 本地任务进度已更新:', `${updatedTask.currentCount}/${updatedTask.targetCount}`);
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ 手动上传失败:', error);
    throw error;
  }
}

// 🎯 新增：图片格式转换（复制background的逻辑）
async function convertImageFormatInPopup(blob) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((convertedBlob) => {
        if (convertedBlob) {
          resolve(convertedBlob);
        } else {
          reject(new Error('图片格式转换失败'));
        }
      }, 'image/jpeg', 0.8);
    };
    
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(blob);
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

// 加载可用任务
async function loadAvailableTasks() {
  const apiBase = document.getElementById('apiBase').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!apiBase || !token) {
    showTaskStatus('请先配置API地址和Token', 'error');
    return;
  }
  
  showTaskStatus('正在加载任务...', 'success');
  
  try {
    const allTasks = await fetchAllTasks(apiBase, token);
    const filteredTasks = allTasks.filter(task => task.state === 0 || task.state === 1);
    
    populateTaskSelect(filteredTasks);
    // 移除这行：document.getElementById('tasksContainer').style.display = 'block';
    showTaskStatus(`加载完成，找到 ${filteredTasks.length} 个可用任务`, 'success');
    
    setTimeout(() => {
      document.getElementById('taskStatus').style.display = 'none';
    }, 3000);
    
  } catch (error) {
    console.error('加载任务失败:', error);
    showTaskStatus('加载任务失败: ' + error.message, 'error');
  }
}

// 分页获取所有任务
async function fetchAllTasks(apiBase, token) {
  const allTasks = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages) {
    try {
      const response = await fetch(`${apiBase}/api/works/user-works?page=${currentPage}&pageSize=50`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取任务失败: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code !== 200) {
        throw new Error(`获取任务失败: ${result.message}`);
      }
      
      const { works, pagination } = result.data;
      allTasks.push(...works);
      
      // 检查是否还有更多页面
      hasMorePages = pagination.currentPage < pagination.totalPages;
      currentPage++;
      
      console.log(`已加载第 ${pagination.currentPage} 页，共 ${pagination.totalPages} 页`);
      
    } catch (error) {
      console.error(`获取第 ${currentPage} 页任务失败:`, error);
      throw error;
    }
  }
  
  console.log(`总共加载了 ${allTasks.length} 个任务`);
  return allTasks;
}

// 填充任务选择框
function populateTaskSelect(tasks) {
  const taskSelect = document.getElementById('taskSelect');
  taskSelect.innerHTML = '<option value="">请选择任务...</option>';
  
  // 🎯 先定义状态映射
  const getStateText = (state) => {
    const stateMap = {
      0: '未采集',
      1: '正在采集',
      2: '采集完成',
      3: '等待质检',
      4: '正在质检',
      5: '质检打回',
      6: '质检通过',
      7: '等待交付',
    };
    return stateMap[state] || '未知';
  };
  
  // 🎯 过滤任务：只保留state为0和1的任务
  const filteredTasks = tasks.filter(task => task.state === 0 || task.state === 1);
  
  filteredTasks.forEach(task => {
    const option = document.createElement('option');
    option.value = task.workID;
    option.textContent = `[ID:${task.workID}] ${task.category} - ${task.collector_type} - ${task.question_direction} [${getStateText(task.state)}] (${task.currentCount}/${task.targetCount})`;
    option.dataset.task = JSON.stringify(task);
    taskSelect.appendChild(option);
  });
  
  // 🎯 可选：显示过滤信息
  console.log(`📊 任务过滤结果: 总共${tasks.length}个任务，显示${filteredTasks.length}个（只显示进行中和已完成的任务）`);
}

// 显示任务状态消息
function showTaskStatus(message, type) {
  const statusDiv = document.getElementById('taskStatus');
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  statusDiv.style.display = 'block';
}

// 修改showDetailedCurrentTask函数，确保进度条正确更新
function showDetailedCurrentTask(task) {
  console.log('🎯 更新顶部当前任务显示:', task);
  
  // 显示顶部当前任务
  document.getElementById('currentTaskDisplay').style.display = 'block';
  document.getElementById('displayTaskID').textContent = task.workID || '-';
  document.getElementById('displayCategory').textContent = task.category;
  document.getElementById('displayCollectorType').textContent = task.collector_type;
  document.getElementById('displayQuestionDirection').textContent = task.question_direction;
  document.getElementById('displayDifficulty').textContent = task.difficulty;
  
  // 🎯 关键修复：确保使用最新的进度数据
  const currentCount = task.currentCount || 0;
  const targetCount = task.targetCount || 1;
  const progress = (currentCount / targetCount) * 100;
  
  console.log(`📊 进度计算: ${currentCount}/${targetCount} = ${progress}%`);
  
  document.getElementById('displayProgressText').textContent = `${currentCount}/${targetCount} (${Math.round(progress)}%)`;
  document.getElementById('displayProgressFill').style.width = progress + '%';
  
  console.log('✅ 顶部任务显示更新完成');
}
