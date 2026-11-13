# 🧠 MemoVida — Plan maestro y prompt de construcción

> Asistente digital para **personas con Alzheimer** (fases leve y moderada) y **sus cuidadores/familiares**.
> Documento 1 de 2: aquí está **el plan y el prompt**. El documento 2 (`README.md`) explica cómo ejecutar la app ya construida.

---

## 0. Prompt maestro (la "idea completa" de la app, en un solo prompt)

> **Construye una aplicación web completa, accesible y 100 % funcional llamada MemoVida, para personas con Alzheimer en fase leve-moderada y sus cuidadores.**
>
> **Stack:** frontend en HTML5 + CSS3 + JavaScript (ES modules, sin frameworks, sin CDN, todo local); backend en Node.js puro (`node:http`, `node:crypto`, cero dependencias npm); persistencia en base de datos documental JSON con escritura atómica; tiempo real con Server-Sent Events; voz con Web Speech API; audio con Web Audio API; gráficos con SVG generado a mano.
>
> **Dos roles con dos interfaces distintas:**
> - **Modo Paciente:** interfaz radicalmente simplificada, botones gigantes (mín. 88 px), tipografía 22–40 px, alto contraste, un máximo de 8 acciones por pantalla, sin menús anidados, sin dobles clics, sin arrastrar, siempre visibles el reloj, la fecha escrita en palabras, el botón "Inicio" y el botón "🆘 Ayuda". Todo texto se puede leer en voz alta. Feedback amable, nunca punitivo: si se equivoca, se muestra la respuesta correcta y se permite reintentar (aprendizaje sin error).
> - **Modo Cuidador:** panel de control con métricas, gráficas, CRUD completo, alertas en tiempo real, informes exportables e impresión.
>
> **Módulos funcionales (todos operativos, con datos reales guardados en el backend):**
> 1. **Orientación** — reloj grande, fecha completa en palabras, parte del día, estación, "estás en casa", foto del entorno y frase de anclaje ("Hoy es martes. Estás en tu casa, en Madrid. Ana viene a las 5").
> 2. **Recordatorios y medicación** — agenda con horas, días de la semana, dosis y notas; avisos que aparecen solos a su hora, con voz; botones "Ya la tomé" / "Recordarme en 10 min"; registro de adherencia; alerta automática al cuidador si pasa la hora de gracia.
> 3. **¿Quién es quién?** — fichas de familiares con foto, nombre, parentesco, teléfono y un recuerdo compartido; botón "Llamar"; juego de reconocimiento de caras.
> 4. **Mis recuerdos (terapia de reminiscencia)** — álbum y línea de vida con fotos, año, historia y etiquetas; narración en voz alta.
> 5. **Mi día (rutinas paso a paso)** — mañana/tarde/noche descompuestas en pasos con pictograma, marcables, con progreso y reinicio diario.
> 6. **Ejercitar la mente (estimulación cognitiva)** — 6 juegos adaptativos de 3 niveles: Parejas, ¿Quién es?, Secuencia de colores y sonidos, Completar refranes, Números y Ordena tu día. Puntuación, historial y evolución.
> 7. **Calmarme** — respiración guiada 4-4-6 con animación y voz, mensajes tranquilizadores para episodios de ansiedad o desorientación.
> 8. **Ánimo** — check-in diario con caras, nota opcional, historial para el cuidador.
> 9. **SOS y seguridad** — botón de ayuda que envía alerta con ubicación al cuidador en tiempo real; **zona segura** (geocerca con radio configurable) que avisa si la persona sale de ella; ficha de identidad imprimible con contactos de emergencia, alergias y grupo sanguíneo.
> 10. **Panel del cuidador** — adherencia, ánimo, progreso cognitivo, alertas, diario de notas, vinculación por código, informes semanales (CSV + impresión), ajustes de accesibilidad remotos.
>
> **Requisitos no funcionales:** accesibilidad WCAG AA (foco visible, `aria-live`, navegación por teclado, `prefers-reduced-motion`, escalado de fuente, modo alto contraste, modo noche), funcionamiento offline del frontend con caché local, sin servicios externos ni trackers, contraseñas con `scrypt`, sesiones por token, validación en servidor, y datos de demostración precargados para que la app se pueda usar en el primer segundo.

