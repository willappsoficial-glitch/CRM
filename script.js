// A URL que você copiou do Apps Script
const API_URL = 'https://script.google.com/macros/library/d/1TPuRJc1b90wS25TNxYPpkHf3mupVE3HN9CDwpv2Jh0FIorKYwtvfFL_i/2';

// Função para buscar os Leads e montar o Kanban
async function carregarKanban() {
    try {
        // O Apps Script exige 'no-cors' ou tratamento simples, 
        // mas fetch padrão funciona bem com redirects do Google
        const response = await fetch(`${API_URL}?op=ler_todos`);
        const json = await response.json();
        
        if (json.status === 'sucesso') {
            renderizarCards(json.dados);
        }
    } catch (error) {
        console.error("Erro ao conectar na API:", error);
    }
}

// Função para Mover Card (Arrasta e Solta)
async function atualizarStatusNoBanco(idLead, novoStatus) {
    const payload = {
        acao: 'mover',
        id: idLead,
        novoStatus: novoStatus
    };

    // O Google Apps Script exige POST stringificado
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
        // Nota: Não use headers 'Content-Type': 'application/json' 
        // pois causa erro de CORS no Apps Script. Mande texto puro (default).
    });
    
    console.log(`Lead ${idLead} movido para ${novoStatus}`);
}

// Inicializa
carregarKanban();