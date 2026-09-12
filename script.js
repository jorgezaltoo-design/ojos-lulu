// --- CONFIGURACIÓN DE CONEXIÓN CON CLOUDFLARE WORKER (GROQ IA) ---
const WORKER_URL = "https://groq-lulu.jorge-z-alto-o.workers.dev";

// Lista de modelos de Groq a probar automáticamente en orden si alguno falla
const MODELOS_GROQ = [
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
];

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

// Mover pupilas en dirección suave
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

        // Activación por palabra clave "Oye Lulú" o variantes
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
                moveEyes(0, -10);
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


// --- 3. CONEXIÓN A GROQ CON SELECCIÓN AUTOMÁTICA DE MODELO QUE FUNCIONE ---
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

    // Recorre automáticamente los modelos en la lista hasta que uno responda con éxito
    for (const modelo of MODELOS_GROQ) {
        try {
            console.log("Probrando modelo Groq:", modelo);

            const response = await fetch(WORKER_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: modelo,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: mensajeUsuario }
                    ],
                    max_tokens: 250,
                    temperature: 0.7
                })
            });

            const data = await response.json();

            // Si el modelo funcionó y trajo mensaje válido
            if (data.choices && data.choices[0] && data.choices[0].message) {
                console.log("¡Éxito con el modelo!", modelo);
                return data.choices[0].message.content.trim();
            } else {
                console.warn(`El modelo ${modelo} falló, probando el siguiente...`, data.error || data);
            }
        } catch (error) {
            console.warn(`Error al conectar con el modelo ${modelo}:`, error);
        }
    }

    return "Lo siento, no pude conectarme con ningún modelo activo de Groq.";
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

// Activar al hacer clic en pantalla
document.body.addEventListener('click', () => {
    if (!isProcessing && !isSpeaking && recognition) {
        try { recognition.start(); } catch(e){}
    }
});
