// --- CONFIGURACIÓN E INICIALIZACIÓN ---
const firebaseConfig = { apiKey: "AIzaSyDNfKVpCw1cf1geCTzfmMSL1-gtVFy9sjs", authDomain: "eventify-70dbc.firebaseapp.com", projectId: "eventify-70dbc", storageBucket: "eventify-70dbc.appspot.com", messagingSenderId: "489645350340", appId: "1:489645350340:web:f1389c69d8498bb5325891" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DEFINICIÓN DE FUNCIONES PRINCIPALES ---
const switchView = (viewName) => {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-view="${viewName}"]`).classList.add('active');
};

const loadTickets = async () => {
    const container = document.getElementById('tickets-container');
    container.innerHTML = 'Cargando fichas de pago...';
    try {
        const snapshot = await db.collection('tickets').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            container.innerHTML = '<p>No se han generado fichas de pago.</p>';
            return;
        }
        container.innerHTML = `<ul class="ticket-list">${snapshot.docs.map(doc => {
            const ticket = doc.data();
            const date = ticket.timestamp.toDate().toLocaleString('es-MX');
            return `<li class="ticket-item">
                <strong>Evento:</strong> ${ticket.eventName} <br>
                <strong>Usuario:</strong> ${ticket.userEmail} <br>
                <strong>Total:</strong> $${ticket.total.toLocaleString()} <br>
                <strong>Fecha:</strong> ${date}
            </li>`;
        }).join('')}</ul>`;
    } catch (error) {
        console.error("Error cargando fichas de pago:", error);
        container.innerHTML = `<p style="color: red;">Error al cargar las fichas. Revisa que el índice de Firestore esté creado y habilitado.</p>`;
    }
};

const handleAddServiceForm = () => {
    const addServiceForm = document.getElementById('add-service-form');
    addServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryOption = document.getElementById('service-category');
        const newService = {
            name: document.getElementById('service-name').value,
            providerName: document.getElementById('service-provider').value,
            basePrice: parseFloat(document.getElementById('service-price').value),
            image: document.getElementById('service-image').value,
            category: categoryOption.value,
            categoryTitle: categoryOption.options[categoryOption.selectedIndex].text,
            pricingModel: document.getElementById('pricing-model').value
        };

        try {
            await db.collection('servicios').add(newService);
            alert("¡Servicio añadido con éxito!");
            addServiceForm.reset();
        } catch (error) {
            console.error("Error añadiendo servicio:", error);
            alert("Error al añadir el servicio. Revisa la consola para más detalles.");
        }
    });
};

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
auth.onAuthStateChanged(async user => {
    if (user) {
        const userDocRef = db.collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            console.log("Acceso de administrador concedido.");
            initializeApp();
        } else {
            alert("Acceso denegado. Esta cuenta no tiene permisos de administrador.");
            auth.signOut();
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html'; // También redirige a index si no hay sesión
    }
});

const initializeApp = () => {
    feather.replace();

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchView(link.dataset.view);
        });
    });

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                // <-- ESTA ES LA LÍNEA CORREGIDA
                window.location.href = 'index.html'; 
            });
        });
    }

    handleAddServiceForm();
    loadTickets();
};