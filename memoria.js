/* Guarda en el navegador la conversación del día para retomarla si la página se cierra.
   Se guardan los pasos (respuestas y lo que contestó el servidor), no el HTML.
   Vale solo para el día de hoy (hora de Colombia) y se borra con /reset o al registrar la salida. */
(function () {
  'use strict';

  var VERSION = 1;   // súbela si cambia el orden de las preguntas: los pasos viejos dejan de servir
  var CLAVE = 'chat-conversacion' + (/[?&]demo=1/.test(location.search) ? '-demo' : '');
  var FOTO_ENVIADA = 'foto-enviada';

  function hoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }

  function borrar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (d && d.version === VERSION && d.dia === hoy() && Array.isArray(d.pasos)) return d.pasos;
    } catch (e) {}
    borrar();
    return [];
  }

  // Las fotos que ya salieron en un envío terminado no hacen falta para retomar: se cambian por una marca.
  function sinFotosEnviadas(pasos) {
    var ultimoEnvio = -1;
    pasos.forEach(function (p, i) { if (p.t === 'api' && p.w && !p.pendiente) ultimoEnvio = i; });
    return pasos.map(function (p, i) {
      if (i < ultimoEnvio && p.k === 'foto' && p.v !== FOTO_ENVIADA) return Object.assign({}, p, { v: FOTO_ENVIADA });
      return p;
    });
  }

  function escribir(pasos) {
    var limpios = sinFotosEnviadas(pasos);
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, dia: hoy(), pasos: limpios }));
    } catch (e) {
      // Sin espacio o almacenamiento bloqueado: la conversación sigue, solo que no se podrá retomar.
    }
    return limpios;
  }

  window.MEMORIA = { leer: leer, escribir: escribir, borrar: borrar, FOTO_ENVIADA: FOTO_ENVIADA };
})();
