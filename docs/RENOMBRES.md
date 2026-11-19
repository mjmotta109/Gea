# Rebranding — APLICADO (2026-11-19)

GEA ya no usa nombres, términos ni personajes de Zoids en el juego
publicado. El canon nuevo vive en **docs/LORE.md §6** (yantras, bīja,
Tradiciones Mecánicas y registro de chasis). Este documento queda como
tabla de equivalencias y lista de lo que falta fuera del juego.

## Qué se cambió

| Antes (prototipo) | Ahora (canon) |
|---|---|
| «Zoid» / «Zoids» | **yantra** / **yantras** (el núcleo: *bīja*) |
| Pilotos Van, Irvine, Moonbay, Fiona | **Iria, Basco, Noor, Tamsin** |
| Liger Zero / Liger Zero CAS | Centella / Centella-M |
| Shield Liger · Blade Liger | Rodela · Tizona |
| Geno Saurer / Geno Saurer CP | Prisma / Prisma-M |
| Gun Sniper / Gun Sniper (custom) | Visor / Visor-C |
| Command Wolf · König Wolf | Rastreador · Retícula |
| Zaber Fang · Rev Raptor | Cizalla · Navaja |
| Iron Kong · Gojulas | Martinete · Baluarte |
| Dibison · Gordos | Bombarda · Torreón |
| Gustav · Brachios | Mula · Faro |
| Pteras · Redler · Storm Sworder | Cometa · Saeta · Vencejo |
| Molga · Guysak | Tornillo · Barrena |
| Strike Laser Claw (arma y módulo) | Garras de inducción |
| Cañón de partículas (cargadas) | Láser de electrones libres |
| Cañón de impacto AZ / Shock cannon | Cañón sin retroceso |
| E-Shield · Smoke discharger | Blindaje electromagnético · Granadas fumígenas |
| Todo el resto del arsenal | Ciencia ficción dura: ver LORE §6.7 |
| «Torso y núcleo Zoid» (módulos) | «Torso y núcleo» |

Gran Brontes y Carguero colono eran propios: se quedan.

**Alcance**: nombres visibles, ids internos (chasis, armas, habilidades,
módulos), identificadores y comentarios del código, tests y scripts.
El archivo publicado va **minificado**: no lleva comentarios ni nombres
internos. Un escaneo del `dist/web/gea.html` no encuentra ningún término
de la franquicia.

**Guardados**: los de antes migran solos la primera vez que se abre el
juego (y los archivos exportados al importarlos). La tabla de migración
guarda solo HUELLAS numéricas de los términos viejos, no los términos:
el juego publicado no los contiene. El texto libre de la crónica se
respeta tal cual (una partida vieja conserva su historia).

**Comportamiento**: idéntico. Las tres partidas golden regeneradas son
iguales a las anteriores salvo en los nombres (comprobado campo a campo).

## Lo que queda fuera del juego (decisión de la dirección)

1. **`assets/models/liger-zero.glb` y `src/web3d/`** — el prototipo 3D
   usa el modelo subido de Liger Zero. No entra en el juego publicado,
   pero es material de la franquicia: borrarlo antes de abrir el repo o
   enseñarlo a nadie. La vertical slice 2.5D lo sustituye.
2. **Historia interna** — `docs/GAME-DESIGN.md` (diario fechado),
   `docs/DESIGN.md` y el historial de git mencionan los nombres viejos.
   No se publican. Si el repo se hace público algún día, valorar
   limpiar el historial.
3. **Comprobación de marcas** — «Gea», «yantra» y los apodos son
   palabras comunes, pero antes de la página de Steam conviene una
   búsqueda básica de marcas registradas en juegos (EUIPO / USPTO).
   No es asesoría legal; es la diligencia mínima.
4. **Siluetas** — son nuestras (procedurales), pero cuando llegue el arte
   conviene desviar un punto las dos más reconocibles (la felina de la
   Centella y el terópodo del Prisma). LORE §6.4 da la guía: el animal es
   la base y la máquina el carácter.
