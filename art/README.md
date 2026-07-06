# GEA — Buzón de arte

Deja aquí los archivos TAL CUAL te los entreguen (especificación
completa en `docs/ENCARGO-ARTE.md`). El desarrollo los recoge de
estas carpetas, los embebe en el build y los conecta. Si el nombre
sigue la convención, la integración es automática.

## Convención de nombres

- `bestias/` — una por familia, en minúsculas:
  `felino.svg` · `lobo.svg` · `raptor.svg` · `teropodo.svg` ·
  `oruga.svg` · `caracol.svg` · `volador.svg` · `gorila.svg` ·
  `bisonte.svg` · `escorpion.svg` · `cuellilargo.svg` · `torreta.svg`
  (también vale `.png` a 512×384)
- `losetas/` — `llanura.png` · `bosque.png` · `agua.png` ·
  `roca.png` · `arena.png` · `ruina.png` (rombo 2:1, 128×64)
- `retratos/` — `piloto-01.png`, `piloto-02.png`… (512×512)
- `iconos/` — `garra.svg`, `calor.svg`, `faccion-gremio.svg`… (24×24)
- `audio/` — `cuartel.ogg` · `viaje.ogg` · `batalla.ogg` · `ciudad.ogg`

## Reglas

1. No renombres el juego de nadie: si un archivo no encaja en la
   convención, déjalo igualmente y el desarrollo lo acomoda.
2. Variantes para elegir: sufija `-a`, `-b` (`felino-a.svg`,
   `felino-b.svg`) y se decide en revisión.
3. Anota la procedencia (artista/herramienta y licencia) en
   `PROCEDENCIA.md` en esta misma carpeta, una línea por entrega.
