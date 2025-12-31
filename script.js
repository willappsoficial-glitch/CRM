// ⚠️ COLOQUE SUA URL DO APPS SCRIPT AQUI DENTRO DAS ASPAS
const API_URL = 'https://script.google.com/macros/s/AKfycbyucoF9SXVKo_b49sg2-CC-jsGSpLhTxVtn9VZzr10oa21jSB91DXLEYn9L_D25U6vW/exec'; 

let dadosMissoesCache = {};
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    carregarLeads(); 
});

// ========================== DASHBOARD ==========================
function abrirDashboard() {
    const modal = new bootstrap.Modal(document.getElementById('modalDashboard'));
    modal.show();
    carregarDashboard();
}

function carregarDashboard() {
    fetch(API_URL + '?op=dashboard').then(r => r.json()).then(res => {
        if(res.status === 'sucesso') renderizarDashboard(res.dados);
    });
}

function renderizarDashboard(dados) {
    // KPIs
    if(document.getElementById('kpi-total')) document.getElementById('kpi-total').innerText = dados.kpis.total;
    if(document.getElementById('kpi-novos')) document.getElementById('kpi-novos').innerText = dados.kpis.novos;
    if(document.getElementById('kpi-negociacao')) document.getElementById('kpi-negociacao').innerText = dados.kpis.negociacao.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    // Meta e Vendas
    const totalVendido = dados.kpis.vendas;
    const metaMensal = 5000;
    if(document.getElementById('kpi-vendas')) document.getElementById('kpi-vendas').innerText = totalVendido.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

    let porcentagem = (totalVendido / metaMensal) * 100;
    if (porcentagem > 100) porcentagem = 100;

    const barra = document.getElementById('barra-meta');
    if (barra) {
        barra.style.width = porcentagem + '%';
        barra.innerText = Math.round(porcentagem) + '%';
        if(porcentagem >= 100) { barra.classList.remove('bg-success'); barra.classList.add('bg-warning', 'text-dark'); barra.innerText = "META BATIDA! 🏆"; }
    }
    
    const falta = metaMensal - totalVendido;
    const elFalta = document.getElementById('meta-falta');
    if(elFalta) elFalta.innerText = falta > 0 ? falta.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : "Meta Batida!";

    // Histórico
    const container = document.getElementById('lista-dashboard-historico');
    container.innerHTML = '';
    if(dados.historico.length === 0) container.innerHTML = '<p class="text-center text-muted p-4">Nada ainda.</p>';
    else {
        dados.historico.forEach(item => {
            let color = 'text-success'; let icon = 'fa-check';
            if(item.tipo === 'cobranca') { color = 'text-danger'; icon = 'fa-file-invoice-dollar'; }
            if(item.tipo === 'ausente') { color = 'text-warning'; icon = 'fa-user-clock'; }
            container.insertAdjacentHTML('beforeend', `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center"><div class="me-3 ${color}"><i class="fa-solid ${icon}"></i></div><div><h6 class="mb-0 fw-bold small">${item.aluno}</h6></div></div>
                    <span class="badge bg-light text-dark border">${item.data}</span>
                </div>
            `);
        });
    }

    // Gráfico
    const ctx = document.getElementById('graficoStatus').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Novos', 'Em Contato', 'Visita', 'Matriculado'], datasets: [{ data: [dados.grafico['Novo'], dados.grafico['Em Contato'], dados.grafico['Visita'], dados.grafico['Fechado']], backgroundColor: ['#0d6efd', '#ffc107', '#0dcaf0', '#198754'], borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// ========================== MISSÕES DO DIA ==========================
function abrirPainelRetencao() {
    new bootstrap.Modal(document.getElementById('modalRetencao')).show();
    carregarMissoes();
}

function carregarMissoes() {
    document.getElementById('lista-niver').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    ['lista-ausente', 'lista-vencido', 'lista-novos'].forEach(id => document.getElementById(id).innerHTML = '');

    fetch(API_URL + '?op=missoes').then(r => r.json()).then(res => {
        if(res.status === 'sucesso') { dadosMissoesCache = res.dados; renderizarTodasAbas(); }
    });
}

function renderizarTodasAbas() {
    const d = dadosMissoesCache;
    document.getElementById('badge-niver').innerText = d.aniversariantes.length;
    document.getElementById('badge-ausente').innerText = d.ausentes.length;
    document.getElementById('badge-vencido').innerText = d.vencidos.length;
    document.getElementById('badge-novos').innerText = d.novos.length;

    renderizarLista('lista-niver', d.aniversariantes, 'aniversario');
    renderizarLista('lista-ausente', d.ausentes, 'ausente');
    renderizarLista('lista-vencido', d.vencidos, 'cobranca');
    renderizarLista('lista-novos', d.novos, 'novo');
}

function renderizarLista(elementId, lista, tipo) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    if (!lista || lista.length === 0) { container.innerHTML = '<div class="text-center text-muted p-4">Tudo limpo!</div>'; return; }

    lista.forEach(aluno => {
        const jaEnviou = aluno.jaEnviou === true;
        const opacity = jaEnviou ? 'opacity-50 bg-light' : 'bg-white';
        const btnClass = jaEnviou ? 'btn-secondary disabled' : 'btn-success';
        const btnText = jaEnviou ? 'Enviado' : 'Enviar';
        let detalhes = '', badge = '';
        let dias = 0;

        if(tipo === 'ausente') {
            dias = aluno.dias;
            detalhes = `<small class="text-muted">Ausente: ${dias} dias</small>`;
            if(aluno.categoria) badge = `<span class="badge bg-secondary ms-2 small">${aluno.categoria}</span>`;
        } else if(tipo === 'cobranca') {
            dias = aluno.diasAtraso;
            detalhes = `<small class="text-danger fw-bold">Atraso: ${dias} dias</small>`;
            badge = `<span class="badge bg-danger ms-2 small">${aluno.categoria || ''}</span>`;
        } else if(tipo === 'novo') detalhes = '<small class="text-success">Novo</small>';
        else detalhes = '<small class="text-primary">Aniversário</small>';

        container.insertAdjacentHTML('beforeend', `
            <div class="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm border rounded ${opacity}" data-categoria="${aluno.categoria || 'todos'}">
                <div><div class="d-flex align-items-center"><h6 class="mb-0 fw-bold">${aluno.nome}</h6>${badge}</div>${detalhes}</div>
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" onclick="enviarMensagem('${aluno.nome}', '${aluno.telefone}', '${tipo}', ${dias}, this)">${btnText}</button>
            </div>
        `);
    });
}

