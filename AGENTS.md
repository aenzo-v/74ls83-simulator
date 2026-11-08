# AGENTS.md — Simulador 3D del 74LS83

## 1. Misión y alcance

Desarrollar una aplicación web educativa, interactiva y tridimensional dedicada **exclusivamente al circuito integrado 74LS83A**, un sumador binario completo de 4 bits. La aplicación debe permitir comprender el funcionamiento del chip sobre una protoboard realista.

Dos modos obligatorios:

1. **Circuito montado**: la protoboard inicia con el chip, la alimentación, los interruptores, el cableado, las resistencias y los indicadores LED ya conectados. El estudiante cambia A (4 bits), B (4 bits) y Cin (1 bit), y observa suma (4 bits) y Cout (1 bit) en tiempo real.
2. **Montaje guiado**: el estudiante ensambla el mismo circuito, paso a paso, con puntos de conexión resaltados, instrucciones en español, validación de conexiones reales y retroalimentación de errores. Al completar el montaje, obtiene el mismo circuito funcional del primer modo.

No convertir la aplicación en un simulador universal de electrónica. No introducir otros circuitos integrados, lógica programable, placas Arduino ni funciones ajenas al 74LS83A sin autorización explícita.

## 2. Entorno existente: respetarlo

El sistema anfitrión es **Arch Linux**, con **Docker y Docker Compose ya instalados**. La aplicación React/Vite ya está creada y funciona dentro del contenedor.

Stack existente:

- Node.js 26 LTS **dentro de Docker**; npm para gestión de paquetes.
- React 19, TypeScript, Vite 8.
- Three.js, `@react-three/fiber`, `@react-three/drei`.
- Tailwind CSS 4 con `@tailwindcss/vite`.
- Zustand para estado de la aplicación.
- Vitest para pruebas de lógica.

Reglas obligatorias:

- **NO instalar Node.js, npm ni ninguna dependencia o herramienta de desarrollo en Arch Linux.**
- **NO usar `sudo pacman`, `yay`, `paru`, `npm install` ni `npx` directamente en el anfitrión.**
- Ejecutar comandos Node/npm siempre dentro de Docker Compose, por ejemplo:
  - `docker compose exec web npm run build`
  - `docker compose exec web npm run lint`
  - `docker compose exec web npx vitest run`
  - `docker compose exec web npm install <paquete>` (solo cuando esté justificado).
- Si el servicio no está iniciado, usar `docker compose run --rm web <comando>`.
- Para iniciar: `docker compose up -d`; para consultar errores: `docker compose logs --tail=100 web`.
- `node_modules` debe permanecer en el volumen Docker configurado, no instalarse en el directorio del anfitrión.
- No modificar el Dockerfile, `compose.yaml`, puertos, `vite.config.ts` ni versiones de dependencias salvo que la tarea lo requiera y se explique por qué. **Vite debe seguir escuchando en `0.0.0.0` dentro del contenedor.**
- Respetar `package-lock.json`; no actualizar dependencias indiscriminadamente. No usar `docker compose down -v`, `docker system prune`, comandos destructivos o privilegios elevados sin aprobación del usuario.

## 3. Exactitud electrónica: fuente de verdad

Tomar como referencia el **74LS83A / SN74LS83A en encapsulado DIP-16, vista superior**. No confundir su disposición física con la del 74LS283, que es funcionalmente similar pero tiene un pinout diferente.

**Mapa de pines canónico (notación de bits A0–A3 / B0–B3 / S0–S3, de menos a más significativo):**

| Pin | Señal | Pin | Señal |
|---:|---|---:|---|
| 1 | A3 | 16 | B3 |
| 2 | S2 | 15 | S3 |
| 3 | A2 | 14 | Cout (C4) |
| 4 | B2 | 13 | Cin (C0) |
| 5 | VCC (+5 V) | 12 | GND |
| 6 | S1 | 11 | B0 |
| 7 | B1 | 10 | A0 |
| 8 | A1 | 9 | S0 |

