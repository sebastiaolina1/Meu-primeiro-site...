
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    addDoc,
    collection,
    getDocs,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* ========================================
   1. CONFIGURAÇÃO DO FIREBASE
======================================== */

// Substitua pelos dados do seu projeto Firebase.
// Firebase Console > Configurações do projeto > Seus apps.

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_PROJETO.firebasestorage.app",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
    prompt: "select_account"
});


/* ========================================
   2. ELEMENTOS E ESTADO
======================================== */

let usuarioAtual = null;
let participantes = [];
let filtroAtual = "todos";

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");

const googleLogin = document.getElementById("googleLogin");
const logoutButton = document.getElementById("logoutButton");

const headerUserName = document.getElementById("headerUserName");
const headerUserPhoto = document.getElementById("headerUserPhoto");

const welcomeUserName = document.getElementById("welcomeUserName");

const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profilePhoto = document.getElementById("profilePhoto");

const profileDisplayName = document.getElementById("profileDisplayName");
const profileClass = document.getElementById("profileClass");
const profileDescription = document.getElementById("profileDescription");


/* ========================================
   3. MENSAGENS
======================================== */

function mostrarErro(mensagem) {
    alert(mensagem);
}

function mostrarMensagem(elemento, mensagem, erro = false) {
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.style.color = erro ? "#b42318" : "#527d3c";
}


/* ========================================
   4. LOGIN COM GOOGLE
======================================== */

googleLogin.addEventListener("click", async () => {
    googleLogin.disabled = true;
    googleLogin.textContent = "Conectando...";

    try {
        await signInWithPopup(auth, provider);
    } catch (erro) {
        console.error("Erro no login:", erro);

        if (erro.code === "auth/popup-blocked") {
            mostrarErro("O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.");
        } else if (erro.code === "auth/unauthorized-domain") {
            mostrarErro("Este domínio ainda não está autorizado no Firebase Authentication.");
        } else {
            mostrarErro("Não foi possível entrar com Google. Tente novamente.");
        }
    } finally {
        googleLogin.disabled = false;
        googleLogin.innerHTML = `
            <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
            >
            Entrar com Google
        `;
    }
});


/* ========================================
   5. SAIR DA CONTA
======================================== */

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (erro) {
        console.error(erro);
        mostrarErro("Não foi possível sair da conta.");
    }
});


/* ========================================
   6. AUTENTICAÇÃO
======================================== */

onAuthStateChanged(auth, async (usuario) => {
    if (usuario) {
        usuarioAtual = usuario;

        loginScreen.classList.add("hidden");
        appScreen.classList.remove("hidden");

        await carregarUsuario();
        await carregarParticipantes();

    } else {
        usuarioAtual = null;

        appScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
    }
});


/* ========================================
   7. CARREGAR PERFIL
======================================== */

async function carregarUsuario() {
    if (!usuarioAtual) return;

    const referencia = doc(db, "profiles", usuarioAtual.uid);

    try {
        const resultado = await getDoc(referencia);

        let dados;

        if (resultado.exists()) {
            dados = resultado.data();
        } else {
            dados = {
                nome: usuarioAtual.displayName || "Novo participante",
                email: usuarioAtual.email || "",
                foto: usuarioAtual.photoURL || "",
                turma: "",
                descricao: "",
                criadoEm: serverTimestamp()
            };

            await setDoc(referencia, dados);
        }

        const nome = dados.nome || usuarioAtual.displayName || "Participante";
        const foto = dados.foto || usuarioAtual.photoURL;

        headerUserName.textContent = nome;
        welcomeUserName.textContent = nome.split(" ")[0];

        profileName.textContent = nome;
        profileEmail.textContent = usuarioAtual.email || "";

        profileDisplayName.value = nome;
        profileClass.value = dados.turma || "";
        profileDescription.value = dados.descricao || "";

        if (foto) {
            headerUserPhoto.src = foto;
            profilePhoto.src = foto;
        }

    } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
        mostrarErro("Não foi possível carregar seu perfil. Verifique a configuração do Firestore.");
    }
}


/* ========================================
   8. SALVAR PERFIL
======================================== */