---

## 1. Problema y objetivos

| Necesidad real en Alzheimer | Cómo la resuelve MemoVida |
|---|---|
| Desorientación temporal y espacial | Panel de orientación permanente + recordatorios contextuales |
| Pérdida de reconocimiento de familiares | Fichas con foto + juego de caras + recuerdo asociado |
| Olvido de medicación y citas | Alarmas con voz, confirmación en un toque y adherencia medible |
| Deterioro de memoria y atención | Estimulación cognitiva diaria adaptativa y sin frustración |
| Ansiedad, agitación, "sundowning" | Módulo de calma guiada + frase de anclaje + SOS |
| Riesgo de deambulación (wandering) | Geocerca "zona segura" + alertas en tiempo real |
| Sobrecarga del cuidador | Panel único, alertas push, diario e informes para el médico |

**Principios de diseño clínico:** aprendizaje sin error, repetición espaciada, terapia de reminiscencia, rutinas estables, una sola tarea por pantalla, estimulación multisensorial (vista + oído), y **cero mensajes de fracaso**.

## 2. Usuarios y permisos

- **Paciente** (`role: paciente`): ve y usa solo su propia información; interfaz simplificada; puede confirmar tomas, jugar, marcar rutinas, registrar ánimo y pedir ayuda.
- **Cuidador** (`role: cuidador`): gestiona uno o varios pacientes vinculados por **código de 6 caracteres**; CRUD completo, alertas, notas e informes. No puede jugar por el paciente ni borrar su historial clínico.
- Vinculación: el cuidador introduce el código → queda en `linkedPatientIds`. Un paciente puede tener varios cuidadores.

## 3. Arquitectura

```
┌────────────────────────── Navegador (HTML + CSS + JS) ──────────────────────────┐
│  Modo Paciente (tiles gigantes, voz, alto contraste)                            │
│  Modo Cuidador (dashboard, CRUD, gráficas SVG, SSE)                             │
│  api.js (fetch + token) · store.js (estado + caché offline) · router hash        │
└───────────────▲──────────────────────────────────────────────┬──────────────────┘
                │ REST JSON  /api/*                            │ SSE /api/stream
┌───────────────┴──────────────────────────────────────────────▼──────────────────┐
│                     Node.js 20 · node:http · CERO dependencias                  │
│  server.js  → estáticos + router + SSE                                          │
│  src/api.js → auth, pacientes, personas, recuerdos, recordatorios, tomas,        │
│               rutinas, ánimos, juegos, alertas, ubicaciones, notas, informes     │
│  src/auth.js→ scrypt + tokens de sesión      src/engine.js → motor de avisos     │
│  src/db.js  → almacén JSON atómico           src/bus.js    → eventos en vivo     │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
                         data/db.json  (persistente)
```

**Lenguajes usados y por qué:** HTML5 (estructura semántica accesible) · CSS3 (diseño adaptativo, alto contraste, animaciones) · JavaScript ES2022 (lógica de UI y de servidor) · JSON (persistencia y API) · SQL (esquema opcional en `docs/schema.sql` para migrar a PostgreSQL/SQLite) · Bash (arranque y pruebas).

## 4. Modelo de datos

`users`, `sessions`, `patients`, `people`, `memories`, `reminders`, `doseLogs`, `routines`, `routineLogs`, `moods`, `gameScores`, `alerts`, `locations`, `notes`.
Claves foráneas por `patientId`; toda consulta se filtra por el permiso del usuario autenticado.

