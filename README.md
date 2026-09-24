# TreeDrawer

Herramienta de práctica de árboles, 100 % frontend y sin dependencias.

**▶ Probala online:** https://matixv23.github.io/TreeDrawer/

Hecho por **Matias** ([@MatiXV23](https://github.com/MatiXV23)) · Repo: [github.com/MatiXV23/TreeDrawer](https://github.com/MatiXV23/TreeDrawer)

- **Dibujar:** armás el árbol arrastrando y conectando nodos, y la app te dice en el momento si es un **AG**, **AB**, **ABB** o **AVL**, junto con los motivos por los que no llega a la clase siguiente.
- **Programar:** escribís tus propias funciones en JavaScript (altura, buscar, insertar, eliminar, esABB, esAVL…) y las ejecutás paso a paso sobre el árbol dibujado, viendo la línea actual, la pila de llamadas, las variables y cómo cambia el árbol.

## Cómo usarlo

Abrí `index.html` en el navegador. No hace falta instalar nada ni levantar un servidor.

Si preferís servirlo:

```bash
python3 -m http.server 8000
```

## Controles

| Acción | Cómo |
|---|---|
| Crear nodo | Doble clic en el lienzo, botón **＋ Nodo** o `N` |
| Editar valor | Doble clic en el nodo o `Enter` |
| Mover | Arrastrar el nodo |
| Conectar padre → hijo | Arrastrar desde el punto inferior del padre hasta el hijo (o `Shift` + arrastrar) |
| Crear hijo | Arrastrar desde el punto inferior y soltar en un espacio vacío |
| Borrar | Seleccionar y `Supr` / `⌫` |
| Mover la vista / zoom | Arrastrar el fondo / rueda del mouse |
| Ordenar / centrar | `L` / `F` |
| Deshacer / rehacer | `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z` |

**Izquierdo o derecho:** lo decide la posición. Si un nodo tiene un solo hijo, es izquierdo si está a la izquierda del padre y derecho si está a la derecha. Si tiene dos, el de más a la izquierda es el izquierdo. Con **Lados I/D** activado se ve en cada arista.

## Clasificación

AVL ⊂ ABB ⊂ AB ⊂ AG. Se muestra la clase más específica.

- **No es árbol**: hay más de una raíz, algún nodo tiene más de un padre, o hay ciclos.
- **AG**: es un árbol.
- **AB**: además, cada nodo tiene como máximo 2 hijos.
- **ABB**: además, en cada nodo todo su subárbol izquierdo es menor y todo el derecho es mayor (sin claves repetidas). Si todos los valores son números se comparan como números; si no, como texto.
- **AVL**: además, en cada nodo |altura(izq) − altura(der)| ≤ 1.

Convenciones (las mismas que `Nodo.altura`): una hoja tiene altura 1 y el árbol vacío, 0. FB = altura(izq) − altura(der).

También marca si el árbol binario es **perfecto**, **completo**, **lleno** o **degenerado**, y muestra altura, hojas, grado y los recorridos (pre, in, post y por niveles).

## Modo Programar

Tocá **Programar** arriba a la izquierda. Por defecto el editor trae **el esqueleto para completar**: nada viene resuelto.

### Estructura de clases (por defecto)

La misma jerarquía que en Java, pero en JavaScript:

```
Nodo (incluida)          dato, izq, der, altura · getDato/setDato, getIzq/setIzq, getDer/setDer, getAltura/setAltura, esHoja()
ArbolBinario             raiz · getRaiz, estaVacio, vaciar, insertar (por nivel), contiene, altura,
                         cantidadNodos, cantidadHojas, preorden, inorden, posorden, porNiveles
ArbolBinarioBusqueda     extends ArbolBinario · insertar (con orden), contiene, buscar, eliminar,
                         minimo, maximo, predecesor, sucesor
ArbolAVL                 extends ArbolBinarioBusqueda · insertar y eliminar (rebalancean), factorBalance,
                         estaBalanceado, rotacionDerecha, rotacionIzquierda,
                         rotacionDobleIzquierdaDerecha, rotacionDobleDerechaIzquierda
```

Los métodos pendientes lanzan `new Error("No implementado")`, como en el esqueleto de Java. Si ejecutás uno, la app avisa cuál falta y marca su línea.

- **`arbol`** es una instancia de la clase elegida en «arbol es un» (en automático: `ArbolAVL` si el dibujo es AVL, `ArbolBinarioBusqueda` si es ABB, `ArbolBinario` si es AB), y `arbol.raiz` es el árbol dibujado.
- En **Ejecutar** ponés la llamada: `arbol.altura()`, `arbol.insertar(35)`, `arbol.eliminar(20)`…
- **Estructura** abre un modal con las clases y los métodos a implementar. Cada método muestra si está implementado, pendiente, heredado o falta, y tiene tres botones: **Ir** (va a la línea en el editor), **Probar** (arma la llamada) y **Ver ejemplo**.
- **Ver ejemplo correcto** muestra una solución de referencia en solo lectura: nunca reemplaza tu código.

Los nodos del dibujo llegan con `altura` ya calculada (hoja = 1). Con **Altura / FB** activado, en Programar se ve el campo `altura` de cada nodo, en rojo si no coincide con la altura real (útil para depurar el AVL).

### Funciones sueltas

El selector también tiene ejercicios con funciones (altura, contar, buscar, esABB, esAVL, espejo, árbol general…). Elegir uno carga **solo las firmas** para completar; la solución también está detrás de «Ver ejemplo correcto». Se ejecutan con `raiz`, que es un atajo de `arbol.raiz`: `altura(raiz)`, `raiz = insertar(raiz, 5)`.

### Ejecución paso a paso

**▶ Ejecutar** anima la ejecución, **Paso** avanza de a una instrucción y **Hasta el final** corre todo de una. Clic en el número de una línea pone un breakpoint.

- La línea actual se resalta, y más suave las líneas donde esperan las llamadas anteriores.
- En el árbol, el nodo de la llamada actual se marca en naranja y los que esperan en la pila, punteados. Las variables que apuntan a nodos aparecen como etiquetas (`actual →`) y lo que devuelve cada llamada, como `↩ 2`.
- La tarjeta **Pila de llamadas** muestra cada llamada (`ArbolAVL.insertarAVL(dato=27, nodo=«30»)`) con sus variables locales.
- Si el código modifica el árbol, el dibujo cambia en vivo, incluso a mitad de una rotación. **Detener** vuelve al árbol original; si terminó, Ctrl/⌘+Z deshace el cambio.

El lenguaje es un subconjunto de JavaScript interpretado por la propia app: clases con `extends`/`super`/`this`, funciones y flechas, `let`/`const`, `if`, `while`, `for`, `for…of`, recursión, arrays con sus métodos habituales, objetos, template strings, `?.`, `??`, `Math` y punto y coma opcional. No incluye getters/setters, campos `#privados`, `switch`, `try/catch`, `async` ni módulos. Hay un límite de 200 llamadas anidadas.

Los errores se explican en español y señalan la línea, por ejemplo: «ArbolBinario no tiene la propiedad ni el método «raz». ¿Quisiste decir «raiz»?» o «el constructor de ArbolAVL tiene que llamar a super()».

El código no se guarda: al recargar la página vuelve al esqueleto.

## Extras

- Insertar un valor como en un **ABB**, o como en un **AVL** con las rotaciones correspondientes (se informa cuál se aplicó).
- Ejemplos listos para cargar.
- Exportar e importar en JSON.
- El dibujo (no el código) se guarda solo en el navegador (localStorage).
- Tema claro/oscuro.

## Estructura

```
index.html
css/styles.css
js/analysis.js   clasificación (AG / AB / ABB / AVL) y propiedades
js/layout.js     distribución automática
js/state.js      estado, historial y persistencia
js/examples.js   árboles de ejemplo
js/app.js        lienzo SVG, interacción y panel
js/editor.js     editor de código con resaltado y breakpoints
js/runner.js     ejecución paso a paso y visualización sobre el árbol
js/lang/parser.js       parser del subconjunto de JavaScript
js/lang/interpreter.js  intérprete paso a paso (generadores)
js/lang/examples.js     esqueletos, soluciones de referencia y estructura de clases
js/guide.js      modal «Estructura» / «Ejemplo correcto»
```
