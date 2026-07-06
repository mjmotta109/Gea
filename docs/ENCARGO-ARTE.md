# GEA — Encargo de arte y audio

Documento para artistas humanos o IAs generativas. Todo lo que se
entregue según esta especificación entra al juego **sin retrabajo**:
la arquitectura ya tiene los enchufes.

## Reglas de oro (leer antes de encargar nada)

1. **Licencia**: uso comercial cedido, sin obligación de atribución
   visible. Si lo genera una IA, revisar que sus términos lo permitan.
2. **Peso**: el juego es UN SOLO archivo HTML con todo embebido.
   Presupuesto total de arte: **4–6 MB**. Cada pieza tiene su tope
   (indicado en su sección). Menos es más.
3. **Consistencia sobre virtuosismo**: 12 sprites hermanos valen más
   que 22 obras maestras huérfanas. Mismo grosor de línea, misma luz
   (desde arriba-izquierda), mismas proporciones.
4. **Entrega**: los archivos tal cual, sin integrar. De embeberlos,
   teñirlos y conectarlos se encarga el desarrollo.

## Paleta del juego (para que el arte no desentone)

- Fondo de cabina: `#0b1014` · paneles `#141c24`
- Bando del jugador: **cian** `#53d1e0` · enemigo: **naranja** `#ff8a5c`
- Acentos: energía `#5fd9a4` · calor `#ff9f45` · peligro `#e5604c`
- Terreno: llanura `#2b3d31` · bosque `#1e4527` · agua `#1d3a52` ·
  roca `#4a4433` · muro `#11161b`

---

## 1. SPRITES DE BESTIA — prioridad máxima

Las 12 **familias** de chasis (cubren el catálogo entero de 20+ máquinas):

| Familia | Descripción para el prompt |
|---|---|
| Felino | león/tigre mecánico, ágil y noble — es LA protagonista |
| Lobo | lobo mecánico, esbelto, hocico largo |
| Raptor | dinosaurio pequeño bípedo, veloz, cola de látigo |
| Terópodo | T-rex mecánico pesado, amenazante |
| Oruga | oruga/larva acorazada baja, sobre ruedas u orugas |
| Caracol | transporte con caparazón enorme, lento y entrañable |
| Volador | pterosaurio/caza alado en vuelo bajo |
| Gorila | simio mecánico masivo, brazos como grúas |
| Bisonte | bóvido acorazado con cuernos, embiste |
| Escorpión | escorpión mecánico, cola arqueada sobre el lomo |
| Cuellilargo | saurópodo de cuello alto, plataforma andante |
| Torreta | cuadrúpedo pesado con cañón dorsal gigante |

**Especificación técnica**:
- **Vista lateral estricta, morro/cabeza a la DERECHA.**
- Fondo transparente.
- Formato ideal **SVG** (≤40 KB); alternativa PNG **512×384 px** (≤150 KB).
- **PRIMERA PASADA EN MONOCROMO** (una sola tinta, silueta con
  interiores recortados): el juego la tiñe del color del bando. Si el
  resultado convence, segunda pasada a color con acabado.
- Debe LEERSE a 46 px de ancho: nada de detalle fino que desaparezca.

**Prompt base para IA de imagen** (sustituir `[FAMILIA]`):
> side view of a mechanical [lion / wolf / raptor / t-rex / armored
> caterpillar / giant snail transport / pterosaur / gorilla / armored
> bison / scorpion / long-necked sauropod / quadruped artillery
> walker] robot, flat vector silhouette style, single solid color,
> transparent background, facing right, clean bold shapes readable at
> small size, game sprite, no text, no background

## 2. LOSETAS DE TERRENO ISOMÉTRICO — prioridad alta

El diorama dibuja prismas por código; lo que necesita del arte es la
**cara superior** de cada terreno:

- Rombo isométrico 2:1, **128×64 px**, PNG con esquinas transparentes
  (o SVG). ≤60 KB cada una.
- Set mínimo (6): llanura herbosa seca, bosque (suelo, sin árboles —
  los árboles los pone el código), agua, roca/pedregal, arena/duna,
  losa de ruina/muro.
- Que casen entre sí al repetirse (sin costuras llamativas).

**Prompt base**:
> isometric 2:1 diamond game tile, top face only, [dry grassland /
> forest floor / still dark water / rocky ground / desert sand /
> ancient ruined stone], muted dark palette, transparent background,
> seamless tileable, no objects, game asset

