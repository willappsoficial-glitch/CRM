// ⚠️ NÃO ESQUEÇA DE COLAR SUA URL DO APPS SCRIPT AQUI NOVAMENTE
const API_URL = 'https://script.google.com/macros/s/AKfycbyucoF9SXVKo_b49sg2-CC-jsGSpLhTxVtn9VZzr10oa21jSB91DXLEYn9L_D25U6vW/exec'; 

// --- INICIALIZAÇÃO ---
// Isso roda assim que a tela abre
document.addEventListener('DOMContentLoaded', () => {
    carregarLeads();
    configurarDragAndDrop();
});

// --- FUNÇÕES GLOBAIS (Agora o HTML consegue ver estas funções) ---

// 1. Abrir Modal de Novo Aluno
async function abrirModalNovo() {
    // Verifica se o SweetAlert carregou
    if (typeof Swal === 'undefined') {
        alert("Erro: A biblioteca SweetAlert não carregou. Verifique sua internet.");
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Novo Aluno',
        html:
            '<input id="swal-nome" class="swal2-input" placeholder="Nome">' +
            '<input id="swal-tel" class="swal2-input" placeholder="Telefone (55...)">' +
            '<input id="swal-tag" class="swal2-input" placeholder="Tag (Ex: Musculação)">',
        focusConfirm: false,
        showCancelButton: true, // Adicionei botão de cancelar
        confirmButtonText: 'Salvar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const nome = document.getElementById('swal-nome').value;
            const telefone = document.getElementById('swal-tel').value;
            
            if (!nome) {
                Swal.showValidationMessage('O nome é obrigatório');
            }
            
            return {
                nome: nome,
                telefone: telefone,
                tags: document.getElementById('swal-tag').value,
                valor: '100,00' // Valor padrão, pode mudar depois
            }
        }
    });

    if (formValues) {
        // 1. Feedback visual imediato (Otimista)
        const tempId = Date.now().toString(); // ID temporário
        criarCardNaTela({ ...formValues, id: tempId, status: 'Novo' });
        atualizarContadores();
        
        // 2. Salva no Banco de Dados (Apps Script)
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'criar', lead: formValues })
            });
            console.log("Salvo no Google Sheets!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            Swal.fire('Erro', 'Não foi possível salvar na planilha.', 'error');
        }
    }
}

// 2. Configura o SortableJS (Arrasta e Solta)
function configurarDragAndDrop() {
    const colunas = document.querySelectorAll('.kanban-list');
    
    colunas.forEach(coluna => {
        // Verifica se Sortable carregou
        if (typeof Sortable === 'undefined') return;

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
                    atualizarContadores();
                }
            }
        });
    });
}

// 3. Busca dados da API
function carregarLeads() {
    // Mostra loading apenas se Swal estiver carregado
    if (typeof Swal !== 'undefined') {
        Swal.fire({title: 'Carregando...', didOpen: () => Swal.showLoading()});
    }
    
    fetch(API_URL)
        .then(response => response.json())
        .then(json => {
            if (typeof Swal !== 'undefined') Swal.close();
            
            if(json.status === 'sucesso') {
                limparColunas();
                json.dados.forEach(lead => criarCardNaTela(lead));
                atualizarContadores();
            } else {
                console.error('Erro no Backend:', json.mensagem);
            }
        })
        .catch(erro => {
            console.error(erro);
            if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Falha ao conectar com a planilha.', 'error');
        });
}

// 4. Renderiza o Card HTML
function criarCardNaTela(lead) {
    // Se o status não existir no HTML, joga para 'Novo'
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
                <button class="btn btn-sm btn-outline-success border-0" onclick="abrirWhatsApp('${lead.telefone}', '${lead.nome}')" title="Chamar no Zap">
                    <i class="fab fa-whatsapp fa-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deletarLead('${lead.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    coluna.appendChild(card);
}

// 5. Salva Movimentação
function atualizarStatusNoBanco(id, status) {
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ acao: 'mover', id: id, novoStatus: status })
    }).then(r => console.log("Status atualizado"));
}

// 6. Abrir WhatsApp
function abrirWhatsApp(tel, nome) {
    if (!tel) {
        alert("Cliente sem telefone cadastrado.");
        return;
    }
    // Remove caracteres não numéricos
    const telLimpo = tel.toString().replace(/\D/g, ''); 
    const texto = `Olá ${nome}, tudo bem? Sou da academia...`;
    window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(texto)}`, '_blank');
}

// 7. Deletar Lead
function deletarLead(id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Apagar este aluno?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, apagar!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            const card = document.querySelector(`[data-id="${id}"]`);
            if (card) card.remove();
            
            fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ acao: 'apagar', id: id })
            });
            atualizarContadores();
        }
    })
}

// 8. Utilitários
function limparColunas() {
    document.querySelectorAll('.kanban-list').forEach(c => c.innerHTML = '');
}

function atualizarContadores() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        const count = col.querySelectorAll('.kanban-card').length;
        col.querySelector('.count-badge').innerText = count;
    });
}
