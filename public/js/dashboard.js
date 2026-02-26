// Dashboard — Command Center Homepage
const dashboardPage = {
  async render() {
    const content = document.getElementById('content');

    try {
      showLoading(true);
      const user = authManager.currentUser;
      const role = user?.role || 'viewer';

      // Fetch summary stats
      let summary = { open_otpa: 0, in_production_otpa: 0, pending_quality: 0, rejections_last_month: 0 };
      try { summary = await api.reports.summary(); } catch(e) { /* skip */ }

      // Greeting
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi Günler' : 'İyi Akşamlar';
      const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      // Module definitions (role-aware)
      const modules = [
        {
          id: 'goods-receipt', icon: 'fa-box', color: 'blue',
          title: 'Malzeme Girişi', desc: 'Gelen malzemelerin kaydı, BOM takibi ve OTPA yönetimi',
          stat: `${summary.open_otpa || 0} açık OTPA`, statColor: 'blue',
          roles: ['tekniker', 'kalite', 'admin']
        },
        {
          id: 'returns', icon: 'fa-undo', color: 'amber',
          title: 'İade Yönetimi', desc: 'Malzeme iade işlemleri, tedarikçi iade takibi',
          stat: null, statColor: 'amber',
          roles: ['tekniker', 'kalite', 'admin']
        },
        {
          id: 'quality', icon: 'fa-check-circle', color: 'emerald',
          title: 'Kalite Kontrol', desc: 'Muayene, kabul/ret kararları ve kalite raporları',
          stat: summary.pending_quality > 0 ? `${summary.pending_quality} bekleyen` : null,
          statColor: summary.pending_quality > 0 ? 'yellow' : 'emerald',
          roles: ['kalite', 'admin']
        },
        {
          id: 'projects', icon: 'fa-project-diagram', color: 'purple',
          title: 'Proje Takip', desc: 'Proje planlama, Gantt şeması, öngörü tarihleri ve raporlar',
          stat: null, statColor: 'purple',
          roles: ['admin', 'proje_yonetici']
        },
        {
          id: 'technicians', icon: 'fa-hard-hat', color: 'orange',
          title: 'İş Takip', desc: 'Tekniker görev atamaları, kanban panosu ve performans takibi',
          stat: null, statColor: 'orange',
          roles: ['tekniker', 'kalite', 'admin']
        },
        {
          id: 'taskboard', icon: 'fa-tv', color: 'cyan',
          title: 'Görev Ekranı', desc: 'Kişisel görev panosu ve günlük iş takibi',
          stat: null, statColor: 'cyan',
          roles: ['tekniker', 'kalite', 'admin']
        },
        {
          id: 'prosedur-otpa', icon: 'fa-file-alt', color: 'indigo',
          title: 'Prosedür & OTPA', desc: 'Form şablonları, batarya raporları ve doküman yönetimi',
          stat: null, statColor: 'indigo',
          roles: ['admin', 'kalite']
        },
        {
          id: 'field-changelog', icon: 'fa-history', color: 'teal',
          title: 'Saha Değişiklik', desc: 'Saha değişiklik kayıtları, OTPA timeline ve Excel import',
          stat: null, statColor: 'teal',
          roles: ['admin', 'kalite']
        },
        {
          id: 'paket-analiz', icon: 'fa-cubes', color: 'rose',
          title: 'Paket Analiz', desc: 'Paket maliyet analizleri, BOM yönetimi ve raporlama',
          stat: null, statColor: 'rose',
          roles: ['admin']
        },
        {
          id: 'admin', icon: 'fa-cog', color: 'gray',
          title: 'Yönetim Paneli', desc: 'Kullanıcı yönetimi, OTPA oluşturma, sistem ayarları',
          stat: null, statColor: 'gray',
          roles: ['admin']
        }
      ];

      const visibleModules = modules.filter(m => m.roles.includes(role));

      // Color map for Tailwind class generation
      const colorMap = {
        blue:    { bg: 'from-blue-500 to-blue-600',    light: 'bg-blue-500/10',    text: 'text-blue-400',    ring: 'hover:ring-blue-500/30' },
        amber:   { bg: 'from-amber-500 to-amber-600',  light: 'bg-amber-500/10',   text: 'text-amber-400',   ring: 'hover:ring-amber-500/30' },
        emerald: { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'hover:ring-emerald-500/30' },
        purple:  { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-500/10',  text: 'text-purple-400',  ring: 'hover:ring-purple-500/30' },
        orange:  { bg: 'from-orange-500 to-orange-600', light: 'bg-orange-500/10',  text: 'text-orange-400',  ring: 'hover:ring-orange-500/30' },
        cyan:    { bg: 'from-cyan-500 to-cyan-600',    light: 'bg-cyan-500/10',    text: 'text-cyan-400',    ring: 'hover:ring-cyan-500/30' },
        indigo:  { bg: 'from-indigo-500 to-indigo-600', light: 'bg-indigo-500/10',  text: 'text-indigo-400',  ring: 'hover:ring-indigo-500/30' },
        teal:    { bg: 'from-teal-500 to-teal-600',    light: 'bg-teal-500/10',    text: 'text-teal-400',    ring: 'hover:ring-teal-500/30' },
        rose:    { bg: 'from-rose-500 to-rose-600',    light: 'bg-rose-500/10',    text: 'text-rose-400',    ring: 'hover:ring-rose-500/30' },
        gray:    { bg: 'from-gray-500 to-gray-600',    light: 'bg-gray-500/10',    text: 'text-gray-400',    ring: 'hover:ring-gray-500/30' },
        red:     { bg: 'from-red-500 to-red-600',      light: 'bg-red-500/10',     text: 'text-red-400',     ring: 'hover:ring-red-500/30' },
        yellow:  { bg: 'from-yellow-500 to-yellow-600', light: 'bg-yellow-500/10',  text: 'text-yellow-400',  ring: 'hover:ring-yellow-500/30' },
      };

      // Role display
      const roleMap = {
        'viewer': { text: 'Yeni Kullanıcı', cls: 'bg-gray-500/15 text-gray-400' },
        'tekniker': { text: 'Tekniker', cls: 'bg-blue-500/15 text-blue-400' },
        'kalite': { text: 'Kalite', cls: 'bg-emerald-500/15 text-emerald-400' },
        'proje_yonetici': { text: 'Proje Yöneticisi', cls: 'bg-purple-500/15 text-purple-400' },
        'admin': { text: 'Admin', cls: 'bg-indigo-500/15 text-indigo-400' }
      };
      const roleInfo = roleMap[role] || roleMap['viewer'];

      content.innerHTML = `
        <div class="space-y-8 fade-in">

          <!-- HERO SECTION -->
          <div class="glass-card rounded-2xl p-8 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div class="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

            <div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-14 h-14 gradient-btn rounded-2xl flex items-center justify-center shadow-lg">
                    <i class="fas fa-clipboard-check text-white text-2xl"></i>
                  </div>
                  <div>
                    <h1 class="text-3xl font-bold text-white">${greeting}, <span class="gradient-text">${user?.full_name || 'Kullanıcı'}</span></h1>
                    <p class="text-gray-400 text-sm mt-0.5">${today}</p>
                  </div>
                </div>
                <p class="text-gray-500 text-sm mt-3 max-w-xl">E-LAB Süreç Kontrol sisteminize hoş geldiniz. Aşağıdaki modüller üzerinden işlemlerinizi yönetebilirsiniz.</p>
              </div>
              <div class="flex items-center gap-3 flex-shrink-0">
                <span class="px-3 py-1.5 rounded-full text-sm font-semibold ${roleInfo.cls}"><i class="fas fa-shield-alt mr-1.5"></i>${roleInfo.text}</span>
              </div>
            </div>
          </div>

          <!-- KPI CARDS -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div onclick="app.navigate('goods-receipt')" class="glass-card rounded-xl p-5 cursor-pointer hover-lift group">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <i class="fas fa-folder-open text-white text-lg"></i>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Açık OTPA</p>
                  <p class="text-2xl font-bold text-white">${summary.open_otpa || 0}</p>
                </div>
              </div>
            </div>
            <div onclick="app.navigate('goods-receipt')" class="glass-card rounded-xl p-5 cursor-pointer hover-lift group">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <i class="fas fa-industry text-white text-lg"></i>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Üretimde</p>
                  <p class="text-2xl font-bold text-white">${summary.in_production_otpa || 0}</p>
                </div>
              </div>
            </div>
            <div onclick="${role === 'kalite' || role === 'admin' ? "app.navigate('quality')" : ''}" class="glass-card rounded-xl p-5 ${role === 'kalite' || role === 'admin' ? 'cursor-pointer hover-lift' : ''} group">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <i class="fas fa-clock text-white text-lg"></i>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Kalite Bekleyen</p>
                  <p class="text-2xl font-bold ${summary.pending_quality > 0 ? 'text-yellow-400' : 'text-white'}">${summary.pending_quality || 0}</p>
                </div>
              </div>
            </div>
            <div onclick="${role === 'kalite' || role === 'admin' ? "app.navigate('quality')" : ''}" class="glass-card rounded-xl p-5 ${role === 'kalite' || role === 'admin' ? 'cursor-pointer hover-lift' : ''} group">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <i class="fas fa-times-circle text-white text-lg"></i>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Red (30 gün)</p>
                  <p class="text-2xl font-bold ${summary.rejections_last_month > 0 ? 'text-red-400' : 'text-white'}">${summary.rejections_last_month || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- MODULE GRID -->
          <div>
            <h2 class="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
              <i class="fas fa-th-large text-indigo-400"></i> Modüller
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${visibleModules.map(m => {
                const c = colorMap[m.color];
                return `
                <div onclick="app.navigate('${m.id}')" 
                  class="glass-card rounded-xl p-6 cursor-pointer hover-lift group transition-all hover:ring-2 ${c.ring} relative overflow-hidden">
                  <div class="absolute top-0 right-0 w-24 h-24 ${c.light} rounded-full blur-2xl -mr-8 -mt-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div class="relative z-10">
                    <div class="flex items-start justify-between mb-3">
                      <div class="w-12 h-12 bg-gradient-to-br ${c.bg} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <i class="fas ${m.icon} text-white text-lg"></i>
                      </div>
                      ${m.stat ? `<span class="text-xs px-2 py-1 rounded-full font-semibold ${colorMap[m.statColor]?.light || c.light} ${colorMap[m.statColor]?.text || c.text}">${m.stat}</span>` : ''}
                    </div>
                    <h3 class="font-bold text-white text-lg mb-1">${m.title}</h3>
                    <p class="text-sm text-gray-500 leading-relaxed">${m.desc}</p>
                    <div class="mt-4 flex items-center gap-1.5 text-xs ${c.text} font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Sayfaya git <i class="fas fa-arrow-right text-xs"></i>
                    </div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>

          <!-- SYSTEM INFO -->
          <div class="glass-card rounded-xl p-5">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-3 text-gray-500 text-sm">
                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Sistem aktif</span>
                <span class="text-gray-700">|</span>
                <span><i class="fas fa-code-branch mr-1"></i>E-LAB Süreç Kontrol v2.0</span>
              </div>
              <div class="text-xs text-gray-600">
                ${visibleModules.length} modül erişiminiz var
              </div>
            </div>
          </div>

        </div>
      `;
    } catch (error) {
      content.innerHTML = `
        <div class="glass-card border-red-500/30 text-red-400 px-4 py-3 rounded">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  }
};

window.dashboardPage = dashboardPage;