document.getElementById("saveProfile").addEventListener("click", async () => {
    if (!usuarioAtual) return;

    const nome = profileDisplayName.value.trim();
    const turma = profileClass.value.trim();
    const descricao = profileDescription.value.trim();

    if (!nome) {
        mostrarMensagem(
            document.getElementById("profileFeedback"),
            "Digite seu nome.",
            true
        );
        return;
    }

    const botao = document.getElementById("saveProfile");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        const referencia = doc(db, "profiles", usuarioAtual.uid);
        const atual = await getDoc(referencia);

        const dados = {
            nome,
            turma,
            descricao,
            email: usuarioAtual.email || "",
            foto: usuarioAtual.photoURL || "",
            atualizadoEm: serverTimestamp()
        };

        // Preserva a classificação definida pela administração.
        if (!atual.exists()) {
            dados.role = "aluno";
            dados.criadoEm = serverTimestamp();
        }

        await setDoc(referencia, dados, { merge: true });

        profileName.textContent = nome;
        headerUserName.textContent = nome;
        welcomeUserName.textContent = nome.split(" ")[0];

        mostrarMensagem(
            document.getElementById("profileFeedback"),
            "Perfil atualizado com sucesso!"
        );

        await carregarParticipantes();

    } catch (erro) {
        console.error("Erro ao salvar perfil:", erro);

        mostrarMensagem(
            document.getElementById("profileFeedback"),
            "Não foi possível salvar. Verifique as regras do Firestore.",
            true
        );

    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar perfil →";
    }
});


/* ========================================
   9. NAVEGAÇÃO
======================================== */

const paginas = document.querySelectorAll(".page");
const botoesNavegacao = document.querySelectorAll(".nav-item");

const titulos = {
    home: "Início",
    community: "Comunidade",
    meetings: "Conversas",
    roulette: "Roleta",
    profile: "Meu perfil"
};

function abrirPagina(nome) {
    paginas.forEach(pagina => {
        pagina.classList.remove("active");
    });

    botoesNavegacao.forEach(botao => {
        botao.classList.remove("active");
    });

    const pagina = document.getElementById("page-" + nome);
    const botao = document.querySelector(`[data-page="${nome}"]`);

    if (!pagina) return;

    pagina.classList.add("active");

    if (botao) {
        botao.classList.add("active");
    }

    document.getElementById("pageTitle").textContent =
        titulos[nome] || "aBAChat";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (nome === "community") {
        carregarParticipantes();
    }
}

botoesNavegacao.forEach(botao => {
    botao.addEventListener("click", () => {
        abrirPagina(botao.dataset.page);
    });
});

document.querySelectorAll("[data-goto]").forEach(botao => {
    botao.addEventListener("click", () => {
        abrirPagina(botao.dataset.goto);
    });
});


/* ========================================
   10. CARREGAR COMUNIDADE
======================================== */

async function carregarParticipantes() {
    if (!usuarioAtual) return;

    const grid = document.getElementById("communityGrid");

    grid.innerHTML = `
        <div class="empty-state">
            <span>⌛</span>
            <h3>Carregando comunidade...</h3>
            <p>Buscando participantes do aBAChat.</p>
        </div>
    `;

    try {
        const referencia = collection(db, "profiles");
        const resultado = await getDocs(referencia);

        participantes = [];

        resultado.forEach(documento => {
            const dados = documento.data();

            participantes.push({
                id: documento.id,
                nome: dados.nome || "Participante",
                turma: dados.turma || "Turma não informada",
                descricao: dados.descricao || "",
                foto: dados.foto || "",
                role: dados.role || "aluno"
            });
        });

        renderizarParticipantes();

    } catch (erro) {
        console.error("Erro ao carregar comunidade:", erro);

        grid.innerHTML = `
            <div class="empty-state">
                <span>!</span>
                <h3>Não foi possível carregar</h3>
                <p>Verifique sua conexão e as regras do Firestore.</p>
            </div>
        `;
    }
}


/* ========================================
   11. MOSTRAR PARTICIPANTES
======================================== */

