(function() {
  'use strict';
  
  // Конфигурация
  const config = window.neuroSalesConfig || {
    apiUrl: 'http://localhost:3000/api',
    company: 'lidorubov.net',
    scriptVersion: '1.0'
  };
  
  // Генерация уникального ID сессии
  const sessionId = generateSessionId();
  
  function generateSessionId() {
    const stored = sessionStorage.getItem('neuro-sales-session');
    if (stored) return stored;
    
    const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('neuro-sales-session', newId);
    return newId;
  }
  
  // Создание HTML структуры виджета
  function createWidget() {
    const widgetHTML = `
      <div id="neuro-sales-widget" class="neuro-widget-closed">
        <!-- Кнопка открытия -->
        <button id="neuro-widget-toggle" class="neuro-toggle-btn" aria-label="Открыть чат">
          <span class="neuro-icon">💬</span>
        </button>
        
        <!-- Окно чата -->
        <div id="neuro-chat-window" class="neuro-chat-window" style="display: none;">
          <div class="neuro-chat-header">
            <div class="neuro-header-content">
              <span class="neuro-header-icon">🎯</span>
              <span class="neuro-header-title">Нейропродавец</span>
              <span class="neuro-header-company">${config.company}</span>
            </div>
            <button id="neuro-close-btn" class="neuro-close-btn" aria-label="Закрыть">
              <span>✕</span>
            </button>
          </div>
          
          <div id="neuro-chat-messages" class="neuro-chat-messages">
            <div class="neuro-message neuro-message-bot">
              <div class="neuro-message-avatar">🤖</div>
              <div class="neuro-message-content">
                <div class="neuro-message-bubble">
                  Загрузка...
                </div>
              </div>
            </div>
          </div>
          
          <div class="neuro-chat-input-area">
            <input 
              type="text" 
              id="neuro-user-input" 
              class="neuro-input" 
              placeholder="Введите сообщение..." 
              autocomplete="off"
            />
            <button id="neuro-send-btn" class="neuro-send-btn" aria-label="Отправить">
              <span>➤</span>
            </button>
          </div>
          
          <div class="neuro-powered-by">
            <span>Powered by OpenAI</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }
  
  // Добавление сообщения в чат
  function addMessage(content, isBot = false) {
    const messagesContainer = document.getElementById('neuro-chat-messages');
    const messageHTML = `
      <div class="neuro-message ${isBot ? 'neuro-message-bot' : 'neuro-message-user'}">
        <div class="neuro-message-avatar">${isBot ? '🤖' : '👤'}</div>
        <div class="neuro-message-content">
          <div class="neuro-message-bubble">
            ${escapeHtml(content)}
          </div>
          <div class="neuro-message-time">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</div>
        </div>
      </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Очистка начальных сообщений
  function clearInitialMessages() {
    const messagesContainer = document.getElementById('neuro-chat-messages');
    messagesContainer.innerHTML = '';
  }
  
  // Показать индикатор печати
  function showTypingIndicator() {
    const messagesContainer = document.getElementById('neuro-chat-messages');
    const typingHTML = `
      <div class="neuro-message neuro-message-bot neuro-typing-indicator" id="neuro-typing">
        <div class="neuro-message-avatar">🤖</div>
        <div class="neuro-message-content">
          <div class="neuro-message-bubble">
            <span class="neuro-typing-dot"></span>
            <span class="neuro-typing-dot"></span>
            <span class="neuro-typing-dot"></span>
          </div>
        </div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Удалить индикатор печати
  function removeTypingIndicator() {
    const typing = document.getElementById('neuro-typing');
    if (typing) typing.remove();
  }
  
  // Отправка сообщения на сервер
  async function sendMessage(message) {
    try {
      const response = await fetch(`${config.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error('Ошибка сервера');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      return {
        response: 'Извините, произошла ошибка. Пожалуйста, попробуйте позже.',
        error: true
      };
    }
  }
  
  // Обработка отправки сообщения
  async function handleSendMessage() {
    const input = document.getElementById('neuro-user-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Добавляем сообщение пользователя
    addMessage(message, false);
    input.value = '';
    
    // Показываем индикатор печати
    showTypingIndicator();
    
    // Отправляем на сервер
    const response = await sendMessage(message);
    
    // Убираем индикатор печати
    removeTypingIndicator();
    
    // Добавляем ответ бота
    if (response.response) {
      addMessage(response.response, true);
      
      // Если это лид, можно показать специальное уведомление
      if (response.isLead) {
        console.log('🎯 Новый лид обнаружен:', response.leadStage);
      }
    }
  }
  
  // Экранирование HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Инициализация виджета
  async function initWidget() {
    // Создаем виджет
    createWidget();
    
    // Получаем элементы
    const toggleBtn = document.getElementById('neuro-widget-toggle');
    const closeBtn = document.getElementById('neuro-close-btn');
    const chatWindow = document.getElementById('neuro-chat-window');
    const sendBtn = document.getElementById('neuro-send-btn');
    const input = document.getElementById('neuro-user-input');
    const widget = document.getElementById('neuro-sales-widget');
    
    // Обработчики событий
    toggleBtn.addEventListener('click', () => {
      const isOpen = widget.classList.contains('neuro-widget-open');
      
      if (isOpen) {
        widget.classList.remove('neuro-widget-open');
        widget.classList.add('neuro-widget-closed');
        chatWindow.style.display = 'none';
      } else {
        widget.classList.remove('neuro-widget-closed');
        widget.classList.add('neuro-widget-open');
        chatWindow.style.display = 'flex';
        input.focus();
        
        // Инициализируем первое сообщение
        if (!sessionStorage.getItem('neuro-chat-initialized')) {
          initializeChat();
          sessionStorage.setItem('neuro-chat-initialized', 'true');
        }
      }
    });
    
    closeBtn.addEventListener('click', () => {
      widget.classList.remove('neuro-widget-open');
      widget.classList.add('neuro-widget-closed');
      chatWindow.style.display = 'none';
    });
    
    sendBtn.addEventListener('click', handleSendMessage);
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSendMessage();
      }
    });
  }
  
  // Инициализация чата (первое сообщение)
  async function initializeChat() {
    clearInitialMessages();
    showTypingIndicator();
    
    // Отправляем начальное сообщение
    const response = await sendMessage('Привет');
    
    removeTypingIndicator();
    
    if (response.response) {
      addMessage(response.response, true);
    }
  }
  
  // Ждем загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
  
})();
