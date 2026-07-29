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
- toasts y textos de ayuda dentro de las tarjetas siguen en inglés
- firma gratuita (SignPath Foundation) — listo de este lado: licencia MIT,
  docs/CODE_SIGNING_POLICY.md, workflow que firma, y el tag v0.1.0 que cubre el
  requisito de "release previo". Falta lo que sólo podés hacer vos:
  1. que el repo sea público y tengas MFA en GitHub
  2. postular en signpath.org/apply con la URL del repo
  3. cuando aprueben, cargar las variables SIGNPATH_ORGANIZATION_ID /
     SIGNPATH_PROJECT_SLUG / SIGNPATH_POLICY_SLUG y el secreto
     SIGNPATH_API_TOKEN; hasta entonces el job de firma se saltea solo
  Ojo: los nombres de los inputs de la acción de SignPath salieron de su
  documentación, no están probados contra una cuenta real.
- el workflow de release nunca corrió en esta forma (build → firma → publicar);
  el tag v0.1.0 es la primera prueba, revisar que "Collect bundles" encuentre
  los instaladores
- ojo: el repo tiene finales de línea mezclados (LF y CRLF); si editás con
  scripts, escribí bytes respetando el salto de línea de cada archivo
