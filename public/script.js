document.addEventListener("DOMContentLoaded", () => {
  const faqContainer = document.getElementById("faq-container");

  // Função assíncrona para buscar os dados da API
  async function fetchFAQData() {
    try {
      const response = await fetch("/api/faq");
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const faqData = await response.json();
      renderFAQ(faqData);
    } catch (error) {
      console.error("Falha ao buscar os dados do FAQ:", error);
      faqContainer.innerHTML =
        "<p>Não foi possível carregar as perguntas. Tente novamente mais tarde.</p>";
    }
  }

  function renderFAQ(data) {
    let htmlContent = "";
    data.forEach((item) => {
      const answerContent = item.downloadLink
        ? `<a href="${item.downloadLink}" download>Baixar Tabela de Produtos (PDF)</a>`
        : `<p>${item.answer}</p>`;

      htmlContent += `
                <div class="faq-item">
                    <button class="faq-question">
                        ${item.question}
                        <i class="fas fa-chevron-down icon"></i>
                    </button>
                    <div class="faq-answer">
                        ${answerContent}
                    </div>
                </div>
            `;
    });
    faqContainer.innerHTML = htmlContent;
    attachEventListeners();
  }

  function attachEventListeners() {
    const faqQuestions = document.querySelectorAll(".faq-question");
    faqQuestions.forEach((question) => {
      question.addEventListener("click", () => {
        const answer = question.nextElementSibling;
        const isActive = question.classList.contains("active");

        if (isActive) {
          question.classList.remove("active");
          answer.classList.remove("show");
        } else {
          document
            .querySelectorAll(".faq-question.active")
            .forEach((activeQuestion) => {
              activeQuestion.classList.remove("active");
              activeQuestion.nextElementSibling.classList.remove("show");
            });

          question.classList.add("active");
          answer.classList.add("show");
        }
      });
    });
  }

  fetchFAQData();
});
