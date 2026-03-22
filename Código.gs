/**
 * RAPPI OPERATIONS INTELLIGENCE BOT - Backend (Google Apps Script)
 * Arquitectura Serverless con Gemini API y Google BigQuery
 */

// ==========================================
// CONFIGURACIÓN Y CONSTANTES GLOBALES
// ==========================================
const PROPS = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = PROPS.getProperty('GEMINI_API_KEY');

// --- CONFIGURACIÓN DE BIGQUERY ---
const BQ_PROJECT_ID = 'selene-ia';
const BQ_DATASET = 'Test_De_DataSet';

// Tus tablas en BigQuery (Ajusta los nombres si son diferentes)
const BQ_TABLE_METRICS = `${BQ_PROJECT_ID}.${BQ_DATASET}.Tabla_01`; 
const BQ_TABLE_ORDERS = `${BQ_PROJECT_ID}.${BQ_DATASET}.Tabla_02`; // Sube la pestaña RAW_ORDERS a esta tabla

// Función Helper: Limpia porcentajes y cambia comas regionales por puntos antes de convertir a número
const safeNum = (col) => `SAFE_CAST(REPLACE(REPLACE(CAST(${col} AS STRING), '%', ''), ',', '.') AS FLOAT64)`;

// ==========================================
// 1. INICIALIZACIÓN DE LA WEB APP
// ==========================================
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rappi Operations Intelligence')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==========================================
// 2. ORQUESTADOR PRINCIPAL
// ==========================================
function handleUserInput(userMessage) {
  try {
    const cache = CacheService.getUserCache();
    let history = JSON.parse(cache.get('chatHistory') || '[]');
    
    const analysis = classifyIntention(userMessage, history);
    let botResponse = "";
    
    if (analysis.type === 'anomaly_report') {
      const anomalyData = findAnomaliesInBigQuery();
      botResponse = generateNaturalLanguage(userMessage, JSON.stringify(anomalyData), history);
      
    } else if (analysis.type === 'data_query') {
      const rawData = queryBigQueryDatabase(analysis.filters);
      botResponse = generateNaturalLanguage(userMessage, JSON.stringify(rawData), history);
      
    } else {
      botResponse = generateNaturalLanguage(userMessage, "No se requieren datos de la base de datos para responder a esto.", history);
    }
    
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: botResponse });
    if (history.length > 10) history = history.slice(-10);
    cache.put('chatHistory', JSON.stringify(history), 21600);
    
    return { success: true, message: botResponse };
    
  } catch (error) {
    console.error("Error Operativo: ", error);
    return { success: false, message: "Hubo un error al procesar tu solicitud en la base de datos." };
  }
}

