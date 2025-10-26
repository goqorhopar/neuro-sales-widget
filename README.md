# neuro-sales-widget

Виджет нейропродавца lidorubov.net: скрипт продаж, OpenAI, Telegram уведомления, интеграция, примеры сценариев.

## Описание
Интерактивный чат-виджет для сайта, который строго следует скрипту из 6 этапов, сохраняет контекст диалога в сессии, интегрируется с OpenAI API для генерации сообщений и отправляет уведомления о лидах в Telegram.

## Техническое задание

### 1. Цель
Создать интерактивный чат-виджет, который работает по строгому скрипту продаж и отправляет уведомления в Telegram о новых лидах.

### 2. Функциональные требования
- Веб-компонент (HTML/CSS/JS) для встраивания на любой сайт
- Кнопка открытия/закрытия в углу экрана
- Сохранение контекста диалога в течение сессии
- Интеграция с OpenAI (gpt-4 или gpt-3.5-turbo), температура 0.3
- Системный промпт с четкими этапами продаж
- Логика триггеров лида (согласие на Zoom, контакты, явный интерес, попытка уйти)
- Уведомления в Telegram по формату

### 3. Скрипт нейропродавца (обязательная структура)

ЭТАП 1: Приветствие
"Вас приветствует нейропродавец компании lidorubov.net
Могу предложить вам готовых клиентов в вашей нише. Скажу коротко — это не реклама, а прямые сделки. У вас есть 2 минуты?"

ЭТАП 2: Авторитет
"Мы работаем с Открытие Банк, BMW, Skillbox, Сбербанком и другими лидерами. 7 лет в нише, и в вашей отрасли у нас есть кейсы с ростом продаж на 30–50% за 2–3 месяца. Я понимаю, что вы получаете десятки предложений, поэтому сразу к сути."

ЭТАП 3: Диагностика (3 вопроса)
"Скажите:
1. Сейчас основной поток клиентов у вас идёт с рекламы или по рекомендациям?
2. Отдел продаж работает только с входящими или есть активный обзвон?
3. Какой у вас средний чек?"

ЭТАП 4: Презентация
"Наши алгоритмы находят людей, которые прямо сейчас ищут ваши услуги, фильтруем их, подтверждаем интерес и передаём вам уже готовых к покупке клиентов. Это экономит бюджет и даёт быстрый рост выручки."

ЭТАП 5: Закрытие на Zoom
"Поэтому предлагаю не тратить время и за 20 минут в Zoom показать вам цифры и кейсы по вашей нише. Когда вам удобнее — завтра в 10:00 или в 14:00?"
[После выбора времени]
"Есть ли причина, по которой встреча в это время может не состояться?"

ЭТАП 6: Обработка возражений
Если пытаются "уйти подумать":
"Понимаю, но решение здесь простое: либо вы видите, как это работает в вашей нише, либо нет. 20 минут в Zoom — и вы сами решите, стоит ли масштабировать. Когда ставим слот?"
Если не получается закрыть на встречу:
"Тогда оставьте ваш номер телефона, и наш эксперт свяжется с вами в удобное время для краткой консультации"

### 4. Техническая реализация

#### 4.1. Системный промпт для GPT
```
Ты - нейропродавец компании lidorubov.net. Твоя задача - строго следовать скрипту продаж из 6 этапов:

1. ПРИВЕТСТВИЕ: Начни с представления и предложи 2 минуты времени
2. АВТОРИТЕТ: Расскажи про кейсы с крупными компаниями
3. ДИАГНОСТИКА: Задай 3 вопроса про поток клиентов, отдел продаж и средний чек
4. ПРЕЗЕНТАЦИЯ: Объясни про алгоритмы поиска готовых клиентов
5. ZOOM: Предложи два времени для встречи
6. ВОЗРАЖЕНИЯ: Если отказ - настойчиво предложи Zoom или возьми телефон

Не отклоняйся от скрипта. Будь настойчивым, но профессиональным.
Переходи к следующему этапу только после получения ответа пользователя.
```

#### 4.2. Бэкенд логика (Node.js)
Файл: `server/index.js`
```
import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const detectLeadStage = (userMessage = '') => {
  const msg = (userMessage || '').toLowerCase()
  const triggers = {
    'zoom': 'Согласие на встречу',
    'телефон': 'Оставил контакты',
    'email': 'Оставил контакты',
    'почта': 'Оставил контакты',
    'позвоните': 'Запрос звонка',
    'подумать': 'Возражение',
    'нет времени': 'Отказ',
    'интересует': 'Явный интерес',
  }
  for (const [keyword, stage] of Object.entries(triggers)) {
    if (msg.includes(keyword)) return stage
  }
  return 'Активный диалог'
}

const extractContacts = (text = '') => {
  const phones = text.match(/\+?\d[\d\s\-()]{7,}/g) || []
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return [...phones, ...emails].join(', ') || '—'
}

const systemPrompt = `Ты - нейропродавец компании lidorubov.net... (см. README)`

app.post('/api/chat', async (req, res) => {
  const { history = [], message = '' } = req.body
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message },
        ],
      }),
    })
    const data = await response.json()
    const aiText = data.choices?.[0]?.message?.content?.trim() || ''

    const stage = detectLeadStage(message)
    const contacts = extractContacts(message)

    if (stage !== 'Активный диалог') {
      await notifyTelegram({
        stage,
        contacts,
        userMessage: message,
        history,
      })
    }

    res.json({ reply: aiText, stage, contacts })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Chat error' })
  }
})

async function notifyTelegram({ stage, contacts, userMessage, history }) {
  const telegramMessage = `\n🎯 НОВЫЙ ЛИД | lidorubov.net\n──────────────\n⏰ Время: ${new Date().toLocaleString()}\n📊 Этап: ${stage}\n📞 Контакты: ${contacts}\n💬 Сообщение: "${userMessage}"\n🔗 История: ${JSON.stringify(history.slice(-3))}`
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: telegramMessage }),
  })
}

app.listen(process.env.PORT || 3000, () => console.log('Server running'))
```

