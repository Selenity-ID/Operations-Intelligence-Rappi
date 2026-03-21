# 🚀 Rappi Operations Intelligence | AI-Powered Assistant

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/architecture-Serverless-orange.svg)
![Tech Stack](https://img.shields.io/badge/tech_stack-JS%20%7C%20Gemini%20%7C%20GAS-success.svg)

Un MVP (Minimum Viable Product) diseñado para democratizar el acceso a datos operacionales, eliminando la fricción técnica para los equipos de Strategy, Planning & Analytics. Este sistema combina un motor de búsqueda matemático con Inteligencia Artificial generativa para ofrecer *insights* en lenguaje natural y dashboards dinámicos.

## 🎯 El Desafío de Negocio

Los Operational Managers invierten horas semanales en extraer respuestas de negocio de miles de filas de datos (requiriendo habilidades en SQL o Python). 
**La solución:** Un pipeline híbrido que procesa datos transaccionales en milisegundos y utiliza IA para enrutamiento semántico y generación de reportes ejecutivos.

## ✨ Características Principales

- **🤖 Asistente Operativo IA:** Bot conversacional que entiende lenguaje natural. Capaz de realizar cruces de datos, comparaciones históricas y extraer el "Top de ofensores".
- **📊 Dashboard Interactivo:** Visualizaciones renderizadas con `ApexCharts`, incorporando filtros dinámicos cruzados (País y Tipo de Zona) sin latencia.
- **🚨 Detección Autónoma de Anomalías:** Algoritmo programado para escanear y alertar sobre caídas del Gross Profit UE o métricas de conversión superiores al 15% WoW (Week over Week).
- **📄 Exportación Ejecutiva:** Generación de reportes PDF *pixel-perfect* en un clic utilizando `html2pdf.js`.
- **⚡ Arquitectura 100% Serverless:** Desplegado sobre Google Apps Script (V8 Engine) para conexión directa con la base de datos (Google Sheets), garantizando costo cero de infraestructura y alta escalabilidad.

## 🧠 Arquitectura del Sistema (Pipeline de 2 Fases)

Para evitar alucinaciones y el desbordamiento de tokens (context window limits), el sistema no envía la base de datos completa al LLM. 

1. **Enrutamiento Semántico:** Gemini 2.5 Flash clasifica la intención del usuario y genera un JSON estricto con los filtros (Fuzzy Search).
2. **Procesamiento Matemático:** JavaScript nativo (en Apps Script) filtra, ordena y cruza más de 12,000 registros de órdenes y métricas.
3. **Generación de Insights:** Solo el micro-contexto procesado (ej. el Top 5 de zonas con problemas) es devuelto a la IA para redactar un análisis ejecutivo en HTML.

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), UI inspirada en Material Design / Bento Box.
- **Backend:** Google Apps Script (JS V8).
- **IA Engine:** API de Gemini (Google AI Studio).
- **Librerías Visuales:** ApexCharts (Gráficos), Google Material Icons, html2pdf.

## 🚀 Guía de Despliegue (Local / GAS)

Este proyecto está diseñado para funcionar nativamente dentro del ecosistema de Google Workspace.

1. Clona este repositorio: `git clone https://github.com/Selenity-ID/Operations-Intelligence-Rappi.git`
2. Crea un nuevo proyecto en [Google Apps Script](https://script.google.com/).
3. Copia el contenido de `Codigo.gs` y `index.html` en sus respectivos archivos dentro del editor.
4. En **Configuración del Proyecto > Propiedades del script**, añade las siguientes variables de entorno:
   - `GEMINI_API_KEY`: Tu clave de API de Google AI Studio.
   - `SHEET_ID`: El ID del documento de Google Sheets con los datos operativos.
5. Haz clic en **Implementar > Nueva Implementación > Aplicación Web**. (Ejecutar como: Tú, Acceso: Cualquier usuario).

## 💬 Casos de Uso de Prueba (Prompts)

Prueba interactuar con el bot usando estos comandos:

- *"¿Cuáles son las 5 zonas con el peor Lead Penetration esta semana?"*
- *"Compara el Perfect Order entre zonas Wealthy y Non Wealthy en México."*
- *"Muéstrame un reporte de anomalías de rentabilidad."*

---

### 👩‍💻 Autoría

**Selene Jiménez** *Arquitecta y Diseñadora de Soluciones de IA | System Engineer* Especializada en optimización de procesos y automatización basada en Inteligencia Artificial. Pasión por dar vida a herramientas inteligentes que antes parecían imposibles.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Profile-blue?style=flat&logo=linkedin)](#) [![GitHub](https://img.shields.io/badge/GitHub-Profile-black?style=flat&logo=github)](https://github.com/Selenity-ID)
