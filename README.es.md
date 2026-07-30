# MorphoCat

MorphoCat es un programa de escritorio para morfometría geométrica. Colocas
landmarks sobre fotografías, alineas los especímenes, ejecutas los análisis y
exportas figuras para publicar. No hace falta instalar nada más, y funciona sin
conexión a internet.

Es software libre, y una reimplementación de MorphoJ.

[English](README.md)

## Instalación

Descarga el archivo que corresponda a tu sistema desde
[Releases](https://github.com/Nispeter/MorphoCat/releases) y ábrelo.

| Sistema | Archivo |
| --- | --- |
| Windows | `MorphoCat_<versión>_x64-setup.exe` |
| Windows (despliegue IT) | `MorphoCat_<versión>_x64_en-US.msi` |
| Debian / Ubuntu | `MorphoCat_<versión>_amd64.deb` |
| Otros Linux | `MorphoCat_<versión>.AppImage` |

La primera vez que lo abras, Windows puede decir "Windows protegió su PC". Haz
clic en **Más información** y luego en **Ejecutar de todas formas**.

Todavía no hay versión para macOS. El programa sí funciona ahí, pero tienes que
[compilarlo desde el código](docs/DEVELOPING.md).

La interfaz está en español e inglés. El idioma se cambia en **Configuración**.

## Uso

Todo empieza en el **Gestor de Datos**.

Para probar el programa antes de digitalizar nada tuyo, usa
[`data/mosca_test.tps`](data/mosca_test.tps), un conjunto de 24 alas de mosca.
Arrástralo y salta al paso 3. Los mismos datos están guardados también como
proyecto terminado en
[`data/mosca_test.morphocat.json`](data/mosca_test.morphocat.json), con sus
categorías y su estilo de figura.

### 1. Carga tus landmarks

Si ya tienes un archivo `.tps`, `.nts` o Morphologika `.txt`, arrástralo sobre
la zona de carga.

Para empezar desde fotografías, usa **Elegir Imágenes** o **Añadir Carpeta**.
Después indicas cuántos landmarks lleva cada espécimen y dónde guardar el
archivo `.tps`.

![Elegir imágenes y la cantidad de landmarks de una sesión nueva](docs/mf0.PNG)

> Guarda el archivo `.tps` en la misma carpeta que las fotos. Un archivo TPS
> guarda el nombre de cada imagen, no la ruta hacia ella, así que el programa no
> puede encontrar tus fotos una vez que los dos se separan.

### 2. Digitaliza

| | |
| --- | --- |
| Colocar un landmark | Clic |
| Colocar un semilandmark | **Shift** + clic |
| Deshacer | **Ctrl+Z** |
| Espécimen siguiente / anterior | **→** / **←** |
| Escala real | **Fijar escala**, marca dos puntos, escribe la distancia |
| Más fotos después | **Añadir especímenes** |

![Colocando landmarks sobre un ala, con el progreso a la derecha](docs/mf1.PNG)

Cuando todos los especímenes estén completos, haz clic en **Cargar como conjunto
de datos**.

### 3. Convierte los IDs en categorías

Abre **Categorías**. Arrastra sobre los caracteres que van juntos y ponles un
nombre, de modo que `26-13MA020230` se vuelva sitio, nivel, o lo que hayas
codificado ahí. Si tus IDs usan un separador, como `ficu_F_031`, cambia a **Por
separador** y haz clic en la parte que quieras. Luego haz clic en **Aplicar**.

![Recortando especie, familia y número de los IDs](docs/mf2.PNG)

### 4. Alinea

Ve a **Ajuste de Procrustes** y haz clic en **Ejecutar**. Esto elimina las
diferencias de posición, tamaño y rotación, de modo que sólo quede la forma. Los
demás análisis lo necesitan hecho primero.

### 5. Busca errores

**Detección de Atípicos** ordena los especímenes por su distancia a la forma
media. Un espécimen que se aleja mucho suele ser un error de digitalización y no
un hallazgo, así que haz clic para revisar sus landmarks. Si se intercambiaron
dos números de landmark, puedes corregir el orden ahí, y la corrección se aplica
a todo el conjunto.

### 6. Analiza

La mayoría de los estudios empieza por el **ACP**. Su pestaña **Figura** arma el
gráfico que vas a publicar. Puedes colorear los puntos según una categoría y
elegir sus símbolos según otra, colocar dibujos de forma a lo largo de los ejes,
mover la leyenda y exportar en PNG o SVG.

![La figura del ACP: puntos coloreados por especie y wireframes en los ejes](docs/mf3.PNG)

En la barra lateral está el resto: matrices de covarianza, correlación de
matrices, PLS de dos bloques, regresión y alometría, modularidad, AVC, ADL con
validación cruzada, métodos filogenéticos comparativos y genética cuantitativa.

### 7. Guarda

**Guardar proyecto** escribe un solo archivo `.morphocat.json` con tus datos, tus
categorías, la alineación, el estilo de la figura y la sesión de digitalización.
Cada tabla se exporta además por separado a CSV, y cada gráfico a PNG o SVG.

## Notas

- El programa no sube nada y no hace ninguna conexión de red.
- Importa archivos TPS, NTS y Morphologika, y exporta TPS y CSV.
- Los datos 3D funcionan para importar y para los análisis principales. La
  estimación de landmarks faltantes es sólo 2D.
- Algunos antivirus dan un falso positivo, por la forma en que se empaqueta el
  motor de cálculo. La página de Releases es la única fuente oficial.

## Más

- [Compilar desde el código](docs/DEVELOPING.md)
- [Firma de código](docs/CODE_SIGNING_POLICY.md)
- [Referencias](REFERENCES.md)
- [Licencia MIT](LICENSE)

Si MorphoCat contribuyó a una investigación publicada, cita también MorphoJ:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric
> morphometrics. *Molecular Ecology Resources* 11: 353–357.

---

*Morpho* de morfometría, *Cat* de categorización, y de gato.
