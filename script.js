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

// --- FUNÇÕES GERAIS ---

function abrirModalNovo() {
    Swal.fire({
        title: 'Novo Aluno',
        html:
            '<input id="swal-nome" class="swal2-input" placeholder="Nome">' +
            '<input id="swal-tel" class="swal2-input" placeholder="Telefone (55...)">' +
            '<div class="mt-3 text-start px-5"><label class="small text-muted">Data de Nascimento:</label>' +
            '<input id="swal-nasc" type="date" class="swal2-input mt-0" placeholder="Nascimento"></div>' +
            '<input id="swal-tag" class="swal2-input" placeholder="Tag (ex: Musculação)">',
        focusConfirm: false,
        preConfirm: () => {
            return {
                nome: document.getElementById('swal-nome').value,
                telefone: document.getElementById('swal-tel').value,
                nascimento: document.getElementById('swal-nasc').value, // CAMPO NOVO
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
            
            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'criar', lead: formValues })
            });
        }
    });
}

function abrirModalDetalhes(id) {
    const lead = cacheLeads.find(l => l.id == id);
    if (!lead) return;

    document.getElementById('edit-id').value = lead.id;
    document.getElementById('edit-nome').value = lead.nome;
    document.getElementById('edit-telefone').value = lead.telefone;
    document.getElementById('edit-valor').value = lead.valor;
    document.getElementById('edit-tag').value = lead.tags;
    
    // Preenche Data Nascimento
    if(lead.nascimento) {
        let dataFmt = lead.nascimento.toString().substring(0, 10); 
        document.getElementById('edit-nasc').value = dataFmt;
    } else {
        document.getElementById('edit-nasc').value = '';
    }

    renderizarHistorico(lead.historico || []);

    const modal = new bootstrap.Modal(document.getElementById('modalDetalhes'));
    modal.show();
}

function salvarEdicao(silencioso = false) {
    const id = document.getElementById('edit-id').value;
    const lead = cacheLeads.find(l => l.id == id);

    lead.nome = document.getElementById('edit-nome').value;
    lead.telefone = document.getElementById('edit-telefone').value;
    lead.valor = document.getElementById('edit-valor').value;
    lead.tags = document.getElementById('edit-tag').value;
    lead.nascimento = document.getElementById('edit-nasc').value; // SALVA NASCIMENTO

    // Atualiza visualmente
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
        body: JSON.stringify({ 
            acao: 'editar', 
            id: id, 
            lead: { 
                nome: lead.nome, 
                telefone: lead.telefone, 
                valor: lead.valor, 
                tags: lead.tags, 
                historico: lead.historico,
                nascimento: lead.nascimento
            } 
        })
    });
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

function abrirWhatsApp(tel, nome, mensagemPersonalizada = null) {
    const cleanTel = tel.toString().replace(/\D/g, '');
    let texto = mensagemPersonalizada ? mensagemPersonalizada : `Olá ${nome}, tudo bem?`;
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

// --- FUNÇÕES DE RETENÇÃO (CRM - MISSÕES DO DIA) ---

function abrirPainelRetencao() {
    const modal = new bootstrap.Modal(document.getElementById('modalRetencao'));
    modal.show();

    // Carrega dados
    fetch(API_URL + '?op=missoes') // Chama o GET com parâmetro
        .then(response => response.json())
        .then(json => {
            if(json.status === 'sucesso') {
                renderizarRetencao(json.dados);
            } else {
                Swal.fire('Erro', 'Não foi possível carregar as missões.', 'error');
            }
        })
        .catch(e => console.error(e));
}

function renderizarRetencao(dados) {
    // 1. Aniversariantes
    renderizarLista('lista-niver', dados.aniversariantes, 'badge-niver', (aluno) => {
        return {
            titulo: `${aluno.nome} 🎂`,
            subtitulo: 'Faz aniversário hoje!',
            msg: `Parabéns ${aluno.nome}! 🎉 Hoje é seu dia! Passando pra desejar muita saúde e muitos treinos. Venha comemorar com a gente!`
        };
    });

    // 2. Ausentes
    renderizarLista('lista-ausente', dados.ausentes, 'badge-ausente', (aluno) => {
        return {
            titulo: `${aluno.nome} 🏃`,
            subtitulo: `Ausente há ${aluno.dias} dias`,
            msg: `Oi ${aluno.nome}, sumiu da academia! 😅 Tá tudo bem? Estamos sentindo sua falta nos treinos. Bora voltar hoje?`
        };
    });

    // 3. Cobrança (Vencidos)
    renderizarLista('lista-vencido', dados.vencidos, 'badge-vencido', (aluno) => {
        return {
            titulo: `${aluno.nome} 💲`,
            subtitulo: 'Mensalidade Vencida',
            msg: `Olá ${aluno.nome}, tudo bem? Vi aqui que sua mensalidade venceu. Aconteceu algo? Segue o link pra regularizar e liberar a catraca: [LINK]`
        };
    });

    // 4. Novos Alunos
    renderizarLista('lista-novos', dados.novos, 'badge-novos', (aluno) => {
        return {
            titulo: `${aluno.nome} 🌱`,
            subtitulo: 'Matriculou recentemente',
            msg: `Oi ${aluno.nome}, seja bem-vindo(a) à família! 💪 Como foi seu primeiro treino? Se precisar de ajuda, pode me chamar aqui.`
        };
    });
}

function renderizarLista(elementId, lista, badgeId, templateFn) {
    const container = document.getElementById(elementId);
    const badge = document.getElementById(badgeId);
    
    container.innerHTML = '';
    badge.innerText = lista.length;

    if (lista.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4"><i class="fa-solid fa-check-circle fa-2x mb-2 text-success"></i><br>Tudo zerado por aqui!</div>';
        return;
    }

    lista.forEach(aluno => {
        const info = templateFn(aluno);
        const div = document.createElement('div');
        div.className = 'list-group-item d-flex justify-content-between align-items-center';
        div.innerHTML = `
            <div>
                <h6 class="mb-0 fw-bold">${info.titulo}</h6>
                <small class="text-muted">${info.subtitulo}</small>
            </div>
            <button class="btn btn-success btn-sm rounded-pill px-3" onclick="abrirWhatsApp('${aluno.telefone}', '${aluno.nome}', \`${info.msg}\`)">
                <i class="fab fa-whatsapp"></i> Enviar
            </button>
        `;
        container.appendChild(div);
    });
}

// --- FUNÇÕES DO DASHBOARD ---

let meuGrafico = null; 

function abrirDashboard() {
    if (cacheLeads.length === 0) {
        Swal.fire('Sem dados', 'Aguarde o carregamento.', 'info');
        return;
    }
    
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
        let valorString = (lead.valor || '0').toString();
        valorString = valorString.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        let valor = parseFloat(valorString) || 0;
        
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
