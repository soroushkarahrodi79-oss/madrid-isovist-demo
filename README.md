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
- Huellas de edificios: geometría municipal derivada de tejados (archivo aportado por el autor, julio 2026). Origen de los datos: Ayuntamiento de Madrid. Si la licencia de reutilización exige otra atribución o condiciones, abre un issue y se corrige.
- Mapa base: © OpenStreetMap contributors (se carga en línea; sin conexión se ven solo las geometrías).
- Las isovistas son las geometrías de la fase 2A, sin recalcular.
