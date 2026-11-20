# Control de Gastos y Ahorro

Aplicación web simple para controlar el presupuesto familiar: ingresos, gastos y saldo de cada mes, con historial y gráficos.

## Características

- **Ingresos del mes**: un campo editable en la tarjeta de resumen (no es fijo, lo escribes cada mes).
- **Gastos fijos** por categoría, con valor presupuestado y valor real por concepto; las categorías son fijas pero editables, y se pueden agregar más con "+ Agregar".
- **Gastos hormiga**: secciones y sub-secciones libres para gastos pequeños (ej. Comida → Empanada, Carro → Llantas, Iglesia → Ofrenda), con su propio total por sección.
- Cálculo automático de **saldo del mes** (ingresos reales − gastos reales, incluyendo gastos hormiga) y **ahorro acumulado** entre meses.
- Gráfico de **distribución de gastos por categoría** (incluye gastos hormiga) y de **historial de saldo** de los últimos 12 meses.
- Navegación entre meses (anterior/siguiente o selector de mes y año).
- **Exportar a Excel** el mes actual (hojas de Resumen, Gastos y Gastos Hormiga) con un botón.
- **Exportar / importar** un respaldo en JSON de todos los datos.
- Los datos se guardan localmente en el navegador (`localStorage`); no requiere servidor ni conexión a internet.
- Responsive y con soporte de modo oscuro automático según el sistema.

## Uso

No requiere instalación ni dependencias. Basta abrir `index.html` en un navegador, o servirlo como sitio estático.

### Ejecutar localmente

```bash
# Opción 1: abrir directamente
# Doble clic en index.html

# Opción 2: con un servidor estático simple
npx serve .
```

### Publicar en GitHub Pages

1. Sube este repositorio a GitHub.
2. En **Settings → Pages**, selecciona la rama `main` y la carpeta raíz (`/`).
3. La app quedará disponible en `https://<usuario>.github.io/<repositorio>/`.

## Estructura

```
index.html   Estructura de la página
style.css    Estilos y temas (claro/oscuro)
app.js       Lógica de la aplicación y persistencia en localStorage
```

## Privacidad

Toda la información se guarda únicamente en el navegador del usuario (`localStorage`). Nada se envía a ningún servidor. Se recomienda exportar un respaldo periódicamente desde el botón **"Exportar respaldo (JSON)"**.
