const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

// Configuración de la impresora
function createPrinter() {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: process.env.PRINTER_INTERFACE || "usb",
    width: 48,
    characterSet: 'SLOVENIA',
    removeSpecialCharacters: false,
    lineCharacter: "-",
    options: {
      timeout: 5000 // 5 segundos de timeout
    }
  });
}

async function imprimirTicket(data) {
  const printer = createPrinter();

  try {
    console.log("Iniciando impresión del ticket...");
    
    printer.alignCenter();
    printer.setTypeFontB();
    printer.println("CARIBE AZUL");
    printer.setTypeFontA();
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Cliente: ${data.cliente}`);
    printer.println(`Cédula: ${data.cedula}`);
    printer.println(`Préstamo: ${data.prestamoId}`);
    printer.println(`Cuota No: ${data.cuotaNumero}`);
    printer.drawLine();

    printer.println(`Monto: RD$ ${parseFloat(data.monto).toFixed(2)}`);
    printer.println(`Método: ${data.metodo}`);
    printer.println(`Fecha: ${data.fecha}`);
    printer.drawLine();

    printer.alignCenter();
    printer.println("Gracias por su pago");
    printer.cut();

    let intentos = 0;
    let success = false;

    while (intentos < 2 && !success) {
      try {
        console.log(`Intento ${intentos + 1} de impresión...`);
        success = await printer.execute();
        console.log(`Resultado del intento ${intentos + 1}:`, success);
        intentos++;
        if (!success) await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error en intento ${intentos + 1}:`, error.message);
        intentos++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!success) {
      throw new Error('No se pudo imprimir después de 2 intentos');
    }

    console.log("🧾 Ticket impreso correctamente");
    return true;
  } catch (err) {
    console.error("❌ Error al imprimir:", err.message);
    throw err;
  } finally {
    printer.clear();
  }
}

module.exports = { imprimirTicket };
