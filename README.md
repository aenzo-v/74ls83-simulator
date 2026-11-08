# 74LS83 Lab — Simulador Educativo 3D del Sumador Binario 74LS83A

Aplicación web educativa, interactiva y tridimensional de laboratorio dedicada **exclusivamente al circuito integrado SN74LS83A / 74LS83**, un sumador binario completo de 4 bits con acarreo rápido (look-ahead carry) en encapsulado DIP-16 sobre una protoboard MB-102 de 830 puntos.

Desarrollada bajo la dirección estética **Laboratory Studio con realismo equilibrado**, combinando rigor técnico de ingeniería digital TTL con una experiencia visual tridimensional fluida e interactiva.

---

## 🎯 Modos de funcionamiento

El simulador ofrece dos experiencias pedagógicas complementarias construidas sobre la misma definición canónica del circuito:

### 1. Modo Circuito Montado (`Circuito montado`)
- La protoboard inicia completamente ensamblada con el circuito integrado 74LS83A, fuente regulada de 5 V, interruptores DIP, resistencias limitadoras de 1 kΩ, resistencias pull-down de 330 Ω, cableado jumper ordenado y 5 LEDs indicadores (4 verdes para la suma S3–S0 y 1 ámbar para el acarreo de salida C4).
- **Control interactivo de entradas**: manipula los 9 bits de entrada (A3–A0, B3–B0 y C0) tanto haciendo clic directamente sobre los actuadores de los interruptores DIP 3D como desde el panel de control lateral.
- **Fuente de alimentación**: conmuta el suministro de 5 V con estados operativos normales (5 V activo) y reposo (STBY con LEDs apagados y advertencias en pantalla).
- **Ejemplos rápidos de suma**: configura con un clic casos clave demostrativos (`0 + 0`, `7 + 1 = 8`, `15 + 1 = 16`, `15 + 15 + 1 = 31`), los cuales actúan directamente sobre los interruptores físicos virtuales del circuito.
- **Desglose aritmético columna por columna**: visualiza el cómputo bit a bit, los acarreos intermedios generados ($C_1$, $C_2$, $C_3$, $C_4$), y representaciones instantáneas en decimal, binario y hexadecimal.
- **Trazado de rutas eléctricas**: resalta en 3D el camino conductor completo de cualquier señal seleccionada ($V_{CC}$, $GND$, $A_i$, $B_i$, $C_0$, $S_i$, $C_4$).

### 2. Modo Montaje Guiado (`Montaje guiado`)
- Guía al estudiante a través de **9 etapas pedagógicas progresivas** desde una protoboard vacía hasta la validación del circuito funcional:
  1. *Etapa 1*: Reconocimiento de la protoboard (rieles de alimentación, pistas verticales de 5 nodos y ranura central DIP).
  2. *Etapa 2*: Inserción del circuito integrado 74LS83A sobre el canal central respetando la orientación del Pin 1.
  3. *Etapa 3*: Polarización del chip ($V_{CC}$ en Pin 5 y $GND$ en Pin 12, pinout canónico del 74LS83A).
  4. *Etapa 4*: Cableado de interruptores y operandos de entrada A ($A_0–A_3$) y B ($B_0–B_3$).
  5. *Etapa 5*: Conexión del acarreo inicial $C_0$ (Pin 13) y verificación de niveles no flotantes.
  6. *Etapa 6*: Ubicación de las 5 etapas de salida con resistencias limitadoras y LEDs indicadores.
  7. *Etapa 7*: Cableado de las salidas de suma $S_0–S_3$ y acarreo $C_4$ hacia sus respectivos LEDs.
  8. *Etapa 8*: Validación eléctrica integral y comprobación matemática de 4 casos de prueba.
  9. *Etapa 9*: Evaluación conceptual final y desbloqueo de práctica libre.
- **Taller 3D interactivo**: creación de cables haciendo clic en terminales válidos, reconexión de extremos, cambio de colores de cables, eliminación de componentes con borrado en cascada y soporte de deshacer/rehacer (*Undo/Redo*).
- **Validación eléctrica real**: el motor valida la conectividad mediante grafos de redes eléctricas (netlists), permitiendo el uso de orificios alternativos dentro de la misma pista física.
- **Persistencia automática en LocalStorage**: guarda el progreso del montaje y las respuestas del estudiante con tolerancia a esquemas obsoletos y prevención de corrupción de datos.

---

## ⚡ Mapa de pines canónico del 74LS83A (DIP-16)

> [!IMPORTANT]
> El pinout del **SN74LS83A** es diferente al del 74LS283. En el 74LS83A, $V_{CC}$ se ubica en el **Pin 5** y $GND$ en el **Pin 12**.

