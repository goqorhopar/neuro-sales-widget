require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Системный промпт для нейропродавца
const SALES_SYSTEM_PROMPT = `Ты - нейропродавец компании ${process.env.COMPANY_NAME || 'lidorubov.net'}. Твоя задача - строго следовать скрипту продаж из 6 этапов:

1. ПРИВЕТСТВИЕ: Начни с представления и предложи 2 минуты времени
   "Вас приветствует нейропродавец компании lidorubov.net. Могу предложить вам готовых клиентов в вашей нише. Скажу коротко — это не реклама, а прямые сделки. У вас есть 2 минуты?"

2. АВТОРИТЕТ: Расскажи про кейсы с крупными компаниями
   "Мы работаем с Открытие Банк, BMW, Skillbox, Сбербанком и другими лидерами. 7 лет в нише, и в вашей отрасли у нас есть кейсы с ростом продаж на 30–50% за 2–3 месяца."

3. ДИАГНОСТИКА: Задай 3 вопроса про поток клиентов, отдел продаж и средний чек
   "Скажите: 1. Сейчас основной поток клиентов у вас идёт с рекламы или по рекомендациям? 2. Отдел продаж работает только с входящими или есть активный обзвон? 3. Какой у вас средний чек?"

4. ПРЕЗЕНТАЦИЯ: Объясни про алгоритмы поиска готовых клиентов
   "Наши алгоритмы находят людей, которые прямо сейчас ищут ваши услуги, фильтруем их, подтверждаем интерес и передаём вам уже готовых к покупке клиентов."

5. ZOOM: Предложи два времени для встречи
   "Предлагаю за 20 минут в Zoom показать вам цифры и кейсы по вашей нише. Когда вам удобнее — завтра в 10:00 или в 14:00?"

6. ВОЗРАЖЕНИЯ: Если отказ - настойчиво предложи Zoom или возьми телефон
   "Понимаю, но решение здесь простое: либо вы видите, как это работает в вашей нише, либо нет. 20 минут в Zoom — и вы сами решите. Когда ставим слот?"

Не отклоняйся от скрипта. Будь настойчивым, но профессиональным. Переходи к следующему этапу только после получения ответа пользователя.`;

// Хранилище диалогов (в реальном проекте использовать БД)
const conversations = new Map();

// Определение этапа лида
function detectLeadStage(userMessage, conversationHistory) {
  const message = userMessage.toLowerCase();
  
  const triggers = {
    'zoom': 'Согласие на встречу',
    'встреча': 'Согласие на встречу',
    'телефон': 'Оставил контакты',
    'позвоните': 'Запрос звонка',
    'email': 'Оставил контакты',
    'почта': 'Оставил контакты',
    'подумать': 'Возражение - подумать',
    'нет времени': 'Возражение - нет времени',
    'интересует': 'Проявил интерес',
    'готов обсудить': 'Проявил интерес',
    'да': conversationHistory.length > 2 ? 'Положительный ответ' : null,
  };
  
  for (const [keyword, stage] of Object.entries(triggers)) {
    if (message.includes(keyword) && stage) {
      return stage;
    }
  }
  
  return null;
}

// Извлечение контактов из сообщения
function extractContacts(message) {
  const phoneRegex = /\+?[0-9]{1,4}?[-.\s]?\(?[0-9]{1,4}?\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  
  const phones = message.match(phoneRegex) || [];
  const emails = message.match(emailRegex) || [];
  
  return {
    phones,
    emails,
    hasContacts: phones.length > 0 || emails.length > 0
  };
}

// Отправка уведомления в Telegram
async function sendTelegramNotification(leadData) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('Telegram не настроен. Лид:', leadData);
    return;
  }
  
  // Поддержка нескольких chat_id через запятую
  const chatIds = process.env.TELEGRAM_CHAT_ID.split(',').map(id => id.trim()).filter(id => id);
  
  const { stage, contacts, userMessage, conversationHistory } = leadData;
  
  const lastMessages = conversationHistory
    .slice(-3)
    .map(msg => `${msg.role === 'user' ? '👤 Пользователь' : '🤖 Бот'}: ${msg.content}`)
    .join('\n');
  
  const contactsInfo = contacts.hasContacts 
    ? `📞 Телефон: ${contacts.phones.join(', ')}\n📧 Email: ${contacts.emails.join(', ')}`
    : 'Контакты не указаны';
  
  const message = `🎯 НОВЫЙ ЛИД | ${process.env.COMPANY_NAME || 'lidorubov.net'}
──────────────
⏰ Время: ${new Date().toLocaleString('ru-RU')}
📊 Этап: ${stage}
${contactsInfo}
💬 Сообщение: "${userMessage}"
📜 История (последние 3 сообщения):
${lastMessages}`;
  
  // Отправка уведомления всем администраторам
  const sendPromises = chatIds.map(chatId => 
    axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }
    ).catch(error => {
      console.error(`❌ Ошибка отправки в Telegram (chat_id: ${chatId}):`, error.message);
      return null;
    })
  );
  
  try {
    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    console.log(`✅ Уведомление отправлено ${successCount} из ${chatIds.length} администраторам`);
  } catch (error) {
    console.error('❌ Критическая ошибка отправки в Telegram:', error.message);
  }
}

// API Endpoint для чата
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Требуются message и sessionId' });
    }
    
    // Получаем или создаем историю диалога
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [
        { role: 'system', content: SALES_SYSTEM_PROMPT }
      ]);
    }
    
    const conversationHistory = conversations.get(sessionId);
    conversationHistory.push({ role: 'user', content: message });
    
    // Вызов OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: conversationHistory,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
      max_tokens: 500,
    });
    
    const aiResponse = completion.choices[0].message.content;
    conversationHistory.push({ role: 'assistant', content: aiResponse });
    
    // Определяем, является ли это лидом
    const leadStage = detectLeadStage(message, conversationHistory);
    const contacts = extractContacts(message);
    
    if (leadStage || contacts.hasContacts) {
      // Отправляем уведомление в Telegram
      await sendTelegramNotification({
        stage: leadStage || 'Оставил контакты',
        contacts,
        userMessage: message,
        conversationHistory: conversationHistory.filter(msg => msg.role !== 'system')
      });
    }
    
    res.json({
      response: aiResponse,
      isLead: !!leadStage || contacts.hasContacts,
      leadStage
    });
    
  } catch (error) {
    console.error('Ошибка в /api/chat:', error);
    res.status(500).json({ 
      error: 'Ошибка сервера',
      message: error.message 
    });
  }
});

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: process.env.SALES_SCRIPT_VERSION || '1.0',
    timestamp: new Date().toISOString()
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 Версия скрипта: ${process.env.SALES_SCRIPT_VERSION || '1.0'}`);
  console.log(`🤖 Модель OpenAI: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
});
