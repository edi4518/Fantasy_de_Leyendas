/**
 * Controlador de Onboarding / Cómo jugar
 * Gestiona el paso por las 3 reglas del juego y la redirección final.
 */

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Regla 1: Presupuesto de 100 millones",
    description: "Tienes un límite salarial estricto de 100 millones de créditos para fichar exactamente a 9 leyendas históricas del fútbol. Gasta con inteligencia para equilibrar a tus estrellas con talentos ocultos.",
    image: "/public/images/pantalla_regla1.webp",
    buttonText: "PRÓXIMO",
    isFinal: false,
  },
  {
    step: 2,
    title: "Regla 2: Formaciones tácticas",
    description: "Elige tu configuración con cuidado. Colocar a un jugador fuera de su posición natural provocará una penalización del 15% al 25% en sus atributos durante la simulación del partido.",
    image: "/public/images/pantalla_regla2.webp",
    buttonText: "PRÓXIMO",
    isFinal: false,
  },
  {
    step: 3,
    title: "Regla 3: Demuestra quién es el GOAT",
    description: "Las partidas se simulan matemáticamente usando datos históricos reales. Construye una plantilla estadísticamente dominante, escala en el ranking global y demuestra quién es el mejor de todos los tiempos.",
    image: "/public/images/pantalla_regla3.webp",
    buttonText: "IR AL LOGIN",
    isFinal: true,
  },
];

let currentStepIndex = 0;

export function initOnboarding(router) {
  const titleEl = document.getElementById("onboarding-title");
  const descEl = document.getElementById("onboarding-desc");
  const imgEl = document.getElementById("onboarding-img");
  const btnNext = document.getElementById("btn-next");
  const btnText = document.getElementById("btn-text");
  const btnSkip = document.getElementById("btn-skip");
  const dots = document.querySelectorAll("#indicators-group .dot");

  const finishOnboarding = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    if (!localStorage.getItem("auth_token")) {
      localStorage.setItem("auth_token", "dev-test-token");
      localStorage.setItem("user", JSON.stringify({ name: "Mánager Leyenda", email: "manager@fantasy.com" }));
    }

    if (router && typeof router.navigate === "function") {
      router.navigate("/dashboard");
    } else {
      window.location.hash = "/dashboard";
    }
  };

  const renderStep = (index) => {
    const data = ONBOARDING_STEPS[index];
    if (!data) return;

    // Actualiza textos e imagen
    titleEl.textContent = data.title;
    descEl.textContent = data.description;
    imgEl.src = data.image;
    imgEl.alt = data.title;
    btnText.textContent = data.buttonText;

    // Actualiza estilos del botón en el paso final
    if (data.isFinal) {
      btnNext.classList.add("btn-action--final");
    } else {
      btnNext.classList.remove("btn-action--final");
    }

    // Actualiza dots de progreso
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === index);
      dot.setAttribute("aria-current", idx === index ? "step" : "false");
    });
  };

  // Event Listeners
  btnNext.addEventListener("click", () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      currentStepIndex++;
      renderStep(currentStepIndex);
    } else {
      finishOnboarding(); 
    }
  });

  btnSkip.addEventListener("click", finishOnboarding);

  // Permitir clic directo sobre los dots
  dots.forEach((dot) => {
    dot.addEventListener("click", (e) => {
      currentStepIndex = parseInt(e.target.dataset.step, 10);
      renderStep(currentStepIndex);
    });
  });

  // Render inicial
  renderStep(currentStepIndex);
}