#### 4.3. Фронтенд виджет
Файлы: `public/neuro-sales-widget.js`, `public/neuro-sales-widget.css`
```
// public/neuro-sales-widget.js
(function(){
  const cfg = window.neuroSalesConfig || {}
  const s = document.createElement('div')
  s.id = 'neuro-sales-widget'
  s.innerHTML = `
    <div class="chat-header">🎯 Нейропродавец</div>
    <div id="chat-container"></div>
    <div class="input-area">
      <input type="text" placeholder="Введите сообщение..." id="nsw-user-input" />
      <button id="nsw-send">Отправить</button>
    </div>`
  document.body.appendChild(s)

  const input = s.querySelector('#nsw-user-input')
  const sendBtn = s.querySelector('#nsw-send')
  const chat = s.querySelector('#chat-container')
  const history = []

  function push(role, content){
    history.push({ role, content })
    const bubble = document.createElement('div')
    bubble.className = role === 'user' ? 'msg user' : 'msg bot'
    bubble.textContent = content
    chat.appendChild(bubble)
    chat.scrollTop = chat.scrollHeight
  }

  async function send(){
    const text = input.value.trim()
    if(!text) return
    push('user', text)
    input.value = ''
    const res = await fetch((cfg.apiUrl || '/api') + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    })
    const data = await res.json()
    if(data.reply) push('assistant', data.reply)
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') send() })

  // Автоприветствие (этап 1)
  push('assistant', 'Вас приветствует нейропродавец компании lidorubov.net... У вас есть 2 минуты?')
})()
```

```
/* public/neuro-sales-widget.css */
#neuro-sales-widget {
  position: fixed;
  bottom: 20px; right: 20px;
  width: 350px; max-height: 60vh;
  background: #fff;
  border: 2px solid #4CAF50;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  display: flex; flex-direction: column;
  overflow: hidden;
  z-index: 99999;
}
#neuro-sales-widget .chat-header { padding: 10px; background:#4CAF50; color:#fff; font-weight:600 }
#neuro-sales-widget #chat-container { padding: 10px; overflow:auto; flex: 1 }
#neuro-sales-widget .input-area { display:flex; gap:8px; padding:10px; border-top:1px solid #eee }
#neuro-sales-widget .msg { margin:6px 0; padding:8px 10px; border-radius:8px; max-width: 90% }
#neuro-sales-widget .msg.user { background:#eef6ff; align-self:flex-end }
#neuro-sales-widget .msg.bot { background:#f6fff0; align-self:flex-start }
```

### 5. Уведомления в Telegram
Формат сообщения:
```
🎯 НОВЫЙ ЛИД | lidorubov.net
──────────────
⏰ Время: {время}
📊 Этап: {этап скрипта}
📞 Контакты: {если есть}
💬 Сообщение: "{ключевая фраза пользователя}"
🔗 История: {последние 3 сообщения}
```

### 6. Деплой и настройка

Переменные окружения (.env):
```
OPENAI_API_KEY=your_key_here
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SALES_SCRIPT_VERSION=1.2
PORT=3000
```

Локальный запуск:
```
# 1) Установка
npm i

# 2) Запуск сервера (предполагается, что файлы в /server и /public)
npm run dev
```

Установка на сайт:
```
<script>
window.neuroSalesConfig = {
  apiUrl: 'https://your-backend.com/api',
  company: 'lidorubov.net',
  scriptVersion: '1.0'
};
</script>
<link rel="stylesheet" href="https://your-cdn.com/neuro-sales-widget.css" />
<script src="https://your-cdn.com/neuro-sales-widget.js"></script>
```

### 7. Структура проекта
```
neuro-sales-widget/
├─ server/
│  └─ index.js
├─ public/
│  ├─ neuro-sales-widget.js
│  └─ neuro-sales-widget.css
├─ package.json
├─ README.md
└─ .env.example
```

### 8. Тестовые сценарии
- Сценарий 1: Пользователь сразу соглашается на Zoom
- Сценарий 2: Пользователь задаёт вопросы и потом соглашается
- Сценарий 3: Пользователь отказывается, но оставляет телефон
- Сценарий 4: Пользователь уходит "подумать" (проверка настойчивости)

### 9. Лицензия
MIT
