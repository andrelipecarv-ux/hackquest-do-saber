const API_KEY = "SUA_API_KEY_AQUI";

let tema = "";
let xp = 0;
let vidas = 3;
let rodada = 0;
let perguntaAtual = null;
let carregando = false;

let nivelIndex = 0;

const niveis = ["Aprendiz", "Intermediário", "Avançado", "Mestre"];
const LIMITE_RODADAS = 5;

/* ---------- INICIALIZAÇÃO ---------- */

function iniciarJogo() {
  tema = document.getElementById("temaInput").value.trim();

  if (!tema) {
    alert("Digite um tema para começar.");
    return;
  }

  xp = 0;
  vidas = 3;
  rodada = 0;
  nivelIndex = 0;
  perguntaAtual = null;
  carregando = false;

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  atualizar();
  carregarPergunta();
}

function getNivelAtual() {
  return niveis[nivelIndex];
}

/* ---------- IA ---------- */

async function gerarPergunta() {
  const prompt = `
Gere 1 pergunta de múltipla escolha sobre o tema: "${tema}".
Dificuldade: "${getNivelAtual()}".

Regras:
- Apenas JSON válido
- 4 alternativas
- 1 correta (índice 0-3)
- Explicação curta
- Evitar cálculo matemático

Formato:
{
  "pergunta": "...",
  "alternativas": ["A","B","C","D"],
  "correta": 0,
  "explicacao": "..."
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 400 || response.status === 403)
      throw new Error("API_KEY_INVALIDA");
    throw new Error("API_ERRO");
  }

  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!texto) throw new Error("RESPOSTA_VAZIA");

  const clean = texto.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);

  if (!match) throw new Error("JSON_INVALIDO");

  const pergunta = JSON.parse(match[0]);
  validarPergunta(pergunta);

  return pergunta;
}

/* ---------- VALIDAÇÃO ---------- */

function validarPergunta(p) {
  if (!p.pergunta || typeof p.pergunta !== "string")
    throw new Error("PERGUNTA_INVALIDA");

  if (!Array.isArray(p.alternativas) || p.alternativas.length !== 4)
    throw new Error("ALTERNATIVAS_INVALIDAS");

  if (typeof p.correta !== "number" || p.correta < 0 || p.correta > 3)
    throw new Error("CORRETA_INVALIDA");

  if (!p.explicacao) p.explicacao = "Explicação indisponível.";
}

/* ---------- FLUXO DO JOGO ---------- */

async function carregarPergunta() {
  if (carregando) return;

  if (rodada >= LIMITE_RODADAS) {
    finalizarMissao();
    return;
  }

  carregando = true;
  rodada++;

  limparTela();

  try {
    perguntaAtual = await gerarPergunta();
    renderizarPergunta();
  } catch (erro) {
    rodada--; // não conta erro como rodada
    mostrarErro(erro);
  }

  carregando = false;
}

function limparTela() {
  document.getElementById("pergunta").innerText = "Gerando pergunta...";
  document.getElementById("alternativas").innerHTML = "";
  document.getElementById("feedback").innerText = "";

  const btn = document.getElementById("proximaBtn");
  btn.classList.add("hidden");
  btn.disabled = true;
}

function mostrarErro(erro) {
  const pergunta = document.getElementById("pergunta");
  const feedback = document.getElementById("feedback");

  if (erro.message === "RATE_LIMIT") {
    pergunta.innerText = "Limite da IA atingido";
    feedback.innerText =
      "Você atingiu o limite diário. Tente novamente mais tarde.";
    return;
  }

  if (erro.message === "API_KEY_INVALIDA") {
    pergunta.innerText = "Erro na API";
    feedback.innerText =
      "Chave inválida ou bloqueada. Gere uma nova no Google AI Studio.";
    return;
  }

  pergunta.innerText = "Erro ao gerar pergunta";
  feedback.innerText = "Tente novamente em instantes.";
}

/* ---------- RENDER ---------- */

function renderizarPergunta() {
  document.getElementById("pergunta").innerText =
    `Rodada ${rodada} — ${perguntaAtual.pergunta}`;

  const div = document.getElementById("alternativas");
  div.innerHTML = "";

  perguntaAtual.alternativas.forEach((alt, i) => {
    const btn = document.createElement("button");
    btn.className = "alternativa";
    btn.innerText = alt;
    btn.onclick = () => responder(i);
    div.appendChild(btn);
  });
}

/* ---------- RESPOSTA ---------- */

function responder(i) {
  if (!perguntaAtual || carregando) return;

  const acertou = i === perguntaAtual.correta;
  const botoes = document.querySelectorAll(".alternativa");

  botoes.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === perguntaAtual.correta) btn.classList.add("correta");
    if (idx === i && !acertou) btn.classList.add("errada");
  });

  if (acertou) {
    xp += 10;
    document.getElementById("feedback").innerText =
      `Acertou! +10 XP\n\n${perguntaAtual.explicacao}`;
  } else {
    vidas = Math.max(0, vidas - 1);
    document.getElementById("feedback").innerText =
      `Errou.\n\n${perguntaAtual.explicacao}`;
  }

  atualizar();

  if (vidas <= 0) {
    finalizarJogoPorVidas();
    return;
  }

  const btn = document.getElementById("proximaBtn");
  btn.disabled = false;
  btn.classList.remove("hidden");
}

/* ---------- HUD ---------- */

function atualizar() {
  document.getElementById("xp").innerText = xp;
  document.getElementById("vidas").innerText = vidas;
  document.getElementById("nivel").innerText = getNivelAtual();
}

/* ---------- NAVEGAÇÃO ---------- */

function proximaPergunta() {
  if (!carregando) carregarPergunta();
}

function finalizarMissao() {
  if (nivelIndex < niveis.length - 1) nivelIndex++;

  atualizar();

  document.getElementById("pergunta").innerText = "Missão concluída";
  document.getElementById("feedback").innerText =
    `XP: ${xp}\nNível: ${getNivelAtual()}`;

  mostrarOpcoesFim();
}

function finalizarJogoPorVidas() {
  document.getElementById("pergunta").innerText = "Fim da missão";
  document.getElementById("feedback").innerText =
    `XP: ${xp}\nNível: ${getNivelAtual()}`;

  mostrarOpcoesFim();
}

function mostrarOpcoesFim() {
  const div = document.getElementById("alternativas");
  div.innerHTML = "";

  const continuar = criarBotao("Continuar", continuarMesmoTema);
  const novo = criarBotao("Novo tema", escolherOutroTema);

  div.appendChild(continuar);
  div.appendChild(novo);
}

function criarBotao(texto, acao) {
  const btn = document.createElement("button");
  btn.className = "alternativa";
  btn.innerText = texto;
  btn.onclick = acao;
  return btn;
}

/* ---------- RESET ---------- */

function continuarMesmoTema() {
  rodada = 0;
  vidas = 3;
  perguntaAtual = null;
  carregarPergunta();
}

function escolherOutroTema() {
  location.reload();
}