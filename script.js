// ⚠️ COLE SUA URL DO APPS SCRIPT AQUI (Não esqueça!)
const API_URL = 'https://script.google.com/macros/s/AKfycbyucoF9SXVKo_b49sg2-CC-jsGSpLhTxVtn9VZzr10oa21jSB91DXLEYn9L_D25U6vW/exec'; 

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    carregarLeads();
    configurarDragAndDrop();
});

// --- FUNÇÕES GLOBAIS ---

// 1. Abrir Modal de Novo Aluno
async function abrirModalNovo() {
    if (typeof Swal === 'undefined') {
        alert("Erro: A biblioteca SweetAlert não carregou.");
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Novo Aluno',
        html:
            '<input id="swal-nome" class="swal2-input" placeholder="Nome">' +
            '<input id="swal-tel" class="swal2-input" placeholder="Telefone (55...)">' +
            '<input id="swal-tag" class="swal2-input" placeholder="Tag (Ex: Musculação)">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Salvar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                nome: document.getElementById('swal-nome').value,
                telefone: document.getElementById('swal-tel').value,
                tags: document.getElementById('swal-tag').value,
                valor: '100,00'
            }
        }
    });

    if (formValues) {
        // Feedback visual imediato
        const tempId = Date.now().toString();
        criarCardNaTela({ ...formValues, id: tempId, status: 'Novo' }); // AQUI ESTAVA O ERRO ANTIGO
        atualizarContadores();
        
        // Salva no Banco
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'criar', lead: formValues })
            });
        } catch (error) {
            console.error("Erro ao salvar:", error);
        }
    }
}

// 2. Busca dados da API
function carregarLeads() {
    if (typeof Swal !== 'undefined') Swal.fire({title: 'Carregando...', didOpen: () => Swal.showLoading()});
    
    fetch(API_URL)
        .then(response => response.json())
        .then(json => {
            if (typeof Swal !== 'undefined') Swal.close();
            
            if(json.status === 'sucesso') {
                limparColunas();
                // O ERRO ESTAVA AQUI: Antes chamava renderizarCards, agora é criarCardNaTela
                json.dados.forEach(lead => criarCardNaTela(lead)); 
                atualizarContadores();
            }
        })
        .catch(erro => {
            console.error(erro);
            if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Falha ao conectar.', 'error');
        });
}

// 3. Renderiza o Card HTML
function criarCardNaTela(lead) {
    const coluna = document.getElementById(lead.status) || document.getElementById('Novo');
    
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-id', lead.id);
    
    card.innerHTML = `
        <div class="d-flex justify-content-between mb-2">
            <span class="fw-bold text-dark">${lead.nome}</span>
            <small class="text-muted"><i class="far fa-clock"></i> Hoje</small>
        </div>
        <div class="mb-2">
            <span class="badge bg-light text-dark border">${lead.tags || 'Geral'}</span>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
            <span class="fw-bold text-success">R$ ${lead.valor || '0,00'}</span>
            <div>
                <button class="btn btn-sm btn-outline-success border-0" onclick="abrirWhatsApp('${lead.telefone}', '${lead.nome}')">
                    <i class="fab fa-whatsapp fa-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deletarLead('${lead.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    if(coluna) coluna.appendChild(card);
}

// 4. Configura Drag and Drop
function configurarDragAndDrop() {
    const colunas = document.querySelectorAll('.kanban-list');
    colunas.forEach(coluna => {
        if (typeof Sortable === 'undefined') return;
        new Sortable(coluna, {
            group: 'crm-pipeline', 
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                if (evt.from !== evt.to) {
                    const item = evt.item;
                    const novoStatus = evt.to.getAttribute('data-status');
                    const idLead = item.getAttribute('data-id');
                    atualizarStatusNoBanco(idLead, novoStatus);
                    atualizarContadores();
                }
            }
        });
    });
}

// 5. Salva Status
function atualizarStatusNoBanco(id, status) {
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ acao: 'mover', id: id, novoStatus: status })
    });
}

// 6. Deletar e Utils
function deletarLead(id) {
    if(confirm("Tem certeza?")) {
        document.querySelector(`[data-id="${id}"]`).remove();
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'apagar', id: id })
        });
        atualizarContadores();
    }
}

function abrirWhatsApp(tel, nome) {
    if(!tel) return alert("Sem telefone");
    const telLimpo = tel.toString().replace(/\D/g, ''); 
    window.open(`https://wa.me/55${telLimpo}?text=Ola ${nome}`, '_blank');
}

function limparColunas() {
    document.querySelectorAll('.kanban-list').forEach(c => c.innerHTML = '');
}

function atualizarContadores() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.querySelector('.count-badge').innerText = col.querySelectorAll('.kanban-card').length;
    });
}

// Adicione este evento no final do seu script
document.getElementById('filtro-busca').addEventListener('keyup', function(e) {
    const termo = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.kanban-card');

    cards.forEach(card => {
        const nome = card.querySelector('.fw-bold').innerText.toLowerCase();
        // Se o nome não bate com a busca, esconde o card
        if (nome.includes(termo)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});
