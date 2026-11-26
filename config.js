// Dirección de los endpoints del bot.
// - En local (npm start) la página y el servidor van juntos: '/api/chat'.
// - En GitHub Pages la página va sola y llama al servidor publicado en Railway (SERVIDOR_PUBLICO).
// El modo demo (datos de mentira, no guarda nada) solo se activa abriendo la página con ?demo=1.
(function () {
  var SERVIDOR_PUBLICO = '';   // p. ej. 'https://chatbot-diageo-production.up.railway.app'
  var enPages = /\.github\.io$/.test(location.hostname);
  window.CONFIG = {
    API_URL: enPages ? (SERVIDOR_PUBLICO ? SERVIDOR_PUBLICO + '/api/chat' : '') : '/api/chat',
    LINK_PDV: 'https://phygital-exp.github.io/PDV_DIAGEO/',
    LINK_PRODUCTOS: 'https://phygital-exp.github.io/PRODUCTOS_DIAGEO/'
  };
})();
