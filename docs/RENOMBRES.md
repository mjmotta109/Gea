# Inventario de rebranding — todo lo que huele a Zoids

Lista COMPLETA de elementos a cambiar antes de que exista una página de
Steam. La dirección rellena la columna «nombre nuevo» (con su historia,
la que escriba con quien quiera); el desarrollo aplica todo en un
bloque. Los **ids internos** del código no se publican y pueden quedarse
— se listan por si la dirección prefiere limpiarlos también (recomendado
a medio plazo, opcional para la página de tienda).

**Dirección de lore acordada**: más MECÁNICO que animal, pero con base
bestial — el camino del «cañón de cuatro patas»: la silueta recuerda al
animal, el nombre y el carácter hablan de la máquina (calibres,
chasis, industria). Las cuatro básculas ya están en el juego
(extraligero / ligero / pesado / extrapesado, con su rol como
subcategoría) y son un buen esqueleto para bautizar por familias.

## 1. Chasis (24 + 2 propios) — POR BÁSCULA

Riesgo: ALTO. Todos los marcados «IP» son nombres de Zoids (Takara
Tomy). Las siluetas son nuestras (procedurales), pero al llegar el arte
conviene desviar un punto las 2-3 más calcadas (liger, geno).

### ▖ Extraligeros
| id interno | nombre actual | rol | origen | nombre nuevo |
|---|---|---|---|---|
| molga | Molga | escaramuza | IP | |
| gun-sniper | Gun Sniper | tirador | IP | |
| gun-sniper-naomi | Gun Sniper (custom) | tirador | IP (+«Naomi», personaje del anime) | |
| redler | Redler | volador | IP | |

### ▚ Ligeros
| id interno | nombre actual | rol | origen | nombre nuevo |
|---|---|---|---|---|
| liger-zero | Liger Zero | asalto | IP | |
| liger-zero-cas | Liger Zero CAS | asalto | IP («CAS» incluido) | |
| command-wolf | Command Wolf | escaramuza | IP | |
| pteras | Pteras | volador | IP | |
| zaber-fang | Zaber Fang | escaramuza | IP | |
| rev-raptor | Rev Raptor | escaramuza | IP | |
| konig-wolf | König Wolf | tirador | IP | |
| guysak | Guysak | escaramuza | IP | |
| storm-sworder | Storm Sworder | volador | IP | |

### ▜ Pesados
| id interno | nombre actual | rol | origen | nombre nuevo |
|---|---|---|---|---|
| shield-liger | Shield Liger | asalto | IP | |
| blade-liger | Blade Liger | asalto | IP | |
| geno-saurer | Geno Saurer | asalto | IP | |
| geno-saurer-cp | Geno Saurer CP | asalto | IP | |
| gustav | Gustav | transporte | IP | |
| brachios | Brachios | soporte | IP | |
| carguero-colono | Carguero colono | transporte | **propio** ✔ | (se queda) |

### █ Extrapesados
| id interno | nombre actual | rol | origen | nombre nuevo |
|---|---|---|---|---|
| gojulas | Gojulas | tanque | IP | |
| iron-kong | Iron Kong | tanque | IP | |
| dibison | Dibison | tanque | IP | |
| gordos | Gordos | tirador | IP | |
| gran-brontes | Gran Brontes | jefe 2×2 | **propio** ✔ | (se queda) |

## 2. Pilotos por defecto (personajes del anime)

Riesgo: ALTO — son los protagonistas de Zoids: Chaotic Century.
`src/web/main.ts` (DEFAULT_PILOT_NAMES). El taller ya permite
renombrarlos en caliente; esto cambia los de FÁBRICA.

| actual | nuevo |
|---|---|
| Van | |
| Irvine | |
| Moonbay | |
| Fiona | |

## 3. Armas y módulos con nombre de franquicia

Riesgo: MEDIO. Casi todo el arsenal es nuestro (genérico). Cambiar:

| dónde | actual | nota | nuevo |
|---|---|---|---|
| weapons.ts + módulo | Strike Laser Claw / Garras Strike Laser | técnica insignia del Liger Zero | |
| weapons.ts + módulo | Cañón de partículas (cargadas) | término insignia de la franquicia; palabras genéricas, pero reconocible — renombrar por seguridad y sabor | |
| modules.ts | «Torso y núcleo Zoid» | contiene la palabra Zoid | |

El resto del arsenal (Martillo Gauss, Lanza railgun, morteros, lanzallamas,
supresor, etc.) es **propio** ✔.

## 4. La palabra «Zoid» en textos visibles

Riesgo: ALTO (es LA marca). La dirección decide el término del universo
para la categoría de máquinas (p. ej. «chasis», «bestia», «armazón», o
un nombre inventado del lore). Apariciones visibles al jugador:

- Parte de derrota: «Tus Zoids quedan fuera de combate.»
- Garaje: etiqueta de fila «Zoid».
- Ciudad: «🏗 Fabricación de Zoids» (puerta y sección, ×2).
- Textos del hangar/bio del núcleo («Todo Zoid está vivo…» en tooltips).
- docs/ y comentarios del código: masivo pero NO se publica (limpieza
  opcional, recomendada antes de abrir el repo o kit de prensa).

## 5. Lo que NO hace falta tocar

- El nombre «Gea», regiones, ciudades, facciones, contratos,
  encrucijadas, destacamentos: TODO propio ✔.
- Los ids internos (localStorage `gea-*`, ids de chasis en guardados):
  no se publican. Si se renombran ids, hará falta migración de
  guardados — por eso la recomendación es renombrar solo NOMBRES
  mostrados ahora y dejar los ids para un bloque con migración.
- Las siluetas procedurales: nuestras (12 arquetipos). Solo desviar las
  más reconocibles cuando llegue el arte.

## Cómo entregarlo

Rellena las columnas (vale un mensaje de chat con la lista). Con la
tabla completa, el bloque de aplicación es: renombres en data/ +
term del universo en los textos de UI + entrada en GAME-DESIGN +
verificación Playwright de que ningún texto visible contiene los
términos viejos (assert automatizable) + tests en verde.
