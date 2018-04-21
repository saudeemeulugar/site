(function($) {
  $('body').scrollspy({
    target: '.navbar-fixed-top',
    offset: 100
  });

  $(function() {
    $('.match-grid-col-scroll').matchHeight();
  });
})(jQuery);

(function($) {
  if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
    $('body').addClass('is-mobile');
  } else {
    $('body').addClass('not-is-mobile');
  }
})(jQuery);