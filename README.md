<p align="center">
  <img src="docs/assets/banner.svg" alt="TreeDrawer — Entendé los árboles, paso a paso. Un proyecto de Matias Perez." width="100%">
</p>

<p align="center">
  <strong>Una aplicación didáctica para aprender árboles implementando y viendo cómo funcionan.</strong>
</p>

<p align="center">
  <a href="https://matixv23.github.io/TreeDrawer/"><strong>▶ Probar TreeDrawer</strong></a>
  &nbsp; · &nbsp;
  <a href="#primeros-pasos">Primeros pasos</a>
  &nbsp; · &nbsp;
  <a href="#aprender-programando">Aprender programando</a>
  &nbsp; · &nbsp;
  <a href="#ejecutar-en-local">Ejecutar en local</a>
</p>

<p align="center"><sub>HTML · CSS · JavaScript &nbsp; | &nbsp; Sin dependencias &nbsp; | &nbsp; Tema claro y oscuro</sub></p>

---

## Del dibujo al algoritmo

Entender un árbol es más fácil cuando podés **construirlo, modificarlo y seguir cada paso de tu código**. TreeDrawer conecta la teoría de estructuras de datos con la práctica: dibujás un árbol, implementás funciones y observás cómo lo recorren o transforman.

Está pensada para estudiantes y para quienes quieran practicar recursión, búsquedas, recorridos y balanceo con una referencia visual. La idea es que escribas tus propias soluciones y puedas comprender qué está pasando en cada nodo.

| Dibujá y explorá | Programá y comprendé |
| --- | --- |
| Creá nodos, conectalos y reorganizá el árbol. | Completá funciones o trabajá con clases AB, ABB y AVL. |
| Descubrí si es AG, AB, ABB o AVL y por qué. | Ejecutá paso a paso y agregá puntos de interrupción. |
| Consultá altura, hojas, grado y recorridos. | Seguí las variables, la pila de llamadas y los retornos. |
| Probá inserciones en ABB y rotaciones en AVL. | Observá cómo cambia el dibujo al modificar el árbol. |

## Un vistazo a TreeDrawer

### Dibujar: la estructura a la vista

![Modo Dibujar con un árbol AVL, sus alturas, factores de balance y clasificación.](docs/assets/dibujar.png)

Creá un árbol desde cero o cargá un ejemplo. El panel analiza la estructura y explica las condiciones que cumple y las que le faltan.

### Programar: seguí el recorrido de tu código

![Modo Programar ejecutando una función de altura, con la línea actual y la pila de llamadas visibles.](docs/assets/programar.png)

La ejecución vincula el código con el dibujo: resalta el nodo actual, muestra las llamadas pendientes y permite inspeccionar cómo avanza la recursión.

## Primeros pasos