## 3. RETRATOS DE PILOTO — prioridad media

- 6–8 bustos (hombro hacia arriba), **512×512 px** PNG, ≤200 KB c/u.
- Mismo estilo entre todos; edades y rasgos variados; ropa de trabajo
  de taller/cabina (monos, chalecos, auriculares), NADA de uniformes
  militares solemnes. Expresión neutra con carácter.
- Van en la ficha de pilotos, el diario y los diálogos futuros.

**Prompt base**:
> portrait bust of a young mechanic pilot, worn workwear and headset,
> neutral confident expression, painted game portrait style, dark
> teal background, consistent character sheet style

## 4. ICONOGRAFÍA DE INTERFAZ — prioridad media

- ~20 iconos **SVG monocromo, 24×24** (≤5 KB c/u): garra, cañón,
  rifle, misil, escudo, calor, energía, munición, herida, estrés,
  suministros, bodega, crédito ⌾, contrato, taberna, taller,
  ferry, lanzadera, y 3 emblemas de facción (gremio / colonos /
  clanes chatarreros).
- Trazo único consistente (2 px a 24 px de lienzo).

## 5. AUDIO — prioridad media-baja (el sintetizado ya cubre)

- **4 loops ambientales** OGG, 30–90 s, bucle perfecto, ≤1 MB c/u:
  cuartel (taller, calma mecánica), viaje (amplitud, viento),
  batalla (tensión contenida, percusión), ciudad (vida de mercado).
- Opcional: 12 efectos one-shot reales (disparo, láser, impacto metal,
  explosión, pisada pesada, lluvia) OGG ≤100 KB c/u, para sustituir
  el sintetizado donde suene mejor.

## 6. IDENTIDAD — cuando haya con qué

- Logotipo "GEA" (SVG) para la pantalla de título.
- 1 ilustración clave (key art): la piloto y su bestia mirando un
  horizonte con dos lunas — o lo que la dirección decida.

---

## Qué NO encargar

- Animaciones (las hace el código: caminar, disparos, agua).
- Modelos 3D (aplazado por diseño).
- Tipografías (el monoespaciado del sistema es identidad).
- Interfaces completas (solo los iconos sueltos del punto 4).

## Orden de compra recomendado con presupuesto corto

1. Las 12 bestias en monocromo (transforman TODO el juego).
2. Los 3 emblemas de facción + 6 retratos.
3. Las 6 losetas.
4. Los 4 loops de audio.

---

# LISTA MAESTRA DE IMÁGENES (inventario completo, 2026-07-06)

Cada línea trae su nombre de archivo para el buzón `art/` — con ese
nombre, la integración es automática. Total: **~69 piezas**; el
paquete mínimo que transforma el juego son las **22 de prioridad 1-2**.

## Prioridad 1 — Identidad (13 piezas)

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 1-12 | Las 12 bestias (lateral, morro a la DERECHA, monocromo) | `bestias/felino.svg` `lobo` `raptor` `teropodo` `oruga` `caracol` `volador` `gorila` `bisonte` `escorpion` `cuellilargo` `torreta` | SVG o PNG 512×384 |
| 13 | Logotipo GEA | `iconos/logo-gea.svg` | SVG |

## Prioridad 1-bis — Láminas técnicas del lector de casco (12 piezas, empezar con 2)

El indicador de estado del Zoid necesita un BLUEPRINT por familia:
vista lateral (morro a la derecha), línea fina clara sobre fondo
transparente, panelado interior visible, estilo manual técnico, SIN
sombreado. Monocromo: el juego tiñe cada zona según su estado.

**Requisito de oro**: las ZONAS de impacto (cabeza / torso / patas
delanteras / patas traseras / arma / mochila-cola) separables —
ideal SVG con grupos nombrados (`<g id="zona-cabeza">`); si es PNG
de IA, que las zonas se distingan a línea limpia (el desarrollo
recorta las máscaras).

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 13b-24b | Lámina técnica por familia — EMPEZAR por felino y terópodo | `laminas/felino.svg` … (mismos nombres que bestias/) | SVG con grupos, o PNG 1024×768 |

**Prompt**: technical blueprint line drawing of a mechanical [lion]
robot, side view facing right, thin clean white lines on transparent
background, panel lines and joints visible, engineering manual style,
no text, no shading, no background

