// public/dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  const pedidosContainer = document.getElementById("pedidos-container");
  const searchInput = document.getElementById("search-input");
  const filterButtons = document.querySelectorAll(".filter-btn");
  let todosOsPedidos = [];

  async function fetchPedidos() {
    try {
      const response = await fetch("/api/pedidos");
      if (!response.ok) {
        throw new Error("Erro ao buscar os pedidos.");
      }
      todosOsPedidos = await response.json();
      renderPedidos(todosOsPedidos);
    } catch (error) {
      console.error("Erro:", error);
      pedidosContainer.innerHTML =
        "<p>Não foi possível carregar os pedidos.</p>";
    }
  }

  function renderPedidos(pedidosParaExibir) {
    pedidosContainer.innerHTML = "";
    if (pedidosParaExibir.length === 0) {
      pedidosContainer.innerHTML = "<p>Nenhum pedido encontrado.</p>";
      return;
    }

    pedidosParaExibir.forEach((pedido) => {
      const pedidoElement = document.createElement("div");
      pedidoElement.className = "pedido-item";
      pedidoElement.innerHTML = `
                <div class="pedido-info">
                    <p><strong>Solicitante:</strong> ${pedido.solicitante}</p>
                    <p><strong>Grupo:</strong> ${pedido.grupo}</p>
                    <p><strong>Produtos:</strong> ${pedido.produtos}</p>
                    <p><strong>Data:</strong> ${new Date(
                      pedido.dataPedido
                    ).toLocaleString()}</p>
                </div>
                <div class="pedido-actions">
                    <a href="/uploads/${pedido.grupo}/${
        pedido.comprovantePath
      }" target="_blank" class="download-link">
                        <i class="fas fa-file-alt"></i> Ver Anexo
                    </a>
                </div>
            `;
      pedidosContainer.appendChild(pedidoElement);
    });
  }

  function filtrarPedidos() {
    const searchTerm = searchInput.value.toLowerCase();
    const activeGroup =
      document.querySelector(".filter-btn.active").dataset.group;

    const pedidosFiltrados = todosOsPedidos.filter((pedido) => {
      const matchesName = pedido.solicitante.toLowerCase().includes(searchTerm);
      const matchesGroup =
        activeGroup === "all" || pedido.grupo === activeGroup;
      return matchesName && matchesGroup;
    });

    renderPedidos(pedidosFiltrados);
  }

  searchInput.addEventListener("input", filtrarPedidos);

  filterButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      e.target.classList.add("active");
      filtrarPedidos();
    });
  });

  fetchPedidos();
});
