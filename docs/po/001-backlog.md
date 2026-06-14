# PyaServ — Backlog MVP+1

Бенчмарк против [Workana](https://www.workana.com), [Tu Lugar](https://tulugar.com.ar/), [Idealista Servicios](https://www.idealista.com/servicios/), [TaskRabbit](https://www.taskrabbit.com), [Thumbtack](https://www.thumbtack.com), [Yandex Услуги](https://uslugi.yandex.ru/).

Сейчас есть: профили специалистов, listings, client requests, inquiries + messages, passwordless OTP login. **Нет**: статусов выполнения, рейтингов, фото, нотификаций, верификации, security-hardening, англ. локали (almost done).

---

## Sprint 1 (закрыть петлю доверия + чистота релиза) — P0

### #1. Work pipeline: статус-машина в inquiry
- **Story:** *As a client/specialist, I want to mark a job as in-progress / done so that both sides confirm the work happened.*
- **Описание:** Добавить колонку `inquiries.work_status` (`negotiating | in_progress | client_confirmed | specialist_confirmed | done | cancelled`). Done только когда обе стороны подтвердили (`client_confirmed` + `specialist_confirmed`). Видна в карточке inquiry + новые кнопки в `/me/inquiries/detail/`.
- **AC:** Given открытая переписка, When клиент жмёт «Comenzar trabajo», Then статус `in_progress`. Given статус `in_progress`, When обе стороны жмут «Marcar como terminado», Then статус `done` и **окно для оценки открывается**.
- **Поверхности:** db (migration 0005), api (`PATCH /v1/inquiries/:id/status`), site (`/me/inquiries/detail/`).
- **Estimate:** M

### #2. Двусторонние отзывы (rating + текст)
- **Story:** *After done, I want to rate the other side so future clients/specialists see trust signals.*
- **Описание:** Таблица `reviews(id, inquiry_id, rater_user_id, ratee_user_id, role 'client'|'specialist', stars 1-5, body, created_at)`. После `done` — модал с 5-зв шкалой + опционально текст. На профиле специалиста — средний рейтинг + последние 5 отзывов; на профиле клиента (пока скрыт — viewable только для других специалистов) — то же.
- **AC:** Один rater per inquiry per direction. Изменить нельзя 24ч после публикации.
- **Поверхности:** db, api (`/v1/reviews` CRUD), site (review modal in `/me/inquiries/detail/`, блок отзывов в `/specialists/detail/`).
- **Estimate:** M
- **Деп:** #1

### #3. Фото профиля + фото услуги (R2)
- **Story:** *As a specialist, I want to upload a photo of me + photos of my work so my profile feels alive.*
- **Описание:** R2 bucket `pyaserv-media` + KV fallback (как в pyaeats). Endpoint `POST /v1/media` принимает image, возвращает `key`. UI: drag-drop в `/me/?tab=profile` (1 photo) и в `/me/listings/edit/?id=…` (до 4 photos).
- **AC:** Photos ≤ 5MB, JPEG/PNG/WebP, EXIF strip.
- **Поверхности:** wrangler R2 binding, api (media route + storage helper), site (3 формы).
- **Estimate:** L

### #4. Email-нотификации (new message, new inquiry)
- **Story:** *I want an email when someone messages me so I don't miss work opportunities.*
- **Описание:** При `POST /v1/inquiries` и `POST /v1/inquiries/:id/messages` — отправка email получателю через @pya-company/email. Опт-аут через профиль user (колонка `email_notifications` default true).
- **AC:** Email не уходит на собственные сообщения. Throttle 1 email/инструкции/час.
- **Поверхности:** db (migration), api, email-template.
- **Estimate:** S

### #5. Verify pyaserv.com в Resend → flip EMAIL_DOMAIN
- **Story:** *Outbound mail from PyaServ should look like PyaServ, not PyaEats.*
- **Описание:** Issue `pya-company/pyaserv#1` уже открыт. DNS records (CNAME × 3 + TXT × 2) добавить в CF zone через API. После verify в Resend — `EMAIL_DOMAIN=pyaserv.com` в wrangler.
- **AC:** Test: `curl POST /api/auth/start` → email FROM `noreply@pyaserv.com`.
- **Estimate:** S

### #6. Bug-fixes из `docs/qa/001-mvp-bug-list.md` Critical #4-#5
- Subject link в `/me/inquiries/detail/` ведёт на правильный specialist profile id (не user_id).
- `/me/?tab=requests` показывает ВСЕ свои requests (open + closed), не только open.
- **Estimate:** S

### #7. i18n завершение + language switcher polish
- Locale кнопки в шапке (есть). `applyI18n()` на каждой странице (частично есть). Перевод всех empty/error/loading состояний.
- **AC:** На EN — нет ни одной испанской строки на 5 публичных страницах + cabinet.
- **Estimate:** S

---

## Sprint 2 (запросы → результат) — P1

### #8. Поиск с автокомплитом barrios Asunción
- Хардкодный список 40 barrios (Villa Morra, Carmelitas, Recoleta, San Roque…) → datalist input.
- **Estimate:** S

### #9. Геолокация (опц)
- На `/specialists/` — «cerca de mí» (если разрешено). Спец имеет `lat/lng`, сортировка по Haversine.
- **Estimate:** M

### #10. Дашборд статистики для специалиста
- Виды моего профиля, кликов на телефон/WhatsApp, входящие inquiries, конверсия → done. Таблица `analytics_events` (user_id, event, subject_id, ts), агрегаты в `/me/?tab=stats`.
- **Estimate:** M

### #11. Anti-spam
- Rate limit `POST /api/auth/start` (5/час/email).
- Rate limit `POST /v1/inquiries` (10/день/user).
- Простой captcha (turnstile из CF) на /login и публичных POST.
- **Estimate:** M

### #12. Phone verification (SMS OTP)
- На профиле — кнопка «Verificar teléfono» → отправка SMS через Twilio/Vonage → флаг `phone_verified`.
- Видимый бейдж «Tel. verificado» на карточке.
- **Estimate:** L

### #13. Соц-доказательство в landing
- Карусель «recientemente verificados», счётчик «X профессионалов в Asunción».
- **Estimate:** S

---

## Sprint 3 (рост и удержание) — P2

### #14. Реферал / приглашение
- Спецы приглашают коллег → приглашённый получает бейдж «recomendado por X».
- **Estimate:** M

### #15. Спор-резолюция
- Кнопка «Reportar problema» в inquiry → admin email + флаг `disputed`. Простой триаж без auto-resolve.
- **Estimate:** S

### #16. Theme toggle (light/dark/auto)
- Сейчас `prefers-color-scheme` only. Добавить явный switcher и persist.
- **Estimate:** S

### #17. WCAG AA audit + фиксы
- `:focus-visible` на всех buttons, aria-live для chat, лучше contrast on muted text, lang switcher → `<html lang>` update.
- **Estimate:** S

### #18. PWA + offline list
- Cache `/specialists/?…` JSON. Show last seen list offline.
- **Estimate:** M

### #19. Анти-leak личной инфы
- При показе телефона на `/specialists/detail/` — не выкидывать в HTML до клика «Mostrar» (защита от scraping).
- **Estimate:** S

### #20. Profile completeness meter
- В `/me/?tab=profile` шкала «80% complete» с подсказками что добавить.
- **Estimate:** S

---

## Не в MVP (обоснование)

- **Escrow / payment.** Требует MSB лицензии в Парагвае или partnership с локальным процессингом; уходит из «без комиссий» позиционирования.
- **Видео в листингах.** R2 хранение + CDN дороже на порядок чем photos. Дать через P1.
- **Marketplace для команд/компаний.** Раздувает user model; добавит сложности в reviews и расходится с MVP «specialists ↔ clients».

---

## Counts

- P0 (Sprint 1): 7 тикетов
- P1 (Sprint 2): 6 тикетов
- P2 (Sprint 3): 7 тикетов
- Total: **20**

## Top-3 P0

1. **#1 work pipeline** — без отметки done нет ratings, без ratings нет доверия.
2. **#2 двусторонние reviews** — главный отстраивающий механизм PyaServ vs Facebook Marketplace.
3. **#3 photos** — карточки без лица выглядят как объявления 2005-го.
