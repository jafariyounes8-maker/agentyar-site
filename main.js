/* ==========================================================================
   Agentyar — اسکریپت اصلی
   بدون هیچ وابستگی خارجی. فقط این فایل را ادیت کنید.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     ⚙️ تنظیمات — این چند خط را با اطلاعات واقعی خودتان عوض کنید
     ---------------------------------------------------------------------- */
  var CONFIG = {
    // شماره واتساپ با کد کشور و بدون + و بدون صفر ابتدایی. مثال: '989121234567'
    whatsapp: '989350886064',

    // اگر سرویس فرم دارید (Formspree / Getform / Google Forms / API خودتان)
    // آدرس آن را اینجا بگذارید. خالی باشد → فرم به واتساپ منتقل می‌شود.
    formEndpoint: '',

    // ایمیل پشتیبان برای حالتی که نه endpoint هست نه واتساپ
    email: 'Jafariyounes8@gmail.com'
  };

  /* ----------------------------------------------------------------------
     ابزارها
     ---------------------------------------------------------------------- */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  function toFa(input) {
    return String(input).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
  }

  function groupThousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ----------------------------------------------------------------------
     1) هدر چسبان
     ---------------------------------------------------------------------- */
  (function header() {
    var el = $('#siteHeader');
    if (!el) return;
    var onScroll = function () {
      el.classList.toggle('is-stuck', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ----------------------------------------------------------------------
     2) منوی موبایل
     ---------------------------------------------------------------------- */
  (function drawer() {
    var drawerEl = $('#drawer');
    var burger   = $('#burger');
    var closeBtn = $('#drawerClose');
    if (!drawerEl || !burger) return;

    function open() {
      drawerEl.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var first = drawerEl.querySelector('a, button');
      if (first) first.focus();
    }

    function close() {
      drawerEl.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    burger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);

    drawerEl.addEventListener('click', function (e) {
      if (e.target === drawerEl) close();           // کلیک روی پس‌زمینه
      if (e.target.closest('a')) close();           // کلیک روی لینک
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerEl.classList.contains('is-open')) {
        close();
        burger.focus();
      }
    });
  })();

  /* ----------------------------------------------------------------------
     3) ظاهر شدن تدریجی المان‌ها هنگام اسکرول
     ---------------------------------------------------------------------- */
  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var sibs = Array.prototype.slice.call(el.parentElement.children).indexOf(el);
        el.style.transitionDelay = Math.min(sibs, 5) * 70 + 'ms';
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ----------------------------------------------------------------------
     4) شمارنده‌ی آمار
     ---------------------------------------------------------------------- */
  (function counters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;

    function render(el, value) {
      var suffix = el.getAttribute('data-suffix') || '';
      el.textContent = toFa(groupThousands(value)) + suffix;
    }

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (prefersReducedMotion()) { render(el, target); return; }

      var duration = 1400;
      var start = null;

      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
        render(el, Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if (!('IntersectionObserver' in window)) {
      nums.forEach(function (el) { run(el); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (el) { io.observe(el); });
  })();

  /* ----------------------------------------------------------------------
     5) وبلاگ — جست‌وجو و فیلتر دسته‌بندی
     ---------------------------------------------------------------------- */
  (function blogFilter() {
    var list = $('#postList');
    if (!list) return;

    var search = $('#postSearch');
    var chips  = $$('.chip-btn', $('#postChips'));
    var posts  = $$('.post', list);
    var empty  = $('#postsEmpty');
    var active = 'all';

    function normalize(s) {
      return (s || '')
        .replace(/[ي]/g, 'ی')   // ی عربی → فارسی
        .replace(/[ك]/g, 'ک')   // ک عربی → فارسی
        .replace(/‌/g, ' ')     // نیم‌فاصله → فاصله
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function apply() {
      var q = normalize(search ? search.value : '');
      var shown = 0;

      posts.forEach(function (p) {
        var cat   = p.getAttribute('data-category') || '';
        var text  = normalize(p.textContent + ' ' + (p.getAttribute('data-tags') || ''));
        var okCat = active === 'all' || cat === active;
        var okQ   = !q || text.indexOf(q) !== -1;
        var show  = okCat && okQ;
        p.style.display = show ? '' : 'none';
        if (show) shown++;
      });

      if (empty) empty.classList.toggle('is-shown', shown === 0);
    }

    chips.forEach(function (btn) {
      btn.addEventListener('click', function () {
        chips.forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        active = btn.getAttribute('data-filter') || 'all';
        apply();
      });
    });

    if (search) {
      var t;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(apply, 120);
      });
    }
  })();

  /* ----------------------------------------------------------------------
     6) فرم‌ها
     ---------------------------------------------------------------------- */
  (function forms() {
    var forms = $$('form[data-form], #consultForm, #demoForm');
    if (!forms.length) return;

    forms.forEach(function (form) {
      var status = form.querySelector('.form__status') || $('#formStatus');

      function say(msg) {
        if (!status) { alert(msg); return; }
        status.textContent = msg;
        status.classList.add('is-shown');
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // اعتبارسنجی ساده
        var required = $$('[required]', form);
        for (var i = 0; i < required.length; i++) {
          if (!required[i].value.trim()) {
            required[i].focus();
            say('لطفاً «' + (form.querySelector('label[for="' + required[i].id + '"]') || {}).textContent + '» را کامل کنید.');
            return;
          }
        }

        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });

        // حالت ۱: ارسال به endpoint
        if (CONFIG.formEndpoint) {
          var btn = form.querySelector('button[type="submit"]');
          if (btn) { btn.disabled = true; btn.textContent = 'در حال ارسال…'; }

          fetch(CONFIG.formEndpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
            .then(function (r) {
              if (!r.ok) throw new Error('bad status');
              form.reset();
              say('درخواست شما ثبت شد ✅ به‌زودی با شما تماس می‌گیریم.');
            })
            .catch(function () {
              say('ارسال ناموفق بود. لطفاً از طریق واتساپ یا ایمیل با ما در تماس باشید.');
            })
            .finally(function () {
              if (btn) { btn.disabled = false; btn.textContent = 'ارسال درخواست'; }
            });
          return;
        }

        // حالت ۲: انتقال به واتساپ
        var lines = [];
        Object.keys(data).forEach(function (k) {
          var label = form.querySelector('label[for="' + k + '"]');
          if (data[k]) lines.push((label ? label.textContent : k) + ': ' + data[k]);
        });
        var text = encodeURIComponent('درخواست از سایت ایجنت‌یار\n\n' + lines.join('\n'));

        if (CONFIG.whatsapp) {
          window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + text, '_blank', 'noopener');
          say('در حال انتقال به واتساپ… اگر باز نشد، پنجره‌های پاپ‌آپ را فعال کنید.');
        } else {
          window.location.href = 'mailto:' + CONFIG.email + '?subject=' +
            encodeURIComponent('درخواست مشاوره') + '&body=' + text;
        }
        form.reset();
      });
    });
  })();

  /* ----------------------------------------------------------------------
     7) هایلایت لینک صفحه‌ی جاری
     ---------------------------------------------------------------------- */
  (function activeNav() {
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav a, .drawer nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === here) a.setAttribute('aria-current', 'page');
    });
  })();

  /* ----------------------------------------------------------------------
     8) شماره واتساپ و ایمیل را در کل صفحه هماهنگ کن
     ---------------------------------------------------------------------- */
  (function syncLinks() {
    if (!CONFIG.whatsapp) return;
    $$('a[href*="wa.me"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var query = href.indexOf('?') !== -1 ? href.slice(href.indexOf('?')) : '';
      // فقط شماره عوض می‌شود؛ متن آماده‌ی پیام دست‌نخورده می‌ماند
      a.setAttribute('href', 'https://wa.me/' + CONFIG.whatsapp + query);
    });
  })();


  /* ----------------------------------------------------------------------
     9) نوار پیشرفت اسکرول
     ---------------------------------------------------------------------- */
  (function progress() {
    var bar = $('#progressBar');
    if (!bar) return;
    var ticking = false;
    function draw() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, p)) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(draw); }
    }, { passive: true });
    draw();
  })();

  /* ----------------------------------------------------------------------
     10) نوار CTA چسبان موبایل — بعد از هیرو ظاهر می‌شود
     ---------------------------------------------------------------------- */
  (function stickyCta() {
    var el = $('#stickyCta');
    if (!el) return;
    var onScroll = function () {
      var footer = $('.site-footer');
      var nearFooter = footer && footer.getBoundingClientRect().top < window.innerHeight - 40;
      el.classList.toggle('is-shown', window.scrollY > 520 && !nearFooter);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ----------------------------------------------------------------------
     11) هایلایت بخش فعال در منو هنگام اسکرول
     ---------------------------------------------------------------------- */
  (function scrollSpy() {
    var links = $$('.nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var el = document.querySelector(a.getAttribute('href'));
      if (el) map[el.id] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (x) { x.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'page');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  })();

})();
