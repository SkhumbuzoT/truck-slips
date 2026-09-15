import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { DocumentType, RawExtractionData } from '../src/types';

let genAIClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required in environment variables');
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Resilient coercers for values parsed from multimodal OCR
const coerceNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    // Strip commas, currency symbols, and unit suffixes
    const cleaned = val.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}, z.number().nullable());

const coerceString = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (
    !s ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'n/a' ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'unknown' ||
    s.toLowerCase() === 'nil'
  ) {
    return null;
  }
  return s;
}, z.string().nullable());

const coerceDate = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'n/a') return null;

  // Already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (dmy) {
    let day = dmy[1].padStart(2, '0');
    let month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = '20' + year;
    if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // Fallback JS parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return s;
}, z.string().nullable());

const coerceBoolean = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    if (['true', 'yes', 'signed', 'present', '1', 'y'].includes(s)) return true;
    if (['false', 'no', 'unsigned', 'blank', '0', 'n'].includes(s)) return false;
  }
  return null;
}, z.boolean().nullable());

// Zod schemas for robust validation
const FuelSlipSchema = z.object({
  transaction_number: coerceString,
  transaction_date: coerceDate,
  transaction_time: coerceString,
  vehicle_registration: coerceString,
  driver_name: coerceString,
  supplier: coerceString,
  fuel_litres: coerceNumber,
  fuel_price_per_litre: coerceNumber,
  fuel_total_amount: coerceNumber,
  odometer: coerceNumber,
});

const LoadingSlipSchema = z.object({
  load_number: coerceString,
  loading_date: coerceDate,
  loading_time: coerceString,
  vehicle_registration: coerceString,
  driver_name: coerceString,
  mine: coerceString,
  loading_location: coerceString,
  product: coerceString,
  quantity_tons: coerceNumber,
});

const PodSchema = z.object({
  load_number: coerceString,
  delivery_date: coerceDate,
  delivery_time: coerceString,
  vehicle_registration: coerceString,
  driver_name: coerceString,
  customer: coerceString,
  destination: coerceString,
  product: coerceString,
  quantity_tons: coerceNumber,
  received_by: coerceString,
  signature_present: coerceBoolean,
});

