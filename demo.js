// Servidor de mentiras para probar la interfaz sin tocar ninguna base.
// Solo se usa cuando la página se abre con ?demo=1.
(function () {
  var portafolio = [
    [50196081, 'BUCHANAN DELUXE 20CL 12Y 04X06', "Buchanan's", true, true],
    [50196388, 'BUCHANAN DELUXE 75CL 12Y 12X01', "Buchanan's", true, true],
    [50196364, 'BUCHANAN DELUXE 1L 12Y 12X01', "Buchanan's", true, true],
    [5000281060668, 'DON JULIO BLANC 70CL 06X01', 'Don Julio', true, true],
    [5000281062808, 'DON JULIO RPSDO 70CL 12X01', 'Don Julio', true, true],
    [7506064300344, 'DON JULIO 1942 75CL 06X01', 'Don Julio', true, true],
    [5000267114279, 'JW BLUE 75CL 06X01', 'Johnnie Walker', false, true],
    [5011013100194, 'BAILEYS ORIG 37.5C 12X01', 'Baileys', false, false]
  ].map(function (x) { return { ean: x[0], nombre: x[1], marca: x[2], foco: x[3], redime: x[4] }; });
  var premios = [
    ['DG04521', 'BOLSAS BAJAS BUCHANANS', "Buchanan's"], ['DG04524', 'CINTA BUCHANANS VERDE', "Buchanan's"],
    ['DG04526', 'BOLSAS BAJAS DON JULIO', 'Don Julio'], ['DG04527', 'CINTA DON JULIO AZUL', 'Don Julio'],
    ['DG04529', 'CHARM DON JULIO BOTELLA BLANCA', 'Don Julio'],
    ['DG04531', 'BOLSAS ALTAS JOHNNIE WALKER', 'Johnnie Walker'], ['DG04532', 'CHARM JOHNNIE WALKER', 'Johnnie Walker']
  ].map(function (x) { return { codigo: x[0], nombre: x[1], linea: x[2], etiqueta: x[2] === 'Don Julio' }; });
  var pdvs = { 1111: { sap: 1111, nombre: 'PDV PRUBA 01', ciudad: 'BOGOTA D.C.', direccion: 'DIRECCION DE PRUEBA' } };
  var reg = null;

  function hora() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  function pub() {
    return reg && { estado: reg.estado, pdv: reg.pdv, sap: reg.sap, horaIngreso: reg.horaIngreso, venta: !!reg.venta, agotados: !!reg.agotados };
  }
  var acciones = {
    identificar: function (p) {
      if (String(p.cedula) !== '12345678') return { ok: false, noReconocido: true };
      if (!reg || reg.estado === 'FUERA DE LABOR') reg = { estado: 'EN LABOR' };
      return { ok: true, usuario: { nombre: 'USUARIO DE PRUEBA', ciudad: 'BOGOTA D.C.', ruta: 'RUTPRU02' }, registro: pub() };
    },
    estado: function () { return { ok: true, registro: pub() }; },
    ruteroHoy: function () { return { ok: true, visitas: [{ id: 'v1', sap: 1111, pdv: 'PDV PRUBA 01', inicio: '1:00:00 p. m.', fin: '7:00:00 p. m.' }] }; },
    buscarPdv: function (p) { return { ok: true, pdv: pdvs[Number(p.sap)] || null }; },
    registrarIngreso: function (p) {
      var pdv = pdvs[Number(p.sap)];
      reg = { estado: 'EN PDV', pdv: pdv.nombre, sap: pdv.sap, horaIngreso: hora() };
      return { ok: true, resumen: { usuario: 'USUARIO DE PRUEBA', fecha: new Date().toLocaleDateString('en-CA'), hora: reg.horaIngreso, sap: pdv.sap, pdv: pdv.nombre }, registro: pub() };
    },
    catalogo: function () { return { ok: true, portafolio: portafolio, premios: premios }; },
    subirVenta: function (p) {
      var prod = portafolio.filter(function (x) { return String(x.ean) === String(p.ean); })[0];
      reg.venta = true;
      return { ok: true, idVenta: Math.floor(100000 + Math.random() * 900000), redime: prod.redime, marca: prod.marca };
    },
    guardarRedencion: function () { return { ok: true, fotoFacturaUrl: 'demo://factura' }; },
    guardarAgotado: function () { return { ok: true }; },
    marcarPaso: function (p) { reg[p.paso] = true; return { ok: true }; },
    registrarSalida: function () { reg.estado = 'FUERA DE LABOR'; return { ok: true, hora: hora() }; }
  };
  window.DEMO_API = function (p) {
    return new Promise(function (ok) {
      setTimeout(function () { ok(acciones[p.accion] ? acciones[p.accion](p) : { ok: false, error: 'Acción no válida' }); }, 450);
    });
  };
})();
