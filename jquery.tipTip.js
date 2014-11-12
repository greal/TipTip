/*
 * TipTip JS
 * Copyright 2010 Drew Wilson
 * www.drewwilson.com
 * code.drewwilson.com/entry/tiptip-jquery-plugin
 *
 * Modified by: indyone (https://github.com/indyone/TipTip)
 * Modified by: Jonathan Lim-Breitbart (https://github.com/breity/TipTip) - Updated: Oct. 10, 2012
 * Modified by: Alan Hussey/EnergySavvy (https://github.com/EnergySavvy/TipTip) - Updated: Mar. 18, 2013
 *
 * Version 1.3   -   Updated: Mar. 23, 2010
 *
 * This Plug-In will create a custom tooltip to replace the default
 * browser tooltip. It is extremely lightweight and very smart in
 * that it detects the edges of the browser window and will make sure
 * the tooltip stays within the current window size. As a result the
 * tooltip will adjust itself to be displayed above, below, to the left
 * or to the right depending on what is necessary to stay within the
 * browser window. It is completely customizable as well via CSS.
 *
 * This TipTip jQuery plug-in is dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

(function ($) {
	$.fn.tipTip = function (options) {
		var defaults = {
			activation: 'hover', // способ активации, может быть `hover`, `focus`, `click`, `manual`
			keepAlive: false, // когда `true`, тип не скроется, когда мышь ушла из родителя; он скроется, когда мышь выйдет из типа
			keepAlive: false, // When true the tooltip won't disappear when the mouse moves away from the element. Instead it will be hidden when it leaves the tooltip.
			hideOnClick: false, // когда `true`, нажатие снаружи типа закроет его. полезно вместе с `keepAlive` и `delayHide`
			maxWidth: '200px', // максимальная ширина, также может задаваться стилями
			edgeOffset: 0, // расстояние между стрелкой типа и родителем
			defaultPosition: 'top', // положение, может быть `top`, `right`, `bottom`, `left`

			delay: 200, // задержка перед показом
			delayHover: 300, // задержка перед показом после наведения
			delayHide: 0, // задержка перед скрытием
			fadeIn: 200, // скорость отображения
			fadeOut: 200, // скорость скрытия

			content: false, // разметка, строка или функция, возвращающая разметку или строку
			attribute: 'title', // атрибут, из которого будет браться содержимое, если `content` не задан

			enter: function () { }, // функция перед отображением
			afterEnter: function () { }, // функция после отображения
			exit: function () { }, // функция перед скрытием
			afterExit: function () { }, // функция после скрытия

			theme: 'white', // устанавливается тема, выбор из `black`, `alt` и `white`
			cssClass: '', // класс будет добавлен типу перед его отображением

			detectTextDir: false // автоматическое определение правостороннего текста, немного замедляет работу
		};

		// готовим разметку для типа
		if ($('#tiptip_holder').length) {
			var tiptip_holder = $('#tiptip_holder');
			var tiptip_content = $('#tiptip_content');
			var tiptip_arrow = $('#tiptip_arrow');
		} else {
			var tiptip_inner_arrow = $('<div>', { id: 'tiptip_arrow_inner' });
			var tiptip_arrow = $('<div>', { id: 'tiptip_arrow' }).append(tiptip_inner_arrow);
			var tiptip_content = $('<div>', { id: 'tiptip_content' });
			var tiptip_holder = $('<div>', { id: 'tiptip_holder' }).append(tiptip_arrow).append(tiptip_content);

			$('body').append(tiptip_holder);
		};

		// общий таймаут, потому что есть только один `#tiptip_holder`
		var timeoutHide = false;

		return this.each(function () {
			var org_elem = $(this);
			var data = org_elem.data('tipTip');
			var opts = data && data.options || $.extend({}, defaults, options);
			var callback_data = { holder: tiptip_holder, content: tiptip_content, arrow: tiptip_arrow, options: opts };

			// можно настроить при помощи атрибутов в разметке
			if (org_elem.attr('data-activation')) { opts.activation = org_elem.attr('data-activation'); };
			if (org_elem.attr('data-delay')) { opts.delay = org_elem.attr('data-delay'); };
			if (org_elem.attr('data-position')) { opts.defaultPosition = org_elem.attr('data-position'); };
			if (org_elem.attr('data-class')) { opts.cssClass = org_elem.attr('data-class'); };
			if (org_elem.attr('data-theme')) { opts.theme = org_elem.attr('data-theme'); };

			// запоминаем и удаляем атрибут `opts.attribute`, чтобы браузер не отображал стандартную подсказку
			if (!opts.content && !$.isFunction(opts.content)) {
				opts.content = org_elem.attr(opts.attribute);
				if (opts.attribute === 'title') {
					org_elem.removeAttr(opts.attribute);
				};
			};

			if (data) {
				switch (options) {
					case 'show':
						active_tiptip();
						break;
					case 'hide':
						deactive_tiptip();
						break;
					case 'destroy':
						org_elem.unbind('.tipTip').removeData('tipTip');
						break;
					case 'position':
						position_tiptip();
				}
			} else {
				var timeout = false;
				var timeoutHover = false;

				org_elem.data('tipTip', { options: opts });

				if (opts.activation == 'hover') {
					org_elem.bind('mouseenter.tipTip', function () {
						if (opts.delayHover){
							timeoutHover = setTimeout( function(){ active_tiptip() }, opts.delayHover);
						}else{
							active_tiptip();
						}
					}).bind('mouseleave.tipTip', function () {
							if (timeoutHover){
								clearTimeout(timeoutHover);
							}
							
							if (!opts.keepAlive) {
								deactive_tiptip();
							} else {
								tiptip_holder.one('mouseleave.tipTip', function () {
									deactive_tiptip();
								});
							}
							if (opts.hideOnClick) {
								deactive_on_click();
							}
						});
				} else if (opts.activation == 'focus') {
					org_elem.bind('focus.tipTip', function () {
						active_tiptip();
					}).bind('blur.tipTip', function () {
							deactive_tiptip();
						});
				} else if (opts.activation == 'click') {
					org_elem.bind('click.tipTip', function (e) {
						e.preventDefault();
						active_tiptip();
						return false;
					}).bind('mouseleave.tipTip', function () {
							if (!opts.keepAlive) {
								deactive_tiptip();
							} else {
								tiptip_holder.one('mouseleave.tipTip', function () {
									deactive_tiptip();
								});
							}
							deactive_on_click();
						});
				} else if (opts.activation == 'manual') {
					// нечего регистрировать, разработчик сам поймёт что, где, когда показывать
				};
				
				// скрывать тип, когда пользователь нажимает куда угодно кроме самого типа
				function deactive_on_click() {
					$('html').off('click.tipTip').on('click.tipTip',function(e){
						if (tiptip_holder.css('display') == 'block' && !$(e.target).closest('#tiptip_holder').length) {
							$('html').off('click.tipTip');
							deactive_tiptip(0); // 0 = мгновенно, игнорируя `delayHide`
						}
					});
				};
			}

			function active_tiptip() {
				if (opts.enter.call(org_elem, callback_data) === false) {
					return;
				};

				// получаем текст и добавляем в `tiptip_content`
				var org_title;

				// даже если напрямую содержимое не устанавливается, уже использовался атрибут
				if (opts.content) {
					org_title = $.isFunction(opts.content) ? opts.content.call(org_elem, callback_data) : opts.content;
				};

				if (!org_title) {
					return; // не отображать тип, если нет содержимого
				};

				tiptip_content.html(org_title);
				tiptip_holder.hide().removeAttr('class').css({ 'max-width': opts.maxWidth });

				// добавляем класс
				opts.cssClass += ' tip--theme-'+ opts.theme;
				tiptip_holder.addClass(opts.cssClass);

				// определяем положение типа
				position_tiptip();

				// показываем тип
				if (timeout) {
					clearTimeout(timeout);
				};

				// убираем таймаут
				if (timeoutHide) {
					clearTimeout(timeoutHide);
				};

				timeout = setTimeout(function () {
					tiptip_holder.stop(true, true).fadeIn(opts.fadeIn);
				}, opts.delay);

				$(window).bind('resize.tipTip scroll.tipTip', position_tiptip);

				org_elem.addClass('tiptip_visible'); // класс-маркер, чтобы облегчить определение родителя типа; будет удалён при помощи `deactive_tiptip()`

				opts.afterEnter.call(org_elem, callback_data);
			};

			function deactive_tiptip(delay) {
				if (opts.exit.call(org_elem, callback_data) === false) {
					return;
				};

				if (timeout) {
					clearTimeout(timeout);
				};

				function hide_tiptip() {
					tiptip_holder.fadeOut(opts.fadeOut, function(){

						// сбрасываем положение и размеры
						$(this).css({ left: '', top: '', height: '', width: '' });
					});
				};

				// скрываем тип после опциональной задержки
				var delay = (delay !== undefined) ? delay : opts.delayHide;

				if (delay == 0) {
					hide_tiptip();

					// если пользователь нажал, убираем отложенное скрытие
					if (opts.delayHide > 0) {
						clearTimeout(timeoutHide);
					}
				} else {
					
					// не скрываем тип, если на него навели
					tiptip_holder.one('mouseenter.tipTip', function() {
						clearTimeout(timeoutHide);
						tiptip_holder.on('mouseleave.tipTip', function() {
							deactive_tiptip();
						});
					});
					
					timeoutHide = setTimeout(function() {
						hide_tiptip();
					}, delay);

				};

				// это должно происходить и когда тип визуально скрыт или перемещён с помощью `active_tiptip()`
				setTimeout(function() {
					$(window).unbind('resize.tipTip scroll.tipTip');

					org_elem.removeClass('tiptip_visible');

					opts.afterExit.call(org_elem, callback_data);
				}, delay);

			}

			function position_tiptip() {
				var org_offset = org_elem.offset();
				var org_top = org_offset.top;
				var org_left = org_offset.left;
				var org_width = org_elem.outerWidth();
				var org_height = org_elem.outerHeight();

				var tip_top;
				var tip_left;
				var tip_width = tiptip_holder.outerWidth();
				var tip_height = tiptip_holder.outerHeight();

				var tip_class;
				var tip_classes = {
					top: 'tip_top',
					bottom: 'tip_bottom',
					left: 'tip_left',
					right: 'tip_right'
				};

				var arrow_top;
				var arrow_left;

				// ПРОВЕРИТЬ: возможно, тип можно скрывать при помощи `visibility: hidden`? тогда этой проблемы не будет
				var arrow_width = 12; // `tiptip_arrow.outerHeight()` and `tiptip_arrow.outerWidth()` не работают, потому что элемент должен быть отображён
				var arrow_height = 12;

				var win = $(window);
				var win_top = win.scrollTop();
				var win_left = win.scrollLeft();
				var win_width = win.width();
				var win_height = win.height();

				var is_rtl = opts.detectTextDir && isRtlText(tiptip_content.text());

				function moveTop() {
					tip_class = tip_classes.top;
					tip_top = org_top - tip_height - opts.edgeOffset - (arrow_height / 2);
					tip_left = org_left + ((org_width - tip_width) / 2);
				};

				function moveBottom() {
					tip_class = tip_classes.bottom;
					tip_top = org_top + org_height + opts.edgeOffset;
					tip_left = org_left + ((org_width - tip_width) / 2);
				};

				function moveLeft() {
					tip_class = tip_classes.left;
					tip_top = org_top + ((org_height - tip_height) / 2);
					tip_left = org_left - tip_width - opts.edgeOffset - (arrow_width / 2);
				};

				function moveRight() {
					tip_class = tip_classes.right;
					tip_top = org_top + ((org_height - tip_height) / 2);
					tip_left = org_left + org_width + opts.edgeOffset;
				};

				// вычисляем положение типа
				if (opts.defaultPosition == 'bottom') {
					moveBottom();
				} else if (opts.defaultPosition == 'top') {
					moveTop();
				} else if (opts.defaultPosition == 'left' && !is_rtl) {
					moveLeft();
				} else if (opts.defaultPosition == 'left' && is_rtl) {
					moveRight();
				} else if (opts.defaultPosition == 'right' && !is_rtl) {
					moveRight();
				} else if (opts.defaultPosition == 'right' && is_rtl) {
					moveLeft();
				} else {
					moveBottom();
				};

				// выдвигаем тип, если он выходит за пределы экрана (слева <-> справа и сверху <-> снизу)
				if (tip_class == tip_classes.left && !is_rtl && tip_left < win_left) {
					moveRight();
				} else if (tip_class == tip_classes.left && is_rtl && tip_left - tip_width < win_left) {
					moveRight();
				} else if (tip_class == tip_classes.right && !is_rtl && tip_left > win_left + win_width) {
					moveLeft();
				} else if (tip_class == tip_classes.right && is_rtl && tip_left + tip_width > win_left + win_width) {
					moveLeft();
				} else if (tip_class == tip_classes.top && tip_top < win_top) {
					moveBottom();
				} else if (tip_class == tip_classes.bottom && tip_top > win_top + win_height) {
					moveTop();
				};

				// исправляем вертикальное положение, если тип выпал сверху или снизу за область просмотра
				if (tip_class == tip_classes.left || tip_class == tip_classes.right) { // если позиционируется слева или справа, проверяем не выходит ли за верхний или нижний край области просмотра
					if (tip_top + tip_height > win_height + win_top) { // если нижняя сторона типа выходит за нижнюю сторону области просмотра
						tip_top = org_top + org_height > win_height + win_top ? org_top + org_height - tip_height : win_height + win_top - tip_height - 4; // выравниваем их
					} else if (tip_top < win_top) { // если верхняя сторона типа выходит за верхнюю сторону области просмотра
						tip_top = org_top < win_top ? org_top : win_top + 4; // выравниваем их
					};
				};

				// исправляем вертикальное положение, если тип выпал слева или справа за область просмотра
				if (tip_class == tip_classes.top || tip_class == tip_classes.bottom) {
					if (tip_left + tip_width > win_width + win_left) { // если правая сторона типа выходит за правую сторону области просмотра
						tip_left = org_left + org_width > win_width + win_left ? org_left + org_width - tip_width : win_width + win_left - tip_width - 4; // выравниваем правую сторону типа с правой стороной области просмотра
					} else if (tip_left < win_left) { // если левая сторона типа выходит за левую сторону области просмотра
						tip_left = org_left < win_left ? org_left : win_left + 4; // выравниваем их
					};
				};

				// применяем положение
				tiptip_holder
					.css({ left: Math.round(tip_left), top: Math.round(tip_top) })
					.removeClass(tip_classes.top)
					.removeClass(tip_classes.bottom)
					.removeClass(tip_classes.left)
					.removeClass(tip_classes.right)
					.addClass(tip_class);

				// позиционируем стрелку
				if (tip_class == tip_classes.top) {
					arrow_top = tip_height; // стрелка снизу
					arrow_left = org_left - tip_left + ((org_width - arrow_width) / 2); // центрируется по горизонтали посередине родителя
				} else if (tip_class == tip_classes.bottom) {
					arrow_top = 0; // стрелка сверху
					arrow_left = org_left - tip_left + ((org_width - arrow_width) / 2); // центрируется по горизонтали посередине родителя
				} else if (tip_class == tip_classes.left) {
					arrow_top = org_top - tip_top + ((org_height - arrow_height) / 2); // центрируется по вертикали посередине родителя
					arrow_left = tip_width; // стрелка слева
				} else if (tip_class == tip_classes.right) {
					arrow_top = org_top - tip_top + ((org_height - arrow_height) / 2); // центрируется по горизонтали посередине родителя
					arrow_left = 0; // стрелка справа
				};

				tiptip_arrow.css({
					left: Math.round(arrow_left),
					top: Math.round(arrow_top)
				});
			}
		});
	}

	// определяем правосторонность текста
	var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF',
		rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC',
		rtlDirCheckRe = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']');

	function isRtlText(text) {
		return rtlDirCheckRe.test(text);
	};

	// по умолчанию обрабатываем элементы со специальным классом
	$(document).ready(function() {
		$('.TipTip').each(function () {
			$(this).tipTip();
		});
	});

})(jQuery);
