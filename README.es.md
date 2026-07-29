# MorfoCat

Morfometría geométrica en tu computadora. Coloca landmarks sobre fotografías,
alinéalos y obtén los análisis y las figuras que necesita un estudio de forma,
sin instalar Python, R ni nada más.

MorfoCat es una reimplementación libre y de código abierto de MorphoJ. Funciona
por completo en tu equipo: no sube nada, no registra nada y anda sin conexión.

**English:** [read me in English](README.md)

---

## Instalación

Descarga el archivo que corresponda a tu sistema desde la
[página de versiones](https://github.com/Nispeter/MorfoCat/releases) y ábrelo.
Todo lo que la aplicación necesita viene adentro; no hay nada más que instalar.

| Tu sistema | Descarga esto | Después |
| --- | --- | --- |
| Windows | `MorfoCat_<versión>_x64-setup.exe` | Doble clic → Siguiente → Instalar |
| Windows gestionado por IT | `MorfoCat_<versión>_x64_en-US.msi` | Para despliegue en red |
| macOS | `MorfoCat_<versión>.dmg` | Arrastra MorfoCat a Aplicaciones |
| Linux (Debian/Ubuntu) | `MorfoCat_<versión>_amd64.deb` | `sudo apt install ./MorfoCat_*.deb` |
| Linux (cualquier otro) | `MorfoCat_<versión>.AppImage` | Dale permiso de ejecución y ábrelo |

> **Si Windows dice "Windows protegió su PC"**, haz clic en **Más información** y
> luego en **Ejecutar de todas formas**. En macOS, haz clic derecho sobre la
> aplicación y elige **Abrir** la primera vez. Esto le pasa a los proyectos
> independientes pequeños y no significa que el archivo tenga algo malo.

La aplicación está en español e inglés. El idioma se cambia en **Configuración**.

---

## Cómo se usa

En resumen: carga tus landmarks, alinéalos y analiza. Todo empieza en el
**Gestor de Datos**, que es la primera página que ves.

### 1. Carga tus landmarks

**Si ya tienes un archivo de landmarks** (`.tps`, `.nts` o Morphologika `.txt`),
arrástralo sobre la zona de carga del Gestor de Datos. Listo, pasa al paso 2.

**Si empiezas desde fotografías**, usa los botones de arriba del Gestor de Datos:

- **Elegir Imágenes** — escoge las fotos una por una
- **Añadir Carpeta** — toma todas las fotos de una carpeta de una vez
- **Abrir TPS** — sigue con un archivo que ya empezaste a digitalizar

Al elegir fotos se abre una ventana donde indicas cuántos landmarks lleva cada
espécimen y dónde guardar el archivo `.tps`.

> **Guarda el `.tps` en la misma carpeta que las fotos.** Un archivo TPS anota el
> *nombre* de cada imagen, no la ruta hacia ella. Si se separan, la aplicación no
> puede encontrar tus fotos. Te avisa cuando pasa, pero es más fácil evitarlo.

Después, en el **Digitalizador**:

| Para hacer esto | Haz esto |
| --- | --- |
| Colocar un landmark | Clic sobre la foto |
| Colocar un semilandmark | Mantén **Shift** y haz clic |
| Deshacer el último | **Ctrl+Z** |
| Espécimen siguiente / anterior | **→** / **←**, o las flechas sobre la imagen |
| Fijar la escala real | **Fijar escala**, marca dos puntos y escribe la distancia real |
| Agregar más fotos después | **Añadir especímenes**, en el panel derecho |

Cuando todos los especímenes estén completos, haz clic en **Cargar como conjunto
de datos**. Vuelves al Gestor de Datos con los datos listos.

### 2. Convierte los IDs en categorías

Casi siempre el nombre del espécimen codifica información: sitio, nivel,
material, sexo. MorfoCat puede recortar ese código en **categorías** para después
colorear y agrupar por ellas.

Abre la tarjeta **Categorías** en el Gestor de Datos. Con un ID como
`26-13MA020230`, arrastra sobre los caracteres que van juntos y ponle nombre a
ese trozo. Si tus IDs usan un separador (`ficu_F_031`), cambia a **Por
separador** y haz clic en la parte que quieras. Crea las categorías que
necesites y luego **Aplicar**.

### 3. Alinea las formas

Ve a **Ajuste de Procrustes** y haz clic en **Ejecutar**. Esto elimina las
diferencias de posición, tamaño y rotación, de modo que sólo quede la forma.
Todos los demás análisis lo necesitan hecho primero.

### 4. Busca errores

**Detección de Atípicos** muestra qué tan lejos está cada espécimen de la forma
media. Uno que se aleje mucho suele ser un error de digitalización, no un
hallazgo: haz clic para revisar sus landmarks. Si se intercambiaron dos números
de landmark, puedes corregir el orden ahí mismo y se aplica a todo el conjunto.

### 5. Analiza

El **ACP** es donde empieza la mayoría de los estudios: muestra las direcciones
principales de variación de la forma y dónde cae cada espécimen en ellas.

Su pestaña **Figura** arma un gráfico listo para publicar: colorea por una
categoría y usa símbolos según otra, coloca dibujos de forma a lo largo de los
ejes, mueve la leyenda a donde quieras y exporta en PNG o SVG.

El resto de los análisis está en la barra lateral: matrices de covarianza,
correlación de matrices, PLS de dos bloques, regresión y alometría, modularidad,
AVC, ADL con validación cruzada, métodos filogenéticos comparativos y genética
cuantitativa.

### 6. Guarda tu trabajo

**Guardar proyecto** escribe un único archivo `.morfocat.json` con tus datos, tus
categorías, la alineación, el estilo de la figura y la sesión de digitalización.
Ábrelo más adelante y todo vuelve como lo dejaste.

Además, cada tabla y cada gráfico se exportan por separado: CSV para los números,
PNG o SVG para las figuras.

---

## Preguntas frecuentes

**¿Necesito tener Python o R instalado?** No. El motor de cálculo viene dentro de
la aplicación.

**¿Envía mis datos a algún lado?** No. MorfoCat no hace ninguna conexión de red.
Tus imágenes y archivos se quedan en tu computadora.

**El antivirus lo marcó.** Es un falso positivo conocido, por la forma en que se
empaqueta el motor de cálculo. El instalador de la página de versiones es el
único oficial.

**¿Sirve para datos 3D?** La importación y los análisis centrales funcionan en
3D. La estimación de landmarks faltantes es sólo 2D por ahora.

**¿Qué formatos puedo abrir?** TPS, NTS y Morphologika para importar; TPS y CSV
para exportar.

---

## Para quien programa

Cómo compilar MorfoCat desde el código fuente, ejecutar las pruebas y publicar
versiones está en **[docs/DEVELOPING.md](docs/DEVELOPING.md)** (en inglés).

---

## Cómo citarlo

Si MorfoCat contribuyó a una investigación publicada, cita también el programa
que reimplementa:

> Klingenberg, C. P. 2011. MorphoJ: an integrated software package for geometric
> morphometrics. *Molecular Ecology Resources* 11: 353–357.

---

## Licencia

MIT — ver [LICENSE](LICENSE). Libre de usar, incluso comercialmente.
