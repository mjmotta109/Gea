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
