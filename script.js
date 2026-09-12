// --- CONFIGURACIÓN DE CONEXIÓN CON CLOUDFLARE WORKER (GROQ IA) ---
const WORKER_URL = "https://groq-lulu.jorge-z-alto-o.workers.dev";

// Elementos DOM
const face = document.getElementById('face');
const subtitleText = document.getElementById('subtitleText');
const statusIndicator = document.getElementById('statusIndicator');

let isProcessing = false;
let isSpeaking = false;

// --- 1. SISTEMA DE ANIMACIÓN DE OJOS ---

// Parpadeo automático natural
function triggerBlink() {
    if (isSpeaking) return;
    face.classList.add('blink');
    setTimeout(() => {
        face.classList.remove('blink');
    }, 160);
}

setInterval(() => {
    if (Math.random() > 0.3) triggerBlink();
}, 3500);

// Mover las pupilas en dirección aleatoria o siguiendo el texto
function moveEyes(x, y) {
    const irises = document.querySelectorAll('.iris');
    irises.forEach(iris => {
        iris.style.transform = `translate(${x}px, ${y}px)`;
    });
}

// Ojos mirando a lados aleatorios de vez en cuando
setInterval(() => {
    if (!isProcessing && !isSpeaking) {
        const randomX = (Math.random() - 0.5) * 25;
        const randomY = (Math.random() - 0.5) * 15;
        moveEyes(randomX, randomY);
        setTimeout(() => moveEyes(0, 0), 1200);
    }
}, 5000);


// --- 2. RECONOCIMIENTO CONTINUO DE VOZ ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
        if (!isProcessing && !isSpeaking) {
            setFaceState('', 'DI "OYE LULÚ"...');
        }
    };

    recognition.onresult = async (event) => {
        if (isProcessing || isSpeaking) return;

        const lastIndex = event.results.length - 1;
        const text = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log("Escuchado:", text);

        // Activación por la palabra clave "Oye Lulú" o variantes
        if (text.includes("oye lulú") || text.includes("oye lulu") || text.includes("lulú") || text.includes("lulu")) {
            let consulta = text
                .replace("oye lulú", "")
                .replace("oye lulu", "")
                .replace("lulú", "")
                .replace("lulu", "")
                .trim();

            isProcessing = true;
            try { recognition.stop(); } catch(e){}

            if (consulta.length < 2) {
                speakResponse("¿Sí? Dime, ¿en qué te puedo ayudar?");
            } else {
                setFaceState('thinking', 'PROCESANDO CON GROQ IA...');
                moveEyes(0, -10); // Mirar hacia arriba mientras piensa
                const respuesta = await consultarGroq(consulta);
                speakResponse(respuesta);
            }
        }
    };

    recognition.onerror = (e) => {
        console.log("Error de voz:", e.error);
    };

    recognition.onend = () => {
        if (!isProcessing && !isSpeaking) {
            try { recognition.start(); } catch(e){}
        }
    };

} else {
    subtitleText.innerText = "TU NAVEGADOR NO ES COMPATIBLE CON VOZ";
}


// --- 3. CONEXIÓN A GROQ IA (VÍA CLOUDFLARE WORKER) ---
async function consultarGroq(mensajeUsuario) {
    const ahora = new Date();
    const fechaHoraTexto = ahora.toLocaleString('es-MX', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
    });

    const systemPrompt = `Eres LULÚ, una asistente virtual web muy amable, clara y rápida.
Responde siempre en español, de forma breve (máximo 2 a 3 oraciones) ya que tus respuestas se leerán en voz alta.
CONTEXTO EN TIEMPO REAL:
- Fecha y hora actual del usuario: ${fechaHoraTexto}.
Usa este contexto si el usuario te pregunta la hora, el día o la fecha.`;

    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: mensajeUsuario }
                ],
                max_tokens: 250,
                temperature: 0.7
            })
        });

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error Groq Worker:", error);
        return "Lo siento, tuve un problema al conectarme al servidor de Lulú.";
    }
}


// --- 4. SÍNTESIS DE VOZ E INTERACCIÓN CON OJOS ---
function speakResponse(texto) {
    if (!('speechSynthesis' in window)) {
        subtitleText.innerText = texto;
        resetToListen();
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-MX';
    utterance.rate = 1.05;
    utterance.pitch = 1.1;

    let mouthAnimationInterval;

    utterance.onstart = () => {
        isSpeaking = true;
        setFaceState('speaking', texto);

        // Hacer que los ojos modulen (dilaten y se muevan) al ritmo del habla
        mouthAnimationInterval = setInterval(() => {
            const scale = 0.9 + Math.random() * 0.3;
            const pupilScale = 0.8 + Math.random() * 0.4;
            
            const pupils = document.querySelectorAll('.pupil');
            pupils.forEach(p => p.style.transform = `scale(${pupilScale})`);

            const irises = document.querySelectorAll('.iris');
            irises.forEach(i => i.style.transform = `scale(${scale})`);
        }, 120);
    };

    utterance.onend = () => {
        clearInterval(mouthAnimationInterval);
        resetEyeTransforms();
        isSpeaking = false;
        isProcessing = false;
        resetToListen();
    };

    utterance.onerror = () => {
        clearInterval(mouthAnimationInterval);
        resetEyeTransforms();
        isSpeaking = false;
        isProcessing = false;
        resetToListen();
    };

    window.speechSynthesis.speak(utterance);
}

function resetEyeTransforms() {
    document.querySelectorAll('.pupil, .iris').forEach(el => el.style.transform = 'none');
}

function resetToListen() {
    setFaceState('', 'DI "OYE LULÚ"...');
    try { recognition.start(); } catch(e){}
}

// Control de clases y estado visual
function setFaceState(stateClass, text) {
    face.className = 'face-container ' + stateClass;
    subtitleText.innerText = text;

    if (stateClass === 'listening') {
        statusIndicator.style.backgroundColor = '#00ff87';
        statusIndicator.style.boxShadow = '0 0 12px #00ff87';
    } else if (stateClass === 'thinking') {
        statusIndicator.style.backgroundColor = '#ff007f';
        statusIndicator.style.boxShadow = '0 0 12px #ff007f';
    } else {
        statusIndicator.style.backgroundColor = '#00f2fe';
        statusIndicator.style.boxShadow = '0 0 12px #00f2fe';
    }
}

// Activar con un toque en la pantalla
document.body.addEventListener('click', () => {
    if (!isProcessing && !isSpeaking && recognition) {
        try { recognition.start(); } catch(e){}
    }
});
