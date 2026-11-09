# Madrid Visual Accessibility: demo de isovistas en Lavapiés

Mapa interactivo (Leaflet, un único `index.html` autónomo generado desde `src/` y `data/`) con los resultados del piloto exploratorio MVA: nueve observadores aceptados en la plaza de Lavapiés y la calle del Ave María, sus isovistas 2D sobre las 1.307 huellas de edificios del Ayuntamiento, un área ampliada de 2 × 2 km con huellas de OpenStreetMap, una **sonda libre** que recalcula la isovista en cualquier punto, un **recorrido animado** y el resultado del **cribado de redundancia (Step 0)**.

## Qué se puede hacer
- **Explorar:** haz clic en el mapa o arrastra el punto azul y la isovista se recalcula en tu navegador (unos 10 a 25 ms). Se puede cambiar el radio (30 a 120 m) y un margen de obstáculo aproximado (0 a 1 m), fijar dos puntos A y B para compararlos, copiar un enlace con el estado, y descargar un CSV con los puntos. Un perfil polar muestra la longitud de cada rayo.
- **Recorrido:** un observador camina de la calle de Valencia a Ave María y la isovista se recalcula en cada paso, con un perfil del área visible a lo largo del trayecto.
- **Step 0:** los 250 puntos del cribado coloreados por radio medio, apertura o residuo (observado menos predicho por los controles), con el resultado del cribado.
- **Observadores de la fase 2A:** los nueve puntos con sus polígonos almacenados (calculados con Shapely) y su sensibilidad al obstáculo.
- Tema claro u oscuro, vista para móvil y teclado.

## Qué es y qué no es
- Es una **descripción geométrica**: radio máximo 100 m por defecto, 360 rayos más un rayo a cada vértice, obstáculos = huellas de tejado.
- **No** es visibilidad validada en campo, **no** es un indicador de caminabilidad y no permite inferencia poblacional (los nueve observadores son puntos colocados a mano; los de Ave María no son independientes).
- No hay alturas, fachadas, árboles ni mobiliario, así que la visibilidad real en calle es menor. Las huellas (2026) y la ortofoto usada para validar los nueve puntos (2025) no son contemporáneas.
- Sensibilidad (fase 2B): engrosar los obstáculos 1 m reduce el área entre un 12 % y un 49 %; el punto cand-026 es frágil.
- **Dos fuentes de huellas.** El área central de 700 × 700 m usa las huellas de tejado del Ayuntamiento. El resto, hasta 2 × 2 km, usa edificios de OpenStreetMap (voluntarios, consulta del 2026-11-09), con otra definición: pueden faltar edificios, estar desplazados o fusionar bloques. La sonda avisa cuando el círculo de la isovista toca la zona de OpenStreetMap, y esos resultados no son comparables con los del piloto. El piloto, el Step 0 y el recorrido solo usan huellas del Ayuntamiento.
- Cerca del borde de los datos (2 × 2 km) la isovista puede quedar truncada; la sonda también lo avisa.

## Estado del piloto: cerrado tras el Step 0 (2026-11-08)
- Se ejecutó el cribado de redundancia con una regla fijada de antemano: 250 puntos cada 20 m sobre los ejes peatonales de la EMT en los 400 m centrales, con validación cruzada por bloques espaciales de 100 m. Los controles fueron densidad edificada, distancia a huella, ancho de calle, posición en la red y POI y paradas de OpenStreetMap (ODbL).
- Resultado **MIXTO**: los controles explican el 0,94 de la varianza del radio medio y el 0,83 de la apertura (umbral de parada 0,85). En 30 particiones repetidas la apertura nunca llegó a 0,85 (máximo 0,83) y el radio medio siempre lo superó.
- Según esa regla no se pasa a la fase de contadores peatonales. No se afirma que la visibilidad carezca de valor: los controles de densidad y ancho salen de las mismas huellas que las isovistas, lo que favorece que el cribado salga redundante.
- Sin alturas, fachadas, árboles ni relación con flujo peatonal real. Los ejes son de la capa "Peatonal" de la EMT, no del callejero municipal.
- Que la demo ofrezca más funciones no cambia ese resultado: la sonda y el recorrido son visualizaciones de la misma geometría 2D.

## Fidelidad del cálculo en el navegador
`src/isovist.js` repite el algoritmo de Python (`isovist.py` de la fase 2A). Frente a esos resultados, en los nueve observadores el **área difiere como máximo un 0,5 %** y el **radio medio 0,07 m** (`tests/test_isovist.js`). El **margen de obstáculo** del navegador es una aproximación (cada pared se desplaza hacia el observador y se alarga), no el buffer exacto de Shapely de la fase 2B: difiere hasta 1,9 puntos porcentuales de área con +0,5 m y hasta 4,0 con +1,0 m. Los polígonos de los nueve observadores que se muestran en la pestaña Explorar son los almacenados de la fase 2A, no los recalculados.

## Estructura del repositorio
| Ruta | Contenido |
|---|---|
| `index.html` | Página autónoma generada; es lo que publica GitHub Pages |
| `src/template.html`, `src/style.css`, `src/app.js` | Interfaz |
| `src/isovist.js` | Cálculo de isovistas (sin dependencias, también se usa desde Node) |
| `src/vendor/` | Leaflet 1.9.4 (BSD-2-Clause) |
| `data/buildings.json`, `data/observers.json`, `data/step0_points.json` | Huellas del Ayuntamiento, observadores de la fase 2A y los 250 puntos del Step 0 |
| `data/buildings_osm.json`, `data/osm_meta.json` | Huellas de OpenStreetMap fuera del área oficial y su procedencia (consulta, fecha, recuentos, SHA-256 de la respuesta) |
| `tools/fetch_osm_buildings.py` | Descarga y prepara las huellas de OpenStreetMap (una petición a Overpass) |
| `tests/test_isovist.js` | Compara el cálculo con Python |
| `build.py` | Genera `index.html` desde `src/` y `data/` |

