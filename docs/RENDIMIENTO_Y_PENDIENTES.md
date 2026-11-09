# Rendimiento y pendientes

Volver al [README](../README.md).

## Rendimiento (medido el 2026-11-09)
Medido en un Chrome 156 automatizado (8 núcleos, pantalla de densidad 2,5, probablemente con dibujo por software), **no en un portátil ni en un móvil reales**.

- Carga: DOMContentLoaded 1,3 s, carga completa 1,8 s, 456 KB transferidos (2,4 MB descomprimidos).
- Con la versión publicada el 2026-11-09 (commits 355ab20 y c4d9304): reposo 60 fps; recorrido a ×8 unos **14 fps**; arrastrar la sonda con una media de 67 ms por fotograma (p95 131 ms). Causa: cada actualización repintaba el canvas de los edificios, que cuesta 85–98 ms.
- Corrección (commit f35fc27): las capas que cambian en cada fotograma (sonda, recorrido, selección, Step 0) van en un canvas aparte, que se repinta en cerca de 0 ms; el canvas de los edificios solo se repinta al terminar de mover o hacer zoom. **Con la corrección no se midieron fps, solo el coste de repintado.** No se midió en móvil.

## Pendiente
- **Huellas oficiales fuera del centro:** el área de 2 × 2 km usa OpenStreetMap porque solo hay huellas del Ayuntamiento para 700 × 700 m. Con un archivo oficial mayor se sustituiría y desaparecería el aviso.
- **Fps en dispositivos reales:** medir en un portátil y un móvil.
- **Condiciones de la capa de ejes de EMT:** consulta enviada el 2026-11-09, sin respuesta todavía.
- **Idioma:** la interfaz está solo en español.