Nota: algunas hojas de datos usan A1–A4, B1–B4 y Σ1–Σ4 para los mismos bits. En el código usar índices 0–3 consistentemente y comentar la equivalencia.

Referencia técnica: https://mdgomez.webs.uvigo.es/LEDG/hojas_caracteristicas/74LS83.pdf
Referencia alternativa: https://www.evselectro.com/image/data/datasheet/7483.pdf

Comportamiento lógico, para entradas definidas y chip correctamente alimentado:

- `total = A + B + Cin`, donde A y B están entre 0 y 15, y Cin es 0 o 1.
- `S = total & 0b1111` (4 bits).
- `Cout = (total >> 4) & 1`.
- Probar exhaustivamente las **512 combinaciones** de A, B y Cin.

**Importante:** una suma aritmética correcta no significa que un montaje esté bien cableado. El motor debe resolver eléctricamente las conexiones antes de determinar el estado de cada señal. No encender indicadores si las señales no llegan al componente por una red válida. Representar explícitamente errores conocidos (sin alimentación, cortocircuito, entrada desconectada, salida mal conectada). Para situaciones no modeladas, indicar la limitación; no inventar precisión analógica ni comportamiento de un circuito real.

El modelo de alimentación debe representar nominalmente 5 V y GND. Verificar con la hoja de datos el uso de resistencias y los límites de corriente de salida de la familia LS-TTL antes de afirmar que un montaje de LEDs es físicamente fiel. Un indicador visual del nivel lógico no debe confundirse con una simulación analógica exacta de corriente o luminosidad.

## 4. Arquitectura obligatoria

Separar responsabilidades para que ambos modos usen **una única definición del circuito**:

- **Dominio / lógica (`src/simulator/`)**: modelo de componentes, mapa de pines, topología de la protoboard, conexiones, resolución de redes, suma digital, estados de error y validación del montaje. Debe ser TypeScript puro, independiente de React y Three.js.
- **Definición del circuito (`src/data/`)**: componentes, posiciones, terminales, cableado correcto, conexiones esperadas y pasos del montaje guiado. Única fuente de verdad compartida por ambos modos.
- **Estado (`src/store/`)**: Zustand para modo activo, pasos, conexiones reales, entradas, selección e interfaz. Mantener los datos derivados fuera del estado cuando puedan calcularse.
- **Vista 3D (`src/components/scene/`)**: React Three Fiber para protoboard, chip DIP-16, cables, interruptores, resistencias, LEDs, cámara e interacciones 3D. La escena representa el estado del motor; **no calcula la electrónica**.
- **Interfaz (`src/components/ui/`)**: panel de bits, resultados, controles de cámara, ayuda, estado de conexiones e instrucciones de montaje. Interfaz y textos en **español**.

Esta organización es una guía; conservar la estructura existente cuando sea razonable. No realizar reestructuraciones masivas sin necesidad.

## 5. Requisitos de interacción y experiencia visual

- Escena tridimensional navegable con órbita, zoom y desplazamiento controlado; cámara inicialmente enfocada en toda la protoboard.
- Apariencia de laboratorio didáctico: componentes reconocibles, colores de cables diferenciables, etiquetas legibles y proporciones coherentes. Priorizar claridad y precisión por encima de efectos decorativos.
- El encapsulado DIP-16 debe colocarse correctamente atravesando la ranura central de la protoboard, respetando su orientación y muesca del pin 1.
- La protoboard debe modelar correctamente sus grupos de contactos internos, separación central y rieles de alimentación (incluidos posibles cortes de riel cuando se representen).
- Los cables deben unir **terminales/agujeros existentes**. Validar por conectividad eléctrica, no por mera proximidad geométrica.
- Un interruptor modifica una entrada real del circuito. Los LEDs e indicadores deben reflejar el resultado del motor, no una animación independiente.
- En montaje guiado: resaltar destino y origen permitidos, permitir acciones de conectar/desconectar, explicar errores, mostrar progreso y ofrecer reinicio del paso. No marcar un paso como correcto por una simple pulsación en «Siguiente».
- El montaje terminado en modo guiado debe producir la **misma netlist efectiva** que el modo montado; compartir pruebas de equivalencia.
- Mantener alternativa de control en la interfaz para tareas fundamentales que no sean cómodas con ratón/táctil; no depender solo del color para transmitir estados.
- Para agujeros y piezas repetidas, considerar `InstancedMesh` u otras optimizaciones antes de crear cientos de mallas independientes. Liberar recursos gráficos cuando proceda.

