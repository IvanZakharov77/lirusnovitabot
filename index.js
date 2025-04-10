const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // Для Render/Glitch используем PORT из окружения

app.use(express.json()); // Для парсинга JSON в теле запроса

// Массив с сопоставлением товаров и их вариантов
const arrProduct = [
  {
    Аріна: {
      дим: 'ceab1dbf-3ff2-42f5-9bc6-49d64cd3d418',
      синій: '1e8dbea6-5ccb-40dc-bb8b-8e41aeb67d7f',
      молоко: '02873f89-cf77-4e18-8188-e8735839b5aa',
    },
  },
];

// Логируем все входящие запросы для отладки
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Обработчик для корневого маршрута
app.get('/', (req, res) => {
  res.send('Сервер работает. Используйте POST /log для Webhook.');
});

app.post('/log', async (req, res) => {
  const tildaData = req.body;

  // Выводим полученные данные для отладки
  console.log('Получено с сайта:', JSON.stringify(tildaData, null, 2));

  // Проверяем наличие payment и products
  if (!tildaData.payment) {
    console.error('Ошибка: поле payment отсутствует в данных от Тильды');
    res.status(400).send('error');
    return;
  }

  if (!tildaData.payment.products || !Array.isArray(tildaData.payment.products)) {
    console.error('Ошибка: payment.products отсутствует или не является массивом');
    res.status(400).send('error');
    return;
  }

  // Формируем массив товаров для CRM
  const cart = [];
  tildaData.payment.products.forEach((product) => {
    const productName = product.name; // Например, "Аріна"
    const color = product.options && product.options[0]?.variant; // Например, "дим"
    const quantity = product.quantity || 0; // Количество
    const amount = product.amount || 0; // Общая сумма за этот тип товара

    // Находим product_id в arrProduct
    const productMapping = arrProduct.find((item) => item[productName]);
    const productId = productMapping && color && productMapping[productName][color];

    if (productId) {
      cart.push({
        product_id: productId,
        store_id: '',
        price: amount, // Общая сумма за все единицы этого товара
        quantity: quantity, // Общее количество
        product_bonus_sum: 0,
      });
    } else {
      console.warn(`Не найден product_id для ${productName} с цветом ${color || 'не указан'}`);
    }
  });

  // Формируем итоговый объект для CRM
  const crmData = {
    number: tildaData.payment.orderid ? parseInt(tildaData.payment.orderid) : 100, // Используем orderid или 100 по умолчанию
    status: 1,
    channel: 'АПІ',
    cart: cart,
    personal_info: {
      client_id: '',
      name: tildaData.Name || 'тест',
      street: '',
      building: '',
      city: tildaData.Місто || '',
      phone: tildaData.Phone || '0631928749',
      comment: '',
      card_or_cash: tildaData.Delivery === 'Передплата' ? 1 : 0, // 1 для предоплаты, 0 для наложки
      bonus_sum: 0,
      writeoff_bonus: 0,
    },
  };

  // Выводим сформированный JSON в консоль для проверки
  console.log('Сформировано для CRM:', JSON.stringify(crmData, null, 2));

  // Отправляем данные в CRM
  try {
    const crmResponse = await fetch('https://api.dntrade.com.ua/orders_upload', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'ApiKey': 'x2kugbdjmkcS2083thxqgrfxgbcF7smus8gbibznC40xekq9xra',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crmData),
    });

    // Логируем статус ответа
    console.log('Статус ответа от CRM:', crmResponse.status, crmResponse.statusText);

    // Пытаемся получить тело ответа
    let crmResponseData;
    try {
      crmResponseData = await crmResponse.json();
      console.log('Ответ от CRM (JSON):', JSON.stringify(crmResponseData, null, 2));
    } catch (jsonError) {
      console.error('Не удалось распарсить JSON от CRM:', jsonError.message);
      const crmResponseText = await crmResponse.text();
      console.log('Ответ от CRM (текст):', crmResponseText);
    }

    if (crmResponse.ok) {
      res.status(200).send('ok'); // Тильда ждёт "ok"
    } else {
      console.error('Ошибка от CRM:', crmResponse.status, crmResponse.statusText);
      res.status(500).send('error');
    }
  } catch (error) {
    console.error('Ошибка при отправке в CRM:', error.message);
    res.status(500).send('error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер слушает на http://localhost:${PORT}`);
});