export const ExtractionResponseSchema = z.object({
  document_type: z.enum(['fuel_slip', 'loading_slip', 'pod', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  fuel_slip_data: FuelSlipSchema.optional().nullable(),
  loading_slip_data: LoadingSlipSchema.optional().nullable(),
  pod_data: PodSchema.optional().nullable(),
});

const EXTRACTION_SYSTEM_INSTRUCTION = `
You are the world-class Document Capture & Logistics OCR engine for PrimeChain Trucking.
Your mission is to examine images or PDFs of transport documents (thermal fuel receipts, weighbridge tickets, loading manifests, delivery notes, and PODs) and extract every single visible operational field with high accuracy.

=== DOCUMENT CLASSIFICATION ===
1. "fuel_slip": Filling station slips, diesel pump receipts, fleet card slips, depot dockets (e.g. Engen, Shell, TotalEnergies, BP, Sasol, Puma Energy, Caltex, Chevron, Love's, Petro, filling stations, bowser dockets).
2. "loading_slip": Weighbridge tickets, dispatch slips, mine scale dockets, bulk loading tickets showing Gross, Tare, and Nett weights.
3. "pod": Proof of Delivery, Delivery Note, Consignment Note, Goods Received Note, showing customer, destination, cargo quantity, and receiver signatures/stamps.
4. "unknown": Non-transport documents.

=== DETAILED OCR GUIDELINES FOR THERMAL FUEL SLIPS ===
Thermal slips often suffer from faint dot-matrix printing, angled photos, wrinkles, paper folds, or handwritten driver notes:
- **supplier**: Read the top header, banner, logo, or store name. Include station brand and location if present (e.g., "Engen Highveld 1-Stop", "TotalEnergies Middelburg", "Shell Ultra City").
- **vehicle_registration**: CRITICAL FIELD. Look thoroughly for vehicle plate numbers. They may be labeled as "REG", "REG NO", "VEH", "VEHICLE", "HORSE", "TRUCK", "FLEET #", OR HANDWRITTEN in blue/black pen by the pump attendant or driver anywhere on the slip (e.g. "ABC 123 GP", "CA 123-456", "KAA 123B", "ND 45212", "JH 77 KL GP"). Strip labels and extract just the plate number.
- **transaction_number**: Look for "INV#", "TAX INVOICE", "INVOICE", "SLIP NO", "RECEIPT #", "REC NO", "TRAN #", "TXN", "DOCKET #", "PUMP/TRAN", "SEQ", "TRACE", "SERIAL".
- **transaction_date**: Normalize any clearly visible date to YYYY-MM-DD format (handle DD/MM/YYYY, DD-MM-YYYY, DD.MM.YY, YYYY/MM/DD, DD-MMM-YYYY).
- **transaction_time**: Time of fuel purchase (HH:MM or HH:MM:SS in 24h format).
- **fuel_litres**: Total volume pumped. Often labeled "LITRES", "LITERS", "VOLUME", "VOL", "QTY", "DIESEL 50PPM", "AGO", or next to "L". Return numeric float (e.g. 450.25).
- **fuel_price_per_litre**: Unit rate. Often labeled "PRICE/L", "RATE", "R/L", "$/L", "UNIT PRICE", "P/L". If missing but litres and total amount are clearly legible, calculate unit price = Total / Litres.
- **fuel_total_amount**: Total transaction cost. Often labeled "TOTAL", "AMOUNT", "TOTAL DUE", "TOTAL INCL VAT", "SALE AMOUNT", "PAID". Output as clean number (e.g. 10450.50).
- **odometer**: Current truck odometer / mileage reading. Look for "KM", "ODO", "ODOMETER", "CURRENT KM", "SPEEDO", "MILEAGE", or handwritten km (often 5 to 7 digits, e.g. 345210).
- **driver_name**: Look for "DRIVER", "OPERATOR", "CARD HOLDER", or printed driver name.

=== DETAILED OCR GUIDELINES FOR WEIGHBRIDGE & LOADING SLIPS ===
- **load_number**: Look for "TICKET #", "WEIGHBRIDGE NO", "WB #", "DISPATCH NO", "DELIVERY NOTE #", "LOAD #".
- **vehicle_registration**: Truck/Horse registration number on the weighbridge slip.
- **driver_name**: Driver name recorded by weighbridge operator.
- **mine**: Source mine, colliery, plant, siding, pit, quarry, or dispatch terminal (e.g. "Wonderfontein Colliery", "Kloof Mine", "Grootegeluk", "RBCT").
- **loading_location**: Specific weighbridge station, silo, bay, stockpile, or siding.
- **product**: Commodity loaded (e.g. "COAL RB1", "COAL DUFF", "CHROME CONCENTRATE", "IRON ORE", "AGGREGATE", "DIESEL").
- **quantity_tons**: Payload weight. Weighbridge slips usually print:
  * GROSS (Total weight)
  * TARE (Truck empty weight)
  * NET or NETT (Cargo payload = Gross - Tare)
  * If weights are in Kilograms (KG), e.g. "NETT: 34,420 KG", CONVERT TO METRIC TONS: 34.420!
  * If already in Tons (e.g. "34.42 T"), return 34.42.
- **loading_date** & **loading_time**: Date and time of dispatch or 2nd weighment.

=== DETAILED OCR GUIDELINES FOR PROOF OF DELIVERY (POD) ===
- **customer**: Receiving company, buyer, client, or consignee.
- **destination**: Offloading site, delivery address, warehouse, or plant.
- **product** & **quantity_tons**: Cargo description and tonnage delivered.
- **received_by**: Printed name of the receiving clerk or supervisor.
- **signature_present**: True if there is a handwritten signature, ink stamp, or acceptance mark in the receiver box; false if the box is visibly blank.

=== RESPONSE FORMAT ===
Output strictly valid JSON matching the schema:
{
  "document_type": "fuel_slip" | "loading_slip" | "pod" | "unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "Concise summary of document features identified",
  "fuel_slip_data": { ... } or null,
  "loading_slip_data": { ... } or null,
  "pod_data": { ... } or null
}
Populate ONLY the relevant sub-object corresponding to the document_type.
`;

export async function extractDocumentWithGemini(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  operatorHint?: string
): Promise<RawExtractionData> {
  const ai = getGeminiClient();

  const base64Data = buffer.toString('base64');

  const filePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType,
    },
  };

  const hintText = operatorHint ? `\nOperator guidance: "${operatorHint}".` : '';

  const textPart = {
    text: `Analyze this trucking logistics document: "${filename}".${hintText}
Carefully read all printed and handwritten text, headers, footers, tables, and stamps.
Identify document_type (fuel_slip, loading_slip, pod, or unknown).
Extract all visible fields with maximum precision. Output valid JSON.`,
  };

  // Primary model gemini-3.8-flash per guidelines
  const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];

  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [filePart, textPart] },
        config: {
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      let responseText = response.text || '{}';
      responseText = responseText.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      }

      const parsedJson = JSON.parse(responseText);

      // Validate and coerce with Zod
      const validated = ExtractionResponseSchema.safeParse(parsedJson);
      let resultData: RawExtractionData;

      if (!validated.success) {
        console.warn(`[Gemini Extractor - ${modelName}] Schema parse issues:`, validated.error.issues);
        resultData = {
          document_type: (parsedJson.document_type as DocumentType) || 'unknown',
          confidence: typeof parsedJson.confidence === 'number' ? parsedJson.confidence : 0.75,
          reasoning: parsedJson.reasoning || 'Extracted with schema coercion',
          fuel_slip_data: parsedJson.fuel_slip_data || null,
          loading_slip_data: parsedJson.loading_slip_data || null,
          pod_data: parsedJson.pod_data || null,
        };
      } else {
        resultData = validated.data as RawExtractionData;
      }

      // Operational calculations and normalization enhancements
      if (resultData.document_type === 'fuel_slip' && resultData.fuel_slip_data) {
        const f = resultData.fuel_slip_data;
        // Auto-calculate missing price per litre if total and litres exist
        if (
          (!f.fuel_price_per_litre || f.fuel_price_per_litre <= 0) &&
          f.fuel_total_amount &&
          f.fuel_litres &&
          f.fuel_litres > 0
        ) {
          f.fuel_price_per_litre = Number((f.fuel_total_amount / f.fuel_litres).toFixed(3));
        }
        // Auto-calculate missing total if litres and price per litre exist
        if (
          (!f.fuel_total_amount || f.fuel_total_amount <= 0) &&
          f.fuel_litres &&
          f.fuel_price_per_litre &&
          f.fuel_litres > 0
        ) {
          f.fuel_total_amount = Number((f.fuel_litres * f.fuel_price_per_litre).toFixed(2));
        }
      } else if (resultData.document_type === 'loading_slip' && resultData.loading_slip_data) {
        const l = resultData.loading_slip_data;
        // If quantity is reported in kg (> 500), convert to metric tons
        if (l.quantity_tons && l.quantity_tons > 500) {
          l.quantity_tons = Number((l.quantity_tons / 1000).toFixed(3));
        }
      } else if (resultData.document_type === 'pod' && resultData.pod_data) {
        const p = resultData.pod_data;
        if (p.quantity_tons && p.quantity_tons > 500) {
          p.quantity_tons = Number((p.quantity_tons / 1000).toFixed(3));
        }
      }

      return resultData;
    } catch (error: any) {
      console.warn(`[Gemini Extractor] Model ${modelName} attempt warning:`, error?.message || error);
      lastError = error;
    }
  }

  console.error('[Gemini Extractor] All candidate models failed:', lastError);
  throw lastError;
}
