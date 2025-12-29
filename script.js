// ⚠️ COLOQUE SUA URL DO APPS SCRIPT AQUI DENTRO DAS ASPAS
const API_URL = 'https://script.google.com/macros/s/AKfycbyucoF9SXVKo_b49sg2-CC-jsGSpLhTxVtn9VZzr10oa21jSB91DXLEYn9L_D25U6vW/exec'; 

// Variável Global para Cache
let cacheLeads = [];

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
    carregarLeads();
    configurarDragAndDrop();
    configurarBusca();
});

// 1. SortableJS (Arrasta e Solta)
function configurarDragAndDrop() {
    const colunas = document.querySelectorAll('.kanban-list');
    colunas.forEach(coluna => {
        new Sortable(coluna, {
            group: 'crm-pipeline', 
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const item = evt.item;
                const novoStatus = evt.to.getAttribute('data-status');
                const idLead = item.getAttribute('data-id');
                if (evt.from !== evt.to) {
                    atualizarStatusNoBanco(idLead, novoStatus);
                }
            }
        });
    });
}

// 2. Busca dados da API
function carregarLeads() {
    Swal.fire({title: 'Carregando...', didOpen: () => Swal.showLoading()});
    fetch(API_URL)
        .then(response => response.json())
        .then(json => {
            Swal.close();
            if(json.status === 'sucesso') {
                cacheLeads = json.dados; 
                limparColunas();
                json.dados.forEach(lead => criarCardNaTela(lead));
                atualizarContadores();
            }
        })
        .catch(erro => {
            console.error(erro);
            Swal.fire('Erro', 'Falha ao carregar leads.', 'error');
        });
}

// 3. Renderiza Card HTML
function criarCardNaTela(lead) {
    const coluna = document.getElementById(lead.status) || document.getElementById('Novo');
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-id', lead.id);
    
    card.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <span class="fw-bold text-dark nome-aluno">${lead.nome}</span>
            <small class="text-muted"><i class="far fa-clock"></i> ${formatarData(lead.data)}</small>
        </div>
        <div class="mb-2">
            <span class="badge bg-light text-dark border tag-aluno">${lead.tags || 'Geral'}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
            <span class="fw-bold text-success valor-aluno">R$ ${lead.valor || '0,00'}</span>
            <div>
                <button class="btn btn-sm btn-outline-success border-0 btn-zap" title="Chamar no Zap"><i class="fab fa-whatsapp fa-lg"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0 btn-trash"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    
    card.onclick = (e) => {
        if (e.target.closest('button')) return;
        abrirModalDetalhes(lead.id);
    };

    const btnZap = card.querySelector('.btn-zap');
    btnZap.onclick = (e) => {
        e.stopPropagation(); 
        abrirWhatsApp(lead.telefone, lead.nome);
    };

    const btnTrash = card.querySelector('.btn-trash');
    btnTrash.onclick = (e) => {
        e.stopPropagation(); 
        deletarLead(lead.id);
    };
    
    coluna.appendChild(card);
}

// --- FUNÇÕES DO MODAL E EDIÇÃO ---

function abrirModalDetalhes(id) {
    const lead = cacheLeads.find(l => l.id == id);
    if (!lead) return;

    document.getElementById('edit-id').value = lead.id;
    document.getElementById('edit-nome').value = lead.nome;
    document.getElementById('edit-telefone').value = lead.telefone;
    document.getElementById('edit-valor').value = lead.valor;
    document.getElementById('edit-tag').value = lead.tags;
    renderizarHistorico(lead.historico || []);

    const modal = new bootstrap.Modal(document.getElementById('modalDetalhes'));
    modal.show();
}

function renderizarHistorico(historico) {
    const container = document.getElementById('lista-historico');
    container.innerHTML = '';
    if (!historico || historico.length === 0) {
        container.innerHTML = '<p class="text-muted text-center mt-5">Nenhum histórico.</p>';
        return;
    }
    [...historico].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'card p-2 mb-2 border-0 shadow-sm bg-white';
        div.innerHTML = `<small class="text-muted fw-bold" style="font-size: 0.75rem">${item.data}</small><p class="mb-0 text-dark">${item.texto}</p>`;
        container.appendChild(div);
    });
}

function adicionarNota() {
    const input = document.getElementById('nova-nota');
    const texto = input.value;
    const id = document.getElementById('edit-id').value;
    if (!texto) return;

    const lead = cacheLeads.find(l => l.id == id);
    if (!lead.historico) lead.historico = [];
    lead.historico.push({ data: new Date().toLocaleString('pt-BR'), texto: texto });
    
    renderizarHistorico(lead.historico);
    input.value = '';
    salvarEdicao(true); 
}

function salvarEdicao(silencioso = false) {
    const id = document.getElementById('edit-id').value;
    const lead = cacheLeads.find(l => l.id == id);

    lead.nome = document.getElementById('edit-nome').value;
    lead.telefone = document.getElementById('edit-telefone').value;
    lead.valor = document.getElementById('edit-valor').value;
    lead.tags = document.getElementById('edit-tag').value;
    
    const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
    if(card) {
        card.querySelector('.nome-aluno').innerText = lead.nome;
        card.querySelector('.tag-aluno').innerText = lead.tags;
        card.querySelector('.valor-aluno').innerText = 'R$ ' + lead.valor;
    }

    if (!silencioso) {
        const modalEl = document.getElementById('modalDetalhes');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        Swal.fire({title: 'Salvo!', icon: 'success', timer: 1500, showConfirmButton: false});
    }

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ acao: 'editar', id: id, lead: { nome: lead.nome, telefone: lead.telefone, valor: lead.valor, tags: lead.tags, historico: lead.historico } })
    });
}

