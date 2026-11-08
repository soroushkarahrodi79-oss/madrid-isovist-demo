# Madrid Visual Accessibility: demo de isovistas en Lavapiés

Mapa interactivo (Leaflet, un único `index.html` autónomo) con los resultados del piloto exploratorio MVA, fases 2A y 2B:
nueve observadores aceptados en la plaza de Lavapiés y la calle del Ave María, sus isovistas 2D y las 1.307 huellas de edificios usadas como obstáculos.

## Qué es y qué no es
- Es una **descripción geométrica** de nueve puntos colocados a mano: radio máximo 100 m, 360 rayos, obstáculos = huellas de tejado.
- **No** es visibilidad validada en campo, **no** es un indicador de caminabilidad y no permite inferencia poblacional (n = 4 y 5; los puntos de Ave María no son independientes).
- No hay alturas, fachadas, árboles ni mobiliario, así que la visibilidad real en calle es menor. Las huellas (2026) y la ortofoto usada para validar los puntos (2025) no son contemporáneas.
- Sensibilidad (fase 2B): engrosar los obstáculos 1 m reduce el área entre un 12 % y un 49 %; el punto cand-026 es frágil.
- Gate 3 del proyecto MVA: HOLD. No hay evidencia de que la visibilidad aporte información más allá de densidad edificada, red y POI.

## Datos y atribución
- **Huellas de edificios:** Origen de los datos: Ayuntamiento de Madrid. Conjunto "Modelo tridimensional de edificaciones y construcciones de la cartografía actualizada" (capas 2D de cubierta; [ficha](https://geoportal.madrid.es/IDEAM_WBGEOPORTAL/dataset.iam?id=ece2d15a-d16f-46e8-aaec-9576771b9997), revisión de metadatos 2026-07-01, escala 1:1000). Se usaron 1.307 polígonos de un contexto de 700 × 700 m alrededor de la plaza de Lavapiés, reproyectados de EPSG:25830 a WGS84 y redondeados a 6 decimales (~0,1 m). No se han alterado sus atributos de forma que cambie su sentido.
- **Licencia de reutilización:** la ficha remite a las [condiciones generales](https://datos.madrid.es/pages/condiciones-generales-ayuntamiento-de-madrid) del Ayuntamiento de Madrid: reutilización comercial y no comercial permitida, citando la fuente y la fecha de actualización, sin desnaturalizar la información y sin sugerir que el Ayuntamiento participa, patrocina o apoya el trabajo. Esta demo cumple esas condiciones y **no está respaldada por el Ayuntamiento de Madrid**.
- **Limitación de procedencia:** el archivo concreto se extrajo de una descarga hecha en julio de 2026 (SHA-256 `fcb20624…6a12`); no se registró qué capa exacta ni la fecha de actualización de esa descarga, por lo que la fecha indicada es la de revisión de la ficha, no la del archivo.
- **Mapa base:** © OpenStreetMap contributors (se carga en línea; sin conexión se ven solo las geometrías).
- Las isovistas son las geometrías de la fase 2A, sin recalcular.
