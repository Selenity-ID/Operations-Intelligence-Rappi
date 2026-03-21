/**
 * RAPPI OPERATIONS INTELLIGENCE BOT - Backend (Google Apps Script)
 * Arquitectura Serverless con Gemini API y Sheets como Base de Datos
 */

// ==========================================
// CONFIGURACIÓN Y CONSTANTES GLOBALES
// ==========================================
const PROPS = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = PROPS.getProperty('GEMINI_API_KEY');
const SPREADSHEET_ID = PROPS.getProperty('SHEET_ID');

// Nombre de la hoja principal de métricas en tu Google Sheet
const SHEET_METRICS = 'RAW_INPUT_METRICS';

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
    // Recuperar el historial de la caché para mantener el contexto
    const cache = CacheService.getUserCache();
    let history = JSON.parse(cache.get('chatHistory') || '[]');
    
    // Paso 1: Clasificar la intención del usuario usando Gemini (JSON Mode)
    const analysis = classifyIntention(userMessage, history);
    
    let botResponse = "";
    
    // Paso 2: Ejecutar la acción operativa según la intención
    if (analysis.type === 'anomaly_report') {
      const anomalyData = findAnomaliesInSheets();
      botResponse = generateNaturalLanguage(userMessage, JSON.stringify(anomalyData), history);
      
    } else if (analysis.type === 'data_query') {
      const rawData = querySpreadsheet(analysis.filters);
      botResponse = generateNaturalLanguage(userMessage, JSON.stringify(rawData), history);
      
    } else {
      // Conversación general o saludo
      botResponse = generateNaturalLanguage(userMessage, "No se requieren datos de la base de datos para responder a esto.", history);
    }
    
    // Paso 3: Actualizar el historial y guardar en caché (Máximo 10 interacciones)
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: botResponse });
    if (history.length > 10) history = history.slice(-10);
    cache.put('chatHistory', JSON.stringify(history), 21600); // Guardar por 6 horas
    
    return { success: true, message: botResponse };
    
  } catch (error) {
    console.error("Error Operativo: ", error);
    return { success: false, message: "Hubo un error al procesar tu solicitud operativa. Intenta reformular la pregunta." };
  }
}

// ==========================================
// 3. MOTOR DE IA Y CLASIFICACIÓN
// ==========================================

