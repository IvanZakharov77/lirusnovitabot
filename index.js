const express = require('express');
const app = express();
const PORT = 3000;

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

app.post('/log', async (req, res) => {
  const tildaData = req.body;

  // Выводим полученные данные для отладки
  console.log('Получено с сайта:', JSON.stringify(tildaData, null, 2));

  // Формируем массив товаров для CRM
  const cart = [];
  tildaData.payment.products.forEach((product) => {
    const productName = product.name; // Например, "Аріна"
    const color = product.options[0]?.variant; // Например, "дим"
    const quantity = product.quantity; // Количество
    const amount = product.amount; // Общая сумма за этот тип товара

    // Находим product_id в arrProduct
    const productMapping = arrProduct.find((item) => item[productName]);
    const productId = productMapping && productMapping[productName][color];

    if (productId) {
      cart.push({
        product_id: productId,
        store_id: '',
        price: amount, // Общая сумма за все единицы этого товара
        quantity: quantity, // Общее количество
        product_bonus_sum: 0,
      });
    } else {
      console.warn(`Не найден product_id для ${productName} с цветом ${color}`);
    }
  });

  // Формируем итоговый объект для CRM
  const crmData = {
    number: 100, // Используем orderid или 100 по умолчанию
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
    const crmResponse = await fetch('https://api.dntrade.com.ua/orders/upload', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'ApiKey': 'x2kugbdjmkc5z083thxqkgrfxg8cf7smusq8gpbiznc4oxekq9xra',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crmData),
    });

    const crmResponseData = await crmResponse.json();
    console.log('Ответ от CRM:', JSON.stringify(crmResponseData, null, 2));

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
