/* Chatbot Diageo — mismo flujo que el bot de WhatsApp de EFICACIA, en una página.
   Toda la lógica de datos vive en el servidor (servidor/); aquí solo se conversa. */
(function () {
  'use strict';

  var CFG = window.CONFIG || {};
  var API_URL = CFG.API_URL || '/api/chat';
  var DEMO = /[?&]demo=1/.test(location.search);
  var $chat = document.getElementById('chat');
  var $opciones = document.getElementById('opciones');
  var $form = document.getElementById('formulario');
  var $entrada = document.getElementById('entrada');
  var $camara = document.getElementById('camara');

  var sesion = { cedula: null, usuario: null, registro: null, catalogo: null };
  var espera = null;          // { resolver, rechazar, tipo, validar }
  var RESET = { reset: true };
  var ultimoAutor = null;
  var generacion = 0;

  /* ------------------------------------------------------------ pintar */

  // Los textos son los del bot de WhatsApp; en la página se pintan sin emojis (las palabras no cambian).
  var EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu;
  function sinEmoji(texto) {
    return String(texto).replace(EMOJI, '').replace(/[ \t]+(\n|$)/g, '$1').replace(/^[ \t]+/gm, '').replace(/ {2,}/g, ' ');
  }

  var ICONO = {
    ubicacion: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
  };
  function icono(nombre) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONO[nombre] + '</svg>';
  }

  function formato(texto) {
    var t = String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>');
    return t;
  }

  function fila(autor) {
    var f = document.createElement('div');
    f.className = 'fila fila--' + autor + (ultimoAutor === autor ? ' fila--seguida' : '');
    if (autor === 'bot') {
      var a = document.createElement('div');
      a.className = 'avatar';
      a.innerHTML = '<img class="solo-claro" src="marca/rutero-simbolo.svg" alt=""><img class="solo-oscuro" src="marca/rutero-simbolo-oscuro.svg" alt="">';
      f.appendChild(a);
    }
    ultimoAutor = autor;
    return f;
  }

  function abajo() { requestAnimationFrame(function () { $chat.scrollTop = $chat.scrollHeight; }); }

  function burbuja(autor, html, clase) {
    var f = fila(autor);
    var b = document.createElement('div');
    b.className = 'burbuja' + (clase ? ' ' + clase : '');
    b.innerHTML = html;
    f.appendChild(b);
    $chat.appendChild(f);
    abajo();
    return b;
  }

  function bot(texto, clase) { return burbuja('bot', formato(sinEmoji(texto)), clase); }
  function yo(texto) { return burbuja('yo', formato(texto)); }

  function ficha(titulo, pares) {
    var html = titulo ? formato(sinEmoji(titulo)) : '';
    html += '<dl class="ficha">' + pares.map(function (p) {
      return '<div><dt>' + formato(sinEmoji(p[0])) + '</dt><dd>' + formato(p[1]) + '</dd></div>';
    }).join('') + '</dl>';
    return burbuja('bot', html);
  }

  var $escribiendo = null;
  function escribiendo(si) {
    if (si && !$escribiendo) {
      $escribiendo = fila('bot');
      $escribiendo.innerHTML += '<div class="burbuja escribiendo" aria-label="Escribiendo"><i></i><i></i><i></i></div>';
      $chat.appendChild($escribiendo);
      ultimoAutor = null;
      abajo();
    } else if (!si && $escribiendo) {
      $escribiendo.remove(); $escribiendo = null; ultimoAutor = null;
    }
  }

  function pausa(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function dice(texto, clase) { escribiendo(true); await pausa(320); escribiendo(false); return bot(texto, clase); }

  /* ------------------------------------------------------------ preguntar */

  function limpiarOpciones() { $opciones.innerHTML = ''; }

  function bloquearEntrada(si, placeholder) {
    $entrada.disabled = si;
    $form.querySelector('button').disabled = si;
    $entrada.placeholder = placeholder || 'Escribe un mensaje';
  }

  function esperar(tipo, extra) {
    return new Promise(function (resolver, rechazar) {
      espera = Object.assign({ resolver: resolver, rechazar: rechazar, tipo: tipo }, extra || {});
    });
  }

  function responder(valor, mostrar) {
    if (!espera) return;
    var e = espera; espera = null;
    limpiarOpciones();
    if (mostrar !== false) yo(mostrar || String(valor));
    e.resolver(valor);
  }

  // Texto libre (o número).
  function pedirTexto(opciones) {
    opciones = opciones || {};
    limpiarOpciones();
    bloquearEntrada(false, opciones.placeholder);
    $entrada.inputMode = opciones.numero ? 'numeric' : 'text';
    setTimeout(function () { $entrada.focus({ preventScroll: true }); }, 50);
    return esperar('texto', { validar: opciones.validar });
  }

  // Botones (también se puede escribir la opción).
  function pedirOpcion(lista, principal) {
    limpiarOpciones();
    bloquearEntrada(false, 'Toca una opción');
    $entrada.inputMode = 'text';
    lista.forEach(function (op, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion' + (op === principal || (principal == null && i === 0 && lista.length <= 2) ? ' opcion--principal' : '');
      b.textContent = op;
      b.addEventListener('click', function () { responder(op); });
      $opciones.appendChild(b);
    });
    return esperar('opcion', { lista: lista });
  }

  // Lista numerada: se toca o se escribe el índice.
  function pedirIndice(titulo, items, pie) {
    var b = bot(titulo);
    var ul = document.createElement('ol');
    ul.className = 'lista';
    items.forEach(function (txt, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="num">' + (i + 1) + '</span><span>' + formato(sinEmoji(txt)) + '</span>';
      btn.addEventListener('click', function () { responder(i, String(i + 1)); });
      li.appendChild(btn); ul.appendChild(li);
    });
    b.appendChild(ul);
    if (pie) { var p = document.createElement('div'); p.className = 'burbuja__pie'; p.innerHTML = formato(sinEmoji(pie)); b.appendChild(p); }
    abajo();
    limpiarOpciones();
    bloquearEntrada(false, 'Toca o escribe el número');
    $entrada.inputMode = 'numeric';
    return esperar('indice', { total: items.length, ul: ul }).then(function (i) {
      ul.querySelectorAll('button').forEach(function (x, j) {
        x.disabled = true;
        if (j === i) { x.classList.add('elegido'); x.setAttribute('aria-current', 'true'); }
      });
      return i;
    });
  }

  function pedirUbicacion() {
    limpiarOpciones();
    bloquearEntrada(true, 'Comparte tu ubicación');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'opcion opcion--principal';
    b.innerHTML = icono('ubicacion') + 'Compartir ubicación';
    $opciones.appendChild(b);
    var p = esperar('ubicacion');
    b.addEventListener('click', function () {
      if (!navigator.geolocation) { bot('Tu celular no permite compartir la ubicación desde aquí.', 'burbuja--error'); return; }
      b.disabled = true; b.lastChild.textContent = 'Buscando ubicación…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = +pos.coords.latitude.toFixed(6), lon = +pos.coords.longitude.toFixed(6);
        if (!espera) return;
        var e = espera; espera = null; limpiarOpciones();
        burbuja('yo', '<span class="burbuja__ubicacion">' + icono('ubicacion') + '<a href="https://maps.google.com/?q=' + lat + ',' + lon + '" target="_blank" rel="noopener">Ubicación: ' + lat + ', ' + lon + '</a></span>');
        e.resolver({ lat: lat, lon: lon });
      }, function () {
        b.disabled = false; b.lastChild.textContent = 'Compartir ubicación';
        bot('No pude leer tu ubicación. Activa el GPS y da permiso de ubicación al navegador, y vuelve a tocar el botón.', 'burbuja--error');
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
    return p;
  }

  function pedirFoto(texto) {
    limpiarOpciones();
    bloquearEntrada(true, 'Toma la foto');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'opcion opcion--principal';
    b.innerHTML = icono('camara') + (texto || 'Tomar foto');
    $opciones.appendChild(b);
    var p = esperar('foto');
    b.addEventListener('click', function () { $camara.value = ''; $camara.click(); });
    return p;
  }

  $camara.addEventListener('change', function () {
    var f = $camara.files && $camara.files[0];
    if (!f || !espera || espera.tipo !== 'foto') return;
    comprimir(f).then(function (dataUrl) {
      if (!espera) return;
      var e = espera; espera = null; limpiarOpciones();
      burbuja('yo', '<img src="' + dataUrl + '" alt="Foto enviada">', 'burbuja--foto');
      e.resolver(dataUrl);
    }).catch(function () { bot('No pude leer la foto. Intenta otra vez.', 'burbuja--error'); });
  });

  // Reduce la foto a 1280 px y JPEG para que suba rápido con datos móviles.
  function comprimir(archivo) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = mal;
      img.src = url;
    });
  }

  $form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $entrada.value.trim();
    if (!v) return;
    if (/^\/reset$/i.test(v)) { $entrada.value = ''; reiniciar(); return; }
    if (!espera) return;
    if (espera.tipo === 'opcion') {
      var op = espera.lista.filter(function (o) { return quitarTildes(o) === quitarTildes(v); })[0];
      if (!op) { yo(v); $entrada.value = ''; bot('Toca una de las opciones 👇🏻'); return; }
      $entrada.value = ''; responder(op); return;
    }
    if (espera.tipo === 'indice') {
      var n = parseInt(v, 10);
      if (!(n >= 1 && n <= espera.total)) { yo(v); $entrada.value = ''; bot('Digita un número entre 1 y ' + espera.total + '.'); return; }
      $entrada.value = ''; responder(n - 1, String(n)); return;
    }
    if (espera.tipo === 'texto') {
      var error = espera.validar && espera.validar(v);
      $entrada.value = '';
      if (error) { yo(v); bot(error); return; }
      responder(v);
    }
  });

  function quitarTildes(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase(); }

  /* ------------------------------------------------------------ servidor */

  var ESCRITURAS = ['registrarIngreso', 'subirVenta', 'guardarRedencion', 'guardarAgotado', 'registrarSalida', 'marcarPaso'];

  async function api(accion, datos) {
    var cuerpo = Object.assign({ accion: accion, cedula: sesion.cedula }, datos || {});
    var yoGen = generacion;
    escribiendo(true);
    try {
      var r;
      if (DEMO) r = await window.DEMO_API(cuerpo);
      else {
        var ctl = new AbortController();
        var t = setTimeout(function () { ctl.abort(); }, 90000);
        var res = await fetch(API_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: ctl.signal
        });
        clearTimeout(t);
        r = await res.json();
      }
      escribiendo(false);
      if (yoGen !== generacion) throw RESET;
      return r;
    } catch (e) {
      if (e === RESET) throw e;
      escribiendo(false);
      var escritura = ESCRITURAS.indexOf(accion) >= 0;
      return {
        ok: false, sinRespuesta: true,
        error: escritura
          ? 'La conexión se cayó y puede que la información sí se haya guardado. No la envíes otra vez: avísale a tu supervisor.'
          : 'No hay conexión con el servidor. Revisa tus datos o wifi e intenta de nuevo.'
      };
    }
  }

  async function exigir(accion, datos) {
    while (true) {
      var r = await api(accion, datos);
      if (r.ok) return r;
      await dice(r.error || 'Algo salió mal.', 'burbuja--error');
      if (ESCRITURAS.indexOf(accion) >= 0) throw { volverMenu: true };
      var op = await pedirOpcion(['Reintentar', 'Volver al inicio']);
      if (op !== 'Reintentar') throw RESET;
    }
  }

  async function catalogo() {
    if (!sesion.catalogo) sesion.catalogo = await exigir('catalogo');
    return sesion.catalogo;
  }

  /* ------------------------------------------------------------ flujo */

  async function identificar() {
    var guardada = null;
    try { guardada = localStorage.getItem('chat-cedula'); } catch (e) {}
    await dice('¡Ups! No reconozco este número en nuestro sistema. 🧐 ¿Te parece si intentamos validarlo de otra forma para poder ayudarte mejor?');
    while (true) {
      await dice('Ingresa tu numero de identificación: \n_ingresa únicamente números sin puntos_');
      var cedula;
      if (guardada) {
        var op = await pedirOpcion(['Continuar con ' + guardada, 'Otra cédula'], 'Continuar con ' + guardada);
        if (op === 'Otra cédula') { guardada = null; continue; }
        cedula = guardada;
      } else {
        cedula = await pedirTexto({
          numero: true, placeholder: 'Número de cédula',
          validar: function (v) { return /^\d{5,12}$/.test(v) ? null : 'Ingresa únicamente números sin puntos.'; }
        });
      }
      sesion.cedula = cedula;
      var r = await api('identificar');
      if (r.ok) {
        sesion.usuario = r.usuario; sesion.registro = r.registro;
        try { localStorage.setItem('chat-cedula', cedula); } catch (e) {}
        await dice('Bienvenido *' + r.usuario.nombre + '*');
        return;
      }
      guardada = null;
      try { localStorage.removeItem('chat-cedula'); } catch (e) {}
      if (r.noReconocido) await dice('¡Ups! No reconozco este número en nuestro sistema. 🧐 ¿Te parece si intentamos validarlo de otra forma para poder ayudarte mejor?');
      else await dice(r.error || 'No pude validar tu cédula.', 'burbuja--error');
    }
  }

  async function menuInicio() {
    while (true) {
      await dice('Que desea realizar\nOpciones 👇🏻');
      var op = await pedirOpcion(['VALIDAR RUTERO', 'EXTRA RUTA']);
      if (op === 'VALIDAR RUTERO') {
        var r = await exigir('ruteroHoy');
        if (!r.visitas.length) {
          await dice('UPS!, parece que no cuentas con visitas programadas para el día de hoy.');
          await dice('Comunícate con tu supervisor');
          continue;
        }
        var i = await pedirIndice('Estas son tus visitas de hoy:', r.visitas.map(function (v) {
          return '*' + v.pdv + '*\nSAP ' + v.sap + ' · ' + v.inicio;
        }), '_Digita el índice de la visita que vas a realizar_');
        var pdv = await confirmarPdv(r.visitas[i].sap);
        if (pdv) return ingreso(pdv, 'RUTERO');
      } else {
        var p = await extraRuta();
        if (p) return ingreso(p, 'EXTRA RUTA');
      }
    }
  }

  async function extraRuta() {
    while (true) {
      await dice('*Link landing*\n\n' + CFG.LINK_PDV + '\n\nEscribe el SAP del PDV:');
      var sap = await pedirTexto({
        numero: true, placeholder: 'SAP del PDV',
        validar: function (v) { return /^\d+$/.test(v) ? null : 'Escribe solo el número del SAP.'; }
      });
      var pdv = await confirmarPdv(sap);
      if (pdv) return pdv;
    }
  }

  async function confirmarPdv(sap) {
    var r = await exigir('buscarPdv', { sap: sap });
    if (!r.pdv) { await dice('El PDV seleccionado no se encuentra en la base, comunícate con el administrador!'); return null; }
    ficha('El PDV seleccionado es:', [
      ['SAP', '*' + r.pdv.sap + '*'], ['➖ PDV', '*' + r.pdv.nombre + '*'],
      ['➖ Ciudad', '*' + r.pdv.ciudad + '*'], ['➖ Dirección', '*' + r.pdv.direccion + '*']
    ]);
    await dice('¿Es Correcto?\nOpciones 👇🏻');
    var op = await pedirOpcion(['Si', 'No']);
    return op === 'Si' ? r.pdv : null;
  }

  async function equipo(nombre) {
    await dice('¿Cuenta con ' + nombre + '?\nOpciones 👇🏻');
    if ((await pedirOpcion(['Si', 'No'])) === 'No') return { tiene: false };
    await dice('Envíame una foto de la ' + nombre.toLowerCase());
    var foto = await pedirFoto('Foto de la ' + nombre.toLowerCase());
    await dice('¿En qué estado está la ' + nombre.toLowerCase() + '?\nOpciones 👇🏻');
    var estado = await pedirOpcion(['Funciona', 'No funciona']);
    await dice('Escribe una observación (o escribe *NA*):');
    var obs = await pedirTexto({ placeholder: 'Observación' });
    return { tiene: true, foto: foto, estado: estado, observacion: obs };
  }

  async function ingreso(pdv, tipo) {
    await dice('compárteme tu ubicación');
    var ub = await pedirUbicacion();
    await dice('Ubicación confirmada correctamente!!!');
    await dice('Iniciemos con el registro de ingreso!!!');
    await dice('Envíame una foto de tu ingreso');
    var foto = await pedirFoto('Foto de ingreso');
    var tablet = await equipo('Tablet');
    var impresora = await equipo('impresora');
    var r;
    try {
      r = await exigir('registrarIngreso', {
        sap: pdv.sap, tipo: tipo, lat: ub.lat, lon: ub.lon, fotoIngreso: foto, tablet: tablet, impresora: impresora
      });
    } catch (e) { if (e && e.volverMenu) return menuInicio(); throw e; }
    sesion.registro = r.registro;
    ficha('', [
      ['Usuario:', '*' + r.resumen.usuario + '*'], ['Fecha:', '*' + r.resumen.fecha + '*'],
      ['Hora:', '*' + r.resumen.hora + '*'], ['SAP:', '*' + r.resumen.sap + '*'], ['PDV:', '*' + r.resumen.pdv + '*']
    ]);
    await dice('Se a guardado correctamente tu información  ☁');
    return menuPdv();
  }

  async function menuPdv() {
    while (true) {
      await dice('. ¿Que deseas realizar?.\nOpciones 👇🏻\n----------');
      var op = await pedirOpcion(['Venta Teorica', 'Agotados', 'Salida'], 'Venta Teorica');
      try {
        if (op === 'Venta Teorica') await ventaTeorica();
        else if (op === 'Agotados') await agotados();
        else { if (await salida()) return; }
      } catch (e) { if (!(e && e.volverMenu)) throw e; }
    }
  }

  async function ventaTeorica() {
    await dice('A continuación vas a registrar venta\nOpciones 👇🏻');
    if ((await pedirOpcion(['Registrar Venta', 'Volver al Menu'])) === 'Volver al Menu') return;
    await dice('¿Realizo venta teorica?\nOpciones 👇🏻');
    if ((await pedirOpcion(['Si', 'No'])) === 'No') { await exigir('marcarPaso', { paso: 'venta' }); return; }
    var cat = await catalogo();
    while (true) {
      await dice('*Link landing*\n\n' + CFG.LINK_PRODUCTOS + '\n\nEscribe el código del producto:');
      var codigo = await pedirTexto({ numero: true, placeholder: 'Código (EAN)' });
      var prod = cat.portafolio.filter(function (x) { return String(x.ean) === codigo.replace(/\D/g, ''); })[0];
      if (!prod) { await dice('El código no se encuentra en el portafolio, revisa el link e intenta de nuevo.'); continue; }
      await dice('Digita las unidades vendidas de *' + prod.nombre + '*:');
      var unidades = await pedirTexto({
        numero: true, placeholder: 'Unidades',
        validar: function (v) { var n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 999 ? null : 'Digita un número de unidades entre 1 y 999.'; }
      });
      ficha('Resumen de venta:', [['Código:', '*' + prod.ean + '*'], ['Producto:', '*' + prod.nombre + '*'], ['Cantidad:', '*' + unidades + '*']]);
      await dice('¿Qué desea realizar?\nOpciones 👇🏻');
      if ((await pedirOpcion(['Subir Venta', 'Cambiar Producto'])) === 'Cambiar Producto') continue;
      var r = await exigir('subirVenta', { ean: prod.ean, unidades: Number(unidades) });
      await dice('Información guardada correctamente  ☁');
      var lista = cat.premios.filter(function (p) { return p.linea === r.marca; });
      if (!r.redime || !lista.length) { await dice('El producto no aplica a redención de premio'); return; }
      await redencion(r.idVenta, lista);
      return;
    }
  }

  async function redencion(idVenta, premios) {
    await dice('¿Fueron entregados premios para esta venta?\nOpciones 👇🏻');
    if ((await pedirOpcion(['Si', 'No'])) === 'No') return;
    await dice('Carga una foto de la factura');
    var foto = await pedirFoto('Foto de la factura');
    var urlFactura = null;
    while (true) {
      var i = await pedirIndice('Selecciona el premio entregado:', premios.map(function (p) { return p.nombre; }),
        '_Digita el indice del premio que se encuentra a la izquierda._');
      var premio = premios[i];
      await dice('¿El premio seleccionado es *' + premio.nombre + '*?\nOpciones 👇🏻');
      if ((await pedirOpcion(['Si', 'No'])) === 'No') continue;
      await dice('Indique las cantidad des premios entregados *' + premio.nombre + '*:');
      var cant = await pedirTexto({
        numero: true, placeholder: 'Cantidad',
        validar: function (v) { var n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 999 ? null : 'Digita una cantidad entre 1 y 999.'; }
      });
      var etiqueta = false;
      if (premio.etiqueta) {
        await dice('¿Se entrego etiqueta?\nOpciones 👇🏻');
        etiqueta = (await pedirOpcion(['Si', 'No'])) === 'Si';
      }
      var r = await exigir('guardarRedencion', {
        idVenta: idVenta, codigo: premio.codigo, cantidad: Number(cant), etiqueta: etiqueta,
        fotoFactura: urlFactura ? null : foto, fotoFacturaUrl: urlFactura
      });
      urlFactura = r.fotoFacturaUrl;
      await dice('Redención guardada exitosamente  ☁');
      await dice('¿Qué desea realizar?\nOpciones 👇🏻');
      if ((await pedirOpcion(['Agregar otro premio', 'Finalizar'])) === 'Finalizar') return;
    }
  }

  async function agotados() {
    await dice('Encontraste Agotados del producto Foco\nOpciones 👇🏻');
    if ((await pedirOpcion(['Si', 'No'])) === 'No') { await exigir('marcarPaso', { paso: 'agotados' }); return; }
    var foco = (await catalogo()).portafolio.filter(function (p) { return p.foco; });
    while (true) {
      var i = await pedirIndice('A continuación te enlistare los productos foco del evento:', foco.map(function (p) { return p.nombre; }),
        '_Digita el índice que se encuentra a la izquierda del producto_');
      await dice('¿El producto seleccionado es *' + foco[i].nombre + '*?\nOpciones 👇🏻');
      if ((await pedirOpcion(['Si', 'No'])) === 'No') continue;
      await exigir('guardarAgotado', { ean: foco[i].ean });
      await dice('Agotado guardado correctamente  ☁');
      await dice('¿Qué desea realizar?\nOpciones 👇🏻');
      if ((await pedirOpcion(['Agregar otro agotado', 'Finalizar'])) === 'Finalizar') {
        await exigir('marcarPaso', { paso: 'agotados' });
        return;
      }
    }
  }

  async function salida() {
    await dice('Vas a registrar tu salida del PDV *' + (sesion.registro && sesion.registro.pdv || '') + '*.\n¿Deseas continuar?\nOpciones 👇🏻');
    if ((await pedirOpcion(['Si', 'No'])) === 'No') return false;
    await dice('¿Cuántas personas abordaste hoy?');
    var personas = await pedirTexto({
      numero: true, placeholder: 'Personas abordadas',
      validar: function (v) { var n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 9999 ? null : 'Digita solo el número de personas.'; }
    });
    await dice('compárteme tu ubicación');
    var ub = await pedirUbicacion();
    await dice('Envíame una foto de tu salida');
    var foto = await pedirFoto('Foto de salida');
    var r = await exigir('registrarSalida', { personas: Number(personas), lat: ub.lat, lon: ub.lon, fotoSalida: foto });
    await dice('Salida registrada a las *' + r.hora + '*  ☁\n¡Gracias por tu jornada!');
    await pedirOpcion(['Empezar de nuevo']);
    throw RESET;
  }

  /* ------------------------------------------------------------ arranque */

  async function conversacion() {
    await identificar();
    if (sesion.registro && sesion.registro.estado === 'EN PDV') {
      await dice('Tienes un ingreso abierto en *' + sesion.registro.pdv + '* desde las ' + sesion.registro.horaIngreso + '.');
      return menuPdv();
    }
    return menuInicio();
  }

  function reiniciar() {
    if (espera) { var e = espera; espera = null; e.rechazar(RESET); }
    else arrancar();   // si había una consulta en curso, su respuesta se descarta (generación distinta)
  }

  function arrancar() {
    $chat.innerHTML = ''; ultimoAutor = null; limpiarOpciones(); escribiendo(false);
    sesion = { cedula: null, usuario: null, registro: null, catalogo: null };
    if (DEMO) {
      var s = document.createElement('div');
      s.className = 'separador';
      s.textContent = 'Modo demo: datos de mentira, no se guarda nada. Cédula de prueba 12345678, SAP 1111.';
      $chat.appendChild(s);
    }
    var miGen = ++generacion;
    conversacion().catch(function (e) {
      if (e === RESET) { if (miGen === generacion) arrancar(); return; }
      console.error(e);
      bot('Algo salió mal. Escribe /reset para empezar de nuevo.', 'burbuja--error');
    });
  }

  document.getElementById('btnReset').addEventListener('click', reiniciar);
  document.getElementById('btnTema').addEventListener('click', function () {
    var r = document.documentElement;
    var oscuro = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('chat-tema', r.dataset.theme); } catch (e) {}
    document.querySelector('meta[name="theme-color"]').setAttribute('content', oscuro ? '#f5f3ee' : '#0c1613');
  });
  // Etiqueta de la barra: "Demo" con ?demo=1, "Prueba" si el servidor está en modo prueba.
  var $chip = document.getElementById('chipPrueba');
  if (DEMO) { $chip.textContent = 'Demo'; $chip.hidden = false; }
  else {
    fetch(API_URL).then(function (r) { return r.json(); }).then(function (r) {
      if (r && r.modoPrueba) { $chip.textContent = 'Prueba'; $chip.hidden = false; }
    }).catch(function () {});
  }

  arrancar();
})();
