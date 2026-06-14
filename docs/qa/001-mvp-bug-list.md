# QA report — PyaServ MVP end-to-end

Reviewed against current prod (`https://pyaserv.com` + `https://api.pyaserv.com`) on the cabinet-refresh + i18n branch.

## Critical (блокеры юзкейса)

1. **No pipeline для отметки выполнения работ.** Inquiry имеет только `last_message_at` — нет статусов `in_progress`/`done`/`cancelled`, нет двустороннего подтверждения. Без этого закрыть петлю «нашёл → обсудили → сделали → оценили» невозможно.
2. **No ratings/reviews API.** Backend не имеет ни схемы `reviews`, ни эндпоинтов `POST /v1/reviews`. Карточки специалистов показывают `verified` бейдж, но нет среднего рейтинга — карточки выглядят «голыми».
3. **Resend domain = pyaeats.com.** Письма входа уходят с `noreply@pyaeats.com` — пользователь PyaServ видит чужой бренд → потеря доверия + spam-risk. Issue `pya-company/pyaserv#1` уже открыт.
4. **inquiries/detail subject link битый.** В `me/inquiries/detail.astro` ссылка `Ver publicación` для `listing` ведёт на `/specialists/detail/?id=<specialistUserId>` — это user_id, не specialist profile id. 404 на profile detail.
5. **`/me/?tab=requests` фильтрует только `open`.** Закрытые requests не виден в кабинете (backend listings все «open» по умолчанию). Нужен `/v1/requests?mine=1` или просто `clientId` фильтр на серверный stage.

## Major

6. **OTP email rate-limit отсутствует.** Можно дёрнуть `/api/auth/start` десятки раз — Resend счётчик быстро сгорит, потом ничего не уходит.
7. **No anti-spam на inquiry create.** Гость с токеном может создать 1000 inquiries одному специалисту — нет throttle.
8. **No XSS защиты в чате.** `messages[].body` рендерится через `textContent` (это ОК), но `formatRelativeTime` приклеен через innerHTML с timestamp — может сломаться при не-числовом значении.
9. **Polling в чате растягивается до бесконечности.** `setInterval(renderThread, 5000)` не очищается при unmount → если человек переключит таб и вернётся, висят два полла.
10. **Authentication leak в /me/inquiries.** Endpoint возвращает все inquiries где user либо client либо specialist; нет проверки что текущая роль соответствует — потенциально можно отвечать чужими сообщениями если подкинуть `inquiryId`.
11. **No phone validation.** В specialist профиле регекс `^[+0-9 ()-]{6,20}$` слишком расслаблен — пройдут странные значения.
12. **No upload фото.** В профиле есть `photo` поле, но нет R2 upload UI/route. Колонка пустая для всех → аватары везде дефолтный 🛠️.

## Minor

13. **Кириллические значения теряются в URL.** `barrio=Карасики` URL-encoded ок, но `searchParams` filter case-sensitive. Минор: вводят «villa morra», не находят `Villa Morra`.
14. **No empty state для `/specialists/?category=plumbing&barrio=…` пустого результата** — показывается просто «0 profesionales» без призыва к action.
15. **listing на `/specialists/detail/` показывает первый listing для composer** — если у спеца 5 услуг, ты пишешь «по поводу первой», даже если кликнул другую карточку.
16. **No client cancel inquiry.** Нет кнопки «удалить переписку» — если открыл по ошибке, повисает в списке.
17. **Tabs scroll position теряется при перезагрузке.** Юзер на `/me/?tab=inquiries` обновил страницу — попал на `profile` (фикс через `?tab=` в URL уже есть; **сейчас работает**, оставляю как hint).
18. **Login form auto-fill не подсвечивается dark mode** — fix через `:autofill` стили.

## A11y / UX nits

19. **Buttons не подсвечивают focus в keyboard navigation.** `:focus-visible` есть на inputs, нет на `.ps-btn`.
20. **Чат не aria-live для новых сообщений** — screen reader не объявляет «новое сообщение».
21. **Decorative emoji не помечены `aria-hidden`** в card heading.
22. **Mode-card hover не работает на touch** — на mobile нет visual feedback при tap, есть `:active scale(0.98)` но он почти не виден.
23. **`<html lang="es">` хардкод** — переключение языка не обновляет это (нужен init script в `Base.astro`).
24. **Color contrast в dark mode на `.ps-text-muted` границе AA**: `#9ca3af` на `#1f2937` = 4.39:1, прошёл AA Normal, но fails AAA. Mute текст бы хорошо посветлее.

## Общее впечатление

Backend честно покрыт CRUD-ом для всех 4 сущностей, frontend знает что с ними делать, базовая навигация работает. Но **нет завершающей петли — `done` → `review`**, что для services marketplace это не «фича позже», а ядро доверия. Также режут глаз: единый email-домен из чужого продукта, пустые карточки без фото и рейтингов. Без рейтингов «Profesionales» выглядит как страница объявлений Amazon Avito, а не доверенная биржа.

Critical: 5 · Major: 7 · Minor: 6 · A11y/UX: 6 = **24 заметки**.
