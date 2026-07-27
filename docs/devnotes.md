# devnotes

## Pendiente

- **add code** — no quedó claro a qué se refería; hay que reformularlo antes de tomarlo.
- **Probar todo por GUI.** Todo lo de abajo pasa `tsc`, `vite build`, `cargo check` y los
  60 tests de Python, pero nada se manejó todavía dentro de la app.
  Correr `npm run tauri dev` y recorrer los flujos reales antes de distribuir.
- Interactividad (valores al pasar el mouse) en los paneles que siguen con recharts:
  PLS, modularidad, correlación de matrices. PCA, biplot y atípicos ya la tienen.
- Terminar la traducción: títulos de página, acciones y controles de gráficos están
  traducidos, pero los textos dentro de las tarjetas y los toasts siguen sólo en inglés.

## Notas para quien siga

- El repo tiene **finales de línea mezclados** (unos archivos LF, otros CRLF). Si editás
  con scripts, escribí bytes y respetá el salto de línea propio del archivo —
  `Path.write_text` en Windows los duplica.
- Fixture de clasificadores con IDs codificados: `python/tests/test_data.tps` (usa `*ID=`).
- Preferencia de UX: mantener la interfaz simple y clara, sin exponer detalles internos.
- La señal filogenética trae su propio parser de Newick, así que ese camino **no**
  depende de ete3 (el mapeo ancestral y los contrastes sí lo siguen usando).

## Hecho

**Digitalización y datos**
- Escala en el digitalizador ("Set Scale"), se escribe como `SCALE=` al exportar TPS
- Importar una carpeta entera de imágenes ("Add Folder…")
- Selector de landmarks que se puede vaciar mientras se escribe (`NumberInput`)
- Clasificadores extraídos del ID; los gráficos colorean por el clasificador activo
- Subconjunto de landmarks, promediar por clasificador, estimar landmarks faltantes (TPS)
- Unir archivos ("Add specimens") y proyectos `.morfocat.json` (guardar/abrir)

**Análisis**
- Pares simétricos y línea media para simetría de objeto (llegan a la GPA de Python)
- Alinear por ejes principales
- Grilla de transformación TPS en el ACP
- DFA pareado con validación cruzada (pestaña en ADL)
- Comparación de matrices de covarianza entre grupos (pestaña en Covarianza)
- Señal filogenética multivariada Kmult (pestaña en Filogenética)
- Distancia de Mahalanobis por espécimen, junto a la de Procrustes

**Gráficos**
- Figura de ACP tipo publicación (`docs/image.png`): colores, nombres y símbolos
  editables por grupo, referencias de forma en ambos ejes, leyenda arrastrable
- Las referencias de cada eje muestran el **espécimen real más cercano** a ese punto,
  como wireframe o como foto (se elige la carpeta de imágenes en el panel)
- Límites de eje: automático / simétrico / manual
- Valores al pasar el mouse en la figura de ACP, el biplot y el gráfico de distancias
- Gráfico de distancias con una línea por espécimen, clic para revisar sus landmarks
- Export PNG/SVG en la esquina superior derecha de cada gráfico (`ChartFrame`)
- Deformación de forma a un valor exacto de CP, además de ±DE

**Interfaz**
- `color-scheme` por tema: se arreglan los desplegables ilegibles en tema oscuro
- Contraste de texto subido en el tema oscuro morado
- El sidebar atenúa las páginas que todavía no se pueden usar y explica por qué al pasar
  el mouse; punto verde en Gestor de Datos y Ajuste de Procrustes cuando ya hay resultado
- Títulos de página unificados vía i18n
- Términos en español corregidos (`ACVa`→`AVC`, "Análisis Canónico de Variantes"→
  "Análisis de Variables Canónicas", "Regresar forma sobre…"→"Regresión de la forma sobre…")
