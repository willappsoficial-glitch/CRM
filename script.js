// ⚠️ COLOQUE SUA URL DO APPS SCRIPT AQUI DENTRO DAS ASPAS
const API_URL = 'https://script.google.com/macros/s/AKfycbyucoF9SXVKo_b49sg2-CC-jsGSpLhTxVtn9VZzr10oa21jSB91DXLEYn9L_D25U6vW/exec'; 

// Variável Global para guardar os leads carregados (Cache)
let cacheLeads = [];

// Inicializa quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    carregarLeads();
    configurarDragAndDrop();
    configurarBusca(); // Se você já adicionou a busca
});

// 1. Configura o SortableJS (Arrasta e Solta)
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

// 2. Busca dados da API e Salva no Cache
function carregarLeads() {
    Swal.fire({title: 'Carregando...', didOpen: () => Swal.showLoading()});
    
    fetch(API_URL)
        .then(response => response.json())
        .then(json => {
            Swal.close();
            if(json.status === 'sucesso') {
                cacheLeads = json.dados; // <--- SALVA NO CACHE AQUI
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

// 3. Renderiza o Card HTML
function criarCardNaTela(lead) {
    const coluna = document.getElementById(lead.status) || document.getElementById('Novo');
    
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-id', lead.id);
    
    // HTML interno do Card
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
                <button class="btn btn-sm btn-outline-success border-0 btn-zap" title="Chamar no Zap">
                    <i class="fab fa-whatsapp fa-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0 btn-trash">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Evento de Clique no Card (Abre Modal)
    card.onclick = (e) => {
        // Se clicar nos botões, não abre o modal
        if (e.target.closest('button')) return;
        abrirModalDetalhes(lead.id);
    };

    // Eventos específicos dos botões (para não conflitar com o clique do card)
    const btnZap = card.querySelector('.btn-zap');
    btnZap.onclick = (e) => {
        e.stopPropagation(); // Impede abrir o modal
        abrirWhatsApp(lead.telefone, lead.nome);
    };

    const btnTrash = card.querySelector('.btn-trash');
    btnTrash.onclick = (e) => {
        e.stopPropagation(); // Impede abrir o modal
        deletarLead(lead.id);
    };
    
    coluna.appendChild(card);
}

// --- FUNÇÕES DO MODAL E EDIÇÃO ---

function abrirModalDetalhes(id) {
    const lead = cacheLeads.find(l => l.id == id);
    if (!lead) return;

    // Preenche os campos do modal
    document.getElementById('edit-id').value = lead.id;
    document.getElementById('edit-nome').value = lead.nome;
    document.getElementById('edit-telefone').value = lead.telefone;
    document.getElementById('edit-valor').value = lead.valor;
    document.getElementById('edit-tag').value = lead.tags;

    // Renderiza Histórico
    renderizarHistorico(lead.historico || []);

    // Abre o Modal do Bootstrap
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

    // Cria cópia e inverte para mostrar mais recente primeiro
    [...historico].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'card p-2 mb-2 border-0 shadow-sm bg-white';
        div.innerHTML = `
            <small class="text-muted fw-bold" style="font-size: 0.75rem">${item.data}</small>
            <p class="mb-0 text-dark">${item.texto}</p>
        `;
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

    const novaNota = {
        data: new Date().toLocaleString('pt-BR'),
        texto: texto
    };
    lead.historico.push(novaNota);

    renderizarHistorico(lead.historico);
    input.value = '';
    
    salvarEdicao(true); 
}

function salvarEdicao(silencioso = false) {
    const id = document.getElementById('edit-id').value;
    const lead = cacheLeads.find(l => l.id == id);

    // Atualiza objeto local (Cache)
    lead.nome = document.getElementById('edit-nome').value;
    lead.telefone = document.getElementById('edit-telefone').value;
    lead.valor = document.getElementById('edit-valor').value;
    lead.tags = document.getElementById('edit-tag').value;
    
    // Atualiza Card visualmente sem recarregar tudo
    const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
    if(card) {
        card.querySelector('.nome-aluno').innerText = lead.nome;
        card.querySelector('.tag-aluno').innerText = lead.tags;
        card.querySelector('.valor-aluno').innerText = 'R$ ' + lead.valor;
    }

    if (!silencioso) {
        // Fecha modal e mostra sucesso
        const modalEl = document.getElementById('modalDetalhes');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        Swal.fire({
            title: 'Salvo!',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }

    // Envia para o Back-end
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
                historico: lead.historico
            }
        })
    });
}

// --- FUNÇÕES GERAIS ---

function abrirModalNovo() {
    Swal.fire({
        title: 'Novo Aluno',
        html:
            '<input id="swal-nome" class="swal2-input" placeholder="Nome">' +
            '<input id="swal-tel" class="swal2-input" placeholder="Telefone">' +
            '<input id="swal-tag" class="swal2-input" placeholder="Tag">',
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
            // Cria ID temporário
            const tempId = Date.now(); 
            const novoLead = { ...formValues, id: tempId, status: 'Novo', data: new Date() };
            
            // Adiciona ao cache e tela
            cacheLeads.push(novoLead);
            criarCardNaTela(novoLead);
            atualizarContadores();
            
            // Salva no Banco
            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'criar', lead: formValues })
            });
        }
    });
}

function atualizarStatusNoBanco(id, status) {
    // Atualiza cache local também
    const lead = cacheLeads.find(l => l.id == id);
    if(lead) lead.status = status;

    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ acao: 'mover', id: id, novoStatus: status })
    });
    atualizarContadores();
}

function deletarLead(id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Apagar este aluno?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, apagar!'
    }).then((result) => {
        if (result.isConfirmed) {
            document.querySelector(`[data-id="${id}"]`).remove();
            // Remove do cache
            cacheLeads = cacheLeads.filter(l => l.id != id);
            atualizarContadores();

            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'apagar', id: id })
            });
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
    // Remove caracteres não numéricos
    const cleanTel = tel.replace(/\D/g, '');
    const texto = `Olá ${nome}, tudo bem?`;
    window.open(`https://wa.me/55${cleanTel}?text=${encodeURIComponent(texto)}`, '_blank');
}

// Configuração da Busca (Caso tenha o input no HTML)
function configurarBusca() {
    const inputBusca = document.getElementById('filtro-busca');
    if(!inputBusca) return;

    inputBusca.addEventListener('keyup', function(e) {
        const termo = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.kanban-card');

        cards.forEach(card => {
            const nome = card.querySelector('.nome-aluno').innerText.toLowerCase();
            if (nome.includes(termo)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}
