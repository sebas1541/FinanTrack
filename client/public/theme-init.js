// Aplica el tema guardado antes de pintar, para evitar un parpadeo claro/oscuro.
try {
  var t = localStorage.getItem('ft_theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