// --- FUNÇÕES GERAIS ---

function abrirModalNovo() {
    Swal.fire({
        title: 'Novo Aluno',
        html: '<input id="swal-nome" class="swal2-input" placeholder="Nome"><input id="swal-tel" class="swal2-input" placeholder="Telefone"><input id="swal-tag" class="swal2-input" placeholder="Tag">',
        focusConfirm: false,
        preConfirm: () => {
            return {
                nome: document.getElementById('swal-nome').value,
                telefone: document.getElementById('swal-tel').value,
                tags: document.getElementById('swal-tag').value,
                valor: '0,00',
                historico: []
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const formValues = result.value;
            const tempId = Date.now(); 
            const novoLead = { ...formValues, id: tempId, status: 'Novo', data: new Date() };
            cacheLeads.push(novoLead);
            criarCardNaTela(novoLead);
            atualizarContadores();
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'criar', lead: formValues }) });
        }
    });
}

function atualizarStatusNoBanco(id, status) {
    const lead = cacheLeads.find(l => l.id == id);
    if(lead) lead.status = status;
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'mover', id: id, novoStatus: status }) });
    atualizarContadores();
}

function deletarLead(id) {
    Swal.fire({title: 'Tem certeza?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, apagar!'}).then((result) => {
        if (result.isConfirmed) {
            document.querySelector(`[data-id="${id}"]`).remove();
            cacheLeads = cacheLeads.filter(l => l.id != id);
            atualizarContadores();
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'apagar', id: id }) });
        }
    })
}

function formatarData(dataISO) {
    if(!dataISO) return '';
    const d = new Date(dataISO);
    return d.toLocaleDateString('pt-BR');
}

function limparColunas() {
    document.querySelectorAll('.kanban-list').forEach(c => c.innerHTML = '');
}

function atualizarContadores() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        const count = col.querySelectorAll('.kanban-card').length;
        col.querySelector('.count-badge').innerText = count;
    });
}

function abrirWhatsApp(tel, nome) {
    const cleanTel = tel.replace(/\D/g, '');
    const texto = `Olá ${nome}, tudo bem?`;
    window.open(`https://wa.me/55${cleanTel}?text=${encodeURIComponent(texto)}`, '_blank');
}

function configurarBusca() {
    const inputBusca = document.getElementById('filtro-busca');
    if(!inputBusca) return;
    inputBusca.addEventListener('keyup', function(e) {
        const termo = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.kanban-card');
        cards.forEach(card => {
            const nome = card.querySelector('.nome-aluno').innerText.toLowerCase();
            if (nome.includes(termo)) card.style.display = 'block';
            else card.style.display = 'none';
        });
    });
}

// --- FUNÇÕES DO DASHBOARD (CORRIGIDAS) ---

let meuGrafico = null; 

function abrirDashboard() {
    if (cacheLeads.length === 0) {
        Swal.fire('Sem dados', 'Aguarde o carregamento.', 'info');
        return;
    }
    
    // Agora que o HTML está corrigido, isso vai funcionar:
    try {
        calcularMetricas();
        const modal = new bootstrap.Modal(document.getElementById('modalDashboard'));
        modal.show();
    } catch(e) {
        console.error(e);
        Swal.fire("Erro", "Verifique o console.", "error");
    }
}

function calcularMetricas() {
    let totalLeads = cacheLeads.length;
    let novosMes = 0;
    let valorNegociacao = 0;
    let valorVendas = 0;
    let counts = { 'Novo': 0, 'Em Contato': 0, 'Visita': 0, 'Fechado': 0 };
    const mesAtual = new Date().getMonth();

    cacheLeads.forEach(lead => {
        // Limpeza rigorosa do valor monetário
        let valorString = (lead.valor || '0').toString();
        // Remove R$, pontos de milhar e troca vírgula por ponto
        valorString = valorString.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        let valor = parseFloat(valorString) || 0;
        
        // Contagem Status
        let status = lead.status || 'Novo';
        if (counts.hasOwnProperty(status)) counts[status]++;
        else {
            if(!counts['Outros']) counts['Outros'] = 0;
            counts['Outros']++;
        }

        if (status === 'Fechado' || status === 'Matriculado') valorVendas += valor;
        else valorNegociacao += valor;

        if (lead.data && new Date(lead.data).getMonth() === mesAtual) novosMes++;
    });

    document.getElementById('kpi-total').innerText = totalLeads;
    document.getElementById('kpi-novos').innerText = novosMes;
    document.getElementById('kpi-negociacao').innerText = formatarMoeda(valorNegociacao);
    document.getElementById('kpi-vendas').innerText = formatarMoeda(valorVendas);

    const META = 5000;
    const porcentagem = Math.min((valorVendas / META) * 100, 100);
    const barra = document.getElementById('barra-meta');
    if(barra) {
        barra.style.width = `${porcentagem}%`;
        barra.innerText = `${Math.round(porcentagem)}%`;
        let falta = Math.max(META - valorVendas, 0);
        document.getElementById('meta-falta').innerText = formatarMoeda(falta);
    }

    gerarGraficoPizza(counts);
}

function gerarGraficoPizza(dados) {
    const canvas = document.getElementById('graficoStatus');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (meuGrafico) meuGrafico.destroy();

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dados),
            datasets: [{
                data: Object.values(dados),
                backgroundColor: ['#0d6efd', '#ffc107', '#0dcaf0', '#198754', '#6c757d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