## 6. Convenciones de implementación

- Usar TypeScript estricto. Evitar `any`; preferir tipos explícitos, interfaces y uniones discriminadas para estados del circuito.
- Componentes React pequeños y reutilizables; lógica de dominio en funciones puras probables con Vitest.
- No duplicar el estado lógico en múltiples sitios, ni hardcodear colores de LED como sustituto del motor.
- Evitar añadir dependencias, servicios, backends, bases de datos, motores SPICE o físicas 3D cuando no sean necesarios para el alcance.
- Emplear APIs vigentes del stack instalado; no migrar tecnologías por iniciativa propia.
- Si se necesitan modelos 3D, preferir geometrías procedurales o recursos GLB optimizados con licencia compatible. No atribuir realismo técnico a modelos cuyas dimensiones/orientación no fueron verificadas.
- No incorporar claves API, telemetría ni servicios externos obligatorios sin solicitud expresa.

## 7. Pruebas y criterios de aceptación

Antes de dar por terminada una tarea relevante:

1. Ejecutar `docker compose exec web npm run build` y corregir errores de TypeScript/Vite.
2. Ejecutar `docker compose exec web npm run lint` si el script está disponible y corregir fallos relacionados con los cambios.
3. Ejecutar `docker compose exec web npx vitest run` para las pruebas existentes.
4. Para cambios en lógica digital, probar las 512 combinaciones y los casos límite (`0+0+0`, `15+15+1`, acarreo, cambio de un bit).
5. Para cambios de conexiones, probar rieles, grupos internos de la protoboard, un cable faltante, alimentación desconectada, entrada flotante y cortocircuito detectado.
6. Para cambios visuales/interactivos, verificar manualmente el funcionamiento en navegador cuando se disponga de acceso real. No afirmar haberlo comprobado si no se pudo abrir.
7. No dejar errores en consola, importaciones rotas, dependencias sin usar o funcionalidades de demostración presentadas como terminadas.

## 8. Flujo de trabajo para agentes

- Antes de editar, inspeccionar los archivos y scripts reales del proyecto. No asumir que la estructura sugerida ya existe.
- Para tareas complejas, presentar un plan breve y ejecutarlo por etapas verificables. Priorizar una implementación vertical pequeña y funcional sobre grandes bloques de código especulativo.
- Orden recomendado: **modelo digital probado → circuito y conectividad → escena 3D → modo montado funcional → montaje guiado validado → mejoras visuales y accesibilidad**.
- No sobrescribir trabajo ajeno ni eliminar código del usuario sin justificarlo. Evitar cambios fuera del alcance de la tarea.
- Tras cada tarea, informar en español: qué cambió, archivos modificados, comandos de prueba realizados, resultados, limitaciones y siguiente paso recomendado.
- Si no es posible ejecutar Docker, disponer del navegador o acceder a una referencia, declarar la limitación de forma explícita. No inventar resultados de tests ni capturas de pantalla.
- Ante ambigüedades secundarias, elegir la solución más sencilla, documentarla y continuar. Consultar al usuario antes de decisiones que cambien el alcance o puedan destruir datos.

## 9. Definición de terminado del producto

El simulador se considerará terminado cuando el modo montado permita operar los 9 bits de entrada y observar las 5 salidas correctas, y el modo guiado permita reproducir y validar las conexiones del mismo circuito sobre una protoboard 3D, con mensajes didácticos en español, comportamiento coherente ante errores modelados, pruebas automatizadas y compilación exitosa. El usuario debe poder desarrollarlo y ejecutarlo **sin instalar herramientas JavaScript en Arch Linux**.