function classifyIntention(message, history) {
  const systemPrompt = `
    Eres el motor de enrutamiento de un bot de datos de Rappi. 
    Analiza el mensaje del usuario y devuelve SOLO un JSON válido.
    Tipos permitidos: 'data_query' (métricas, zonas, ciudades, tendencias, comparaciones), 'anomaly_report' (alertas, anomalías, caídas), 'general' (saludos).
    Si es 'data_query', incluye un objeto 'filters' con las claves que detectes (ej. city, zone, metric, zone_type).
    
    REGLAS DE ORDENAMIENTO: 
    - Si el usuario pide "mejores", "mayores", "top" o "más alto", agrega "order": "desc". 
    - Si pide "peores", "menores", "bottom" o "más bajo", agrega "order": "asc". 
    - Si pide una cantidad, agrega "limit": numero.
    
    IMPORTANTE: Si el usuario menciona "Lead Penetration", el valor en el JSON debe ser exactamente "Lead Penetration". Si menciona "Wealthy" o "Non Wealthy", ponlo en "zone_type".
    
    Formato esperado: {"type": "data_query", "filters": {"metric": "Lead Penetration", "order": "asc", "limit": 5, "zone_type": "Wealthy"}}
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
    Tu tarea es responder a las preguntas de los managers usando EXCLUSIVAMENTE los datos JSON proporcionados en el contexto.
    
    REGLA ESTRICTA DE FORMATO:
    NO uses Markdown plano. Devuelve tu respuesta EXCLUSIVAMENTE en formato HTML usando la siguiente estructura de "Executive Dashboard" para que el frontend pueda renderizarlo y exportarlo a PDF:
    
    <div class="rappi-report-card">
      <h3 class="rappi-report-title">📊 [Título del Reporte o Análisis]</h3>
      <p class="rappi-report-summary">[Breve resumen ejecutivo del hallazgo, tendencia o comparación]</p>
      
      <table class="rappi-table">
        <thead>
          <tr><th>Ciudad</th><th>Zona/Tipo</th><th>Métrica</th><th>Valor L0W (Actual)</th><th>Tendencia (vs L1W)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>[Ciudad]</td>
            <td>[Zona]</td>
            <td>[Nombre Métrica]</td>
            <td>
              <strong>[Valor formateado, ej. 0.4%]</strong>
              <div class="rappi-bar-container"><div class="rappi-bar" style="width: [PORCENTAJE_CALCULADO]%;"></div></div>
            </td>
            <td>[Ej. ▲ 2% o ▼ -5% frente a la semana pasada]</td>
          </tr>
        </tbody>
      </table>
      
      <div class="rappi-report-footer">
        <p><strong>💡 Insight Operativo:</strong> [Una recomendación de negocio sólida basada en estos datos. Si ves caídas continuas en L1W/L2W/L3W, menciónalas aquí.]</p>
        <button class="btn-pdf" onclick="descargarPDF(this)">📄 Descargar Reporte en PDF</button>
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
  // Nota: Actualiza a la versión 2.5 según tu preferencia
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.error) throw new Error(json.error.message);
  
  return json.candidates[0].content.parts[0].text;
}

// ==========================================
// 4. LÓGICA DE BASE DE DATOS Y BÚSQUEDA
// ==========================================

function querySpreadsheet(filters) {
  if (!filters || Object.keys(filters).length === 0) return "No se detectaron filtros válidos.";
  
  try {
    const sheetMetrics = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_METRICS);
    if (!sheetMetrics) return `Error Crítico: No se encontró la pestaña '${SHEET_METRICS}'.`;
    
    const data = sheetMetrics.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Índices de columnas críticas y de histórico (Tendencias de 4 semanas)
    const idxCity = headers.indexOf('CITY');
    const idxZone = headers.indexOf('ZONE');
    const idxZoneType = headers.indexOf('ZONE_TYPE');
    const idxMetric = headers.indexOf('METRIC');
    const idxL0W = headers.indexOf('L0W_ROLL'); // Actual
    const idxL1W = headers.indexOf('L1W_ROLL'); // 1 semana atrás
    const idxL2W = headers.indexOf('L2W_ROLL'); // 2 semanas atrás
    const idxL3W = headers.indexOf('L3W_ROLL'); // 3 semanas atrás
    const idxL4W = headers.indexOf('L4W_ROLL'); // 4 semanas atrás
    
    // FILTRADO (Fuzzy Search)
    let filteredRows = rows.filter(row => {
      let match = true;
      const rowText = row.join(" | ").toLowerCase();
      
      if (filters.city) match = match && rowText.includes(filters.city.toLowerCase());
      if (filters.zone) match = match && rowText.includes(filters.zone.toLowerCase());
      if (filters.metric) match = match && rowText.includes(filters.metric.toLowerCase());
      if (filters.zone_type) match = match && rowText.includes(filters.zone_type.toLowerCase());
      
      return match;
    });
    
    if (filteredRows.length === 0) {
      return `La búsqueda en la base de datos no arrojó resultados para los filtros: ${JSON.stringify(filters)}`;
    }
    
    // ORDENAMIENTO NATIVO JS (Antes de cortar la matriz)
    if (filters.order === 'asc') {
      filteredRows.sort((a, b) => (parseFloat(a[idxL0W]) || 0) - (parseFloat(b[idxL0W]) || 0));
    } else if (filters.order === 'desc') {
      filteredRows.sort((a, b) => (parseFloat(b[idxL0W]) || 0) - (parseFloat(a[idxL0W]) || 0));
    }
    
    // LÍMITE DE CONTEXTO
    let limit = filters.limit ? filters.limit + 10 : 30; // Damos un poco de margen para comparaciones
    filteredRows = filteredRows.slice(0, limit);
    
    // ARMADO DEL JSON CON HISTÓRICO DE TENDENCIAS
    const result = filteredRows.map(row => {
      return {
        "Ciudad": row[idxCity],
        "Zona": row[idxZone],
        "Tipo_Zona": row[idxZoneType],
        "Metrica": row[idxMetric],
        "Semana_L0W_Actual": parseFloat(row[idxL0W]) || 0,
        "Semana_L1W": parseFloat(row[idxL1W]) || 0,
        "Semana_L2W": parseFloat(row[idxL2W]) || 0,
        "Semana_L3W": parseFloat(row[idxL3W]) || 0,
        "Semana_L4W": parseFloat(row[idxL4W]) || 0
      };
    });
    
    return JSON.stringify(result);
    
  } catch (error) {
    return "Error de ejecución en la consulta: " + error.message;
  }
}

// ==========================================
// 5. SISTEMA DE DETECCIÓN DE ANOMALÍAS
// ==========================================
function findAnomaliesInSheets() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_METRICS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const idxCity = headers.indexOf('CITY');
  const idxZone = headers.indexOf('ZONE');
  const idxMetric = headers.indexOf('METRIC');
  const idxL1W = headers.indexOf('L1W_ROLL');
  const idxL0W = headers.indexOf('L0W_ROLL');
  
  let anomalies = [];
  
  rows.forEach(row => {
    let valL1 = parseFloat(row[idxL1W]) || 0;
    let valL0 = parseFloat(row[idxL0W]) || 0;
    
    // Detectamos caídas superiores al 15% de una semana a la otra en métricas donde L1W era positivo
    if (valL1 > 0 && ((valL1 - valL0) / valL1) > 0.15) {
      anomalies.push({
        "Ciudad": row[idxCity],
        "Zona": row[idxZone],
        "Metrica": row[idxMetric],
        "Caida_Porcentual": (((valL1 - valL0) / valL1) * 100).toFixed(2) + "%",
        "Semana_Anterior_L1W": valL1,
        "Semana_Actual_L0W": valL0
      });
    }
  });
  
  // Ordenamos para mostrar las caídas más dramáticas primero
  anomalies.sort((a, b) => parseFloat(b.Caida_Porcentual) - parseFloat(a.Caida_Porcentual));
  
  // Devolvemos el Top 10 de anomalías críticas
  return anomalies.slice(0, 10); 
}

function clearChatHistory() {
  CacheService.getUserCache().remove('chatHistory');
  return "Memoria borrada.";
}

// ==========================================
// 6. MOTOR DEL DASHBOARD (Agregación de Datos y Filtros)
// ==========================================
function getDashboardData(filters = {countries: [], zoneTypes: []}) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const hasCountryFilter = filters.countries && filters.countries.length > 0;
    const hasZoneTypeFilter = filters.zoneTypes && filters.zoneTypes.length > 0;

    // 1. Extraer Metadatos (Para crear el cruce de Zona -> Tipo de Zona)
    const sheetMetrics = ss.getSheetByName('RAW_INPUT_METRICS');
    const metricsData = sheetMetrics.getDataRange().getValues();
    const mHeaders = metricsData[0];
    
    const idxCity = mHeaders.indexOf('CITY');
    const idxZone = mHeaders.indexOf('ZONE');
    const idxMetric = mHeaders.indexOf('METRIC');
    const idxML0 = mHeaders.indexOf('L0W_ROLL');
    const idxCountry = mHeaders.indexOf('COUNTRY');
    const idxZoneType = mHeaders.indexOf('ZONE_TYPE');
    
    let zoneTypeMap = {}; // Mapa para relacionar RAW_ORDERS con ZONE_TYPE
    let countriesSet = new Set();
    let zoneTypesSet = new Set();

    for(let i = 1; i < metricsData.length; i++) {
      let z = metricsData[i][idxZone];
      let zt = metricsData[i][idxZoneType];
      if (z && zt) zoneTypeMap[z] = zt;
      if (metricsData[i][idxCountry]) countriesSet.add(metricsData[i][idxCountry]);
      if (zt) zoneTypesSet.add(zt);
    }

    // 2. Procesar Órdenes (Aplicando Filtros)
    const sheetOrders = ss.getSheetByName('RAW_ORDERS');
    const ordersData = sheetOrders.getDataRange().getValues();
    const ordersHeaders = ordersData[0];
    const idxOrdL0 = ordersHeaders.indexOf('L0W');
    const idxOrdL1 = ordersHeaders.indexOf('L1W');
    
    let totalOrdersL0 = 0;
    let totalOrdersL1 = 0;
    let weeklyOrdersTrend = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    for(let i = 1; i < ordersData.length; i++) {
      let rowCountry = ordersData[i][0]; // COUNTRY
      let rowZone = ordersData[i][2]; // ZONE
      let rowZoneType = zoneTypeMap[rowZone];

      // Aplicar filtros dinámicos
      if (hasCountryFilter && !filters.countries.includes(rowCountry)) continue;
      if (hasZoneTypeFilter && !filters.zoneTypes.includes(rowZoneType)) continue;

      totalOrdersL0 += parseFloat(ordersData[i][idxOrdL0]) || 0;
      totalOrdersL1 += parseFloat(ordersData[i][idxOrdL1]) || 0;
      for(let w = 0; w <= 8; w++) {
        weeklyOrdersTrend[8-w] += parseFloat(ordersData[i][ordersHeaders.indexOf(`L${w}W`)]) || 0;
      }
    }
    const wowGrowth = totalOrdersL1 > 0 ? ((totalOrdersL0 - totalOrdersL1) / totalOrdersL1) * 100 : 0;

    // 3. Procesar Métricas y Profit (Aplicando Filtros)
    let profitZones = [];
    let avgProfitSum = 0;
    let profitCount = 0;

    for(let i = 1; i < metricsData.length; i++) {
      let rowCountry = metricsData[i][idxCountry];
      let rowZoneType = metricsData[i][idxZoneType];

      if (hasCountryFilter && !filters.countries.includes(rowCountry)) continue;
      if (hasZoneTypeFilter && !filters.zoneTypes.includes(rowZoneType)) continue;

      let metricName = metricsData[i][idxMetric];
      let valL0 = parseFloat(metricsData[i][idxML0]) || 0;
      
      if (metricName === 'Gross Profit UE') {
        avgProfitSum += valL0;
        profitCount++;
        profitZones.push({
          pais: rowCountry || '-',
          ciudad: metricsData[i][idxCity] || '-',
          zona: metricsData[i][idxZone] || '-',
          tipo: rowZoneType || 'N/A',
          profit: valL0
        });
      }
    }
    
    // Extraer Top 5 Peores (Alertas)
    profitZones.sort((a, b) => a.profit - b.profit);
    const topOffenders = profitZones.slice(0, 5);
    const avgProfit = profitCount > 0 ? (avgProfitSum / profitCount) : 0;
    
    // Extraer Top 100 Mejores (Para la Tabla Detallada)
    const detailedData = [...profitZones].sort((a, b) => b.profit - a.profit).slice(0, 100);

    return JSON.stringify({
      success: true,
      kpis: {
        totalOrders: totalOrdersL0,
        wowGrowth: wowGrowth.toFixed(2),
        avgProfit: avgProfit.toFixed(2),
      },
      trends: { orders: weeklyOrdersTrend },
      offenders: topOffenders,
      detailedData: detailedData,
      filtersData: {
        countries: Array.from(countriesSet).sort(),
        zoneTypes: Array.from(zoneTypesSet).sort()
      }
    });

  } catch (error) {
    return JSON.stringify({ success: false, error: error.message });
  }
}
