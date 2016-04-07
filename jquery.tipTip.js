/*
 * TipTip JS
 * Copyright 2010 Drew Wilson
 *
 * Modified by: Sergei Vasilev (https://github.com/Ser-Gen/TipTip)
 *
 * Version 1.6.0
 *
 * This TipTip jQuery plug-in is dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

(function ($) {
	$.fn.tipTip = function (options) {
		var defaults = {
			activation: 'hover', // способ активации, может быть `hover`, `focus`, `click`, `manual`
			keepAlive: false, // когда `true`, Тип не скроется, когда мышь ушла из родителя; он скроется, когда мышь выйдет из Типа
			hideOnClick: false, // когда `true`, нажатие снаружи Типа закроет его. полезно вместе с `keepAlive` и `delayHide`, например
			maxWidth: '200px', // максимальная ширина, также может задаваться стилями
			width: null, // возможность задать фиксированную ширину
			edgeOffset: 0, // расстояние между стрелкой Типа и родителем
			defaultPosition: 'top', // положение, может быть `top`, `right`, `bottom`, `left`

			delay: 100, // задержка перед показом
			delayHover: 0, // задержка перед показом после наведения
			delayHide: 0, // задержка перед скрытием
			fadeIn: 100, // скорость отображения
			fadeOut: 200, // скорость скрытия

			content: false, // разметка, строка или функция, возвращающая разметку или строку
			attribute: 'title', // атрибут, из которого будет браться содержимое, если `content` не задан

			enter: function () { }, // функция перед отображением
			afterEnter: function () { }, // функция после отображения
			exit: function () { }, // функция перед скрытием
			afterExit: function () { }, // функция после скрытия

			theme: 'black', // устанавливается тема, выбор из `black`, `alt` и `white`
			cssClass: '', // класс будет добавлен типу перед его отображением

			objActiveClass: 'TipTip__active', // класс-маркер, чтобы облегчить определение родителя активного типа; будет удалён при помощи `deactive_tiptip()`
			hideOthers: true, // скрывать ли другие типы при активации
			container: 'body', // элемент, потенциально прокручиваемый, внутрь которого будет добавляться разметка Типа

			shiftByViewport: true, // автоматическое подстраивание под область видимости
			detectTextDir: false // автоматическое определение правостороннего текста, немного замедляет работу
		};

		return this.each(function () {

			// готовим Тип к использованию
			var obj = $(this);

			var data = $.data(obj[0], 'tipTip');
			var opts = data && data.options || $.extend(
				{},
				defaults, // по умолчанию
				window.tipTip || {}, // глобальные
				options, // переданные при инициализации
				obj.data('tipTip') || {} // из атрибута, самый большой приоритет
			);
			var timeout = false;
			var timeoutHover = false;
			var timeoutHide = false;

			if (!!data) {
				data['options'] = opts;
			} else {
				data = { 'options': opts };
			};
			$.data(obj[0], 'tipTip', data);

			// если нет содержимого, установленного напрямую, и функции, возвращаемой содержимое
			if (!opts.content && !$.isFunction(opts.content)) {

				// если есть нужный идентификатор и элемент-донор
				var tiptip_donor = obj.find('.TipTip__donor');

				if (tiptip_donor.length) {
					opts.content = tiptip_donor.html();
				} else {

					// иначе используем стандартный атрибут
					// запоминаем и удаляем `opts.attribute`, чтобы браузер не отображал стандартную подсказку
					opts.content = obj.attr(opts.attribute);
					if (opts.attribute === 'title') {
						obj.removeAttr(opts.attribute);
					};
				};
			};

			if (options === 'show') {
				active_tiptip();
			} else if (options === 'hide') {
				deactive_tiptip();
			} else if (options === 'destroy') {
				destroy_tiptip();
			} else if (options === 'position') {
				position_tiptip();
			} else {

				$.data(obj[0], 'tipTip', { options: opts });

				if (opts.activation == 'hover') {
					obj.on('mouseenter.tipTip', function () {
						if (opts.delayHover){
							timeoutHover = setTimeout( function(){ active_tiptip() }, opts.delayHover);
						} else {
							active_tiptip();
						};
						if (timeoutHide) {
							clearTimeout(timeoutHide);
						};
					}).on('mouseleave.tipTip', function () {
						var data = $.data(this, 'tipTip');

						if (timeoutHover) {
							clearTimeout(timeoutHover);
						};
						
						if (!opts.keepAlive) {
							deactive_tiptip();
						} else {
							data.holder.one('mouseleave.tipTip', function () {
								deactive_tiptip();
							});
						};
						if (opts.hideOnClick) {
							deactive_on_click();
						};
					});
				} else if (opts.activation == 'focus') {
					obj.on('focus.tipTip', function () {
						active_tiptip();
					}).on('blur.tipTip', function () {
						deactive_tiptip();
					});
				} else if (opts.activation == 'click') {
					obj.on('click.tipTip', function (e) {
						e.preventDefault();

						if (!$(this).hasClass(opts.objActiveClass)) {
							$('html').trigger('tipTip-check', [$(e.target)]);
							setImmediate(active_tiptip);
						} else {
							deactive_tiptip();
						};
					});

					// выключать по нажатию в произвольном месте
					if (opts.hideOnClick) {
						deactive_on_click();
					};

					// скрывать Тип, когда пользователь нажимает куда угодно кроме самого Типа
					$('html').on('tipTip-check', obj, function(e, target) {
						if (obj.hasClass(opts.objActiveClass) && $.data(obj[0], 'tipTip').holder) {
							if ($(target).parents('.TipTip').get(0) != $.data(obj[0], 'tipTip').holder.get(0)) {
								deactive_tiptip();
							};
						};
					});

					// если работа не полностью на нажатиях
					if (!opts.keepAlive || !opts.hideOnClick) {
						obj.on('mouseleave.tipTip', function () {
							if (!opts.keepAlive) {
								deactive_tiptip();
							} else if (!opts.hideOnClick) {

								// сейчас данные уже обновились
								$.data(obj[0], 'tipTip').holder.one('mouseleave.tipTip', function () {
									deactive_tiptip();
								});
							};
						});
					};
				} else if (opts.activation == 'manual') {
					// нечего регистрировать, разработчик сам поймёт что, где, когда показывать
				};
			};
				
			function deactive_on_click() {
				$('html').off('click.tipTip').on('click.tipTip', function(e) {
					$('html').trigger('tipTip-check', [$(e.target)]); 
				});
			};

			function active_tiptip() {
				var data = $.data(obj[0], 'tipTip');

				if (opts.enter.call(obj, data) === false || obj.hasClass(opts.objActiveClass)) {
					return;
				};

				if (opts.hideOthers) {
					$('.TipTip--is-active').each(function () {
						var _tip = $(this);
						var _obj = _tip.data().tipTip.obj || undefined;

						if (_obj && obj[0] !== _obj[0]) {
							_obj.tipTip('hide');
						};
					});
				};

				// готовим разметку для Типа, если не готова
				if (!data.holder) {
					var tiptip_inner_arrow = $('<div>', { 'class': 'TipTip__pointer' });
					var tiptip_arrow = $('<div>', { 'class': 'TipTip__arrow' }).append(tiptip_inner_arrow);
					var tiptip_content = $('<div>', { 'class': 'TipTip__content' });
					var tiptip_holder = $('<div>', { 'class': 'TipTip' }).append(tiptip_arrow).append(tiptip_content);
					$(opts.container).append(tiptip_holder);

					data['holder'] = tiptip_holder;
					data['content'] = tiptip_content;
					data['arrow'] = tiptip_arrow;
					$.data(obj[0], 'tipTip', data);
					$.data(tiptip_holder[0], 'tipTip', {obj: obj});

					$(window).on('resize.tipTip', position_tiptip);
					if (opts.container !== 'body') {
						data['container'] = obj.parents(opts.container);
						data['container'].on('scroll.tipTip', position_tiptip);
					} else {
						$(window).on('scroll.tipTip', position_tiptip);
					};
				};

				// получаем текст и добавляем в `data.content`
				var org_title;

				// даже если напрямую содержимое не устанавливается, уже использовался атрибут
				if (opts.content) {
					org_title = $.isFunction(opts.content) ? opts.content.call(obj, data) : opts.content;
				};

				// не отображать Тип, если нет содержимого
				if (!org_title) {
					return;
				};

				data.content.html(org_title);
				data.holder.hide().removeAttr('class').css({
					'max-width': opts.maxWidth,
					'width': opts.width
				});

				// работаем с элементом для скрытия Типа
				var close = data.content.find('.TipTip__close');

				if (close.length) {
					close.on('click.tipTip', function(e) {
						e.preventDefault();

						deactive_tiptip(0);
					});
				};

				// добавляем класс
				opts.cssClass += ' TipTip TipTip--theme-'+ opts.theme;
				data.holder.addClass(opts.cssClass);
				data.holder.addClass('TipTip--is-active');

				// определяем положение Типа
				position_tiptip();

				// показываем Тип
				if (timeout) {
					clearTimeout(timeout);
				};

				// убираем таймаут
				if (timeoutHide) {
					clearTimeout(timeoutHide);
				};

				timeout = setTimeout(function () {
					data.holder.data().tipTip.isActive = true;
					data.holder.stop(true, true).fadeIn(opts.fadeIn);
				}, opts.delay);

				obj.addClass(opts.objActiveClass);

				opts.afterEnter.call(obj, data);
			};

			function deactive_tiptip(delay) {
				var data = $.data(obj[0], 'tipTip');

				if (opts.exit.call(obj, data) === false) {
					return;
				};

				if (timeout) {
					clearTimeout(timeout);
				};

				// скрываем Тип после опциональной задержки
				var delay = (delay !== undefined) ? delay : opts.delayHide;

				if (delay == 0) {
					hide_tiptip(data);

					// если пользователь нажал, убираем отложенное скрытие
					if (opts.delayHide > 0) {
						clearTimeout(timeoutHide);
					};
				} else {
					
					// не скрываем Тип, если на него навели
					// или вернулись на родителя
					if (data.holder) {
						data.holder.off('.tipTip-deactive');
						data.holder.on('mouseenter.tipTip-deactive', function() {
							clearTimeout(timeoutHide);
							data.holder.on('mouseleave.tipTip-deactive', function() {
								deactive_tiptip();
							});
						});
					};
					
					timeoutHide = setTimeout(function() {
						hide_tiptip();
					}, delay);

				};
			};

			function hide_tiptip() {
				var data = $.data(obj[0], 'tipTip');

				if (data.holder) {
					data.holder.fadeOut(opts.fadeOut, function(){
						data.holder.data().tipTip.isActive = false;
						data.holder.removeClass('TipTip--is-active');
					
						// это должно происходить и когда Тип визуально скрыт или перемещён с помощью `active_tiptip()`
						obj.removeClass(opts.objActiveClass);
						opts.afterExit.call(obj, data);
					});
				};
			};

			function destroy_tiptip() {
				obj.off('.tipTip').removeData('tipTip');
			};

			function position_tiptip() {

				var data = $.data(obj[0], 'tipTip');

				// в этой ситуации Тип уничтожен
				// проверка нужна, потому что для уничтоженного также будет производиться пересчёт положения при изменении размеров области просмотра
				// и позиционировать нужно только те, которые активны
				if (!data || !data.holder || !data.holder.hasClass('TipTip--is-active')) { return false; };

				var obj_offset = obj.offset();
				var obj_top = obj_offset.top;
				var obj_left = obj_offset.left;
				var obj_width = obj.outerWidth();
				var obj_height = obj.outerHeight();

				var tip_top;
				var tip_left;
				var tip_width = data.holder.outerWidth();
				var tip_height = data.holder.outerHeight();

				var tip_class;
				var tip_classes = {
					top: 'TipTip--top',
					right: 'TipTip--right',
					bottom: 'TipTip--bottom',
					left: 'TipTip--left'
				};

				var arrow_top;
				var arrow_left;

				// ПРОВЕРИТЬ: возможно, тип можно скрывать при помощи `visibility: hidden`? тогда этой проблемы не будет
				// `data.arrow.outerHeight()` и `data.arrow.outerWidth()` не работают, потому что элемент должен быть отображён
				var arrow_width = 12;
				var arrow_height = 12;

				var wrap = $(window);

				if (opts.container !== 'body') {
					var container_offset = data.container.offset();
					var obj_top = obj_offset.top - container_offset.top;
					var obj_left = obj_offset.left - container_offset.left;

					wrap = $(opts.container);
				};

				var win_top = wrap.scrollTop();
				var win_left = wrap.scrollLeft();
				var win_width = wrap.width();
				var win_height = wrap.height();

				var is_rtl = opts.detectTextDir && isRtlText(data.content.text());

				function moveTop() {
					tip_class = tip_classes.top;
					tip_top = obj_top - tip_height - opts.edgeOffset - (arrow_height / 2);
					tip_left = obj_left + ((obj_width - tip_width) / 2);
				};

				function moveBottom() {
					tip_class = tip_classes.bottom;
					tip_top = obj_top + obj_height + opts.edgeOffset + (arrow_height / 2);
					tip_left = obj_left + ((obj_width - tip_width) / 2);
				};

				function moveLeft() {
					tip_class = tip_classes.left;
					tip_top = obj_top + ((obj_height - tip_height) / 2);
					tip_left = obj_left - tip_width - opts.edgeOffset - (arrow_width / 2);
				};

				function moveRight() {
					tip_class = tip_classes.right;
					tip_top = obj_top + ((obj_height - tip_height) / 2);
					tip_left = obj_left + obj_width + opts.edgeOffset;
				};

				// вычисляем положение Типа
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

				// если включен сдвиг под область видимости
				if (opts.shiftByViewport) {

					// выдвигаем Тип, если он выходит за пределы экрана (слева <-> справа и сверху <-> снизу)
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
					} else if (tip_class == tip_classes.bottom && tip_top + tip_height > win_top + win_height) {
						moveTop();
					};

					// исправляем вертикальное положение, если Тип выпал сверху или снизу за область просмотра
					if (tip_class == tip_classes.left || tip_class == tip_classes.right) { // если позиционируется слева или справа, проверяем не выходит ли за верхний или нижний край области просмотра
						if (tip_top + tip_height > win_height + win_top) { // если нижняя сторона Типа выходит за нижнюю сторону области просмотра
							tip_top = obj_top + obj_height > win_height + win_top ? obj_top + obj_height - tip_height : win_height + win_top - tip_height - 4; // выравниваем их
						} else if (tip_top < win_top) { // если верхняя сторона Типа выходит за верхнюю сторону области просмотра
							tip_top = obj_top < win_top ? obj_top : win_top + 4; // выравниваем их
						};
					};

					// исправляем вертикальное положение, если Тип выпал слева или справа за область просмотра
					if (tip_class == tip_classes.top || tip_class == tip_classes.bottom) {
						if (tip_left + tip_width > win_width + win_left) { // если правая сторона Типа выходит за правую сторону области просмотра
							tip_left = obj_left + obj_width > win_width + win_left ? obj_left + obj_width - tip_width : win_width + win_left - tip_width - 4; // выравниваем правую сторону Типа с правой стороной области просмотра
						} else if (tip_left < win_left) { // если левая сторона Типа выходит за левую сторону области просмотра
							tip_left = obj_left < win_left ? obj_left : win_left + 4; // выравниваем их
						};
					};

				};

				// применяем положение
				data.holder
					.css({ left: Math.round(tip_left), top: Math.round(tip_top) })
					.removeClass(tip_classes.top)
					.removeClass(tip_classes.bottom)
					.removeClass(tip_classes.left)
					.removeClass(tip_classes.right)
					.addClass(tip_class);

				// позиционируем стрелку
				if (tip_class == tip_classes.top) {
					arrow_top = tip_height; // стрелка снизу
					arrow_left = obj_left - tip_left + ((obj_width - arrow_width) / 2); // центрируется по горизонтали посередине родителя
				} else if (tip_class == tip_classes.bottom) {
					arrow_top = -arrow_height; // стрелка сверху
					arrow_left = obj_left - tip_left + ((obj_width - arrow_width) / 2); // центрируется по горизонтали посередине родителя
				} else if (tip_class == tip_classes.left) {
					arrow_top = obj_top - tip_top + ((obj_height - arrow_height) / 2); // центрируется по вертикали посередине родителя
					arrow_left = tip_width; // стрелка справа
				} else if (tip_class == tip_classes.right) {
					arrow_top = obj_top - tip_top + ((obj_height - arrow_height) / 2); // центрируется по горизонтали посередине родителя
					arrow_left = -arrow_width; // стрелка слева
				};

				data.arrow.css({
					left: Math.round(arrow_left),
					top: Math.round(arrow_top)
				});
			}
		});
	};


	// определяем правосторонность текста
	var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF',
		rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC',
		rtlDirCheckRe = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']');

	function isRtlText(text) {
		return rtlDirCheckRe.test(text);
	};


	// http://learn.javascript.ru/setimmediate
	if (!window.setImmediate) window.setImmediate = (function() {
		var head = { }, tail = head; // очередь вызовов, 1-связный список
		var ID = Math.random(); // уникальный идентификатор

		function onmessage(e) {
			if(e.data != ID) return; // не наше сообщение
			head = head.next;
			var func = head.func;
			delete head.func;
			func();
		};

		if(window.addEventListener) { // IE9+, другие браузеры
			window.addEventListener('message', onmessage, false);
		};

		return window.postMessage && window.addEventListener ? function(func) {
			tail = tail.next = { func: func };
			window.postMessage(ID, "*");
		} :
			function(func) { // IE<=8
			setTimeout(func, 0);
		};
	}());


	// по умолчанию обрабатываем элементы со специальным классом
	$(document).ready(function() {
		$('.js-TipTip').each(function () {
			$(this).tipTip();
		});
	});

})(jQuery);
