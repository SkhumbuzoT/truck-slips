// Generates realistic canvas-rendered test trucking documents (Fuel Slip, Loading Weighbridge Ticket, Signed POD)
// so users can test document capture immediately without needing their own files.

export function createSampleDocumentFile(
  type: 'fuel_slip' | 'loading_slip' | 'pod'
): File {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = 1200;
  canvas.height = 1600;

  // Background - realistic paper texture
  ctx.fillStyle = '#fbfcfc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Courier New", monospace';

  if (type === 'fuel_slip') {
    // Fuel Slip (Puma Energy / Shell Fleet Diesel Receipt)
    ctx.fillText('=================================================', 70, 100);
    ctx.fillText('          ENGEN FLEET DIESEL DEPOT               ', 70, 150);
    ctx.fillText('         MIDRAND LOGISTICS HUB (RSA)             ', 70, 200);
    ctx.fillText('=================================================', 70, 250);

    ctx.font = '28px "Courier New", monospace';
    ctx.fillText('DATE: 2025-08-14          TIME: 07:45', 70, 330);
    ctx.fillText('TRANSACTION #: TXN-994821', 70, 390);
    ctx.fillText('SUPPLIER: ENGEN PETROLEUM LTD', 70, 450);
    ctx.fillText('PUMP #: 04 - 50PPM ULTRA DIESEL', 70, 510);
    ctx.fillText('-------------------------------------------------', 70, 570);
    ctx.fillText('VEHICLE REG: ABC 123 GP', 70, 640);
    ctx.fillText('DRIVER: Sipho Ndlovu', 70, 710);
    ctx.fillText('ODOMETER: 248190.5 KM', 70, 780);
    ctx.fillText('FLEET CARD: **** **** **** 8831', 70, 850);
    ctx.fillText('-------------------------------------------------', 70, 920);
    ctx.fillText('FUEL VOLUME:         485.50 LITRES', 70, 1000);
    ctx.fillText('UNIT PRICE:          R 22.450 / L', 70, 1070);
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText('TOTAL AMOUNT:        R 10,899.48', 70, 1150);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText('TAX INVOICE / VAT INCL (15%)', 70, 1230);
    ctx.fillText('SIGNATURE: [ FLEET DRIVER APPROVED ]', 70, 1330);
    ctx.fillText('*** THANK YOU FOR YOUR BUSINESS ***', 70, 1450);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const blob = dataURItoBlob(dataUrl);
    return new File([blob], 'fuel-slip-ABC123GP.jpg', { type: 'image/jpeg' });
  } else if (type === 'loading_slip') {
    // Loading Slip (Coal Mine Weighbridge Ticket)
    ctx.fillText('=================================================', 70, 100);
    ctx.fillText('       MAFUBE COAL WEIGHBRIDGE TICKET            ', 70, 150);
    ctx.fillText('           DISPATCH & HAULAGE RECORD             ', 70, 200);
    ctx.fillText('=================================================', 70, 250);

    ctx.font = '28px "Courier New", monospace';
    ctx.fillText('LOAD NUMBER:        LOAD-001', 70, 330);
    ctx.fillText('LOADING DATE:       2025-08-14', 70, 400);
    ctx.fillText('LOADING TIME:       09:30', 70, 470);
    ctx.fillText('-------------------------------------------------', 70, 540);
    ctx.fillText('MINE:               MAFUBE COLLIERY', 70, 620);
    ctx.fillText('LOADING LOCATION:   SILO DISPATCH BAY 2', 70, 690);
    ctx.fillText('PRODUCT:            THERMAL COAL RB1', 70, 760);
    ctx.fillText('VEHICLE REG:        ABC 123 GP', 70, 830);
    ctx.fillText('TRAILER 1:          TRL-991-GP', 70, 900);
    ctx.fillText('TRAILER 2:          TRL-992-GP', 70, 970);
    ctx.fillText('DRIVER:             Sipho Ndlovu', 70, 1040);
    ctx.fillText('-------------------------------------------------', 70, 1110);
    ctx.fillText('GROSS WEIGHT:       54.200 TONS', 70, 1180);
    ctx.fillText('TARE WEIGHT:        19.950 TONS', 70, 1250);
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText('NET QUANTITY:       34.250 TONS', 70, 1340);
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText('WEIGHBRIDGE OPERATOR: J. Khumalo (#WB-09)', 70, 1420);
    ctx.fillText('STATUS: CLEARED FOR ROAD TRANSIT', 70, 1490);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const blob = dataURItoBlob(dataUrl);
    return new File([blob], 'loading-slip-LOAD-001.jpg', { type: 'image/jpeg' });
  } else {
    // Proof of Delivery (POD)
    ctx.fillText('=================================================', 70, 100);
    ctx.fillText('           PROOF OF DELIVERY (P.O.D)             ', 70, 150);
    ctx.fillText('         RICHARDS BAY COAL TERMINAL              ', 70, 200);
    ctx.fillText('=================================================', 70, 250);

    ctx.font = '28px "Courier New", monospace';
    ctx.fillText('DELIVERY NOTE #:    POD-RBCT-8842', 70, 330);
    ctx.fillText('LOAD NUMBER:        LOAD-001', 70, 400);
    ctx.fillText('DELIVERY DATE:      2025-08-14', 70, 470);
    ctx.fillText('DELIVERY TIME:      16:15', 70, 540);
    ctx.fillText('-------------------------------------------------', 70, 610);
    ctx.fillText('CUSTOMER:           RBCT COMMODITY LOGISTICS', 70, 680);
    ctx.fillText('DESTINATION:        BERTH 3 QUAYSIDE STOCKYARD', 70, 750);
    ctx.fillText('PRODUCT:            THERMAL COAL RB1', 70, 820);
    ctx.fillText('QUANTITY DELIVERED: 34.250 TONS', 70, 890);
    ctx.fillText('VEHICLE REG:        ABC 123 GP', 70, 960);
    ctx.fillText('DRIVER:             Sipho Ndlovu', 70, 1030);
    ctx.fillText('-------------------------------------------------', 70, 1100);
    ctx.fillText('RECEIVED IN GOOD ORDER AND CONDITION:', 70, 1170);
    ctx.fillText('RECEIVED BY:        M. Dlamini (Stock Manager)', 70, 1240);

    // Draw realistic handwritten signature
    ctx.beginPath();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 4;
    ctx.moveTo(350, 1340);
    ctx.bezierCurveTo(400, 1300, 450, 1380, 500, 1320);
    ctx.bezierCurveTo(550, 1290, 600, 1350, 650, 1310);
    ctx.stroke();

    ctx.font = 'italic 24px "Courier New", monospace';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText('MDlamini - Signed 14/08/2025 16:20', 360, 1390);

    ctx.fillStyle = '#0f172a';
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText('RECEIVING STAMP: [ RBCT INBOUND VERIFIED ]', 70, 1470);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const blob = dataURItoBlob(dataUrl);
    return new File([blob], 'pod-LOAD-001.jpg', { type: 'image/jpeg' });
  }
}

function dataURItoBlob(dataURI: string) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}
