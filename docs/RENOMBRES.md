# Rebranding — APLICADO (2026-07-12)

Este documento era el inventario de «todo lo que huele a Zoids» con la
columna «nombre nuevo» esperando a dirección. **Ya está bautizado y
aplicado en el código.** Queda como registro de qué se llamó cómo y por
qué, y como referencia para arte, tienda y textos futuros.

**Criterio de bautizo** (dirección + §P5 de LORE.md): más MECÁNICO que
animal, con base bestial — la silueta recuerda al animal; el nombre habla
de la máquina: herramienta, calibre, oficio. Nombres CORTOS, en
castellano, que quepan en una carta de unidad y suenen a apodo de taller
(que es lo que son: así las llama la gente, no el Registro).

**Término del universo**: «zoid» → **armazón**. Sale de los candidatos del
canon (§P5). Encaja con el tono burocrático —«licencia de armazón»— y
contrasta con el NÚCLEO vivo que lleva dentro, que sigue siendo el
misterio de Prathama que nadie comprende.

**Ids internos**: SIN TOCAR a propósito (`liger-zero`, `geno-saurer`…).
No se publican y renombrarlos exigiría migrar guardados. Solo cambian los
nombres MOSTRADOS.

## 1. Chasis — por báscula

### ▖ Extraligeros
| id interno | antes | ahora | por qué |
|---|---|---|---|
| molga | Molga | **Oruga** | oruga de insecto y oruga de tracción: la misma palabra |
| gun-sniper | Gun Sniper | **Aguja** | tirador de precisión |
| gun-sniper-naomi | Gun Sniper (custom) | **Aguja afinada** | la misma máquina, puesta a punto |
| redler | Redler | **Cometa** | volador ligero |

### ▚ Ligeros
| id interno | antes | ahora | por qué |
|---|---|---|---|
| liger-zero | Liger Zero | **Zarpa** | felino de asalto; el arma ES la garra |
| liger-zero-cas | Liger Zero CAS | **Zarpa Coraza** | la Zarpa con paquete de blindaje intercambiable |
| command-wolf | Command Wolf | **Batidor** | el que abre camino y hostiga: su oficio |
| pteras | Pteras | **Vigía** | explorador aéreo: ojos, no puños |
| zaber-fang | Zaber Fang | **Colmillo** | felino de dientes largos |
| rev-raptor | Rev Raptor | **Espolón** | espolón de ave y espolón de máquina |
| konig-wolf | König Wolf | **Montero** | cazador con jauría: lobo tirador |
| guysak | Guysak | **Alacrán** | escorpión, con su cola |
| storm-sworder | Storm Sworder | **Vendaval** | volador de golpe y viento |

### ▜ Pesados
| id interno | antes | ahora | por qué |
|---|---|---|---|
| shield-liger | Shield Liger | **Broquel** | escudo pequeño de puño: asalto que aguanta |
| blade-liger | Blade Liger | **Alabarda** | asalto con hoja |
| geno-saurer | Geno Saurer | **Basilisco** | mata con el haz, como el mito con la mirada |
| geno-saurer-cp | Geno Saurer CP | **Basilisco Ígneo** | la variante de reactor forzado |
| gustav | Gustav | **Acémila** | bestia de carga: transporte y taller rodante |
| brachios | Brachios | **Zahorí** | soporte que encuentra lo que otros no ven |
| carguero-colono | Carguero colono | *(se queda)* | ya era propio |

### █ Extrapesados
| id interno | antes | ahora | por qué |
|---|---|---|---|
| gojulas | Gojulas | **Yunque** | la muralla: donde se para todo |
| iron-kong | Iron Kong | **Mazo** | gorila con martillo: el mazo es el arma y el nombre |
| dibison | Dibison | **Ariete** | bisonte acorazado que embiste |
| gordos | Gordos | **Bastión** | artillería lenta: una fortaleza que anda |
| gran-brontes | Gran Brontes | *(se queda)* | ya era propio |

## 2. Pilotos de fábrica

Eran los protagonistas del anime. El taller permite renombrarlos; estos
son los de fábrica.

| antes | ahora |
|---|---|
| Van | **Ilán** |
| Irvine | **Corvo** |
| Moonbay | **Bruna** |
| Fiona | **Aris** |

## 3. Armas y módulos

| antes | ahora |
|---|---|
| Strike Laser Claw (habilidad + arma) | **Zarpazo de plasma** |
| Garras Strike Laser (módulo) | **Garras de plasma** |
| Cañón de partículas cargadas (habilidad + arma) | **Cañón de fisura** |
| Cañón de partículas (módulo) | **Cañón de fisura** |
| «Torso y núcleo Zoid» | **Torso y núcleo** |
| «Torso y reactor Zoid» | **Torso y reactor** |
| «Fuselaje y núcleo Zoid» | **Fuselaje y núcleo** |

El resto del arsenal (Martillo Gauss, Lanza railgun, morteros,
lanzallamas, supresor…) ya era propio.

## 4. La palabra «Zoid» en pantalla → «armazón»

- Parte de derrota: «Tus **armazones** quedan fuera de combate.»
- Garaje: etiqueta de fila «**Armazón**».
- Ciudad: «🏗 Fabricación de **armazones**» (puerta y sección).
- Tooltips del núcleo: «Todo **armazón** está vivo…».
- Comentarios del código: limpiados también (el repo se abre).

## 5. Verificación

Assert automatizado con Playwright sobre el juego construido: se recorre
menú, batalla y garaje y se comprueba que el texto visible **no contiene
ninguno** de los 22 términos de franquicia. En verde. 416 tests, tsc
limpio, build correcto.

## 6. Lo que sigue pendiente (no bloquea tienda)

- **Ids internos** (`liger-zero`…): renombrarlos exige migrar guardados.
  Bloque aparte cuando interese abrir el repo del todo.
- **Nombre de fichero del modelo 3D** (`liger-zero.opt.glb`) y los
  arquetipos de silueta (`felino`, `raptor`…): internos, sin publicar.
- **Siluetas**: desviar un punto las 2-3 más reconocibles cuando llegue
  el arte (ya estaba anotado).
- **Designación oficial** (línea + báscula, al estilo de §P5): el apodo de
  taller ya está; la designación burocrática que lo acompaña en la ficha
  del hangar queda como mejora de sabor.
