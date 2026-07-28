# Gea — Plan de Early Access en Steam

Hoja de ruta operativa hacia el Early Access. La dirección decide fechas
y nombres; este documento fija el ORDEN (hay pasos que bloquean a los
demás) y reparte el trabajo entre la dirección y el desarrollo.

## La línea roja: primero el rebranding, luego TODO lo demás

**Nada con IP de Zoids puede tocar una página de Steam** — ni nombres de
chasis (Liger Zero, Geno Saurer…), ni el término «Zoid», ni material
promocional que los mencione. Son marcas de Takara Tomy. La página de
tienda de un Early Access es pública desde el día uno (y Valve revisa),
así que el rebranding no es el último paso: es el PRIMERO.

La arquitectura ya está preparada para esto: todo el contenido con
nombres provisionales vive en `src/data/` marcado PROVISIONAL, y el
motor (`src/core`) no conoce ni un nombre de universo. El rebranding es
una pasada de datos + textos, no una reescritura.

**Lo que decide la dirección** (el desarrollo lo aplica en un bloque):
- Nombre comercial del juego («Gea» está probablemente bien — verificar
  colisiones en Steam y registros de marca básicos).
- Nomenclatura del universo: cómo se llaman las bestias-máquina como
  categoría (sustituto de «zoid» en textos de juego; el código interno
  puede quedarse — no se publica).
- Tabla de renombres de los ~25 chasis + armas con nombre de la
  franquicia. Las siluetas son nuestras (procedurales), pero los 2-3
  chasis calcados de diseños icónicos conviene desviarlos un punto
  cuando llegue el arte.

## Fase 0 — lo que solo puede hacer la dirección (en paralelo)

1. Cuenta de Steamworks: registro, tarifa de alta (100 USD por app,
   recuperable con 1.000 USD de ventas), datos fiscales y bancarios.
   El proceso de verificación puede tardar días o semanas: EMPEZARLO YA.
2. El arte encargado (docs/ENCARGO-ARTE.md): la cápsula de tienda es lo
   primero que vende. Steam exige un juego de cápsulas en tamaños
   concretos; el felino en 3 estilos serviría de base.
3. Decidir el precio EA y responder el cuestionario de Early Access de
   Valve (por qué EA, cuánto durará, qué cambiará, precio al salir de
   EA, cómo participará la comunidad). Puedo redactar borradores.

## Fase 1 — empaquetado de escritorio (desarrollo)

El juego es UN html autocontenido sin red: el empaquetado es el paso
técnico más barato de todo el plan.

- **Envoltorio**: Tauri (ligero, ~10 MB) o Electron (pesado pero
  trivial). Recomendación: Electron primero (integración steamworks.js
  madura, empaquetado reproducible), Tauri como optimización futura.
- **Guardados a fichero**: localStorage dentro de un webview es frágil
  (se pierde al reinstalar). Puente mínimo: volcar las claves gea-* a
  un fichero en userdata al guardar y rehidratarlas al arrancar. Deja
  listo el terreno para Steam Cloud.
- **Steamworks mínimo del día uno**: init de la API + overlay. Logros y
  Cloud pueden llegar DURANTE el EA (es lo esperable en EA).
- **Objetivos de plataforma**: Windows primero (90 % del mercado),
  Linux/Deck después — el juego es teclado+ratón; el modo gamepad para
  Deck es un bloque propio del backlog.

## Fase 2 — la vara de contenido del EA

Lo que un comprador de EA debe encontrar el primer día para no
reembolsar. Estado actual honesto:

| Pieza | Estado |
|---|---|
| Bucle táctico (CT+tempo, reacciones, vigilancia, objetivos) | ✔ hecho |
| Campaña mercenaria (contratos 5 tipos, 3 continentes, secretos) | ✔ hecho |
| Progresión (escuelas, básica, estrés, manías; historia del metal) | ✔ hecho |
| Profundidad de máquina (frames, blindaje, reactor, desgaste) | ✔ hecho |
| IA con curva + adaptación de facción | ✔ hecho |
| Tutorial + repeticiones + taller de contenido | ✔ hecho |
| Rebranding legal | ✘ BLOQUEA la página de tienda |
| Arte (cápsulas, key art, siluetas desviadas) | ✘ bloquea la página |
| Arco final de campaña (un cierre, aunque sea provisional) | ✘ deseable pre-EA |
| Sonido: pasada de mezcla + música (aunque sea 2-3 piezas) | ◐ sfx hechos, música falta |
| Gamepad/Deck | backlog EA |
| Localización EN (Steam sin inglés vende poco) | ✘ deseable pre-EA |

## Fase 3 — página de tienda y demo

- Página de tienda («coming soon») en cuanto haya rebranding + cápsulas:
  el wishlist se acumula ANTES del lanzamiento y es la métrica que
  manda. Tráiler de 60-90 s con capturas reales (las repeticiones 📼
  son material de tráiler gratis).
- Steam Next Fest con una DEMO (la escaramuza + 3 contratos) es el
  mejor empujón de wishlists disponible para un indie sin marketing.

## Orden recomendado

1. **YA**: cuenta Steamworks (dirección) + tabla de renombres (dirección)
   + arte encargado en marcha (dirección).
2. Bloque de rebranding (desarrollo, 1 sesión cuando esté la tabla).
3. Bloque de empaquetado Electron + guardados a fichero (desarrollo).
4. Página «coming soon» con cápsulas (dirección + desarrollo).
5. Bloques pre-EA: localización EN, música, arco de cierre provisional.
6. Demo para Next Fest → fecha de EA.

## Qué es el EA y qué no (para el cuestionario de Valve)

- EA porque: el motor es sólido y determinista (370 tests, golden
  master), el bucle es completo, y el plan de contenido (más regiones,
  más chasis, arco argumental, Deck) se beneficia de jugadores reales.
- NO es EA para financiar lo básico: lo básico ya existe y se puede
  demostrar con la demo.
- Comunicación: el diario de diseño (GAME-DESIGN §7) ya es un changelog
  fechado — publicarlo como notas de parche es casi gratis.
