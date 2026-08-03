# Rappi Operations Intelligence Bot - Prueba Técnica

> **Solución al Caso Técnico SP&A (Strategy, Planning & Analytics)**  
> **Desarrollado por:** Selene Jiménez ([selene.jimenez.id@gmail.com](mailto:selene.jimenez.id@gmail.com))  
> **Repositorio GitHub:** [Operations-Intelligence-Rappi](https://github.com/Selenity-ID/Operations-Intelligence-Rappi)

---

## 📌 Descripción General

**Rappi Operations Intelligence** es un asistente conversacional y dashboard analítico serverless diseñado para democratizar el acceso a métricas operativas de Rappi. 

Permite a los **Operational Managers** y equipos de **SP&A** obtener insights ejecutivos, detectar anomalías críticas de rentabilidad (*Gross Profit UE*) y visualizar curvas de demanda a través de lenguaje natural, eliminando la barrera de escribir consultas SQL complejas o procesar archivos masivos en memoria.

---

## 🚀 Arquitectura del Sistema (El "Orquestador IA")

Para garantizar **escalabilidad a nivel Data Warehouse**, latencia sub-segundo y un uso eficiente de tokens sin alucinaciones, el sistema utiliza un **pipeline desacoplado en dos pasos**:

```
 [Usuario] ──(Lenguaje Natural)──> [Gemini 3.6 Flash] ──(Parseo a JSON)──> [Express / BigQuery Engine]
                                                                                   │
                                                                           (Filtrado SQL & Math)
                                                                                   │
 [UI & PDF] <──(Reporte HTML)── [Gemini 3.6 Flash] <──(Micro-Contexto)──────────────┘
```

1. **Comprensión Semántica (Router IA):** Gemini traduce la intención del usuario a filtros estructurados (métrica exacta, ordenamiento, país, tipo de zona).
2. **Ejecución en Data Warehouse (BigQuery):** La base de datos o motor SQL realiza la agregación matemática pesada.
3. **Generación de Insights:** Gemini formatea los micro-resultados en tarjetas de reporte ejecutivo HTML interactivo con exportación a PDF.

---

## ⚡ Características Principales

- 🤖 **Asistente Operativo NL:** Mapeo inteligente de lenguaje natural al diccionario exacto de métricas de Rappi (*Gross Profit UE*, *Retail CVR*, *Breakeven PRO*, *Lead Penetration*).
- 🚨 **Detección Autónoma de Anomalías:** Algoritmo que escanea automáticamente caídas mayores al 15% WoW en rentabilidad y genera alertas de prioridad.
- 📊 **Dashboard Visual Interactivo:**
  - KPI Cards en tiempo real (*Total Orders, Gross Profit UE, Retail CVR, Breakeven PRO*).
  - Gráfica de evolución de demanda (*ApexCharts* - L8W a L0W).
  - Tabla de *Top Offenders* (Zonas críticas en pérdida).
  - Filtros combinables por Países (MX, CO, BR, CL, PE) y Tipos de Zona (*Wealthy / Non Wealthy*).
- 📄 **Exportación Instantánea a PDF:** Generación e impresión de reportes ejecutivos en un solo clic.
- 🔒 **Control de Intentos & Autenticación de Admin:**
  - Límite de 5 consultas gratuitas para usuarios invitados.
  - Autenticación con Google como Administradora (`selene.jimenez.id@gmail.com`) para habilitar **consultas ilimitadas**.

---

## 🛠️ Tech Stack

- **Backend & Server:** Node.js, Express, TypeScript (`tsx`).
- **Motor IA:** `@google/genai` (Modelo `gemini-3.6-flash`).
- **Data Engine:** Simulación/Conector de Google BigQuery (Tablas `Tabla_01` y `Tabla_02`).
- **Frontend UI:** React 19, TypeScript, Vite.
- **Estilos & Componentes:** Tailwind CSS v4, Lucide React Icons.
- **Data Viz:** ApexCharts (`react-apexcharts`).

---

## ⚙️ Configuración e Instalación Local

### Requisitos Previos
- Node.js >= 18.x
- NPM / Yarn

### 1. Clonar el repositorio
```bash
git clone https://github.com/Selenity-ID/Operations-Intelligence-Rappi.git
cd Operations-Intelligence-Rappi
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea o edita el archivo `.env` en la raíz del proyecto basándote en `.env.example`:
```env
GEMINI_API_KEY="TU_GEMINI_API_KEY"
```

### 4. Ejecutar en modo desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 5. Compilar para producción
```bash
npm run build
npm start
```

---

## 📖 Diccionario de Métricas Soportadas

| Métrica en Lenguaje Natural | Nombre Exacto en Base de Datos | Descripción |
| :--- | :--- | :--- |
| **Gross Profit / Rentabilidad** | `Gross Profit UE` | Utilidad bruta promedio por orden (*Unit Economics*) |
| **Retail CVR / Conversión Retail** | `Retail SST > SS CVR` | Tasa de conversión de búsqueda a sesión en Retail |
| **Breakeven PRO** | `% PRO Users Who Breakeven` | Porcentaje de usuarios PRO que recuperan la membresía |
| **Lead Penetration** | `Lead Penetration` | Conversión de tiendas prospecto a activas |
| **Órdenes Totales** | `Orders` | Volumen acumulado de pedidos entregados |

---

## 👤 Autora

**Selene Jiménez**  
- **Email:** [selene.jimenez.id@gmail.com](mailto:selene.jimenez.id@gmail.com)  
- **GitHub:** [@Selenity-ID](https://github.com/Selenity-ID)  
- **Proyecto:** Prueba Técnica SP&A - Rappi Operations Intelligence Bot