function filtrarLista(tipo, filtro, btnElement) {
    Array.from(btnElement.parentElement.children).forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    const container = document.getElementById('lista-' + tipo);
    Array.from(container.children).forEach(c => {
        const cat = c.getAttribute('data-categoria');
        if(filtro === 'todos' || cat === filtro) { c.classList.remove('d-none'); c.classList.add('d-flex'); }
        else { c.classList.add('d-none'); c.classList.remove('d-flex'); }
    });
}

function enviarMensagem(nome, telefone, tipo, dias, btn) {
    const tel = telefone.replace(/\D/g, '');
    let msg = "";
    const primNome = nome.split(' ')[0];

    if (tipo === 'ausente') {
        if (dias <= 4) msg = `Fala ${primNome}, bora treinar? 💪 Estamos te esperando!`;
        else if (dias <= 10) msg = `Oi ${primNome}, sumiu! 😅 Tá tudo bem? Voltar agora é mais fácil.`;
        else msg = `Olá ${primNome}, sentimos sua falta! 🛑 Aconteceu algo? Conta com a gente pra voltar.`;
    } else if (tipo === 'cobranca') {
        if (dias <= 5) msg = `Oi ${primNome}, sua mensalidade venceu há pouco. Link: [LINK]`;
        else if (dias <= 20) msg = `Olá ${primNome}. Pendência de ${dias} dias. Evite bloqueio: [LINK]`;
        else msg = `Olá ${primNome}. Precisamos falar sobre sua pendência (${dias} dias).`;
    } else if (tipo === 'aniversario') msg = `Parabéns ${primNome}! 🎉 Muita saúde e treinos!`;
    else if (tipo === 'novo') msg = `Bem-vindo(a) ${primNome}! 💪 Como foi o primeiro treino?`;

    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');

    btn.className = 'btn btn-sm btn-secondary disabled rounded-pill px-3';
    btn.innerText = 'Enviado';
    btn.closest('.list-group-item').classList.add('opacity-50', 'bg-light');
    
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'registrar_envio', aluno: nome, tipo: tipo }) });
}

// --- KANBAN BÁSICO ---
function carregarLeads() { fetch(API_URL).then(r=>r.json()).then(d=>{ if(d.status==='sucesso') renderizarKanban(d.dados); }); }
function renderizarKanban(leads) {
    ['Novo','Em Contato','Visita','Fechado'].forEach(id=>document.getElementById(id).innerHTML='');
    document.querySelectorAll('.count-badge').forEach(b=>b.innerText='0');
    leads.forEach(l => {
        const col = document.getElementById(l.status);
        if(col) col.insertAdjacentHTML('beforeend', `<div class="card mb-2 shadow-sm p-2"><div class="d-flex justify-content-between"><strong>${l.nome}</strong><small class="text-muted">${l.valor}</small></div></div>`);
    });
    ['Novo','Em Contato','Visita','Fechado'].forEach(id=>document.querySelector(`#${id}`).parentElement.querySelector('.count-badge').innerText = document.getElementById(id).children.length);
}
function abrirModalNovo() { Swal.fire('Novo Aluno', 'Função de cadastro.', 'info'); }
