# Límites, estado del piloto y fidelidad del cálculo

Volver al [README](../README.md).

## Qué es y qué no es
- Es una **descripción geométrica**: radio máximo 100 m por defecto, 360 rayos más un rayo a cada vértice, obstáculos = huellas de tejado.
- **No** es visibilidad validada en campo, **no** es un indicador de caminabilidad y no permite inferencia poblacional (los nueve observadores son puntos colocados a mano; los de Ave María no son independientes).
- No hay alturas, fachadas, árboles ni mobiliario, así que la visibilidad real en calle es menor. Las huellas (2026) y la ortofoto usada para validar los nueve puntos (2025) no son contemporáneas.
- Sensibilidad (fase 2B): engrosar los obstáculos 1 m reduce el área entre un 12 % y un 49 %; el punto cand-026 es frágil.
- **Dos fuentes de huellas.** El área central de 700 × 700 m usa las huellas de tejado del Ayuntamiento. El resto, hasta 2 × 2 km, usa edificios de OpenStreetMap (voluntarios, consulta del 2026-11-09), con otra definición: pueden faltar edificios, estar desplazados o fusionar bloques. La sonda avisa cuando el círculo de la isovista toca la zona de OpenStreetMap, y esos resultados no son comparables con los del piloto. El piloto, el Step 0 y el recorrido solo usan huellas del Ayuntamiento. Un contorno discontinuo en el mapa marca el límite del área oficial.
- Cerca del borde de los datos (2 × 2 km) la isovista puede quedar truncada; la sonda también lo avisa.

## Estado del piloto: cerrado tras el Step 0 (2026-11-08)
- Se ejecutó el cribado de redundancia con una regla fijada de antemano (registrada con hash): 250 puntos cada 20 m sobre los ejes peatonales de la EMT en los 400 m centrales, con validación cruzada por bloques espaciales de 100 m. Los controles fueron densidad edificada, distancia a huella, ancho de calle, posición en la red y POI y paradas de OpenStreetMap (ODbL).
- Resultado **MIXTO**: los controles explican el 0,94 de la varianza del radio medio y el 0,83 de la apertura (umbral de parada 0,85). En 30 particiones repetidas la apertura nunca llegó a 0,85 (máximo 0,83) y el radio medio siempre lo superó.
- Según esa regla no se pasa a la fase de contadores peatonales. No se afirma que la visibilidad carezca de valor: los controles de densidad y ancho salen de las mismas huellas que las isovistas, lo que favorece que el cribado salga redundante.
- Sin alturas, fachadas, árboles ni relación con flujo peatonal real. Los ejes son de la capa "Peatonal" de la EMT, no del callejero municipal.
- Que la demo ofrezca más funciones no cambia ese resultado: la sonda y el recorrido son visualizaciones de la misma geometría 2D.
- El análisis exploratorio de los residuos mostró agrupamiento espacial (I de Moran 0,24 a 0,38) sin relación con orientación de la calle, distancia al cruce ni longitud del tramo.

## Fidelidad del cálculo en el navegador
`src/isovist.js` repite el algoritmo de Python (`isovist.py` de la fase 2A). Frente a esos resultados, en los nueve observadores el **área difiere como máximo un 0,5 %** y el **radio medio 0,07 m** (`tests/test_isovist.js`).

El **margen de obstáculo** del navegador es una aproximación (cada pared se desplaza hacia el observador y se alarga), no el buffer exacto de Shapely de la fase 2B: difiere hasta 1,9 puntos porcentuales de área con +0,5 m y hasta 4,0 con +1,0 m. La sonda lo usa para mostrar la sensibilidad con margen 0, 0,5 y 1 m, y dibuja los contornos. Los polígonos de los nueve observadores que se muestran en la pestaña Explorar son los almacenados de la fase 2A, no los recalculados.
