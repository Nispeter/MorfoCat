- probar todo por GUI: nada de lo hecho se manejó dentro de la app, sólo compila
  y pasa los 72 tests de Python. Lo más urgente de probar es el flujo nuevo:
  gestor de datos → elegir imágenes / carpeta / abrir TPS → digitalizador, y
  añadir especímenes a una sesión ya abierta
- proyectos: el formato pasó a v2 (ahora guarda la sesión del digitalizador).
  Los v1 se abren igual pero vuelven sin sesión; para esos está el botón
  "digitalizar el dataset cargado", que sólo aparece si el dataset trae
  imageDir. Ojo con la ambigüedad de fondo: si imageDir está seteado las
  coordenadas vienen multiplicadas por la escala, y si no, están en píxeles —
  conviene marcar el origen del dataset en vez de deducirlo
- ACP figura: la Figura 58 de la tesis llega a y −0.10 y estos datos sólo a
  −0.062; si es otra submuestra o otra parte de la vasija, decirlo para verificar
- ACP figura: el signo de cada CP es arbitrario y MorphoJ no sigue ninguna
  convención (probadas 5, ninguna se cumple), así que "invertir eje" seguirá
  siendo manual — se guarda en el proyecto
- interactividad (valores al pasar el mouse) en PLS, modularidad y correlación
  de matrices
- macOS salió del CI. El universal necesita el sidecar para las dos
  arquitecturas a la vez y PyInstaller sólo compila para el intérprete en el que
  corre; un leg por arquitectura sí funciona, pero los runners Intel (macos-13)
  quedaron casi 4 h en cola. Si algún día hace falta el .dmg: volver a agregar
  sólo macos-latest (Apple Silicon, sin --target), que no tiene ese problema, y
  asumir que los Mac Intel compilan desde el código
- firma gratuita (SignPath Foundation) — listo de este lado: licencia MIT,
  docs/CODE_SIGNING_POLICY.md y el workflow que firma. El requisito de "release
  previo" NO está cubierto todavía: el tag v0.1.0 existe pero su build falló en
  macOS, así que nunca se generó el borrador ni se publicó nada. Falta:
  1. que el repo sea público y tengas MFA en GitHub (el repo ya es público)
  2. publicar un release de verdad, y después postular en signpath.org/apply
  3. cuando aprueben, cargar las variables SIGNPATH_ORGANIZATION_ID /
     SIGNPATH_PROJECT_SLUG / SIGNPATH_POLICY_SLUG y el secreto
     SIGNPATH_API_TOKEN; hasta entonces el job de firma se saltea solo
  Ojo: los nombres de los inputs de la acción de SignPath salieron de su
  documentación, no están probados contra una cuenta real.
- el workflow (build → firma → publicar) corrió una vez con el tag v0.1.0 y
  falló en macOS por el sidecar universal. Como el job de release exige que
  TODA la matriz esté en verde, no se creó ningún borrador — de ahí que la
  página de releases estuviera vacía. Corregido, pero sin volver a probar:
  el tag hay que borrarlo y rehacerlo sobre main. Revisar también que
  "Collect bundles" encuentre los instaladores en cada plataforma
- ojo: el repo tiene finales de línea mezclados (LF y CRLF); si editás con
  scripts, escribí bytes respetando el salto de línea de cada archivo