// ==========================================
// 3. MOTOR DE IA Y CLASIFICACIÓN
// ==========================================
function classifyIntention(message, history) {
  const systemPrompt = `
    Eres el motor de enrutamiento de un bot de datos de Rappi. 
    Analiza el mensaje del usuario y devuelve SOLO un JSON válido.
    Tipos permitidos: 'data_query' (métricas, zonas, ciudades, tendencias), 'anomaly_report' (alertas, anomalías), 'general' (saludos).
    Si es 'data_query', incluye un objeto 'filters' con las claves que detectes.
    
    REGLAS DE BÚSQUEDA: 
    - Si el usuario pide "mejores", "top", "mayor" agrega "order": "desc". 
    - Si pide "peores", "bottom", "menor" agrega "order": "asc". 
    - Si pide cantidad agrega "limit": numero.
    - Si menciona "Wealthy" o "Non Wealthy", va en la clave "zone_type".
    - Si menciona un país (ej. "México", "Colombia", "Brasil"), conviértelo a su código ISO de 2 letras (ej. "MX", "CO", "BR") en la clave "country".
    
    REGLA ESTRICTA DE DICCIONARIO DE DATOS (Mapeo de Métricas):
    Cuando el usuario pregunte por métricas, DEBES mapear su lenguaje natural a los nombres EXACTOS de la base de datos en la clave "metric":
    - Si mencionan "Retail CVR" o conversión de retail -> "Retail SST > SS CVR"
    - Si mencionan "Breakeven" o retención PRO -> "% PRO Users Who Breakeven"
    - Si mencionan "Gross Profit", "profit" o rentabilidad -> "Gross Profit UE"
    - Si mencionan "Lead Penetration" -> "Lead Penetration"
    NUNCA inventes nombres de métricas en el JSON que no sean estos.

    Formato esperado de ejemplo: 
    {"type": "data_query", "filters": {"metric": "Retail SST > SS CVR", "order": "desc", "limit": 5, "country": "MX"}}
  `;
  
  const payload = {
    contents: [{ parts: [{ text: message }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
  };
  
  const response = callGeminiAPI(payload);
  return JSON.parse(response);
}

function generateNaturalLanguage(userMessage, dataContext, history) {
  const systemPrompt = `
    Eres un Analista Senior de Operaciones en Rappi. 
    
    REGLA DE IDENTIDAD Y CONVERSACIÓN (PRIORIDAD MÁXIMA):
    Si el usuario te saluda, hace una pregunta general, o pregunta qué puedes hacer o qué métricas puedes analizar, DEBES responder de forma conversacional, amigable y natural (SIN usar la tabla HTML). 
    Preséntate como experto y lista las métricas principales que puedes analizar:
    1. Gross Profit UE (Rentabilidad y Unit Economics)
    2. Retail CVR (Tasa de conversión de búsqueda a sesión en Retail)
    3. Breakeven PRO (Porcentaje de usuarios PRO que recuperan su membresía)
    4. Órdenes Totales y Evolución de la Demanda
    PROHIBICIÓN ESTRICTA: NUNCA menciones la palabra "JSON", "Prompt", "BigQuery", "Contexto" ni expliques tu arquitectura interna. Nunca digas que te faltan datos si solo te están saludando.

    REGLA PARA CONSULTAS DE DATOS OPERATIVOS:
    Si el usuario pide analizar datos específicos, responde usando EXCLUSIVAMENTE los datos proporcionados en el "Contexto de datos". En este caso, DEBES usar la siguiente REGLA ESTRICTA DE FORMATO HTML PARA EXPORTACIÓN:
    <div class="rappi-report-card">
      <h3 class="rappi-report-title">📊 [Título del Análisis]</h3>
      <p class="rappi-report-summary">[Breve resumen ejecutivo]</p>
      <table class="rappi-table">
        <thead>
          <tr><th>Ciudad</th><th>Zona/Tipo</th><th>Métrica</th><th>Valor L0W</th><th>Tendencia</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>[Ciudad]</td><td>[Zona]</td><td>[Nombre Métrica]</td>
            <td><strong>[Valor]</strong><div class="rappi-bar-container"><div class="rappi-bar" style="width:[PORCENTAJE]%;"></div></div></td>
            <td>[Ej. ▲ 2% o ▼ -5%]</td>
          </tr>
        </tbody>
      </table>
      <div class="rappi-report-footer">
        <p><strong>💡 Insight Operativo:</strong> [Recomendación basada en datos]</p>
        <button class="btn-pdf" onclick="descargarPDF(this)">📄 Descargar Reporte PDF</button>
      </div>
    </div>
    
    Contexto de datos: ${dataContext}
  `;
  
  const contents = history.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  
  const payload = {
    contents: contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.3 } 
  };
  return callGeminiAPI(payload);
}

function callGeminiAPI(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json.candidates[0].content.parts[0].text;
}

// ==========================================
// 4. LÓGICA CORE: BIGQUERY ENGINE
// ==========================================
// Helper para ejecutar consultas SQL y parsear la respuesta de la API de BQ
function runQuery(sql) {
  const request = { query: sql, useLegacySql: false };
  const queryResults = BigQuery.Jobs.query(request, BQ_PROJECT_ID);
  
  if (!queryResults.rows) return [];
  
  const headers = queryResults.schema.fields.map(field => field.name);
  return queryResults.rows.map(row => {
    let rowData = {};
    row.f.forEach((col, index) => { rowData[headers[index]] = col.v; });
    return rowData;
  });
}

function queryBigQueryDatabase(filters) {
  if (!filters || Object.keys(filters).length === 0) return "No se detectaron filtros válidos.";
  
  try {
    let conditions = [];
    if (filters.city) conditions.push(`LOWER(CITY) LIKE LOWER('%${filters.city}%')`);
    if (filters.zone) conditions.push(`LOWER(ZONE) LIKE LOWER('%${filters.zone}%')`);
    if (filters.metric) conditions.push(`LOWER(METRIC) LIKE LOWER('%${filters.metric}%')`);
    if (filters.zone_type) conditions.push(`LOWER(ZONE_TYPE) LIKE LOWER('%${filters.zone_type}%')`);
    
    let whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    let orderClause = '';
    if (filters.order === 'asc') orderClause = `ORDER BY ${safeNum('L0W_ROLL')} ASC`;
    else if (filters.order === 'desc') orderClause = `ORDER BY ${safeNum('L0W_ROLL')} DESC`;
    
    let limit = filters.limit ? filters.limit + 10 : 30;
    
    // Consulta SQL Dinámica
    const sql = `
      SELECT CITY as Ciudad, ZONE as Zona, ZONE_TYPE as Tipo_Zona, METRIC as Metrica,
             ${safeNum('L0W_ROLL')} as Semana_L0W_Actual,
             ${safeNum('L1W_ROLL')} as Semana_L1W,
             ${safeNum('L2W_ROLL')} as Semana_L2W,
             ${safeNum('L3W_ROLL')} as Semana_L3W,
             ${safeNum('L4W_ROLL')} as Semana_L4W
      FROM \`${BQ_TABLE_METRICS}\`
      ${whereClause}
      ${orderClause}
      LIMIT ${limit}
    `;
    
    const data = runQuery(sql);
    if(data.length === 0) return `La búsqueda en BigQuery no arrojó resultados para: ${JSON.stringify(filters)}`;
    return JSON.stringify(data);
    
  } catch (error) {
    return "Error de ejecución SQL en BigQuery: " + error.message;
  }
}

// ==========================================
// 5. SISTEMA DE DETECCIÓN DE ANOMALÍAS (Vía SQL)
// ==========================================
function findAnomaliesInBigQuery() {
  const sql = `
    SELECT CITY as Ciudad, ZONE as Zona, METRIC as Metrica,
           ${safeNum('L1W_ROLL')} as Semana_Anterior_L1W,
           ${safeNum('L0W_ROLL')} as Semana_Actual_L0W,
           ROUND(((${safeNum('L1W_ROLL')} - ${safeNum('L0W_ROLL')}) / NULLIF(${safeNum('L1W_ROLL')}, 0)) * 100, 2) as Caida_Porcentual_Num
    FROM \`${BQ_TABLE_METRICS}\`
    WHERE ${safeNum('L1W_ROLL')} > 0
      AND ((${safeNum('L1W_ROLL')} - ${safeNum('L0W_ROLL')}) / NULLIF(${safeNum('L1W_ROLL')}, 0)) > 0.15
    ORDER BY Caida_Porcentual_Num DESC
    LIMIT 10
  `;
  
  try {
    const data = runQuery(sql);
    return data.map(d => ({
      Ciudad: d.Ciudad,
      Zona: d.Zona,
      Metrica: d.Metrica,
      Caida_Porcentual: d.Caida_Porcentual_Num + "%",
      Semana_Anterior_L1W: d.Semana_Anterior_L1W,
      Semana_Actual_L0W: d.Semana_Actual_L0W
    }));
  } catch (error) {
    console.error("Error en Anomalías BQ:", error);
    return [];
  }
}

function clearChatHistory() {
  CacheService.getUserCache().remove('chatHistory');
  return "Memoria borrada.";
}

// ==========================================
// 6. MOTOR DEL DASHBOARD (Agregación Nivel Data Warehouse - BigQuery)
// ==========================================
function getDashboardData(filters = {countries: [], zoneTypes: []}) {
  try {
    // --- Parseador Robusto a prueba de regiones ---
    const robustParse = (val) => {
      if (val === null || val === undefined || val === '') return 0;
      let s = String(val).replace(/%/g, '').trim();
      // Si el número viene con coma regional (ej. 0,6023 o 1.500,50)
      if (s.includes(',')) {
        s = s.replace(/\./g, ''); // Eliminamos puntos de miles si los hay
        s = s.replace(',', '.');  // Convertimos la coma decimal en punto
      }
      return parseFloat(s) || 0;
    };

    let whereMetricsArr = [];
    let whereOrdersArr = [];
    
    if (filters.countries && filters.countries.length > 0) {
      const cList = filters.countries.map(c => `'${c}'`).join(',');
      whereMetricsArr.push(`COUNTRY IN (${cList})`);
      whereOrdersArr.push(`COUNTRY IN (${cList})`);
    }
    if (filters.zoneTypes && filters.zoneTypes.length > 0) {
      const zList = filters.zoneTypes.map(z => `'${z}'`).join(',');
      whereMetricsArr.push(`ZONE_TYPE IN (${zList})`);
      whereOrdersArr.push(`ZONE IN (SELECT DISTINCT ZONE FROM \`${BQ_TABLE_METRICS}\` WHERE ZONE_TYPE IN (${zList}))`);
    }

    let whereMetrics = whereMetricsArr.length > 0 ? 'WHERE ' + whereMetricsArr.join(' AND ') : '';
    let whereOrders = whereOrdersArr.length > 0 ? 'WHERE ' + whereOrdersArr.join(' AND ') : '';

    // 1. Obtener Filtros Dinámicos
    const sqlFilters = `SELECT DISTINCT COUNTRY FROM \`${BQ_TABLE_METRICS}\` WHERE COUNTRY IS NOT NULL`;
    const sqlZoneTypes = `SELECT DISTINCT ZONE_TYPE FROM \`${BQ_TABLE_METRICS}\` WHERE ZONE_TYPE IS NOT NULL`;
    const countriesList = runQuery(sqlFilters).map(r => r.COUNTRY).sort();
    const zoneTypesList = runQuery(sqlZoneTypes).map(r => r.ZONE_TYPE).sort();

    // 2. Extraer TODAS las Métricas (Profit, CVR y Breakeven - NOMBRES EXACTOS)
    const sqlMetrics = `
      SELECT COUNTRY as pais, CITY as ciudad, ZONE as zona, ZONE_TYPE as tipo, METRIC as metricName, 
             L0W_ROLL as valL0, 
             L1W_ROLL as valL1
      FROM \`${BQ_TABLE_METRICS}\`
      ${whereMetrics ? whereMetrics + " AND " : "WHERE "} METRIC IN ('Gross Profit UE', 'Retail SST > SS CVR', '% PRO Users Who Breakeven')
    `;
    const metricsData = runQuery(sqlMetrics);
    
    let profitZones = [];
    let avgProfitSum = 0; let profitCount = 0;
    let cvrSumL0 = 0; let cvrSumL1 = 0; let cvrCount = 0;
    let beSumL0 = 0; let beSumL1 = 0; let beCount = 0;

    metricsData.forEach(row => {
      let valL0 = robustParse(row.valL0);
      let valL1 = robustParse(row.valL1);
      
      // Mapeo con los nombres estrictos de la base de datos
      if (row.metricName === 'Gross Profit UE') {
        avgProfitSum += valL0; profitCount++;
        profitZones.push({
          pais: row.pais || '-', ciudad: row.ciudad || '-', zona: row.zona || '-', tipo: row.tipo || 'N/A', profit: valL0
        });
      } else if (row.metricName === 'Retail SST > SS CVR') {
        cvrSumL0 += valL0; cvrSumL1 += valL1; cvrCount++;
      } else if (row.metricName === '% PRO Users Who Breakeven') {
        beSumL0 += valL0; beSumL1 += valL1; beCount++;
      }
    });

    // Cálculos Finales
    profitZones.sort((a, b) => a.profit - b.profit);
    const topOffenders = profitZones.slice(0, 5);
    const avgProfit = profitCount > 0 ? (avgProfitSum / profitCount) : 0;
    const detailedData = [...profitZones].sort((a, b) => b.profit - a.profit).slice(0, 100);

    const avgCvrL0 = cvrCount > 0 ? ((cvrSumL0 / cvrCount) * 100) : 0;
    const cvrWow = cvrCount > 0 ? (avgCvrL0 - ((cvrSumL1 / cvrCount) * 100)) : 0;
    
    const avgBeL0 = beCount > 0 ? ((beSumL0 / beCount) * 100) : 0;
    const beWow = beCount > 0 ? (avgBeL0 - ((beSumL1 / beCount) * 100)) : 0;

    // 3. Extraer Órdenes (Tendencias)
    let ordersTrend = [0,0,0,0,0,0,0,0,0];
    let totalOrdersL0 = 0;
    let wowGrowth = 0;
    
    try {
      // Usamos alias explícitos para no confundir a JavaScript
      const sqlOrders = `
        SELECT 
          SUM(L0W) as valL0W, SUM(L1W) as valL1W, SUM(L2W) as valL2W, 
          SUM(L3W) as valL3W, SUM(L4W) as valL4W, SUM(L5W) as valL5W, 
          SUM(L6W) as valL6W, SUM(L7W) as valL7W, SUM(L8W) as valL8W
        FROM \`${BQ_TABLE_ORDERS}\` ${whereOrders}
      `;
      const ordersData = runQuery(sqlOrders);
      
      if (ordersData.length > 0 && ordersData[0].valL0W !== null) {
        const o = ordersData[0];
        totalOrdersL0 = robustParse(o.valL0W);
        let l1 = robustParse(o.valL1W);
        
        wowGrowth = l1 > 0 ? ((totalOrdersL0 - l1) / l1) * 100 : 0;
        
        // Armamos la gráfica desde L8W (hace 2 meses) hasta L0W (actual)
        ordersTrend = [
          robustParse(o.valL8W), robustParse(o.valL7W), robustParse(o.valL6W), 
          robustParse(o.valL5W), robustParse(o.valL4W), robustParse(o.valL3W), 
          robustParse(o.valL2W), l1, totalOrdersL0
        ];
      }
    } catch (errOrders) {
      console.log("Aviso Órdenes:", errOrders);
    }

    return JSON.stringify({
      success: true,
      kpis: {
        totalOrders: totalOrdersL0,
        wowGrowth: parseFloat(wowGrowth),
        avgProfit: avgProfit,
        cvr: avgCvrL0,
        cvrWow: cvrWow,
        breakeven: avgBeL0,
        breakevenWow: beWow
      },
      trends: { orders: ordersTrend },
      offenders: topOffenders,
      detailedData: detailedData,
      filtersData: { countries: countriesList, zoneTypes: zoneTypesList }
    });

  } catch (error) {
    return JSON.stringify({ success: false, error: "Error BQ Dashboard: " + error.message });
  }
}
