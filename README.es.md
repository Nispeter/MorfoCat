# MorphoCat

Morfometría geométrica en tu computadora: digitaliza landmarks, alinéalos,
ejecuta los análisis y exporta figuras para publicar. Sin instalar Python ni R.
Funciona sin conexión.

Libre, de código abierto, y una reimplementación de MorphoJ.

[English](README.md)

## Instalación

Descarga desde [Releases](https://github.com/Nispeter/MorphoCat/releases) y ábrelo.

| Sistema | Archivo |
| --- | --- |
| Windows | `MorphoCat_<versión>_x64-setup.exe` |
| Windows (despliegue IT) | `MorphoCat_<versión>_x64_en-US.msi` |
| Debian / Ubuntu | `MorphoCat_<versión>_amd64.deb` |
| Otros Linux | `MorphoCat_<versión>.AppImage` |

Si Windows dice *"Windows protegió su PC"*: **Más información → Ejecutar de todas
formas**.

Todavía no hay versión para macOS. Funciona, pero hay que
[compilarla desde el código](docs/DEVELOPING.md).

Español e inglés — se cambia en **Configuración**.

## Uso

Todo empieza en el **Gestor de Datos**.

¿Quieres probarlo primero? [`data/mosca_test.tps`](data/mosca_test.tps) es un
conjunto real de 24 alas de mosca — arrástralo y salta al paso 3.
[`data/mosca_test.morphocat.json`](data/mosca_test.morphocat.json) son los mismos
datos como proyecto terminado, con categorías y estilo de figura.

### 1. Carga tus landmarks

¿Ya tienes un `.tps`, `.nts` o Morphologika `.txt`? Arrástralo a la zona de carga.

¿Empiezas desde fotografías? **Elegir Imágenes** o **Añadir Carpeta**, luego
indica cuántos landmarks lleva cada espécimen y dónde guardar el `.tps`.

![Elegir imágenes y la cantidad de landmarks de una sesión nueva](docs/mf0.PNG)

> Guarda el `.tps` en la misma carpeta que las fotos. Los archivos TPS guardan el
> *nombre* de la imagen, no la ruta: si se separan, la aplicación no las
> encuentra.

### 2. Digitaliza

| | |
| --- | --- |
| Colocar un landmark | Clic |
| Colocar un semilandmark | **Shift** + clic |
| Deshacer | **Ctrl+Z** |
| Espécimen siguiente / anterior | **→** / **←** |
| Escala real | **Fijar escala** → marca dos puntos → escribe la distancia |
| Más fotos después | **Añadir especímenes** |

![Colocando landmarks sobre un ala, con el progreso a la derecha](docs/mf1.PNG)

Cuando estén todos: **Cargar como conjunto de datos**.

### 3. Convierte los IDs en categorías

Abre **Categorías**. Arrastra sobre los caracteres que van juntos y ponles
nombre: `26-13MA020230` se vuelve sitio, nivel, lo que hayas codificado. Para IDs
con separador como `ficu_F_031`, cambia a **Por separador** y haz clic en una
parte. Luego **Aplicar**.

![Recortando especie, familia y número de los IDs](docs/mf2.PNG)

### 4. Alinea

**Ajuste de Procrustes → Ejecutar.** Elimina posición, tamaño y rotación. Todos
los demás análisis lo necesitan hecho.

### 5. Busca errores

**Detección de Atípicos** ordena los especímenes por distancia a la forma media.
Un atípico lejano suele ser un error de digitalización: haz clic para revisarlo.
Si hay números de landmark intercambiados, se corrigen ahí para todo el conjunto.

### 6. Analiza

Normalmente el **ACP** primero. Su pestaña **Figura** arma el gráfico para
publicar: color por una categoría, símbolos por otra, dibujos de forma sobre los
ejes, leyenda movible, exportación en PNG o SVG.

![La figura del ACP: puntos coloreados por especie y wireframes en los ejes](docs/mf3.PNG)

También en la barra lateral: matrices de covarianza, correlación de matrices, PLS
de dos bloques, regresión y alometría, modularidad, AVC, ADL con validación
cruzada, métodos filogenéticos comparativos y genética cuantitativa.

### 7. Guarda

**Guardar proyecto** escribe un solo `.morphocat.json` con datos, categorías,
alineación, estilo de figura y la sesión de digitalización. Las tablas se
exportan a CSV y los gráficos a PNG o SVG.

## Notas

- No sube ni registra nada. No hace ninguna conexión de red.
- Importa: TPS, NTS, Morphologika. Exporta: TPS, CSV.
- 3D funciona para importar y los análisis centrales; la estimación de landmarks
  faltantes es 2D.
- Los antivirus dan falsos positivos por cómo se empaqueta el motor de cálculo.
  La página de Releases es la única fuente oficial.

## Más

[Compilar desde el código](docs/DEVELOPING.md) ·
[Firma de código](docs/CODE_SIGNING_POLICY.md) ·
[Referencias](REFERENCES.md) ·
[Licencia MIT](LICENSE)

¿Citas MorphoCat? Cita también MorphoJ:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric
> morphometrics. *Molecular Ecology Resources* 11: 353–357.

---

*Morpho* de morfometría, *Cat* de categorización — y de gato.
