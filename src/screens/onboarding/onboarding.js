/**
 * @file onboarding.js
 * @description Controlador de Onboarding / Cómo jugar.
 * Gestiona la navegación entre las 3 reglas del juego, actualización de dots e imágenes y transición a Login.
 */

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Presupuesto de 150 millones",
    description: "Tienes un límite salarial estricto de 150 millones de créditos para fichar exactamente a 10 leyendas históricas del fútbol (6 titulares y 4 suplentes). Gasta con inteligencia para equilibrar a tus estrellas con talentos ocultos.",
    image: "/public/images/pantalla_regla1.webp",
    buttonText: "PRÓXIMO",
    isFinal: false,
  },
  {
    step: 2,
    title: "Formaciones tácticas",
    description: "Elige tu configuración con cuidado. Colocar a un jugador fuera de su posición natural provocará una penalización del 15% al 25% en sus atributos durante la simulación del partido.",
    image: "/public/images/pantalla_regla2.webp",
    buttonText: "PRÓXIMO",
    isFinal: false,
  },
  {
    step: 3,
    title: "Demuestra quién es el GOAT",
    description: "Las partidas se simulan matemáticamente usando datos históricos reales. Construye una plantilla estadísticamente dominante, escala en el ranking global y demuestra quién es el mejor de todos los tiempos.",
    image: "/public/images/pantalla_regla3.webp",
    buttonText: "IR AL LOGIN",
    isFinal: true,
  },
];

export function initOnboarding(router) {
  let currentStepIndex = 0;

  const finishOnboarding = () => {
    localStorage.setItem("hasSeenOnboarding", "true");

    const authToken = localStorage.getItem("auth_token") || localStorage.getItem("access_token");
    const targetRoute = authToken ? "/dashboard" : "/login";

    if (router && typeof router.navigate === "function") {
      router.navigate(targetRoute);
    } else {
      window.location.hash = targetRoute;
    }
  };

  const renderStep = (index) => {
    const data = ONBOARDING_STEPS[index];
    if (!data) return;

    const titleEl = document.getElementById("onboarding-title");
    const descEl = document.getElementById("onboarding-desc");
    const imgEl = document.getElementById("onboarding-img");
    const btnText = document.getElementById("btn-text");
    const nextBtn = document.getElementById("btn-next");
    const dots = document.querySelectorAll("#indicators-group .dot");

    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.description;
    if (imgEl) {
      imgEl.onerror = () => {
        if (imgEl.src.includes("/public/images/")) {
          imgEl.src = data.image.replace("/public/images/", "/images/");
        }
      };
      imgEl.src = data.image;
      imgEl.alt = data.title;
    }
    if (btnText) btnText.textContent = data.buttonText;

    if (nextBtn) {
      if (data.isFinal) {
        nextBtn.classList.add("btn-action--final");
      } else {
        nextBtn.classList.remove("btn-action--final");
      }
    }

    dots.forEach((dot, idx) => {
      const isActive = idx === index;
      dot.classList.toggle("active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "page");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    console.debug(`[Onboarding] Mostrando regla ${index + 1}: ${data.title}`);
  };

  const goToNextStep = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      currentStepIndex++;
      renderStep(currentStepIndex);
    } else {
      finishOnboarding();
    }
  };

  // Delegación de eventos en el contenedor principal o body
  const container = document.getElementById("onboarding-container") || document.body;

  const handleContainerClick = (e) => {
    const nextBtn = e.target.closest("#btn-next");
    if (nextBtn) {
      e.preventDefault();
      e.stopPropagation();
      goToNextStep();
      return;
    }

    const skipBtn = e.target.closest("#btn-skip");
    if (skipBtn) {
      e.preventDefault();
      e.stopPropagation();
      finishOnboarding();
      return;
    }

    const dotBtn = e.target.closest("#indicators-group .dot");
    if (dotBtn) {
      e.preventDefault();
      e.stopPropagation();
      const stepIdx = parseInt(dotBtn.dataset.step, 10);
      if (!isNaN(stepIdx) && stepIdx >= 0 && stepIdx < ONBOARDING_STEPS.length) {
        currentStepIndex = stepIdx;
        renderStep(currentStepIndex);
      }
    }
  };

  container.addEventListener("click", handleContainerClick);

  // Render inicial asegurando que empieza en la Regla 1 (Presupuesto de 130 millones)
  renderStep(0);
}