| Pin | Señal | Función | Pin | Señal | Función |
|---:|:---|:---|---:|:---|:---|
| **1** | $A_3$ | Bit 3 del sumando A (MSB) | **16** | $B_3$ | Bit 3 del sumando B (MSB) |
| **2** | $S_2$ | Bit 2 de la suma S | **15** | $S_3$ | Bit 3 de la suma S (MSB) |
| **3** | $A_2$ | Bit 2 del sumando A | **14** | $C_{out}$ ($C_4$) | Acarreo de salida final |
| **4** | $B_2$ | Bit 2 del sumando B | **13** | $C_{in}$ ($C_0$) | Acarreo de entrada inicial |
| **5** | $V_{CC}$ | Alimentación positiva (+5 V nominal) | **12** | $GND$ | Tierra de referencia (0 V) |
| **6** | $S_1$ | Bit 1 de la suma S | **11** | $B_0$ | Bit 0 del sumando B (LSB) |
| **7** | $B_1$ | Bit 1 del sumando B | **10** | $A_0$ | Bit 0 del sumando A (LSB) |
| **8** | $A_1$ | Bit 1 del sumando A | **9** | $S_0$ | Bit 0 de la suma S (LSB) |

---

## 🛠️ Pila tecnológica

- **Frontend & Framework**: React 19, TypeScript, Vite 8 (con Rolldown bundler).
- **Gráficos 3D**: Three.js, `@react-three/fiber`, `@react-three/drei`.
- **Estilos & Diseño**: Tailwind CSS 4 con `@tailwindcss/vite`, interfaz adaptativa en español.
- **Gestor de estado**: Zustand (con selectores granulares booleanos y caché referencial de netlist).
- **Pruebas unitarias**: Vitest (suite exhaustiva con 67 pruebas automatizadas que cubren las 512 combinaciones del sumador, netlists, fallas eléctricas y montaje guiado).
- **Linter**: Oxlint (0 errores, 0 advertencias).
- **Contenedorización**: Docker & Docker Compose (entorno aislado con Node.js 26 LTS).

---

## 🚀 Instrucciones de desarrollo (con Docker Compose)

El proyecto está diseñado para ejecutarse dentro de Docker, protegiendo el entorno del anfitrión (respetando la regla de no instalar dependencias directamente en Arch Linux).

### 1. Iniciar el entorno de desarrollo
```bash
docker compose up -d
```
La aplicación estará disponible inmediatamente en:
`http://localhost:5173`

### 2. Consultar registros del servidor
```bash
docker compose logs -f web
```

### 3. Ejecutar pruebas automatizadas
Para ejecutar la suite completa de 67 pruebas con Vitest:
```bash
docker compose exec web npx vitest run
```

### 4. Ejecutar análisis estático (Lint)
```bash
docker compose exec web npm run lint
```

### 5. Compilar para producción
Para compilar la aplicación y validar tipos TypeScript:
```bash
docker compose exec web npm run build
```
Los artefactos optimizados se generarán en la carpeta `dist/` divididos en paquetes vendor independientes (`three-vendor`, `framework-vendor`, `index`).

---

## 🌐 Despliegue en producción (Vercel)

El proyecto está configurado para desplegarse como una aplicación web estática (SPA) en **Vercel** sin necesidad de Docker:

1. **Configuración de Vercel (`vercel.json`)**:
   - Incluye reglas de reescritura para Single Page Application (`"source": "/(.*)", "destination": "/index.html"`).
   - Configuración de cabeceras de seguridad (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
   - Política de almacenamiento en caché inmutable (`Cache-Control: public, max-age=31536000, immutable`) para activos en `/assets/*`.

2. **Parámetros del proyecto en Vercel**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Optimizaciones de empaquetado**:
   - Bundles divididos: Three.js y Drei quedan aislados en `three-vendor.js`, el núcleo de React y Zustand en `framework-vendor.js`, y el código de la aplicación en `index.js` (~80 kB gzip), garantizando tiempos de carga ultrarrápidos y óptimo aprovechamiento del caché CDN.

---

## ⚠️ Limitaciones conocidas del modelo

> [!NOTE]
> **74LS83 Lab es un simulador lógico y topológico digital educativo**, no un motor analógico continuo tipo SPICE.

1. **Lógica TTL digital**: El motor resuelve niveles lógicos discretos (`STRONG_HIGH`, `STRONG_LOW`, `FLOATING`, `SHORT_CIRCUIT`). No resuelve ecuaciones diferenciales de tiempos de propagación en nanosegundos ni curvas analógicas I-V dependientes de la temperatura.
2. **Encendido de LEDs**: Los LEDs se modelan con comportamiento biestable (encendido/apagado) respaldado por la resolución eléctrica de red (ánodo a salida alta y cátodo a tierra con resistencia limitadora). No se simulan variaciones analógicas sutiles de luminosidad basadas en corrientes parciales.
3. **Resistencias**: El motor verifica la función de circuito de las resistencias (limitación de corriente en salidas hacia LEDs y polarización pull-down en interruptores abiertos para evitar entradas TTL flotantes). No modela disipación térmica en vatios.
4. **Alimentación**: La fuente virtual entrega 5.0 V DC nominales. Las detecciones de cortocircuito (+5 V directo a GND) disparan la protección del motor y apagan la lógica del chip para ilustrar visual y didácticamente el error.
