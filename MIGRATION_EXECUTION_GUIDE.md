# 🚀 Руководство по выполнению миграций

## 📋 Статус подключения Supabase CLI

**❌ Supabase CLI с Docker:** Не работает (Docker не запущен)  
**❌ Supabase CLI удаленно:** Ошибка prepared statement  
**✅ Supabase Dashboard:** Рекомендуемый способ

## 🎯 Рекомендуемый способ выполнения

### 1. **Supabase Dashboard (Лучший вариант)**
1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдите в ваш проект `oaockmesooydvausfoca`
3. Откройте **SQL Editor**
4. Скопируйте содержимое файла `all_migrations.sql`
5. Вставьте в SQL Editor
6. Нажмите **Run** для выполнения

### 2. **Альтернативный способ - через psql**
Если у вас установлен PostgreSQL:
```bash
psql "postgresql://postgres.oaockmesooydvausfoca:XPHwFWRd6aTCm2OD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f all_migrations.sql
```

## 📊 Что будет создано

### ✅ **Основные таблицы:**
- `tp_evaluations` - оценки торговых представителей
- `trainer_territories` - назначения тренеров на территории  
- `user_qr_tokens` - QR токены для авторизации
- `test_sequence_answers` - варианты последовательных вопросов
- `test_answer_reviews` - проверка тестов

### ✅ **Дополнительные поля:**
- `current_question_index` в `user_test_attempts`
- `order` в `test_questions`
- Новые навыки продаж в `tp_evaluations`
- Поля проверки тестов в `user_test_attempts`

### ✅ **Функции:**
- `get_tp_evaluation_stats()` - статистика по мероприятию
- `update_tp_evaluations_updated_at()` - автообновление
- `update_trainer_territories_updated_at()` - автообновление
- `update_user_qr_tokens_updated_at()` - автообновление

### ✅ **RLS политики:**
- Безопасность для всех новых таблиц
- Контроль доступа по ролям
- Защита данных пользователей

## ⚠️ Важные замечания

1. **Порядок выполнения:** Миграции должны выполняться в указанном порядке
2. **Резервное копирование:** Рекомендуется создать бэкап перед выполнением
3. **Тестирование:** Проверьте работу системы после выполнения
4. **RLS политики:** Убедитесь, что политики безопасности работают корректно

## 🔧 Проверка после выполнения

После выполнения миграций проверьте:

```sql
-- Проверка создания таблиц
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tp_evaluations', 'user_qr_tokens', 'trainer_territories', 'test_sequence_answers', 'test_answer_reviews');

-- Проверка функций
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%tp_evaluation%';

-- Проверка RLS политик
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('tp_evaluations', 'user_qr_tokens', 'trainer_territories');
```

## 🎯 Результат

После выполнения всех миграций система будет полностью восстановлена со всеми функциями:
- ✅ Оценка торговых представителей
- ✅ QR авторизация  
- ✅ Управление территориями
- ✅ Проверка тестов
- ✅ Статистика и аналитика
- ✅ Расширенные навыки продаж

## 🆘 Если возникли проблемы

1. **Ошибки выполнения:** Проверьте логи в Supabase Dashboard
2. **Конфликты:** Убедитесь, что таблицы не существуют
3. **Права доступа:** Проверьте, что у вас есть права администратора
4. **Поддержка:** Обратитесь к документации Supabase

---

**Файл готов к выполнению:** `all_migrations.sql` 🚀