## Prioridad 2 — Alma (11 piezas)

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 14-21 | 8 retratos de piloto (busto, ropa de taller, expresión con carácter) | `retratos/piloto-01.png` … `piloto-08.png` | 512×512 |
| 22-24 | 3 emblemas de facción (Gremio / Colonos / Clanes) | `iconos/faccion-gremio.svg` `-colonos` `-chatarreros` | SVG 64×64 |

## Prioridad 3 — Los lugares (17 piezas)

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 25-32 | 8 fachadas de plaza: taller, mercader, fábrica, fabricación (grúa), modificación, descansos, taberna, formación | `fachadas/taller.png` etc. | 400×280, fondo transparente |
| 33-40 | 8 interiores de edificio (viñeta banner al cruzar la puerta) | `interiores/taller.png` etc. | 1200×300 |
| 41 | Escena del hangar del cuartel (bestia aparcada, foco cenital) | `escenas/hangar.png` | 1600×400 |

## Prioridad 4 — Los momentos (13 piezas)

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 42 | Key art de portada (piloto y bestia ante dos lunas) | `escenas/portada.png` | 1920×1080 |
| 43-47 | 5 viñetas de encrucijada: caravana volcada, manada salvaje, piloto perdido, peaje chatarrero, veta de chatarra | `encuentros/caravana.png` etc. | 800×450 |
| 48-50 | 3 cartas de destacamento: escolta, prospección, rastreo | `destacamentos/escolta.png` etc. | 600×338 |
| 51-52 | Victoria / derrota (sello o viñeta de fin de batalla) | `escenas/victoria.png` `derrota.png` | 800×450 |
| 53-54 | Horizontes de ciudad por facción (opcional: hay procedural) | `escenas/horizonte-colonos.png` `-chatarreros.png` | 1600×300 |

## Prioridad 5 — La quincalla (~15 piezas + audio)

| # | Pieza | Archivo | Tamaño |
|---|---|---|---|
| 55-60 | 6 losetas isométricas (cara superior del rombo) | `losetas/llanura.png` `bosque` `agua` `roca` `arena` `ruina` | 128×64 |
| 61-69 | ~9 iconos UI restantes (garra, cañón, rifle, escudo, calor, energía, herido, suministros, contrato) | `iconos/*.svg` | 24×24 |
| — | 4 loops ambientales + 12 SFX (ver sección de audio) | `audio/*.ogg` | — |

## Herramientas recomendadas (según la pieza)

- **Bestias y fachadas (vector)**: **Recraft** — genera SVG de verdad,
  que es justo nuestro formato; estilo "flat vector" consistente.
- **Consistencia de estilo entre 12+ piezas**: **Midjourney** con
  `--sref` (referencia de estilo: generas la primera bestia que te
  guste y las demás la citan) o **Scenario.gg** (entrenas un estilo
  propio con 10-20 ejemplos y todo sale hermanado — pensado para
  juegos).
- **Retratos**: aquí rinde más un **artista humano** (Fiverr/ArtStation
  buscando "character portrait game", r/gameDevClassifieds): las caras
  con alma son lo más difícil para la IA de mantener coherentes entre
  8 personajes. Si es IA: Midjourney con --cref (referencia de
  personaje).
- **Logotipo y emblemas**: **Ideogram** (el mejor con letras) o Recraft.
- **Local y gratis**: **Stable Diffusion + LoRA** (con ControlNet
  puedes forzar la pose lateral exacta de cada bestia usando mis
  siluetas como plantilla — se las paso como PNG guía si vas por ahí).
- **Audio**: **Suno/Udio** para los loops (revisar licencia comercial
  del plan) o un músico de Fiverr con el brief "4 loops ambientales
  30-60s, mecánico-desértico, sin melodía protagonista".

## El flujo que recomiendo

1. Genera **UNA bestia (el felino) en 3 estilos** distintos.
2. Me pegas las 3 aquí en el chat → te digo cuál casa con el juego y
   por qué → eliges dirección.
3. Con la elegida como referencia de estilo (`--sref`/Scenario),
   produces las 11 restantes + logo (prioridad 1).
4. Suben al buzón `art/` → las integro → juzgamos en pantalla.
5. Solo entonces encargas prioridades 2-3. Nunca compres el paquete
   entero a ciegas.