function renderizarParticipantes() {
    const grid = document.getElementById("communityGrid");
    const busca = document.getElementById("searchPeople").value
        .trim()
        .toLowerCase();

    const filtrados = participantes.filter(pessoa => {
        const correspondeBusca =
            pessoa.nome.toLowerCase().includes(busca) ||
            pessoa.turma.toLowerCase().includes(busca);

        const correspondeFiltro =
            filtroAtual === "todos" ||
            pessoa.role === filtroAtual;

        return correspondeBusca && correspondeFiltro;
    });

    grid.innerHTML = "";

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span>♧</span>
                <h3>Ninguém encontrado</h3>
                <p>Tente outro nome ou filtro.</p>
            </div>
        `;
        return;
    }

    filtrados.forEach(pessoa => {
        const card = document.createElement("article");
        card.className = "person-card";

        const avatar = document.createElement("div");
        avatar.className = "person-avatar";

        if (pessoa.foto) {
            const imagem = document.createElement("img");
            imagem.src = pessoa.foto;
            imagem.alt = "";
            imagem.style.width = "100%";
            imagem.style.height = "100%";
            imagem.style.objectFit = "cover";
            imagem.style.borderRadius = "inherit";
            avatar.appendChild(imagem);
        } else {
            avatar.textContent = pessoa.nome.charAt(0).toUpperCase();
        }

        const nome = document.createElement("h3");
        nome.textContent = pessoa.nome;

        const turma = document.createElement("p");
        turma.textContent = pessoa.turma;

        const descricao = document.createElement("span");
        descricao.className = "person-tag";
        descricao.textContent =
            pessoa.role === "professor" ? "Professor" :
            pessoa.role === "mentor" ? "Mentor" : "Aluno";

        card.append(avatar, nome, turma, descricao);

        grid.appendChild(card);
    });
}


/* ========================================
   12. BUSCA E FILTROS
======================================== */

document.getElementById("searchPeople").addEventListener("input", () => {
    renderizarParticipantes();
});

document.querySelectorAll(".filter-button").forEach(botao => {
    botao.addEventListener("click", () => {
        document.querySelectorAll(".filter-button").forEach(item => {
            item.classList.remove("active");
        });

        botao.classList.add("active");

        filtroAtual = botao.dataset.filter;
        renderizarParticipantes();
    });
});


/* ========================================
   13. INTERESSE EM CONVERSAS
======================================== */

document.getElementById("meetingForm").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!usuarioAtual) return;

    const pessoa = document.getElementById("meetingPerson").value.trim();
    const data = document.getElementById("meetingDate").value;
    const horario = document.getElementById("meetingTime").value;
    const mensagem = document.getElementById("meetingMessage").value.trim();

    const feedback = document.getElementById("meetingFeedback");
    const botao = evento.target.querySelector("button[type='submit']");

    if (!pessoa || !data || !horario) {
        mostrarMensagem(feedback, "Preencha os campos obrigatórios.", true);
        return;
    }

    // Evita datas anteriores ao dia atual.
    const dataEscolhida = new Date(`${data}T${horario}:00`);
    if (Number.isNaN(dataEscolhida.getTime()) || dataEscolhida <= new Date()) {
        mostrarMensagem(feedback, "Escolha uma data e horário futuros.", true);
        return;
    }

    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
        await addDoc(collection(db, "meetingRequests"), {
            usuarioId: usuarioAtual.uid,
            usuarioNome: usuarioAtual.displayName || "",
            usuarioEmail: usuarioAtual.email || "",
            convidado: pessoa,
            data,
            horario,
            mensagem,
            status: "pendente",
            criadoEm: serverTimestamp()
        });

        mostrarMensagem(
            feedback,
            "Interesse enviado! A organização poderá entrar em contato."
        );

        evento.target.reset();

    } catch (erro) {
        console.error("Erro ao enviar interesse:", erro);

        mostrarMensagem(
            feedback,
            "Não foi possível enviar. Tente novamente.",
            true
        );

    } finally {
        botao.disabled = false;
        botao.textContent = "Enviar interesse →";
    }
});


/* ========================================
   14. ROLETA
======================================== */

const spinButton = document.getElementById("spinButton");
const rouletteVisual = document.getElementById("rouletteVisual");
const rouletteResult = document.getElementById("rouletteResult");

spinButton.addEventListener("click", () => {
    if (spinButton.disabled) return;

    // A roleta usa somente participantes cadastrados.
    const disponiveis = participantes.filter(pessoa =>
        pessoa.id !== usuarioAtual?.uid
    );

    if (disponiveis.length === 0) {
        rouletteResult.textContent =
            "Ainda não existem outros participantes cadastrados.";
        return;
    }

    spinButton.disabled = true;
    spinButton.textContent = "Sorteando...";

    rouletteVisual.classList.remove("spinning");

    void rouletteVisual.offsetWidth;

    rouletteVisual.classList.add("spinning");

    const sorteado =
        disponiveis[Math.floor(Math.random() * disponiveis.length)];

    setTimeout(() => {
        rouletteResult.textContent =
            "O próximo convidado é: " + sorteado.nome + "!";

        spinButton.disabled = false;
        spinButton.textContent = "Girar novamente ✳";

    }, 1700);
});


/* ========================================
   15. DATA MÍNIMA DO AGENDAMENTO
======================================== */

const meetingDate = document.getElementById("meetingDate");

if (meetingDate) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    meetingDate.min = `${ano}-${mes}-${dia}`;
}
