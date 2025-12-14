# Инструкция по тестированию Go сервиса в Postman

## Эндпоинт

**URL:** `http://localhost:8081/calculate`  
**Метод:** `POST`

## Настройка запроса в Postman

### 1. Базовые настройки

- **Method:** `POST`
- **URL:** `http://localhost:8081/calculate`

### 2. Headers (Заголовки)

Добавьте следующие заголовки:

| Key | Value |
|-----|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `secret8b` |

### 3. Body (Тело запроса)

Выберите `raw` и формат `JSON`, затем используйте следующий пример:

**Важно:** Теперь Go-сервис принимает только `order_id` и сам запрашивает данные заказа из Django API.

```json
{
  "order_id": 1
}
```

Go-сервис автоматически:
1. Получит данные заказа из Django API по `order_id`
2. Выполнит расчет года
3. Отправит результат обратно в Django через callback

## Примеры тестовых сценариев

### Пример 1: Успешный расчет с одним человеком

**Важно:** Заказ с `order_id: 1` должен существовать в базе данных Django.

```json
{
  "order_id": 1
}
```

**Ожидаемый ответ:**
```json
{
  "order_id": 1,
  "year_from": 1530,
  "year_to": 1584,
  "status": "completed"
}
```

### Пример 2: Расчет с несколькими людьми

**Важно:** Заказ с `order_id: 2` должен существовать в базе данных Django и содержать несколько персон.

```json
{
  "order_id": 2
}
```

**Ожидаемый ответ:**
```json
{
  "order_id": 2,
  "year_from": 1762,
  "year_to": 1725,
  "status": "completed"
}
```

*Примечание: Если пересечения годов нет, year_from будет больше year_to, что означает, что результат будет null в финальном ответе.*

### Пример 3: Заказ не найден в базе данных

```json
{
  "order_id": 999
}
```

**Ожидаемый ответ:**
- **Status Code:** `500 Internal Server Error`
- **Body:** `Failed to fetch order data: status 404` (если заказ не существует)

**Ожидаемый ответ:**
```json
{
  "order_id": 3,
  "year_from": null,
  "year_to": null,
  "status": "completed"
}
```

### Пример 4: Неправильный токен авторизации

**Headers:**
- `Authorization`: `wrong_token`

**Ожидаемый ответ:**
- **Status Code:** `401 Unauthorized`
- **Body:** `Unauthorized`

### Пример 5: Отсутствует токен авторизации

**Headers:**
- Без заголовка `Authorization`

**Ожидаемый ответ:**
- **Status Code:** `401 Unauthorized`
- **Body:** `Unauthorized`

## Проверка callback

После успешного запроса сервис асинхронно отправляет результат в Django на:
- `http://localhost:8000/api/orders/result_callback/`

Для проверки callback необходимо:

1. Убедиться, что Django сервер запущен на порту 8000
2. Проверить логи Go сервиса (должно появиться сообщение "Callback sent successfully for order X")
3. Проверить логи Django или базу данных на наличие обновленного заказа

## Время выполнения

Запрос выполняется с задержкой 5-10 секунд (имитация сложных вычислений).

## Эндпоинт для обновления результата

**URL:** `http://localhost:8081/update_result`  
**Метод:** `POST`

### Настройка запроса в Postman

1. **Method:** `POST`
2. **URL:** `http://localhost:8081/update_result`
3. **Headers:**
   - `Content-Type`: `application/json`
4. **Body:** `raw` → `JSON`

```json
{
  "order_id": 1,
  "year_from": 1650,
  "year_to": 1680,
  "secret_key": "secret8b"
}
```

**Важно:** `secret_key` обязателен и должен быть передан в теле JSON запроса.

**Ожидаемый ответ:**
```json
{
  "order_id": 1,
  "status": "accepted",
  "message": "Update request accepted and will be processed asynchronously"
}
```

**Примечания:**
- Обновление выполняется асинхронно
- Можно указать только `year_from` или только `year_to`
- Заказ будет обновлен в Django через callback

## Возможные ошибки

| Status Code | Описание |
|------------|----------|
| `400 Bad Request` | Неверный формат JSON в теле запроса или отсутствуют обязательные поля |
| `401 Unauthorized` | Неверный или отсутствующий токен авторизации |
| `405 Method Not Allowed` | Использован неверный HTTP метод (не POST) |