1. **[Abrí la aplicación](https://matixv23.github.io/TreeDrawer/)** y elegí **AVL perfecto** en el selector de ejemplos.
2. Activá **Altura / FB** y **Lados I/D** para relacionar cada nodo con sus propiedades.
3. Cambiá un valor o agregá un nodo y observá cómo cambia la clasificación.
4. Entrá en **Programar**, elegí el ejercicio **Altura** y completá la función.
5. Ejecutá `altura(raiz)` con **Paso** para seguir las llamadas y los valores que devuelve cada una.

> Los ejercicios empiezan con un esqueleto para completar. **Ver ejemplo correcto** abre una solución de referencia en solo lectura, sin reemplazar tu código.

## Qué podés aprender

### Familias de árboles

La aplicación muestra la clasificación más específica que cumple tu dibujo: **AVL ⊂ ABB ⊂ AB ⊂ AG**.

| Tipo | Qué lo caracteriza |
| --- | --- |
| **AG · Árbol general** | Una estructura de árbol que puede tener varios hijos por nodo. |
| **AB · Árbol binario** | Cada nodo tiene, como máximo, dos hijos. |
| **ABB · Árbol binario de búsqueda** | Además, los valores del subárbol izquierdo son menores y los del derecho son mayores, sin claves repetidas. |
| **AVL · Árbol binario de búsqueda balanceado** | Además, la diferencia de alturas entre los subárboles de cada nodo es, como máximo, 1. |

También detecta estructuras que **no son árboles**, como ciclos, múltiples raíces o nodos con más de un padre. Para árboles binarios, indica si son perfectos, completos, llenos o degenerados.

### De la recursión al balanceo

- **Medir:** altura, cantidad de nodos, cantidad de hojas y grado.
- **Recorrer:** preorden, inorden, posorden y por niveles.
- **Buscar:** valores, mínimo, máximo, predecesor y sucesor.
- **Transformar:** insertar, eliminar y construir el espejo de un árbol.
- **Validar y balancear:** comprobar las propiedades de ABB y AVL, calcular factores de balance e implementar rotaciones.

> **Convención de alturas:** árbol vacío = `0`; hoja = `1`.
> El factor de balance es `altura(izq) − altura(der)`.

## Aprender programando

Podés trabajar con **funciones sueltas** o con una **jerarquía de clases en JavaScript**:

```text
ArbolBinario
└── ArbolBinarioBusqueda
    └── ArbolAVL
```

La clase `Nodo` ya está incluida. Los métodos pendientes lanzan `Error("No implementado")` hasta que escribas tu solución.

| Referencia | Para qué sirve | Ejemplo de llamada¹ |
| --- | --- | --- |
| `arbol` | Instancia de la clase seleccionada. | `arbol.altura()` |
| `arbol.raiz` | Raíz del árbol dibujado. | `arbol.rotacionDerecha(arbol.raiz)` |
| `raiz` | Atajo de `arbol.raiz` para funciones sueltas. | `altura(raiz)` |

<sub>¹ Las llamadas requieren que hayas implementado el método o la función correspondiente. Si una operación devuelve una nueva raíz, asignala; por ejemplo: <code>arbol.raiz = arbol.rotacionDerecha(arbol.raiz)</code>.</sub>

**Estructura** permite ver los métodos implementados, pendientes, heredados o faltantes, saltar a su línea y preparar una llamada para probarlos.

### Mirá qué pasa en cada paso

- **▶ Ejecutar** anima la ejecución; **Paso** avanza una instrucción; **Hasta el final** continúa hasta terminar o encontrar un punto de interrupción.
- Un clic en el número de línea agrega un **breakpoint**.
- El nodo actual se resalta en naranja; los nodos de las llamadas pendientes aparecen punteados.
- La **pila de llamadas** muestra los parámetros y las variables locales. El dibujo también muestra referencias a nodos y retornos.
- Las modificaciones se ven durante la ejecución, incluso a mitad de una rotación. **Detener** recupera el árbol original; después de terminar, podés deshacer el cambio.

<details>
<summary><strong>Referencia de clases y nodos</strong></summary>

| Clase | Contenido |
| --- | --- |
| `Nodo` · incluida | `dato`, `izq`, `der`, `altura`; métodos `getDato/setDato`, `getIzq/setIzq`, `getDer/setDer`, `getAltura/setAltura` y `esHoja()`. Para árboles generales, `hijos`. |
| `ArbolBinario` | `raiz`, `getRaiz`, `estaVacio`, `vaciar`, inserción por nivel, `contiene`, `altura`, conteos y recorridos. |
| `ArbolBinarioBusqueda` | Inserción ordenada, `contiene`, `buscar`, `eliminar`, `minimo`, `maximo`, `predecesor` y `sucesor`. |
| `ArbolAVL` | Inserción y eliminación con rebalanceo, `factorBalance`, `estaBalanceado` y rotaciones simples y dobles. |

En la selección automática, `arbol` usa `ArbolAVL` si el dibujo es AVL, `ArbolBinarioBusqueda` si es ABB y `ArbolBinario` si es AB.

Los nodos del dibujo llegan con `altura` calculada. En **Programar**, al activar **Altura / FB**, el campo `altura` se muestra en rojo si no coincide con la altura real: una ayuda para depurar el balanceo.

</details>

<details>
<summary><strong>JavaScript admitido y límites del intérprete</strong></summary>

La aplicación interpreta un subconjunto de JavaScript para poder mostrar la ejecución paso a paso.

**Incluye:** clases con `extends`, `super` y `this`; funciones y flechas; `let` y `const`; `if`, `while`, `for` y `for…of`; recursión; arrays y sus métodos habituales; objetos; template strings; `?.`, `??`, `Math` y `console.log`. El punto y coma es opcional.

**No incluye:** getters/setters de JavaScript, campos `#privados`, `switch`, `try/catch`, `async` ni módulos. Hay un límite de **200 llamadas anidadas**.

Los errores se muestran en español y señalan la línea correspondiente. Por ejemplo, si escribís `arbol.raz`, el intérprete puede sugerir `raiz`.

</details>

## Controles

| Acción | Control |
| --- | --- |
| Crear un nodo | Doble clic en el lienzo, **＋ Nodo** o `N` |
| Editar un valor | Doble clic en el nodo o `Enter` |
| Mover un nodo | Arrastrarlo |
| Conectar padre → hijo | Arrastrar desde el punto inferior del padre hasta el hijo, o `Shift` + arrastrar |
| Crear un hijo | Arrastrar desde el punto inferior y soltar en un espacio vacío |
| Borrar la selección | `Supr` / `⌫` |
| Mover la vista / hacer zoom | Arrastrar el fondo / rueda del mouse |
| Ordenar / centrar | `L` / `F` |
| Deshacer / rehacer | `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` |

**La posición determina el lado de un hijo.** Si hay uno solo, es izquierdo o derecho según su posición respecto del padre. Si hay dos, el de más a la izquierda es el izquierdo. Activá **Lados I/D** para ver las etiquetas en las aristas.

## Guardar y retomar

El **dibujo se guarda automáticamente** en el navegador mediante `localStorage`. También podés exportarlo e importarlo en JSON para conservar ejemplos o compartirlos.

**El código del editor no se guarda al recargar la página:** vuelve al esqueleto inicial. Copiá tus implementaciones a un archivo si querés retomarlas después.

## Ejecutar en local

Descargá o cloná el repositorio y abrí **`index.html`** en tu navegador. No necesitás instalar dependencias ni compilar.

```bash
git clone https://github.com/MatiXV23/TreeDrawer.git
cd TreeDrawer
```

Si preferís usar un servidor local y tenés Python 3:

```bash
python3 -m http.server 8000
```

Luego abrí [localhost:8000](http://localhost:8000).

<details>
<summary><strong>Estructura del proyecto</strong></summary>

```text
TreeDrawer/
├── index.html                 Interfaz principal
├── css/styles.css             Estilos y temas claro/oscuro
├── docs/assets/               Logo, portada y capturas del README
└── js/
    ├── analysis.js            Clasificación y propiedades de árboles
    ├── layout.js              Distribución automática de nodos
    ├── state.js               Estado, historial y persistencia
    ├── examples.js            Árboles de ejemplo
    ├── app.js                 Lienzo SVG, interacción y panel
    ├── editor.js              Editor, resaltado y breakpoints
    ├── runner.js              Ejecución y visualización paso a paso
    ├── guide.js               Guía de estructura y soluciones
    └── lang/
        ├── parser.js          Parser del subconjunto de JavaScript
        ├── interpreter.js     Intérprete paso a paso
        └── examples.js        Ejercicios, esqueletos y referencias
```

</details>

---

<p align="center">
  <img src="docs/assets/logo.svg" alt="Logo de TreeDrawer" width="48"><br>
  <strong>TreeDrawer</strong><br>
  Desarrollado por <strong>Matias Perez</strong><br>
  <a href="https://github.com/MatiXV23">@MatiXV23</a>
</p>
