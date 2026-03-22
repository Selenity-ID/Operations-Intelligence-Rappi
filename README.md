# 🚀 Rappi Operations Intelligence | AI-Powered Assistant

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/architecture-Serverless-orange.svg)
![Tech Stack](https://img.shields.io/badge/tech_stack-BigQuery%20%7C%20Gemini%20%7C%20GAS-success.svg)

Un MVP (Minimum Viable Product) de nivel Enterprise diseñado para democratizar el acceso a datos operacionales, eliminando la fricción técnica para los equipos de Strategy, Planning & Analytics. Este sistema combina el poder de cómputo de un Data Warehouse (BigQuery) con Inteligencia Artificial generativa para ofrecer *insights* en lenguaje natural y dashboards dinámicos.

## 🎯 El Desafío de Negocio

Los Operational Managers invierten horas semanales en extraer respuestas de negocio de millones de filas de datos, requiriendo habilidades avanzadas en SQL o Python. 
**La solución:** Un pipeline desacoplado que delega el procesamiento matemático a Google BigQuery (procesando datos a escala en milisegundos) y utiliza IA para enrutamiento semántico y generación de reportes ejecutivos.

## ✨ Características Principales

- **🤖 Asistente Operativo IA:** Bot conversacional que entiende lenguaje natural. Capaz de realizar cruces de datos, comparaciones históricas y extraer el "Top de ofensores".
- **📊 Dashboard Interactivo:** Visualizaciones renderizadas con `ApexCharts`, incorporando filtros dinámicos cruzados (País y Tipo de Zona) alimentados directamente mediante consultas SQL en tiempo real.
- **🚨 Detección Autónoma de Anomalías:** Motor SQL programado para escanear y alertar sobre caídas de rentabilidad (Gross Profit UE) superiores al 15% WoW (Week over Week), filtrando automáticamente *outliers* de la base de datos.
- **🛡️ Parseo Regional Robusto:** Implementación de limpieza de datos en JavaScript para estandarizar formatos numéricos regionales (comas vs. puntos) asegurando la integridad matemática de los FLOATS.
- **📄 Exportación Ejecutiva:** Generación de reportes PDF *pixel-perfect* en un clic utilizando `html2pdf.js`.
- **⚡ Arquitectura 100% Serverless:** Ecosistema nativo en Google Cloud Platform (BigQuery + Apps Script V8), garantizando costo cero de infraestructura base y alta escalabilidad (de 12k a 100M+ registros sin latencia).

## 🧠 Arquitectura del Sistema (Pipeline Desacoplado)

Para evitar alucinaciones, cuellos de botella de memoria y el desbordamiento de tokens, el sistema implementa una estricta separación de responsabilidades:

1. **Enrutamiento Semántico:** Gemini 2.5 Flash clasifica la intención del usuario y genera un JSON estricto con los filtros deseados.
2. **Ejecución Data Warehouse:** El backend en Google Apps Script traduce la intención a una consulta SQL dinámica. **Google BigQuery** ejecuta el cruce de datos y devuelve únicamente la matriz resultante.
3. **Generación de Insights:** Solo el micro-contexto procesado matemáticamente (ej. el Top 5 exacto) es devuelto a la IA, la cual redacta un análisis ejecutivo determinístico en formato HTML.

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), UI inspirada en Material Design / Bento Box.
- **Backend & Orquestador:** Google Apps Script (JS V8).
- **Data Warehouse:** Google BigQuery (Standard SQL).
- **IA Engine:** API de Gemini 2.5 Flash (Google AI Studio).
- **Librerías Visuales:** ApexCharts (Gráficos), Google Material Icons, html2pdf.

## 🚀 Guía de Despliegue (GCP / Apps Script)

Este proyecto requiere un entorno de Google Cloud Platform con facturación habilitada (o capa gratuita) para el uso de BigQuery.

1. Clona este repositorio: `git clone https://github.com/Selenity-ID/Operations-Intelligence-Rappi.git`
2. Configura tu entorno en Google Cloud:
   - Crea un proyecto en GCP y habilita la **BigQuery API**.
   - Crea un dataset y sube las tablas operacionales (asegurando el formato de *Locale* a United States para integridad de decimales).
3. Crea un nuevo proyecto en [Google Apps Script](https://script.google.com/).
4. Copia el contenido de `Codigo.gs` e `index.html`. Actualiza las constantes `BQ_PROJECT_ID` y `BQ_DATASET` en el código.
5. En el editor de Apps Script, añade el servicio **BigQuery API**.
6. En el archivo `appsscript.json`, añade los `oauthScopes` necesarios para BigQuery y Google Drive.
7. En **Configuración del Proyecto > Propiedades del script**, añade la variable de entorno:
   - `GEMINI_API_KEY`: Tu clave de API de Google AI Studio.
8. Haz clic en **Implementar > Nueva Implementación > Aplicación Web**.

## 💬 Casos de Uso de Prueba (Prompts)

Prueba interactuar con el bot usando estos comandos:

- *"¿Cuáles son las 5 zonas con el peor Retail CVR esta semana?"*
- *"Compara el Perfect Order entre zonas Wealthy y Non Wealthy en México."*
- *"Muéstrame un reporte de anomalías de rentabilidad."*

---

### 👩‍💻 Autoría

**Selene Jiménez** *Arquitecta y Diseñadora de Soluciones de IA | System Engineer* Especializada en optimización de procesos, migración a infraestructuras Cloud y automatización basada en Inteligencia Artificial. Pasión por dar vida a herramientas inteligentes que antes parecían imposibles.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Profile-blue?style=flat&logo=linkedin)](#) [![GitHub](https://img.shields.io/badge/GitHub-Profile-black?style=flat&logo=github)](https://github.com/Selenity-ID)
