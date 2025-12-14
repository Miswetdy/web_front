# Go Service для расчета года исторического события

Асинхронный HTTP-сервис на Go для расчета года исторического события.

## Запуск

```bash
cd go-service
go mod tidy
go run main.go
```

Сервис запустится на порту 8081 (или порту, указанному в переменной окружения PORT).

## Переменные окружения

- `DJANGO_CALLBACK_URL` - URL для отправки результатов в Django (по умолчанию: http://localhost:8000/api/orders/result_callback/)
- `DJANGO_API_URL` - URL Django API для получения данных заказов (по умолчанию: http://localhost:8000)

## API

Сервис слушает на порту 8081 по умолчанию (можно изменить через переменную окружения PORT).

### POST /calculate

Выполняет расчет года исторического события с задержкой 5-10 секунд.

**Заголовки:**
- `Authorization: secret8b` (токен авторизации)

**Тело запроса:**

Go-сервис принимает только `order_id` и автоматически запрашивает данные заказа из Django API.

```json
{
  "order_id": 1
}
```

**Важно:** Заказ с указанным `order_id` должен существовать в базе данных Django.

**Ответ:**
```json
{
  "order_id": 1,
  "year_from": 1530,
  "year_to": 1584,
  "status": "completed"
}
```

После расчета сервис автоматически отправляет результат в Django через callback endpoint.

### POST /update_result

Обновляет результат конкретного заказа асинхронно.

**Тело запроса:**
```json
{
  "order_id": 1,
  "year_from": 1650,
  "year_to": 1680,
  "secret_key": "secret8b"
}
```

**Важно:** `secret_key` обязателен и должен быть передан в теле запроса.

**Ответ:**
```json
{
  "order_id": 1,
  "status": "accepted",
  "message": "Update request accepted and will be processed asynchronously"
}
```

**Примечания:**
- Обновление выполняется асинхронно через callback в Django
- Можно указать только `year_from` или только `year_to`, или оба значения
- Требуется авторизация через токен `secret8b`