## 5. API REST (resumen)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | Alta, acceso, salida |
| GET | `/api/auth/me` | Sesión actual |
| GET | `/api/bootstrap?patientId=` | Todo el estado del paciente en 1 llamada |
| GET/PATCH | `/api/patients/:id` | Perfil, zona segura, accesibilidad |
| POST | `/api/patients/link` | Vincular por código (cuidador) |
| CRUD | `/api/people` · `/memories` · `/reminders` · `/routines` · `/notes` | Gestión |
| POST | `/api/doses` | Confirmar / posponer / omitir toma |
| GET | `/api/reminders/due` | Avisos pendientes ahora mismo |
| POST | `/api/routines/:id/step` | Marcar paso de rutina |
| POST | `/api/moods` · `/api/games` | Ánimo y puntuaciones |
| POST | `/api/alerts/sos` · `/api/locations` | Ayuda y posición |
| PATCH | `/api/alerts/:id` | Atender / resolver alerta |
| GET | `/api/reports/weekly` · `/api/reports/export.csv` | Informes |
| GET | `/api/stream?token=` | Canal SSE de alertas y avisos |

## 6. Pantallas

**Paciente (9):** Acceso · Inicio (8 tiles) · Orientación · Medicación de hoy · Personas · Recuerdos · Mi día · Juegos (6) · Calma · Ficha de ayuda.
**Cuidador (10):** Panel · Pacientes · Recordatorios · Personas · Recuerdos · Rutinas · Alertas · Diario · Progreso · Informes y ajustes.

## 7. Accesibilidad (checklist aplicado)

Botones ≥ 88 px en modo paciente · fuente base 22 px escalable a 34 px · ratio de contraste ≥ 7:1 en modo alto contraste · `aria-live="polite"` para anuncios · foco visible de 4 px · navegación completa por teclado (Tab/Enter/Esc) · sin límites de tiempo en los juegos · sin arrastrar ni doble clic · pictogramas + texto siempre juntos · lectura en voz alta de cualquier pantalla · `prefers-reduced-motion` respetado · modo noche.

## 8. Seguridad y privacidad

`scrypt` (N=16384) + salt por usuario · comparación en tiempo constante · tokens de 256 bits con caducidad · validación y saneado de todo el cuerpo de las peticiones · límite de 2 MB por petición · sin dependencias de terceros (superficie de ataque mínima) · datos solo en el servidor propio · sin analítica ni cookies de terceros. **Aviso:** es una herramienta de apoyo, no un producto sanitario ni un sustituto del criterio médico.

## 9. Plan de ejecución (fases)

1. **F0 Plan** — este documento. ✔
2. **F1 Backend** — almacén JSON, auth, router, API completa, SSE, motor de avisos, semilla de datos.
3. **F2 Núcleo frontend** — shell, router, estado, cliente API, sistema de diseño accesible, voz.
4. **F3 Modo Paciente** — 9 pantallas + 6 juegos + calma + SOS.
5. **F4 Modo Cuidador** — panel, CRUD genérico, alertas en vivo, informes, geocerca.
6. **F5 Pruebas** — smoke test de API de extremo a extremo + verificación en navegador.
7. **F6 Entrega** — README, esquema SQL opcional, datos demo.

## 10. Criterios de aceptación ("100 % funcional")

- [x] Registro, login y logout reales con contraseñas cifradas.
- [x] Los datos sobreviven al reinicio del servidor.
- [x] Crear/editar/borrar recordatorios, personas, recuerdos, rutinas y notas.
- [x] Confirmar una toma actualiza la adherencia del panel al instante.
- [x] Un SOS del paciente aparece en el panel del cuidador **sin recargar** (SSE).
- [x] Los 6 juegos guardan puntuación y se ven en la gráfica de evolución.
- [x] La geocerca calcula dentro/fuera y genera alerta.
- [x] Informe semanal con datos reales + exportación CSV + impresión.
- [x] Accesibilidad: voz, escalado de fuente, alto contraste, teclado.

## 11. Fuera de alcance (siguiente iteración)

App nativa/PWA instalable en tienda, notificaciones push del sistema con la app cerrada, sincronización multi-dispositivo con base de datos distribuida, integración con wearables, videollamada WebRTC, IA de detección de deterioro del habla. Todo ello está previsto en la arquitectura (capas separadas) pero no forma parte de esta entrega.