## Desarrollo
```bash
python -I -X utf8 build.py            # regenera index.html
python -I -X utf8 build.py --check    # comprueba que index.html corresponde a las fuentes
node tests/test_isovist.js            # compara con los resultados de Python y mide tiempos (PASS o FAIL)
python -I -X utf8 tools/fetch_osm_buildings.py   # solo si quieres volver a descargar OpenStreetMap (cambiará con el tiempo)
python -m http.server 8765            # servir en local (también funciona abriendo index.html)
```
No edites `index.html` a mano: se sobrescribe al construir.

## Datos y atribución
- **Huellas de edificios:** Origen de los datos: Ayuntamiento de Madrid. Conjunto "Modelo tridimensional de edificaciones y construcciones de la cartografía actualizada" (capas 2D de cubierta; [ficha](https://geoportal.madrid.es/IDEAM_WBGEOPORTAL/dataset.iam?id=ece2d15a-d16f-46e8-aaec-9576771b9997), revisión de metadatos 2026-07-01, escala 1:1000). Se usaron 1.307 polígonos de un contexto de 700 × 700 m alrededor de la plaza de Lavapiés, reproyectados de EPSG:25830 a WGS84 y redondeados a 6 decimales (~0,1 m). No se han alterado sus atributos de forma que cambie su sentido.
- **Licencia de reutilización:** la ficha remite a las [condiciones generales](https://datos.madrid.es/pages/condiciones-generales-ayuntamiento-de-madrid) del Ayuntamiento de Madrid: reutilización comercial y no comercial permitida, citando la fuente y la fecha de actualización, sin desnaturalizar la información y sin sugerir que el Ayuntamiento participa, patrocina o apoya el trabajo. Esta demo cumple esas condiciones y **no está respaldada por el Ayuntamiento de Madrid**.
- **Limitación de procedencia:** el archivo concreto se extrajo de una descarga hecha en julio de 2026 (SHA-256 `fcb20624…6a12`); no se registró qué capa exacta ni la fecha de actualización de esa descarga, por lo que la fecha indicada es la de revisión de la ficha, no la del archivo.
- **Huellas de OpenStreetMap (fuera del área oficial):** © OpenStreetMap contributors, licencia ODbL. Consulta a Overpass API (`overpass-api.de`) del cuadrado de 2 × 2 km alrededor de la plaza de Lavapiés, marca de tiempo OSM 2026-11-09T19:13:23Z; respuesta de 8,046,475 bytes (SHA-256 `d7162a137eb0…`). 5,398 elementos; se descartaron 1,052 dentro del área oficial y 15 que solapaban con ella, y quedan **4,327**. Se simplificaron con una tolerancia de unos 0,2 m. No son comparables con las huellas del Ayuntamiento. La respuesta bruta no se incluye en el repositorio.
- **Puntos del Step 0:** ejes de la capa "Peatonal" de la EMT; puntos de interés y paradas de OpenStreetMap (ODbL, consulta de 2026-11-08). `data/step0_points.json` contiene solo las medidas calculadas en cada punto.
- **Mapa base:** © OpenStreetMap contributors (se carga en línea; sin conexión se ven solo las geometrías).
- **Leaflet** 1.9.4, © Vladimir Agafonkin, licencia BSD-2-Clause (aviso conservado en `src/vendor/leaflet.js`).

## Licencias
Es una indicación práctica, no asesoría legal.
- **Código** (`src/app.js`, `src/isovist.js`, `src/style.css`, `src/template.html`, `build.py`, `tests/`, `tools/`): licencia [MIT](LICENSE), © 2026 soroushkarahrodi79-oss.
- **Leaflet** (`src/vendor/`): BSD-2-Clause, © Vladimir Agafonkin. Conserva su aviso en el propio archivo.
- **Huellas del Ayuntamiento y datos derivados de ellas** (`data/buildings.json`, `data/observers.json`, `data/step0_points.json`): no los cubre la licencia MIT. Rigen las [condiciones generales](https://datos.madrid.es/pages/condiciones-generales-ayuntamiento-de-madrid) del Ayuntamiento de Madrid: citar la fuente y la fecha de actualización, no desnaturalizar los datos y no sugerir que el Ayuntamiento participa o apoya este trabajo.
- **Huellas de OpenStreetMap** (`data/buildings_osm.json`, `data/osm_meta.json`): base de datos derivada de OpenStreetMap, bajo la [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors. Quien la reutilice debe atribuir y compartir las modificaciones de la base de datos bajo la misma licencia.
- **Mapa base:** © OpenStreetMap contributors, sujeto a la [política de uso de teselas](https://operations.osmfoundation.org/policies/tiles/) de la Fundación OSM.

## Pendiente
- **Huellas oficiales fuera del centro:** el área de 2 × 2 km usa OpenStreetMap porque solo hay huellas del Ayuntamiento para 700 × 700 m. Con un archivo oficial mayor se sustituiría y desaparecería el aviso.
- **Rendimiento:** alejar el zoom con todas las capas tarda en torno a 1 o 2 s la primera vez en la ventana de pruebas; no se midió en un portátil ni en un móvil reales.
- Idioma: la interfaz está solo en español.
